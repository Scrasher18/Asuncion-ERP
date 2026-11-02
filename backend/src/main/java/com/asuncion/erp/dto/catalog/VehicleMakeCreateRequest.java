package com.asuncion.erp.dto.catalog;

import jakarta.validation.constraints.NotBlank;

public record VehicleMakeCreateRequest(
        @NotBlank(message = "El nombre de la marca vehicular es obligatorio")
        String name
) {
}
