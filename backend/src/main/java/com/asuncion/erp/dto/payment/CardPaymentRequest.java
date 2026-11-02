package com.asuncion.erp.dto.payment;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record CardPaymentRequest(
        @NotNull(message = "El ID del pedido es obligatorio")
        @Positive(message = "El ID del pedido debe ser positivo")
        Long orderId,

        @NotBlank(message = "El número de tarjeta es obligatorio")
        String cardNumber,

        @NotBlank(message = "El nombre del titular es obligatorio")
        String cardholderName,

        @NotBlank(message = "El mes de expiración es obligatorio")
        String expiryMonth,

        @NotBlank(message = "El año de expiración es obligatorio")
        String expiryYear,

        @NotBlank(message = "El código de seguridad CVV es obligatorio")
        String cvv,

        String documentNumber,

        String documentType,

        Integer installments,

        String email,

        String clientIp
) {
}
