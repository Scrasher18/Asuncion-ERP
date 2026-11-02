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
        Integer minStockLevel,
        boolean lowStockAlert,
        String warehouseLocation,
        boolean active,
        String primaryImageUrl,
        List<PartImageDto> images,
        List<PartCompatibilityDto> compatibilities
) {
}
