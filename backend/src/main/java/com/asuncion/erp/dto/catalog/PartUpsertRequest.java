package com.asuncion.erp.dto.catalog;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.util.List;

public record PartUpsertRequest(
        String sku,

        String oemCode,

        @NotBlank(message = "El nombre del repuesto es obligatorio")
        String name,

        String technicalDescription,

        @NotBlank(message = "La marca del fabricante es obligatoria")
        String manufacturerBrand,

        @NotNull(message = "La categoría es obligatoria")
        Long categoryId,

        @NotNull(message = "El precio de compra es obligatorio")
        @DecimalMin(value = "0.0", inclusive = true)
        BigDecimal purchasePrice,

        @NotNull(message = "El precio de venta es obligatorio")
        @DecimalMin(value = "0.0", inclusive = true)
        BigDecimal salePrice,

        BigDecimal wholesalePrice,

        @NotNull(message = "El stock es obligatorio")
        @Min(0)
        Integer stockQuantity,

        @Min(0)
        Integer minStockLevel,

        String warehouseLocation,

        Boolean active,

        @Valid
        List<PartCompatibilityRequest> compatibilities
) {
}
