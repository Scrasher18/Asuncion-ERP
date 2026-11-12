package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.Branch;
import com.asuncion.erp.dto.logistics.BranchDto;
import com.asuncion.erp.dto.logistics.BranchUpdateRequest;
import com.asuncion.erp.dto.logistics.CoverageValidationResponse;
import com.asuncion.erp.exception.BadRequestException;
import com.asuncion.erp.exception.ResourceNotFoundException;
import com.asuncion.erp.repository.BranchRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.sql.DataSource;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.sql.Connection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

@Service
public class GeospatialCoverageService {

    private static final Logger log = LoggerFactory.getLogger(GeospatialCoverageService.class);
    /**
     * IUGG WGS84 mean ellipsoidal Earth radius in meters (matches PostGIS spheroid mean radius).
     */
    private static final double WGS84_MEAN_EARTH_RADIUS_METERS = 6371008.8;
    private static final int WGS84_SRID = 4326;

    private final BranchRepository branchRepository;
    private final DataSource dataSource;
    private final GeometryFactory geometryFactory = new GeometryFactory(new PrecisionModel(), WGS84_SRID);
    private final AtomicReference<Boolean> postgisAvailableCache = new AtomicReference<>(null);

    public GeospatialCoverageService(BranchRepository branchRepository, DataSource dataSource) {
        this.branchRepository = branchRepository;
        this.dataSource = dataSource;
    }

    public Point createWgs84Point(double longitude, double latitude) {
        Point point = geometryFactory.createPoint(new Coordinate(longitude, latitude));
        point.setSRID(WGS84_SRID);
        return point;
    }

