package com.asuncion.erp.dto.catalog;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VehicleModelCreateRequest(
        @NotNull(message = "El ID de la marca vehicular es obligatorio")
        Long makeId,

        @NotBlank(message = "El nombre del modelo vehicular es obligatorio")
        String name,

        String vehicleType
) {
}
