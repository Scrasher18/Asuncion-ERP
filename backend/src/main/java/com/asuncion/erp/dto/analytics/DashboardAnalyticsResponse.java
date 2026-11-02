package com.asuncion.erp.dto.analytics;

import java.util.List;

public record DashboardAnalyticsResponse(
        DashboardKpisDto kpis,
        List<SalespersonRankingDto> salespersonRanking,
        List<HighRotationPartDto> highRotationParts,
        List<LowRotationPartDto> lowRotationParts,
        List<CategorySalesDto> salesByCategory,
        List<SalesTimelinePointDto> dailySales,
        List<SalesTimelinePointDto> weeklySales,
        List<SalesTimelinePointDto> monthlySales,
        List<DistributionMetricDto> deliveryMethodDistribution,
        List<DistributionMetricDto> invoiceTypeDistribution,
        List<WeekdaySalesDto> weekdaySales
) {
}
