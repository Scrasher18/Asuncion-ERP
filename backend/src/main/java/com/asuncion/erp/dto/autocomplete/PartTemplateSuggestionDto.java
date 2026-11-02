package com.asuncion.erp.dto.autocomplete;

import java.math.BigDecimal;
import java.util.List;

public record PartTemplateSuggestionDto(
        String name,
        String manufacturerBrand,
        String categoryCode,
        String oemCode,
        String technicalDescription,
        BigDecimal suggestedPurchasePrice,
        BigDecimal suggestedSalePrice,
        BigDecimal suggestedWholesalePrice,
        List<String> commonVehicles
) {
}
