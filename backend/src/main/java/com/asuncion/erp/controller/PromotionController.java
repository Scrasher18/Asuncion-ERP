package com.asuncion.erp.controller;

import com.asuncion.erp.dto.catalog.PartPromotionDto;
import com.asuncion.erp.service.PromotionCatalogService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class PromotionController {

    private final PromotionCatalogService promotionService;

    public PromotionController(PromotionCatalogService promotionService) {
        this.promotionService = promotionService;
    }

    @GetMapping("/api/v1/catalog/promotions")
    public ResponseEntity<List<PartPromotionDto>> getPublicPromotions() {
        return ResponseEntity.ok(promotionService.getActivePromotions());
    }

    @PostMapping("/api/v1/admin/promotions")
    public ResponseEntity<PartPromotionDto> upsertPromotion(@RequestBody PartPromotionDto request) {
        return ResponseEntity.ok(promotionService.upsertPromotion(request));
    }

    @DeleteMapping("/api/v1/admin/promotions/{sku}")
    public ResponseEntity<Map<String, Object>> deletePromotion(@PathVariable String sku) {
        promotionService.removePromotion(sku);
        return ResponseEntity.ok(Map.of("removed", true, "sku", sku));
    }
}
