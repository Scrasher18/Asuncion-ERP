package com.asuncion.erp.dto.payment;

import java.math.BigDecimal;
import java.time.Instant;

public record CardPaymentResponse(
        boolean success,
        String status, // APROBADO, RECHAZADO, ERROR
        String transactionId,
        String authorizationCode,
        String message,
        String cardBrand,
        String cardBank,
        String cardType,
        String cardLastFour,
        String cardholderName,
        Integer installments,
        BigDecimal amount,
        String currency,
        String orderNumber,
        Long orderId,
        Instant processedAt
) {
}
