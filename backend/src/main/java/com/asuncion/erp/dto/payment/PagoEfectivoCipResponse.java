package com.asuncion.erp.dto.payment;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public record PagoEfectivoCipResponse(
        boolean success,
        String cipCode,
        String qrData,
        BigDecimal amount,
        String currency,
        Instant expiresAt,
        String status, // PENDIENTE_PAGO, APROBADO, EXPIRADO
        String orderNumber,
        Long orderId,
        String transactionId,
        List<BankInstruction> instructions
) {
    public record BankInstruction(
            String bankName,
            String channel, // "Banca Móvil / Web" o "Agente / Bodega"
            String serviceName,
            String step1,
            String step2,
            String step3,
            String badgeColor
    ) {
    }
}
