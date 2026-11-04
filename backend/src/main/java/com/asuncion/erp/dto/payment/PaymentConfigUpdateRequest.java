package com.asuncion.erp.dto.payment;

public record PaymentConfigUpdateRequest(
        boolean culqiEnabled,
        String culqiPublicKey,
        String culqiSecretKey,
        boolean pagoefectivoEnabled,
        String pagoefectivoServiceId,
        String pagoefectivoSecretKey,
        boolean niubizEnabled,
        String niubizMerchantId,
        String niubizUser,
        String niubizPassword,
        String environment,
        String yapePhone,
        String yapeHolder,
        String yapeQrImageUrl,
        String plinPhone,
        String plinHolder,
        String plinQrImageUrl,
        String walletInstructions
) {
}
