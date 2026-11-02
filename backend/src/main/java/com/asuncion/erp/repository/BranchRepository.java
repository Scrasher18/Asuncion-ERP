package com.asuncion.erp.repository;

import com.asuncion.erp.domain.entity.Branch;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface BranchRepository extends JpaRepository<Branch, Long> {

    List<Branch> findByActiveTrueOrderByIdAsc();

    Optional<Branch> findByCodeIgnoreCase(String code);

    interface PostgisCoverageProjection {
        Long getBranchId();
        String getBranchName();
        Double getBranchLatitude();
        Double getBranchLongitude();
        Double getAllowedRadiusMeters();
        BigDecimal getBaseDeliveryFee();
        BigDecimal getPerKmFee();
        Double getDistanceMeters();
        Boolean getCovered();
    }

    /**
     * Native PostGIS geospatial validation query over WGS84 spheroid (SRID 4326)
     * leveraging GiST index acceleration via ST_DWithin and exact distance via ST_Distance.
     */
    @Query(value = """
            SELECT
                b.id AS branchId,
                b.name AS branchName,
                ST_Y(CAST(b.location AS geometry)) AS branchLatitude,
                ST_X(CAST(b.location AS geometry)) AS branchLongitude,
                CAST(b.coverage_radius_meters AS DOUBLE PRECISION) AS allowedRadiusMeters,
                b.base_delivery_fee AS baseDeliveryFee,
                b.per_km_fee AS perKmFee,
                ST_Distance(
                    CAST(b.location AS geography),
                    CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)
                ) AS distanceMeters,
                ST_DWithin(
                    CAST(b.location AS geography),
                    CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography),
                    CAST(b.coverage_radius_meters AS DOUBLE PRECISION)
                ) AS covered
            FROM branches b
            WHERE b.active = true
              AND (:branchId IS NULL OR b.id = :branchId)
            ORDER BY covered DESC, distanceMeters ASC
            LIMIT 1
            """, nativeQuery = true)
    Optional<PostgisCoverageProjection> evaluatePostgisCoverage(
            @Param("lat") double latitude,
            @Param("lng") double longitude,
            @Param("branchId") Long branchId
    );
}
