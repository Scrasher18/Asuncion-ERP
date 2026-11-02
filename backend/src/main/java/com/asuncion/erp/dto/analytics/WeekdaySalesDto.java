package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record WeekdaySalesDto(
        int dayOfWeek,
        String dayName,
        BigDecimal totalAmount,
        long ordersCount,
        double sharePercent
) {
}
