package com.asuncion.erp.dto.payment;

import java.math.BigDecimal;
import java.time.Instant;

public record PaymentTransactionDto(
        Long id,
        Long orderId,
        String orderNumber,
        String paymentMethod,
        String gatewayProvider,
        String transactionId,
        BigDecimal amount,
        String currency,
        String status,
        String cardBrand,
        String cardBank,
        String cardType,
        String cardLastFour,
        String cardholderName,
        Integer installments,
        String cipCode,
        Instant cipExpiresAt,
        String authorizationCode,
        String gatewayReference,
        String errorMessage,
        Instant createdAt
) {
}
