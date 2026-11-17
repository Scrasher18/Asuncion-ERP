package com.asuncion.erp.dto.catalog;

import java.math.BigDecimal;
import java.util.List;

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
        List<ComboComplementItemDto> comboComplements,
        Integer unitsQuota,
        Integer unitsSoldInPromo,
        Boolean active,
        String startDate
) {
    public record ComboComplementItemDto(
            String sku,
            String name,
            BigDecimal price,
            BigDecimal promoPrice,
            Integer discountPercent,
            String imageUrl
    ) {
    }
}
