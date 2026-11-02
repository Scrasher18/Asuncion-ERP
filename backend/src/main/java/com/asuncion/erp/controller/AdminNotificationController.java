package com.asuncion.erp.controller;

import com.asuncion.erp.dto.notification.*;
import com.asuncion.erp.service.EmailNotificationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/notifications")
@Tag(name = "11. Configuración SMTP & Bandeja de Notificaciones HTML", description = "Gestión dinámica de credenciales Gmail/SMTP, prueba en vivo y auditoría de correos HTML enviados o simulados")
public class AdminNotificationController {

    private final EmailNotificationService emailNotificationService;

    public AdminNotificationController(EmailNotificationService emailNotificationService) {
        this.emailNotificationService = emailNotificationService;
    }

    @GetMapping("/config")
    @Operation(summary = "Obtener configuración actual del servidor de correo SMTP")
    public ResponseEntity<MailConfigDto> getConfig() {
        return ResponseEntity.ok(emailNotificationService.getMailConfig());
    }

    @PutMapping("/config")
    @Operation(summary = "Actualizar credenciales SMTP (preserva la contraseña existente si se envía vacía)")
    public ResponseEntity<MailConfigDto> updateConfig(@RequestBody MailConfigUpdateRequest request) {
        return ResponseEntity.ok(emailNotificationService.updateMailConfig(request));
    }

    @PostMapping("/test")
    @Operation(summary = "Enviar correo HTML de prueba de forma síncrona para verificar credenciales SMTP")
    public ResponseEntity<TestEmailResponse> sendTestEmail(@Valid @RequestBody TestEmailRequest request) {
        return ResponseEntity.ok(emailNotificationService.sendTestEmail(request.recipientEmail()));
    }

    @GetMapping("/logs")
    @Operation(summary = "Listar las últimas 40 notificaciones HTML generadas (SENT, SIMULATED_NO_SMTP, FAILED)")
    public ResponseEntity<List<EmailNotificationLogDto>> getLogs() {
        return ResponseEntity.ok(emailNotificationService.getRecentLogs());
    }

    @DeleteMapping("/logs")
    @Operation(summary = "Vaciar historial de notificaciones enviadas y de prueba")
    public ResponseEntity<Void> clearLogs() {
        emailNotificationService.clearAllLogs();
        return ResponseEntity.noContent().build();
    }
}
