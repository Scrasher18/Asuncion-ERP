package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.dto.autocomplete.VehicleModelSuggestionDto;
import com.asuncion.erp.dto.autocomplete.VehicleQuickImportRequest;
import com.asuncion.erp.dto.catalog.*;
import com.asuncion.erp.exception.BadRequestException;
import com.asuncion.erp.exception.ResourceNotFoundException;
import com.asuncion.erp.repository.*;
import com.asuncion.erp.service.storage.StorageService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.*;

@Service
public class CatalogService {

    private static final Set<String> VALID_VEHICLE_TYPES = Set.of(
            "SEDAN", "HATCHBACK", "SUV", "PICKUP", "VAN", "COMERCIAL", "CROSSOVER"
    );
    private static final long CACHE_TTL_MS = 15_000L;

    private record CachedPartEntry(
            PartResponse baseResponse,
            boolean universalFitment,
            String haystack,
            String compactHaystack
    ) {
        PartResponse withLiveReservations(int reservedQty) {
            int physical = baseResponse.stockQuantity() != null ? baseResponse.stockQuantity() : 0;
            int avail = Math.max(0, physical - reservedQty);
            boolean low = physical <= (baseResponse.minStockLevel() != null ? baseResponse.minStockLevel() : 5);
            return new PartResponse(
                    baseResponse.id(),
                    baseResponse.sku(),
                    baseResponse.oemCode(),
                    baseResponse.name(),
                    baseResponse.technicalDescription(),
                    baseResponse.manufacturerBrand(),
                    baseResponse.categoryId(),
                    baseResponse.categoryName(),
                    baseResponse.purchasePrice(),
                    baseResponse.salePrice(),
                    baseResponse.wholesalePrice(),
                    physical,
                    reservedQty,
                    avail,
                    baseResponse.minStockLevel(),
                    low,
                    baseResponse.warehouseLocation(),
                    baseResponse.active(),
                    baseResponse.primaryImageUrl(),
                    baseResponse.images(),
                    baseResponse.compatibilities()
            );
        }
    }

    private record CatalogCacheSnapshot(
            long loadedAtMs,
            List<CategoryDto> categories,
            List<VehicleMakeDto> makes,
            List<VehicleModelDto> allModels,
            List<CachedPartEntry> allParts
    ) {
    }

    private volatile CatalogCacheSnapshot catalogCache = null;

    private final CategoryRepository categoryRepository;
    private final ManufacturerBrandRepository manufacturerBrandRepository;
    private final VehicleMakeRepository vehicleMakeRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final PartRepository partRepository;
    private final PartImageRepository partImageRepository;
    private final ImageOptimizationService imageOptimizationService;
    private final StorageService storageService;
    private final StockReservationService stockReservationService;

    public CatalogService(
            CategoryRepository categoryRepository,
            ManufacturerBrandRepository manufacturerBrandRepository,
            VehicleMakeRepository vehicleMakeRepository,
            VehicleModelRepository vehicleModelRepository,
            PartRepository partRepository,
            PartImageRepository partImageRepository,
            ImageOptimizationService imageOptimizationService,
            StorageService storageService,
            StockReservationService stockReservationService
    ) {
        this.categoryRepository = categoryRepository;
        this.manufacturerBrandRepository = manufacturerBrandRepository;
        this.vehicleMakeRepository = vehicleMakeRepository;
        this.vehicleModelRepository = vehicleModelRepository;
        this.partRepository = partRepository;
        this.partImageRepository = partImageRepository;
        this.imageOptimizationService = imageOptimizationService;
        this.storageService = storageService;
        this.stockReservationService = stockReservationService;
    }

    public void evictCatalogCache() {
        this.catalogCache = null;
    }

