package com.asuncion.erp.dto.catalog;

import java.math.BigDecimal;

public record PartPromotionDto(
        String sku,
        Long partId,
        String partName,
        String categoryName,
        BigDecimal originalPrice,
        BigDecimal purchasePrice,
        BigDecimal promoPrice,
        Integer discountPercentage,
        String badgeLabel,
        String promoType,
        String comboComplementSku,
        String comboComplementName,
        BigDecimal comboComplementPrice,
        BigDecimal comboComplementPromoPrice,
        BigDecimal comboTotalPromoPrice,
        Integer unitsQuota,
        Integer unitsSoldInPromo,
        Boolean active,
        String startDate
) {
}
