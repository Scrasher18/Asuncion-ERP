package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.Part;
import com.asuncion.erp.domain.entity.PartPromotionEntity;
import com.asuncion.erp.dto.catalog.PartPromotionDto;
import com.asuncion.erp.exception.BadRequestException;
import com.asuncion.erp.repository.PartPromotionRepository;
import com.asuncion.erp.repository.PartRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Service
public class PromotionCatalogService {

    private static final Logger log = LoggerFactory.getLogger(PromotionCatalogService.class);
    private static final BigDecimal COMBO_COMPLEMENT_FACTOR = new BigDecimal("0.85");
    private static final DateTimeFormatter PE_DATE = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PartPromotionRepository promotionRepository;
    private final PartRepository partRepository;

    private volatile List<PartPromotionDto> activeCache = null;

    public PromotionCatalogService(
            @Lazy PartPromotionRepository promotionRepository,
            @Lazy PartRepository partRepository
    ) {
        this.promotionRepository = promotionRepository;
        this.partRepository = partRepository;
    }

    public void evictCache() {
        this.activeCache = null;
    }

    @Transactional(readOnly = true)
    public List<PartPromotionDto> getActivePromotions() {
        List<PartPromotionDto> snap = this.activeCache;
        if (snap != null) {
            return snap;
        }
        List<PartPromotionDto> loaded = promotionRepository.findByActiveTrueOrderByUpdatedAtDesc().stream()
                .map(this::toDto)
                .toList();
        this.activeCache = loaded;
        return loaded;
    }

    @Transactional
    public PartPromotionDto upsertPromotion(PartPromotionDto req) {
        if (req == null || req.sku() == null || req.sku().isBlank()) {
            throw new BadRequestException("El código SKU del repuesto es obligatorio para activar una oferta.");
        }
        String cleanSku = req.sku().trim().toUpperCase(Locale.ROOT);
        Part mainPart = partRepository.findBySkuIgnoreCase(cleanSku).orElse(null);

        BigDecimal originalPrice = mainPart != null ? mainPart.getSalePrice() : safeMoney(req.originalPrice(), BigDecimal.valueOf(100));
        BigDecimal purchasePrice = mainPart != null ? mainPart.getPurchasePrice() : safeMoney(req.purchasePrice(), originalPrice.multiply(new BigDecimal("0.70")));
        int pct = req.discountPercentage() != null ? Math.max(1, Math.min(80, req.discountPercentage())) : 10;

        BigDecimal calculatedPromo = originalPrice
                .multiply(BigDecimal.valueOf(100 - pct))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);

        if (calculatedPromo.compareTo(purchasePrice) < 0) {
            calculatedPromo = purchasePrice.setScale(2, RoundingMode.HALF_UP);
        }

        String promoType = "COMBO_SUGERIDO".equalsIgnoreCase(req.promoType())
                ? "COMBO_SUGERIDO"
                : "DESCUENTO_DIRECTO";

        String compSku = null;
        String compName = null;
        BigDecimal compRegularPrice = null;
        BigDecimal compPromoPrice = null;
        BigDecimal comboTotal = null;

        if ("COMBO_SUGERIDO".equals(promoType) && req.comboComplementSku() != null && !req.comboComplementSku().isBlank()) {
            compSku = req.comboComplementSku().trim().toUpperCase(Locale.ROOT);
            Part compPart = partRepository.findBySkuIgnoreCase(compSku).orElse(null);
            if (compPart != null) {
                compSku = compPart.getSku();
                compName = compPart.getName();
                compRegularPrice = compPart.getSalePrice();
                BigDecimal rawCompPromo = compRegularPrice.multiply(COMBO_COMPLEMENT_FACTOR).setScale(2, RoundingMode.HALF_UP);
                compPromoPrice = rawCompPromo.compareTo(compPart.getPurchasePrice()) >= 0
                        ? rawCompPromo
                        : compPart.getPurchasePrice().setScale(2, RoundingMode.HALF_UP);
            } else {
                compName = req.comboComplementName() != null ? req.comboComplementName().trim() : compSku;
                compRegularPrice = safeMoney(req.comboComplementPrice(), BigDecimal.valueOf(40));
                compPromoPrice = compRegularPrice.multiply(COMBO_COMPLEMENT_FACTOR).setScale(2, RoundingMode.HALF_UP);
            }
            comboTotal = calculatedPromo.add(compPromoPrice).setScale(2, RoundingMode.HALF_UP);
        }

