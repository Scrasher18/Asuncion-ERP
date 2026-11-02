package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record SalesTimelinePointDto(
        String periodKey,
        String label,
        String subLabel,
        BigDecimal totalSales,
        BigDecimal grossProfit,
        long ordersCount,
        long unitsSold
) {
}