    @Transactional(readOnly = true)
    public List<BranchDto> getActiveBranches() {
        return branchRepository.findByActiveTrueOrderByIdAsc().stream()
                .map(this::toBranchDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BranchDto> getAllBranches() {
        return branchRepository.findAll().stream()
                .sorted(Comparator.comparing(Branch::getId))
                .map(this::toBranchDto)
                .toList();
    }

    @Transactional
    public BranchDto updateBranch(Long id, BranchUpdateRequest req) {
        validateCoordinates(req.latitude(), req.longitude());
        Branch branch = branchRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Sucursal no encontrada con ID: " + id));

        if (req.code() != null && !req.code().isBlank()) {
            branch.setCode(req.code().trim().toUpperCase());
        }
        branch.setName(req.name().trim());
        branch.setAddress(req.address().trim());
        branch.setPhone(req.phone() != null ? req.phone().trim() : branch.getPhone());
        branch.setLocation(createWgs84Point(req.longitude(), req.latitude()));
        branch.setCoverageRadiusMeters(req.coverageRadiusMeters());
        if (req.baseDeliveryFee() != null) {
            branch.setBaseDeliveryFee(req.baseDeliveryFee().setScale(2, RoundingMode.HALF_UP));
        }
        if (req.perKmFee() != null) {
            branch.setPerKmFee(req.perKmFee().setScale(2, RoundingMode.HALF_UP));
        }
        if (req.active() != null) {
            branch.setActive(req.active());
        }

        Branch saved = branchRepository.save(branch);
        return toBranchDto(saved);
    }

    @Transactional(readOnly = true)
    public CoverageValidationResponse validateCoverage(double customerLatitude, double customerLongitude, Long branchId) {
        validateCoordinates(customerLatitude, customerLongitude);

        if (branchId != null) {
            Branch requested = branchRepository.findById(branchId)
                    .orElseThrow(() -> new ResourceNotFoundException("Sucursal no encontrada con ID: " + branchId));
            if (!requested.isActive()) {
                throw new BadRequestException("La sucursal seleccionada no se encuentra activa para despacho.");
            }
        }

        if (isPostgreSqlEngine()) {
            try {
                Optional<BranchRepository.PostgisCoverageProjection> pgResult =
                        branchRepository.evaluatePostgisCoverage(customerLatitude, customerLongitude, branchId);
                if (pgResult.isPresent()) {
                    return buildFromPostgisProjection(pgResult.get(), customerLatitude, customerLongitude);
                }
            } catch (Exception e) {
                log.warn("Fallback de PostGIS nativo a motor geodésico JTS WGS84: {}", e.getMessage());
            }
        }

        return evaluateWithJtsGeodesic(customerLatitude, customerLongitude, branchId);
    }

    private CoverageValidationResponse buildFromPostgisProjection(
            BranchRepository.PostgisCoverageProjection p,
            double customerLat,
            double customerLng
    ) {
        double distanceMeters = round2(p.getDistanceMeters());
        double allowedRadius = round2(p.getAllowedRadiusMeters());
        boolean covered = Boolean.TRUE.equals(p.getCovered());
        BigDecimal fee = calculateDeliveryFee(p.getBaseDeliveryFee(), p.getPerKmFee(), distanceMeters);
        String msg = buildMessage(covered, p.getBranchName(), distanceMeters, allowedRadius);

        return new CoverageValidationResponse(
                covered,
                p.getBranchId(),
                p.getBranchName(),
                p.getBranchLatitude(),
                p.getBranchLongitude(),
                customerLat,
                customerLng,
                distanceMeters,
                allowedRadius,
                fee,
                "POSTGIS_ST_DWITHIN_GEOGRAPHY",
                msg
        );
    }

    private CoverageValidationResponse evaluateWithJtsGeodesic(double customerLat, double customerLng, Long branchId) {
        List<Branch> candidates = branchId != null
                ? branchRepository.findById(branchId).map(List::of).orElse(List.of())
                : branchRepository.findByActiveTrueOrderByIdAsc();

        if (candidates.isEmpty()) {
            throw new BadRequestException("No existen sucursales activas configuradas para despacho.");
        }

        record EvaluatedBranch(Branch branch, double distanceMeters, boolean covered) {
        }

        EvaluatedBranch best = candidates.stream()
                .map(b -> {
                    double bLat = b.getLocation().getY();
                    double bLng = b.getLocation().getX();
                    double dist = calculateWgs84GeodesicMeters(bLat, bLng, customerLat, customerLng);
                    boolean isCov = dist <= b.getCoverageRadiusMeters();
                    return new EvaluatedBranch(b, dist, isCov);
                })
                .sorted(Comparator
                        .comparing(EvaluatedBranch::covered).reversed()
                        .thenComparingDouble(EvaluatedBranch::distanceMeters))
                .findFirst()
                .orElseThrow();

        Branch b = best.branch();
        double distanceMeters = round2(best.distanceMeters());
        double allowedRadius = round2(b.getCoverageRadiusMeters());
        BigDecimal fee = calculateDeliveryFee(b.getBaseDeliveryFee(), b.getPerKmFee(), distanceMeters);
        String msg = buildMessage(best.covered(), b.getName(), distanceMeters, allowedRadius);

        return new CoverageValidationResponse(
                best.covered(),
                b.getId(),
                b.getName(),
                b.getLocation().getY(),
                b.getLocation().getX(),
                customerLat,
                customerLng,
                distanceMeters,
                allowedRadius,
                fee,
                "JTS_WGS84_GEODESIC_SPATIAL",
                msg
        );
    }

    public double calculateWgs84GeodesicMeters(double lat1, double lon1, double lat2, double lon2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLon = Math.toRadians(lon2 - lon1);
        double rLat1 = Math.toRadians(lat1);
        double rLat2 = Math.toRadians(lat2);

        double sinHalfLat = Math.sin(dLat / 2.0);
        double sinHalfLon = Math.sin(dLon / 2.0);

        double a = sinHalfLat * sinHalfLat
                + Math.cos(rLat1) * Math.cos(rLat2) * sinHalfLon * sinHalfLon;
        double c = 2.0 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0.0, 1.0 - a)));
        return WGS84_MEAN_EARTH_RADIUS_METERS * c;
    }

    private BigDecimal calculateDeliveryFee(BigDecimal baseFee, BigDecimal perKmFee, double distanceMeters) {
        // Tarifa reducida y accesible para despacho local en Lima Este (Santa Anita, Ate, El Agustino, La Molina)
        BigDecimal safeBase = (baseFee != null && baseFee.compareTo(BigDecimal.valueOf(5.00)) <= 0)
                ? baseFee
                : BigDecimal.valueOf(3.50);
        BigDecimal safePerKm = (perKmFee != null && perKmFee.compareTo(BigDecimal.valueOf(1.00)) <= 0)
                ? perKmFee
                : BigDecimal.valueOf(0.80);
        BigDecimal km = BigDecimal.valueOf(distanceMeters / 1000.0);
        return safeBase.add(safePerKm.multiply(km)).setScale(2, RoundingMode.HALF_UP);
    }

    private String buildMessage(boolean covered, String branchName, double distanceMeters, double allowedRadiusMeters) {
        double distKm = round2(distanceMeters / 1000.0);
        double radKm = round2(allowedRadiusMeters / 1000.0);
        if (covered) {
            return String.format(
                    "Dirección dentro de cobertura de %s (%.2f km de %.2f km permitidos).",
                    branchName, distKm, radKm
            );
        }
        return String.format(
                "Dirección fuera del radio de entrega permitido de %s: distancia calculada %.2f km excede el límite de %.2f km.",
                branchName, distKm, radKm
        );
    }

    private void validateCoordinates(Double lat, Double lng) {
        if (lat == null || lng == null || lat < -90.0 || lat > 90.0 || lng < -180.0 || lng > 180.0) {
            throw new BadRequestException("Coordenadas geográficas WGS84 inválidas.");
        }
    }

    private boolean isPostgreSqlEngine() {
        Boolean cached = postgisAvailableCache.get();
        if (cached != null) {
            return cached;
        }
        try (Connection conn = dataSource.getConnection()) {
            String productName = conn.getMetaData().getDatabaseProductName();
            boolean isPg = productName != null && productName.toLowerCase().contains("postgresql");
            postgisAvailableCache.set(isPg);
            return isPg;
        } catch (Exception e) {
            postgisAvailableCache.set(false);
            return false;
        }
    }

    public BranchDto toBranchDto(Branch b) {
        return new BranchDto(
                b.getId(),
                b.getCode(),
                b.getName(),
                b.getAddress(),
                b.getPhone(),
                b.getLocation().getY(),
                b.getLocation().getX(),
                b.getCoverageRadiusMeters(),
                b.getBaseDeliveryFee(),
                b.getPerKmFee(),
                b.isActive()
        );
    }

    private double round2(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }
}