        PartPromotionEntity entity = promotionRepository.findById(cleanSku).orElseGet(PartPromotionEntity::new);
        entity.setSku(mainPart != null ? mainPart.getSku() : cleanSku);
        entity.setPartId(mainPart != null ? mainPart.getId() : req.partId());
        entity.setPartName(mainPart != null ? mainPart.getName() : (req.partName() != null ? req.partName().trim() : cleanSku));
        entity.setCategoryName(mainPart != null && mainPart.getCategory() != null ? mainPart.getCategory().getName() : req.categoryName());
        entity.setOriginalPrice(originalPrice.setScale(2, RoundingMode.HALF_UP));
        entity.setPurchasePrice(purchasePrice.setScale(2, RoundingMode.HALF_UP));
        entity.setPromoPrice(calculatedPromo);
        entity.setDiscountPercentage(pct);
        entity.setBadgeLabel(req.badgeLabel() != null && !req.badgeLabel().isBlank() ? req.badgeLabel().trim() : "OFERTA FLASH");
        entity.setPromoType(promoType);
        entity.setComboComplementSku(compSku);
        entity.setComboComplementName(compName);
        entity.setComboComplementPrice(compRegularPrice);
        entity.setComboComplementPromoPrice(compPromoPrice);
        entity.setComboTotalPromoPrice(comboTotal);
        entity.setUnitsQuota(req.unitsQuota() != null && req.unitsQuota() > 0 ? req.unitsQuota() : 8);
        entity.setUnitsSoldInPromo(req.unitsSoldInPromo() != null && req.unitsSoldInPromo() >= 0 ? req.unitsSoldInPromo() : 0);
        entity.setActive(req.active() == null || req.active());
        entity.setStartDate(req.startDate() != null && !req.startDate().isBlank()
                ? req.startDate()
                : LocalDate.now(ZoneId.of("America/Lima")).format(PE_DATE));
        entity.setUpdatedAt(Instant.now());

