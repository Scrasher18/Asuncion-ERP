package com.asuncion.erp.dto.lookup;

public record AddressSuggestionDto(
        String displayName,
        String district,
        double latitude,
        double longitude
) {
}
