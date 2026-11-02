package com.asuncion.erp.dto.payment;

import java.time.Instant;

public record PaymentConfigDto(
        boolean culqiEnabled,
        String culqiPublicKey,
        boolean hasCulqiSecret,
        boolean pagoefectivoEnabled,
        String pagoefectivoServiceId,
        boolean hasPagoefectivoSecret,
        boolean niubizEnabled,
        String niubizMerchantId,
        boolean hasNiubizPassword,
        String environment, // SANDBOX or PRODUCTION
        Instant updatedAt
) {
}
