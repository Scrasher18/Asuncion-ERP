package com.asuncion.erp.dto.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CulqiChargeRequest(
        @NotNull(message = "El ID del pedido es obligatorio")
        Long orderId,

        @NotBlank(message = "El ID del token generado por Culqi es obligatorio")
        String tokenId,

        String email,

        String deviceId
) {
}
