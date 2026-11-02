package com.asuncion.erp.dto.autocomplete;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public record VehicleQuickImportRequest(
        @NotBlank(message = "El nombre de la marca vehicular es obligatorio")
        String makeName,

        List<VehicleModelSuggestionDto> models
) {
}