    private CatalogCacheSnapshot getOrLoadSnapshot() {
        CatalogCacheSnapshot snap = this.catalogCache;
        long now = System.currentTimeMillis();
        if (snap != null && (now - snap.loadedAtMs()) < CACHE_TTL_MS) {
            return snap;
        }
        synchronized (this) {
            snap = this.catalogCache;
            if (snap != null && (System.currentTimeMillis() - snap.loadedAtMs()) < CACHE_TTL_MS) {
                return snap;
            }
            List<CategoryDto> cats = categoryRepository.findByActiveTrueOrderByIdAsc().stream()
                    .map(c -> new CategoryDto(c.getId(), c.getCode(), c.getName(), c.getDescription()))
                    .toList();
            List<VehicleMakeDto> makes = vehicleMakeRepository.findAllByOrderByNameAsc().stream()
                    .map(m -> new VehicleMakeDto(m.getId(), m.getName()))
                    .toList();
            List<VehicleModelDto> models = vehicleModelRepository.findAllByOrderByMakeNameAscNameAsc().stream()
                    .map(this::toVehicleModelDto)
                    .toList();

            List<Part> parts = partRepository.findAllWithImagesOrderByIdAsc();
            if (!parts.isEmpty()) {
                partRepository.hydrateCompatibilities(parts);
            }

            List<CachedPartEntry> cachedParts = parts.stream()
                    .map(this::buildCachedPartEntry)
                    .toList();

            CatalogCacheSnapshot fresh = new CatalogCacheSnapshot(
                    System.currentTimeMillis(),
                    cats,
                    makes,
                    models,
                    cachedParts
            );
            this.catalogCache = fresh;
            return fresh;
        }
    }

    private CachedPartEntry buildCachedPartEntry(Part part) {
        PartResponse base = toPartResponseWithReserved(part, 0);
        boolean universal = base.compatibilities().isEmpty()
                && base.categoryName() != null
                && base.categoryName().toLowerCase().contains("accesorio");

        StringBuilder searchable = new StringBuilder();
        if (base.sku() != null) searchable.append(base.sku()).append(' ');
        if (base.oemCode() != null && !base.oemCode().isBlank()) searchable.append(base.oemCode()).append(' ');
        searchable.append(base.name()).append(' ')
                .append(base.manufacturerBrand()).append(' ')
                .append(base.categoryName()).append(' ');
        if (base.technicalDescription() != null) {
            searchable.append(base.technicalDescription()).append(' ');
        }
        for (PartCompatibilityDto c : base.compatibilities()) {
            searchable.append(c.makeName()).append(' ')
                    .append(c.modelName()).append(' ')
                    .append(c.yearStart()).append('-').append(c.yearEnd()).append(' ');
            if (c.engineSpec() != null) {
                searchable.append(c.engineSpec()).append(' ');
            }
        }
        String haystack = normalizeText(searchable.toString());
        String compactHaystack = haystack.replace("-", "").replace(" ", "");
        return new CachedPartEntry(base, universal, haystack, compactHaystack);
    }

    @Transactional(readOnly = true)
    public List<CategoryDto> getCategories() {
        return getOrLoadSnapshot().categories();
    }

    @Transactional(readOnly = true)
    public List<VehicleMakeDto> getVehicleMakes() {
        return getOrLoadSnapshot().makes();
    }

    @Transactional(readOnly = true)
    public List<VehicleModelDto> getVehicleModels(Long makeId) {
        List<VehicleModelDto> all = getOrLoadSnapshot().allModels();
        if (makeId == null) {
            return all;
        }
        return all.stream()
                .filter(m -> makeId.equals(m.makeId()))
                .toList();
    }

