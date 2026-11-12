package com.asuncion.erp.dto.catalog;

import java.math.BigDecimal;
import java.util.List;

public record PartResponse(
        Long id,
        String sku,
        String oemCode,
        String name,
        String technicalDescription,
        String manufacturerBrand,
        Long categoryId,
        String categoryName,
        BigDecimal purchasePrice,
        BigDecimal salePrice,
        BigDecimal wholesalePrice,
        Integer stockQuantity,
        Integer reservedQuantity,
        Integer availableStock,
        Integer minStockLevel,
        boolean lowStockAlert,
        String warehouseLocation,
        boolean active,
        String primaryImageUrl,
        List<PartImageDto> images,
        List<PartCompatibilityDto> compatibilities,
        Long totalSold,
        boolean bestSeller
) {
    public PartResponse(
            Long id,
            String sku,
            String oemCode,
            String name,
            String technicalDescription,
            String manufacturerBrand,
            Long categoryId,
            String categoryName,
            BigDecimal purchasePrice,
            BigDecimal salePrice,
            BigDecimal wholesalePrice,
            Integer stockQuantity,
            Integer reservedQuantity,
            Integer availableStock,
            Integer minStockLevel,
            boolean lowStockAlert,
            String warehouseLocation,
            boolean active,
            String primaryImageUrl,
            List<PartImageDto> images,
            List<PartCompatibilityDto> compatibilities
    ) {
        this(
                id, sku, oemCode, name, technicalDescription, manufacturerBrand,
                categoryId, categoryName, purchasePrice, salePrice, wholesalePrice,
                stockQuantity, reservedQuantity, availableStock, minStockLevel, lowStockAlert,
                warehouseLocation, active, primaryImageUrl, images, compatibilities,
                0L, false
        );
    }

    public PartResponse(
            Long id,
            String sku,
            String oemCode,
            String name,
            String technicalDescription,
            String manufacturerBrand,
            Long categoryId,
            String categoryName,
            BigDecimal purchasePrice,
            BigDecimal salePrice,
            BigDecimal wholesalePrice,
            Integer stockQuantity,
            Integer minStockLevel,
            boolean lowStockAlert,
            String warehouseLocation,
            boolean active,
            String primaryImageUrl,
            List<PartImageDto> images,
            List<PartCompatibilityDto> compatibilities
    ) {
        this(
                id, sku, oemCode, name, technicalDescription, manufacturerBrand,
                categoryId, categoryName, purchasePrice, salePrice, wholesalePrice,
                stockQuantity, 0, stockQuantity, minStockLevel, lowStockAlert,
                warehouseLocation, active, primaryImageUrl, images, compatibilities,
                0L, false
        );
    }
}
