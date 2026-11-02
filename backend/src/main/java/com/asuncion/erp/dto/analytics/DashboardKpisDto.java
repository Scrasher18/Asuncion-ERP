package com.asuncion.erp.dto.analytics;

import java.math.BigDecimal;

public record DashboardKpisDto(
        BigDecimal totalRevenue,
        BigDecimal grossProfit,
        long totalOrders,
        BigDecimal averageTicket,
        long deliveredOrders,
        long inTransitOrders,
        long pendingWarehouseOrders,
        long lowStockPartsCount,
        BigDecimal totalInventoryValue
) {
}