        PartPromotionEntity saved = promotionRepository.save(entity);
        evictCache();
        return toDto(saved);
    }

    @Transactional
    public void removePromotion(String sku) {
        if (sku == null || sku.isBlank()) {
            return;
        }
        promotionRepository.findById(sku.trim().toUpperCase(Locale.ROOT)).ifPresent(entity -> {
            entity.setActive(false);
            entity.setUpdatedAt(Instant.now());
            promotionRepository.save(entity);
        });
        evictCache();
    }

    /**
     * Calcula los precios unitarios efectivos al facturar un pedido considerando:
     * 1) Ofertas directas activas.
     * 2) Combos automotrices activos (cuando el pedido lleva AMBOS repuestos del combo).
     * 3) Tarifa mayorista (4+ unidades), eligiendo siempre el mejor precio a favor del cliente.
     */
    @Transactional
    public Map<Long, BigDecimal> resolveEffectiveUnitPricesAndTrackQuota(
            Map<Long, Part> lockedPartsById,
            Map<Long, Integer> requestedQuantities
    ) {
        Map<Long, BigDecimal> result = new HashMap<>();
        Map<String, Part> orderPartsBySku = new HashMap<>();
        for (Part p : lockedPartsById.values()) {
            BigDecimal std = p.getSalePrice();
            int qty = requestedQuantities.getOrDefault(p.getId(), 1);
            if (qty >= 4 && p.getWholesalePrice() != null && p.getWholesalePrice().compareTo(BigDecimal.ZERO) > 0
                    && p.getWholesalePrice().compareTo(std) < 0) {
                std = p.getWholesalePrice();
            }
            result.put(p.getId(), std);
            if (p.getSku() != null) {
                orderPartsBySku.put(p.getSku().toUpperCase(Locale.ROOT), p);
            }
        }

        List<PartPromotionEntity> activePromos = promotionRepository.findByActiveTrueOrderByUpdatedAtDesc();
        boolean cacheDirty = false;

        for (PartPromotionEntity promo : activePromos) {
            if (!promo.isActive()) continue;
            String mainSku = promo.getSku() != null ? promo.getSku().toUpperCase(Locale.ROOT) : "";
            Part mainPart = orderPartsBySku.get(mainSku);
            if (mainPart == null) continue;

            if ("COMBO_SUGERIDO".equalsIgnoreCase(promo.getPromoType()) && promo.getComboComplementSku() != null) {
                Part compPart = orderPartsBySku.get(promo.getComboComplementSku().toUpperCase(Locale.ROOT));
                if (compPart != null) {
                    BigDecimal currentMain = result.get(mainPart.getId());
                    if (promo.getPromoPrice() != null && promo.getPromoPrice().compareTo(currentMain) < 0) {
                        result.put(mainPart.getId(), promo.getPromoPrice());
                    }
                    BigDecimal compPromo = promo.getComboComplementPromoPrice();
                    if (compPromo != null && compPromo.compareTo(result.get(compPart.getId())) < 0) {
                        result.put(compPart.getId(), compPromo);
                    }
                    int comboPairs = Math.min(
                            requestedQuantities.getOrDefault(mainPart.getId(), 1),
                            requestedQuantities.getOrDefault(compPart.getId(), 1)
                    );
                    incrementSoldQuota(promo, comboPairs);
                    cacheDirty = true;
                }
            } else {
                BigDecimal currentMain = result.get(mainPart.getId());
                if (promo.getPromoPrice() != null && promo.getPromoPrice().compareTo(currentMain) < 0) {
                    result.put(mainPart.getId(), promo.getPromoPrice());
                    incrementSoldQuota(promo, requestedQuantities.getOrDefault(mainPart.getId(), 1));
                    cacheDirty = true;
                }
            }
        }

        if (cacheDirty) {
            evictCache();
        }
        return result;
    }

    private void incrementSoldQuota(PartPromotionEntity promo, int soldUnits) {
        int updatedSold = (promo.getUnitsSoldInPromo() != null ? promo.getUnitsSoldInPromo() : 0) + Math.max(1, soldUnits);
        promo.setUnitsSoldInPromo(updatedSold);
        if (promo.getUnitsQuota() != null && updatedSold >= promo.getUnitsQuota()) {
            promo.setActive(false);
        }
        promo.setUpdatedAt(Instant.now());
        promotionRepository.save(promo);
    }

    @Transactional
    public void seedDefaultPromotionsIfEmpty() {
        try {
            if (promotionRepository.count() > 0) {
                return;
            }
            List<Part> activeParts = partRepository.findAll().stream()
                    .filter(Part::isActive)
                    .filter(p -> p.getStockQuantity() != null && p.getStockQuantity() >= 4)
                    .toList();
            if (activeParts.size() < 4) {
                return;
            }

            Map<String, Part> bySku = new HashMap<>();
            for (Part p : activeParts) {
                if (p.getSku() != null) {
                    bySku.put(p.getSku().toUpperCase(Locale.ROOT), p);
                }
            }

            // 1. Combo Frenos: Pastillas Brembo + Líquido de Frenos DOT 4 Bosch
            seedComboPair(bySku, activeParts, "ASU-FRE-001", "ASU-FRE-004", 10, "OFERTA FLASH");
            // 2. Combo Afinamiento y Motor: Aceite Sintético + Filtro de Aceite Blindado
            seedComboPair(bySku, activeParts, "ASU-FIL-003", "ASU-FIL-001", 12, "PRECIO TALLER");
            // 3. Combo Suspensión / Refrigeración: Amortiguador o Bomba de Agua + Refrigerante
            seedComboPair(bySku, activeParts, "ASU-SUS-001", "ASU-REF-003", 10, "PROMOCIÓN ESPECIAL");

            // 4-6. Ofertas Directas en sistemas clave
            seedDirectOffer(bySku, activeParts, "ASU-TRA-001", 12, "LIQUIDACIÓN DE STOCK");
            seedDirectOffer(bySku, activeParts, "ASU-REF-001", 10, "OFERTA FLASH");
            seedDirectOffer(bySku, activeParts, "ASU-ELE-004", 10, "PRECIO TALLER");

            evictCache();
            log.info("Promociones y combos automotrices iniciales verificados ({} activos).", promotionRepository.count());
        } catch (Exception e) {
            log.warn("Aviso no crítico al inicializar ofertas y combos: {}", e.getMessage());
        }
    }

    private void seedComboPair(
            Map<String, Part> bySku,
            List<Part> pool,
            String preferredMainSku,
            String preferredCompSku,
            int pct,
            String badge
    ) {
        Part main = bySku.get(preferredMainSku);
        Part comp = bySku.get(preferredCompSku);
        if (main == null) {
            main = pool.stream()
                    .filter(p -> !promotionRepository.existsById(p.getSku().toUpperCase(Locale.ROOT)))
                    .filter(p -> p.getSalePrice().compareTo(BigDecimal.valueOf(120)) >= 0)
                    .findFirst()
                    .orElse(null);
        }
        if (comp == null && main != null) {
            final Long mainId = main.getId();
            comp = pool.stream()
                    .filter(p -> !p.getId().equals(mainId))
                    .filter(p -> p.getSalePrice().compareTo(BigDecimal.valueOf(90)) <= 0)
                    .findFirst()
                    .orElse(null);
        }
        if (main == null || comp == null || main.getId().equals(comp.getId())) {
            return;
        }
        if (promotionRepository.existsById(main.getSku().toUpperCase(Locale.ROOT))) {
            return;
        }
        upsertPromotion(new PartPromotionDto(
                main.getSku(),
                main.getId(),
                main.getName(),
                main.getCategory() != null ? main.getCategory().getName() : null,
                main.getSalePrice(),
                main.getPurchasePrice(),
                null,
                pct,
                badge,
                "COMBO_SUGERIDO",
                comp.getSku(),
                comp.getName(),
                comp.getSalePrice(),
                null,
                null,
                Math.min(10, main.getStockQuantity()),
                0,
                true,
                null
        ));
    }

    private void seedDirectOffer(
            Map<String, Part> bySku,
            List<Part> pool,
            String preferredSku,
            int pct,
            String badge
    ) {
        Part main = bySku.get(preferredSku);
        if (main == null || promotionRepository.existsById(main.getSku().toUpperCase(Locale.ROOT))) {
            main = pool.stream()
                    .filter(p -> !promotionRepository.existsById(p.getSku().toUpperCase(Locale.ROOT)))
                    .filter(p -> p.getSalePrice().compareTo(BigDecimal.valueOf(95)) >= 0)
                    .findFirst()
                    .orElse(null);
        }
        if (main == null) {
            return;
        }
        upsertPromotion(new PartPromotionDto(
                main.getSku(),
                main.getId(),
                main.getName(),
                main.getCategory() != null ? main.getCategory().getName() : null,
                main.getSalePrice(),
                main.getPurchasePrice(),
                null,
                pct,
                badge,
                "DESCUENTO_DIRECTO",
                null,
                null,
                null,
                null,
                null,
                Math.min(8, main.getStockQuantity()),
                0,
                true,
                null
        ));
    }

    private static BigDecimal safeMoney(BigDecimal val, BigDecimal fallback) {
        return val != null && val.compareTo(BigDecimal.ZERO) > 0 ? val : fallback;
    }

    private PartPromotionDto toDto(PartPromotionEntity e) {
        return new PartPromotionDto(
                e.getSku(),
                e.getPartId(),
                e.getPartName(),
                e.getCategoryName(),
                e.getOriginalPrice(),
                e.getPurchasePrice(),
                e.getPromoPrice(),
                e.getDiscountPercentage(),
                e.getBadgeLabel(),
                e.getPromoType(),
                e.getComboComplementSku(),
                e.getComboComplementName(),
                e.getComboComplementPrice(),
                e.getComboComplementPromoPrice(),
                e.getComboTotalPromoPrice(),
                e.getUnitsQuota(),
                e.getUnitsSoldInPromo(),
                e.isActive(),
                e.getStartDate()
        );
    }
}
