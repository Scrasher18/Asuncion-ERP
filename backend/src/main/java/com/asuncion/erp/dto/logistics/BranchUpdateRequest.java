package com.asuncion.erp.dto.logistics;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record BranchUpdateRequest(
        String code,

        @NotBlank(message = "El nombre de la sucursal es obligatorio")
        String name,

        @NotBlank(message = "La dirección es obligatoria")
        String address,

        String phone,

        @NotNull(message = "La latitud es obligatoria")
        Double latitude,

        @NotNull(message = "La longitud es obligatoria")
        Double longitude,

        @NotNull(message = "El radio de cobertura en metros es obligatorio")
        @Positive(message = "El radio de cobertura debe ser mayor a 0")
        Double coverageRadiusMeters,

        @DecimalMin(value = "0.0", inclusive = true)
        BigDecimal baseDeliveryFee,

        @DecimalMin(value = "0.0", inclusive = true)
        BigDecimal perKmFee,

        Boolean active
) {
}
