package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record CategorySalesDto(
        String categoryName,
        BigDecimal totalAmount,
        long unitsSold
) {
}