    @Transactional
    public VehicleMakeDto createVehicleMake(VehicleMakeCreateRequest request) {
        String name = request.name().trim();
        VehicleMake make = vehicleMakeRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> vehicleMakeRepository.save(new VehicleMake(name)));
        evictCatalogCache();
        return new VehicleMakeDto(make.getId(), make.getName());
    }

    @Transactional
    public VehicleModelDto createVehicleModel(VehicleModelCreateRequest request) {
        VehicleMake make = vehicleMakeRepository.findById(request.makeId())
                .orElseThrow(() -> new ResourceNotFoundException("Marca vehicular no encontrada con ID: " + request.makeId()));
        String modelName = request.name().trim();
        String normalizedType = normalizeVehicleType(request.vehicleType());

        VehicleModel model = vehicleModelRepository.findByMakeIdAndNameIgnoreCase(make.getId(), modelName)
                .orElseGet(() -> vehicleModelRepository.save(new VehicleModel(make, modelName, normalizedType)));
        evictCatalogCache();
        return toVehicleModelDto(model);
    }

    @Transactional
    public List<VehicleModelDto> quickImportVehicles(VehicleQuickImportRequest request) {
        String makeName = request.makeName().trim();
        VehicleMake make = vehicleMakeRepository.findByNameIgnoreCase(makeName)
                .orElseGet(() -> vehicleMakeRepository.save(new VehicleMake(makeName)));

        if (request.models() != null) {
            for (VehicleModelSuggestionDto m : request.models()) {
                if (m == null || m.name() == null || m.name().isBlank()) {
                    continue;
                }
                String modelName = m.name().trim();
                String normalizedType = normalizeVehicleType(m.vehicleType());
                vehicleModelRepository.findByMakeIdAndNameIgnoreCase(make.getId(), modelName)
                        .orElseGet(() -> vehicleModelRepository.save(new VehicleModel(make, modelName, normalizedType)));
            }
        }
        evictCatalogCache();

        return vehicleModelRepository.findByMakeIdOrderByNameAsc(make.getId()).stream()
                .map(this::toVehicleModelDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PartResponse> searchPublicParts(
            String q,
            Long categoryId,
            Long makeId,
            Long modelId,
            Integer year,
            Boolean onlyInStock
    ) {
        CatalogCacheSnapshot snap = getOrLoadSnapshot();
        Map<Long, Integer> reservedMap = stockReservationService.getAllReservedQuantities();
        List<String> queryTokens = tokenizeNormalized(q);

        return snap.allParts().stream()
                .filter(entry -> entry.baseResponse().active())
                .filter(entry -> categoryId == null || categoryId.equals(entry.baseResponse().categoryId()))
                .filter(entry -> {
                    if (!Boolean.TRUE.equals(onlyInStock)) return true;
                    int reserved = reservedMap.getOrDefault(entry.baseResponse().id(), 0);
                    int avail = Math.max(0, (entry.baseResponse().stockQuantity() != null ? entry.baseResponse().stockQuantity() : 0) - reserved);
                    return avail > 0;
                })
                .filter(entry -> matchesCachedFitment(entry, makeId, modelId, year))
                .filter(entry -> matchesCachedSearchTokens(entry, queryTokens))
                .map(entry -> entry.withLiveReservations(reservedMap.getOrDefault(entry.baseResponse().id(), 0)))
                .toList();
    }

    @Transactional(readOnly = true)
    public PartResponse getPublicPartById(Long id) {
        CatalogCacheSnapshot snap = getOrLoadSnapshot();
        for (CachedPartEntry entry : snap.allParts()) {
            if (id.equals(entry.baseResponse().id())) {
                int reserved = stockReservationService.getReservedQuantity(id);
                return entry.withLiveReservations(reserved);
            }
        }
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + id));
        return toPartResponse(part);
    }

    @Transactional(readOnly = true)
    public List<PartResponse> getAdminParts(Boolean lowStockOnly) {
        CatalogCacheSnapshot snap = getOrLoadSnapshot();
        Map<Long, Integer> reservedMap = stockReservationService.getAllReservedQuantities();
        return snap.allParts().stream()
                .map(entry -> entry.withLiveReservations(reservedMap.getOrDefault(entry.baseResponse().id(), 0)))
                .filter(part -> !Boolean.TRUE.equals(lowStockOnly) || part.lowStockAlert())
                .toList();
    }

    @Transactional
    public PartResponse createPart(PartUpsertRequest req) {
        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada con ID: " + req.categoryId()));

        String cleanSku;
        if (req.sku() == null || req.sku().isBlank()) {
            cleanSku = generateNextSku(category);
        } else {
            cleanSku = req.sku().trim().toUpperCase();
            if (partRepository.existsBySkuIgnoreCase(cleanSku)) {
                throw new BadRequestException("Ya existe un repuesto registrado con el código SKU: " + cleanSku);
            }
        }

        Part part = new Part();
        applyUpsertFields(part, req, cleanSku, category);
        Part saved = partRepository.save(part);

        if (req.compatibilities() != null && !req.compatibilities().isEmpty()) {
            attachCompatibilities(saved, req.compatibilities());
            saved = partRepository.save(saved);
        }
        evictCatalogCache();
        return toPartResponse(saved);
    }

    @Transactional
    public PartResponse updatePart(Long id, PartUpsertRequest req) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + id));

        Category category = categoryRepository.findById(req.categoryId())
                .orElseThrow(() -> new ResourceNotFoundException("Categoría no encontrada con ID: " + req.categoryId()));

        String cleanSku;
        if (req.sku() == null || req.sku().isBlank()) {
            cleanSku = part.getSku();
        } else {
            cleanSku = req.sku().trim().toUpperCase();
            partRepository.findBySkuIgnoreCase(cleanSku).ifPresent(existing -> {
                if (!existing.getId().equals(id)) {
                    throw new BadRequestException("El código SKU " + cleanSku + " ya pertenece a otro repuesto.");
                }
            });
        }

        applyUpsertFields(part, req, cleanSku, category);

        // Clear and flush before re-adding compatibilities to respect unique constraint
        part.getCompatibilities().clear();
        partRepository.saveAndFlush(part);

        if (req.compatibilities() != null && !req.compatibilities().isEmpty()) {
            attachCompatibilities(part, req.compatibilities());
        }

        Part saved = partRepository.save(part);
        stockReservationService.reconcileHoldsForPart(saved.getId(), saved.getStockQuantity() != null ? saved.getStockQuantity() : 0);
        evictCatalogCache();
        return toPartResponse(saved);
    }

    @Transactional
    public void deactivatePart(Long id) {
        Part part = partRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + id));
        part.setActive(false);
        partRepository.save(part);
        evictCatalogCache();
    }

    @Transactional
    public PartResponse uploadPartImages(Long partId, List<MultipartFile> files, Integer primaryIndex) {
        if (files == null || files.isEmpty() || files.stream().allMatch(MultipartFile::isEmpty)) {
            throw new BadRequestException("Debe adjuntar al menos un archivo de imagen.");
        }

        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + partId));

        boolean hadPrimary = part.getImages().stream().anyMatch(PartImage::isPrimary);
        boolean shouldOverridePrimary = primaryIndex != null || !hadPrimary;

        if (shouldOverridePrimary && hadPrimary) {
            part.getImages().forEach(img -> img.setPrimary(false));
            partRepository.saveAndFlush(part);
        }

        int nextOrder = part.getImages().stream()
                .mapToInt(img -> img.getDisplayOrder() != null ? img.getDisplayOrder() : 0)
                .max()
                .orElse(-1) + 1;

        List<MultipartFile> validFiles = files.stream().filter(f -> !f.isEmpty()).toList();
        int effectivePrimaryIdx = primaryIndex != null && primaryIndex >= 0 && primaryIndex < validFiles.size()
                ? primaryIndex
                : 0;

        for (int i = 0; i < validFiles.size(); i++) {
            MultipartFile file = validFiles.get(i);
            try {
                ImageOptimizationService.OptimizedImage optimized = imageOptimizationService.optimize(file.getInputStream());
                StorageService.StoredObject stored = storageService.store(
                        "parts",
                        part.getSku().toLowerCase(),
                        optimized.bytes(),
                        optimized.mimeType(),
                        optimized.extension()
                );

                PartImage img = new PartImage();
                img.setPart(part);
                img.setObjectKey(stored.objectKey());
                img.setImageUrl(stored.publicUrl());
                img.setMimeType(stored.mimeType());
                img.setFileSizeBytes(stored.sizeBytes());
                img.setDisplayOrder(nextOrder + i);
                img.setPrimary(shouldOverridePrimary && i == effectivePrimaryIdx);
                part.getImages().add(img);
            } catch (IOException e) {
                throw new BadRequestException("Error leyendo imagen subida: " + e.getMessage());
            }
        }

        Part saved = partRepository.saveAndFlush(part);
        evictCatalogCache();
        return toPartResponse(saved);
    }

    @Transactional
    public PartResponse setPrimaryImage(Long partId, Long imageId) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + partId));

        boolean exists = part.getImages().stream().anyMatch(img -> img.getId().equals(imageId));
        if (!exists) {
            throw new ResourceNotFoundException("Imagen ID " + imageId + " no pertenece al repuesto ID " + partId);
        }

        // Clear primary first and flush to satisfy partial unique index (WHERE is_primary = TRUE)
        part.getImages().forEach(img -> img.setPrimary(false));
        partRepository.saveAndFlush(part);

        part.getImages().forEach(img -> {
            if (img.getId().equals(imageId)) {
                img.setPrimary(true);
            }
        });
        Part saved = partRepository.saveAndFlush(part);
        evictCatalogCache();
        return toPartResponse(saved);
    }

    @Transactional
    public PartResponse deletePartImage(Long partId, Long imageId) {
        Part part = partRepository.findById(partId)
                .orElseThrow(() -> new ResourceNotFoundException("Repuesto no encontrado con ID: " + partId));

        PartImage target = partImageRepository.findByIdAndPartId(imageId, partId)
                .orElseThrow(() -> new ResourceNotFoundException("Imagen no encontrada con ID: " + imageId));

        boolean wasPrimary = target.isPrimary();
        String objectKey = target.getObjectKey();

        part.getImages().removeIf(img -> img.getId().equals(imageId));
        partRepository.saveAndFlush(part);
        storageService.delete(objectKey);

        if (wasPrimary && !part.getImages().isEmpty()) {
            part.getImages().stream()
                    .min(Comparator.comparingInt(img -> img.getDisplayOrder() != null ? img.getDisplayOrder() : 0))
                    .ifPresent(first -> first.setPrimary(true));
            part = partRepository.saveAndFlush(part);
        }
        evictCatalogCache();

        return toPartResponse(part);
    }

    public PartResponse toPartResponse(Part part) {
        int reservedQty = stockReservationService.getReservedQuantity(part.getId());
        return toPartResponseWithReserved(part, reservedQty);
    }

    private PartResponse toPartResponseWithReserved(Part part, int reservedQty) {
        List<PartImageDto> imageDtos = part.getImages().stream()
                .sorted(Comparator
                        .comparingInt((PartImage img) -> img.getDisplayOrder() != null ? img.getDisplayOrder() : 0)
                        .thenComparing(img -> img.getId() != null ? img.getId() : 0L))
                .map(img -> new PartImageDto(
                        img.getId(),
                        img.getImageUrl(),
                        img.getObjectKey(),
                        img.getMimeType(),
                        img.getFileSizeBytes(),
                        img.isPrimary(),
                        img.getDisplayOrder()
                ))
                .toList();

        String primaryUrl = imageDtos.stream()
                .filter(PartImageDto::isPrimary)
                .map(PartImageDto::imageUrl)
                .findFirst()
                .orElseGet(() -> imageDtos.isEmpty() ? null : imageDtos.get(0).imageUrl());

        List<PartCompatibilityDto> compatDtos = part.getCompatibilities().stream()
                .map(c -> new PartCompatibilityDto(
                        c.getId(),
                        c.getVehicleModel().getMake().getId(),
                        c.getVehicleModel().getMake().getName(),
                        c.getVehicleModel().getId(),
                        c.getVehicleModel().getName(),
                        c.getYearStart(),
                        c.getYearEnd(),
                        c.getEngineSpec(),
                        c.getNotes()
                ))
                .toList();

        int physicalStock = part.getStockQuantity() != null ? part.getStockQuantity() : 0;
        int availableStock = Math.max(0, physicalStock - reservedQty);
        boolean lowStock = physicalStock <= part.getMinStockLevel();

        return new PartResponse(
                part.getId(),
                part.getSku(),
                part.getOemCode(),
                part.getName(),
                part.getTechnicalDescription(),
                part.getManufacturerBrand().getName(),
                part.getCategory().getId(),
                part.getCategory().getName(),
                part.getPurchasePrice(),
                part.getSalePrice(),
                part.getWholesalePrice(),
                physicalStock,
                reservedQty,
                availableStock,
                part.getMinStockLevel(),
                lowStock,
                part.getWarehouseLocation(),
                part.isActive(),
                primaryUrl,
                imageDtos,
                compatDtos
        );
    }

    public String extractPrimaryImageUrl(Part part) {
        if (part.getImages() == null || part.getImages().isEmpty()) {
            return null;
        }
        return part.getImages().stream()
                .filter(PartImage::isPrimary)
                .map(PartImage::getImageUrl)
                .findFirst()
                .orElse(part.getImages().get(0).getImageUrl());
    }

    private synchronized String generateNextSku(Category category) {
        String rawCode = category != null && category.getCode() != null ? category.getCode().toUpperCase() : "GEN";
        String stripped = rawCode.replaceFirst("^CAT[-_]", "").replaceAll("[^A-Z0-9]", "");
        if (stripped.isEmpty()) {
            stripped = "GEN";
        }
        String cat3 = stripped.length() >= 3
                ? stripped.substring(0, 3)
                : String.format("%-3s", stripped).replace(' ', 'X');

        int seq = 1;
        while (true) {
            String candidate = String.format("ASU-%s-%04d", cat3, seq);
            if (!partRepository.existsBySkuIgnoreCase(candidate)) {
                return candidate;
            }
            seq++;
        }
    }

    private void applyUpsertFields(Part part, PartUpsertRequest req, String cleanSku, Category category) {
        if (req.salePrice().compareTo(req.purchasePrice()) < 0) {
            throw new BadRequestException("El precio de venta no puede ser menor al precio de compra.");
        }

        String brandName = req.manufacturerBrand().trim();
        ManufacturerBrand brand = manufacturerBrandRepository.findByNameIgnoreCase(brandName)
                .orElseGet(() -> manufacturerBrandRepository.save(new ManufacturerBrand(brandName, null)));

        BigDecimal wholesale = req.wholesalePrice() != null
                ? req.wholesalePrice()
                : req.salePrice().multiply(BigDecimal.valueOf(0.90)).setScale(2, RoundingMode.HALF_UP);

        String cleanOem = (req.oemCode() != null && !req.oemCode().isBlank())
                ? req.oemCode().trim().toUpperCase()
                : null;
        String cleanWarehouse = (req.warehouseLocation() != null && !req.warehouseLocation().isBlank())
                ? req.warehouseLocation().trim().toUpperCase()
                : null;

        part.setSku(cleanSku);
        part.setOemCode(cleanOem);
        part.setName(req.name().trim());
        part.setTechnicalDescription(req.technicalDescription() != null && !req.technicalDescription().isBlank()
                ? req.technicalDescription().trim()
                : null);
        part.setCategory(category);
        part.setManufacturerBrand(brand);
        part.setPurchasePrice(req.purchasePrice().setScale(2, RoundingMode.HALF_UP));
        part.setSalePrice(req.salePrice().setScale(2, RoundingMode.HALF_UP));
        part.setWholesalePrice(wholesale.setScale(2, RoundingMode.HALF_UP));
        part.setStockQuantity(req.stockQuantity());
        part.setMinStockLevel(req.minStockLevel() != null ? req.minStockLevel() : 5);
        part.setWarehouseLocation(cleanWarehouse);
        part.setActive(req.active() == null || req.active());
    }

    private void attachCompatibilities(Part part, List<PartCompatibilityRequest> requests) {
        Set<String> seenKeys = new HashSet<>();
        for (PartCompatibilityRequest cr : requests) {
            if (cr.yearEnd() < cr.yearStart()) {
                throw new BadRequestException("El año final (" + cr.yearEnd() + ") no puede ser menor al año inicial (" + cr.yearStart() + ").");
            }
            VehicleModel model = vehicleModelRepository.findById(cr.modelId())
                    .orElseThrow(() -> new ResourceNotFoundException("Modelo vehicular no encontrado con ID: " + cr.modelId()));

            String engine = cr.engineSpec() != null ? cr.engineSpec().trim() : "";
            String dedupKey = model.getId() + "|" + cr.yearStart() + "|" + cr.yearEnd() + "|" + engine.toLowerCase();
            if (!seenKeys.add(dedupKey)) {
                continue;
            }

            PartCompatibility pc = new PartCompatibility();
            pc.setPart(part);
            pc.setVehicleModel(model);
            pc.setYearStart(cr.yearStart());
            pc.setYearEnd(cr.yearEnd());
            pc.setEngineSpec(engine.isEmpty() ? null : engine);
            pc.setNotes(cr.notes() != null && !cr.notes().isBlank() ? cr.notes().trim() : null);
            part.getCompatibilities().add(pc);
        }
    }

    private boolean matchesCachedFitment(CachedPartEntry entry, Long makeId, Long modelId, Integer year) {
        if (makeId == null && modelId == null && year == null) {
            return true;
        }
        List<PartCompatibilityDto> comps = entry.baseResponse().compatibilities();
        if (comps == null || comps.isEmpty()) {
            return false;
        }
        return comps.stream().anyMatch(c -> {
            boolean makeOk = makeId == null || makeId.equals(c.makeId());
            boolean modelOk = modelId == null || modelId.equals(c.modelId());
            boolean yearOk = year == null || (c.yearStart() <= year && c.yearEnd() >= year);
            return makeOk && modelOk && yearOk;
        });
    }

    private boolean matchesCachedSearchTokens(CachedPartEntry entry, List<String> tokens) {
        if (tokens.isEmpty()) {
            return true;
        }
        return tokens.stream().allMatch(token -> {
            if (entry.haystack().contains(token)) {
                return true;
            }
            String compactToken = token.replace("-", "").replace(" ", "");
            return !compactToken.isBlank() && entry.compactHaystack().contains(compactToken);
        });
    }

    private VehicleModelDto toVehicleModelDto(VehicleModel m) {
        return new VehicleModelDto(
                m.getId(),
                m.getMake().getId(),
                m.getMake().getName(),
                m.getName(),
                m.getVehicleType()
        );
    }

    private String normalizeVehicleType(String raw) {
        if (raw == null || raw.isBlank()) {
            return "SEDAN";
        }
        String clean = normalizeText(raw).toUpperCase().replace("-", "").replace(" ", "");
        if (VALID_VEHICLE_TYPES.contains(clean)) {
            return clean;
        }
        if (clean.contains("PICK")) return "PICKUP";
        if (clean.contains("CAMION") || clean.contains("TRACTO") || clean.contains("FURGON") || clean.contains("COMERC")) return "COMERCIAL";
        if (clean.contains("SUV") || clean.contains("4X4")) return "SUV";
        if (clean.contains("HATCH")) return "HATCHBACK";
        if (clean.contains("VAN") || clean.contains("MINIVAN")) return "VAN";
        if (clean.contains("CROSS")) return "CROSSOVER";
        return "SEDAN";
    }

    public static String normalizeText(String input) {
        if (input == null) {
            return "";
        }
        String nfd = Normalizer.normalize(input, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{InCombiningDiacriticalMarks}+", "").toLowerCase();
    }

    private List<String> tokenizeNormalized(String q) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        return Arrays.stream(normalizeText(q).split("\\s+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }
}
