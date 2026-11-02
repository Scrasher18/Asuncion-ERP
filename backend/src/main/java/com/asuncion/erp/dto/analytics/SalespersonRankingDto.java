package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record SalespersonRankingDto(
        Long salespersonId,
        String fullName,
        String email,
        long closedTransactions,
        BigDecimal totalSalesVolume,
        BigDecimal monthlyQuota,
        double quotaAchievementPercent,
        BigDecimal averageTicket,
        int rankPosition
) {
}
