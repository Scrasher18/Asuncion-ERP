package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record LowRotationPartDto(
        Long partId,
        String sku,
        String oemCode,
        String name,
        String categoryName,
        long unitsSold,
        int currentStock,
        BigDecimal immobilizedCapital,
        long daysSinceLastSale,
        String rotationStatus
) {
}
