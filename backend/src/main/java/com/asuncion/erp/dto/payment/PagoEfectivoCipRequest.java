package com.asuncion.erp.dto.payment;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record PagoEfectivoCipRequest(
        @NotNull(message = "El ID del pedido es obligatorio")
        @Positive(message = "El ID del pedido debe ser positivo")
        Long orderId,

        Integer expirationHours
) {
}
