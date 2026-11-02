package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.dto.payment.*;
import com.asuncion.erp.service.PaymentGatewayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/payments")
@Tag(name = "10. Pasarela de Pagos & PagoEfectivo", description = "Procesamiento de tarjetas Visa/Mastercard/Amex/Diners con detección de bancos peruanos (BCP, Interbank, BBVA, etc.) y generación de CIP PagoEfectivo")
public class PaymentController {

    private final PaymentGatewayService paymentGatewayService;
    private final com.asuncion.erp.service.AuthService authService;

    public PaymentController(PaymentGatewayService paymentGatewayService, com.asuncion.erp.service.AuthService authService) {
        this.paymentGatewayService = paymentGatewayService;
        this.authService = authService;
    }

    @GetMapping("/config")
    @Operation(summary = "Obtener configuración pública de pasarelas de pago y medios habilitados")
    public ResponseEntity<PaymentConfigDto> getPublicConfig() {
        return ResponseEntity.ok(paymentGatewayService.getPublicConfig());
    }

    @GetMapping("/analyze-card")
    @Operation(summary = "Analizar en tiempo real el BIN de tarjeta, marca y banco emisor peruano")
    public ResponseEntity<PaymentGatewayService.CardDetails> analyzeCard(@RequestParam(name = "number", required = false, defaultValue = "") String number) {
        return ResponseEntity.ok(paymentGatewayService.analyzeCardNumber(number));
    }

    @PostMapping("/card/process")
    @Operation(summary = "Procesar pago con tarjeta de crédito o débito para un pedido")
    public ResponseEntity<CardPaymentResponse> processCardPayment(
            @Valid @RequestBody CardPaymentRequest request
    ) {
        AppUser currentUser = authService.getCurrentUserOrNull();
        return ResponseEntity.ok(paymentGatewayService.processCardPayment(request, currentUser));
    }

    @PostMapping("/culqi/charge")
    @Operation(summary = "Procesar pago mediante token generado por Culqi Checkout v4")
    public ResponseEntity<CardPaymentResponse> processCulqiCharge(
            @Valid @RequestBody CulqiChargeRequest request
    ) {
        AppUser currentUser = authService.getCurrentUserOrNull();
        return ResponseEntity.ok(paymentGatewayService.processCulqiTokenPayment(request, currentUser));
    }

    @PostMapping("/pagoefectivo/generate-cip")
    @Operation(summary = "Generar código CIP de PagoEfectivo con instrucciones de pago BCP, BBVA, Interbank, Scotiabank y Agentes")
    public ResponseEntity<PagoEfectivoCipResponse> generateCip(
            @Valid @RequestBody PagoEfectivoCipRequest request
    ) {
        AppUser currentUser = authService.getCurrentUserOrNull();
        return ResponseEntity.ok(paymentGatewayService.generatePagoEfectivoCip(request, currentUser));
    }

    @GetMapping("/pagoefectivo/status/{orderId}")
    @Operation(summary = "Consultar estado de pago de CIP PagoEfectivo para un pedido")
    public ResponseEntity<PagoEfectivoCipResponse> checkCipStatus(@PathVariable Long orderId) {
        return ResponseEntity.ok(paymentGatewayService.checkCipStatus(orderId));
    }

    @PostMapping("/pagoefectivo/simulate-payment/{orderId}")
    @Operation(summary = "Verificar / simular pago de CIP bancario recibido (cambia pedido a PAGADO y envía notificación)")
    public ResponseEntity<CardPaymentResponse> simulateCipPayment(
            @PathVariable Long orderId
    ) {
        AppUser currentUser = authService.getCurrentUserOrNull();
        return ResponseEntity.ok(paymentGatewayService.confirmOrSimulateCipPayment(orderId, currentUser));
    }

    @PostMapping("/webhook/pagoefectivo")
    @Operation(summary = "Webhook para recepción de notificaciones de pago en vivo de PagoEfectivo / Culqi")
    public ResponseEntity<String> webhookNotification(@RequestBody(required = false) String payload) {
        // Acknowledge webhook
        return ResponseEntity.ok("OK");
    }
}
