package com.asuncion.erp.dto.order;

import java.math.BigDecimal;

public record OrderItemDto(
        Long id,
        Long partId,
        String partSku,
        String partOemCode,
        String partName,
        String warehouseLocation,
        String primaryImageUrl,
        Integer quantity,
        BigDecimal unitPrice,
        BigDecimal unitCost,
        BigDecimal subtotal,
        boolean picked
) {
}
