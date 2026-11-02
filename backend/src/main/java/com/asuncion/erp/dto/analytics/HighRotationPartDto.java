package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record HighRotationPartDto(
        Long partId,
        String sku,
        String oemCode,
        String name,
        String categoryName,
        long unitsSold,
        BigDecimal revenueGenerated,
        int currentStock,
        int minStockLevel,
        double turnoverRatio
) {
}
