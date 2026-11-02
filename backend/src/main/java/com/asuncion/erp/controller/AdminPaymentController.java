package com.asuncion.erp.controller;

import com.asuncion.erp.dto.payment.PaymentConfigDto;
import com.asuncion.erp.dto.payment.PaymentConfigUpdateRequest;
import com.asuncion.erp.dto.payment.PaymentTransactionDto;
import com.asuncion.erp.service.PaymentGatewayService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/payments")
@Tag(name = "11. Administración de Pasarelas y Transacciones", description = "Gestión de credenciales Culqi, Niubiz, PagoEfectivo y auditoría de transacciones bancarias")
@PreAuthorize("hasRole('ADMIN')")
public class AdminPaymentController {

    private final PaymentGatewayService paymentGatewayService;

    public AdminPaymentController(PaymentGatewayService paymentGatewayService) {
        this.paymentGatewayService = paymentGatewayService;
    }

    @GetMapping("/config")
    @Operation(summary = "Consultar credenciales y configuración de pasarelas de pago")
    public ResponseEntity<PaymentConfigDto> getAdminConfig() {
        return ResponseEntity.ok(paymentGatewayService.getPublicConfig());
    }

    @PutMapping("/config")
    @Operation(summary = "Actualizar credenciales de pasarelas Culqi, PagoEfectivo, Niubiz o entorno")
    public ResponseEntity<PaymentConfigDto> updateAdminConfig(@Valid @RequestBody PaymentConfigUpdateRequest request) {
        return ResponseEntity.ok(paymentGatewayService.updateAdminConfig(request));
    }

    @GetMapping("/transactions")
    @Operation(summary = "Auditoría de las últimas 50 transacciones bancarias procesadas")
    public ResponseEntity<List<PaymentTransactionDto>> getRecentTransactions() {
        return ResponseEntity.ok(paymentGatewayService.getRecentTransactions());
    }
}
