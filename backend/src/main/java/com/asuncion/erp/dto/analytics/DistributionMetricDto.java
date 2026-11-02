package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record DistributionMetricDto(
        String key,
        String label,
        BigDecimal amount,
        long count,
        double percentage
) {
}
