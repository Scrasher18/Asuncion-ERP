package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.dto.telemetry.DriverLocationPingRequest;
import com.asuncion.erp.dto.telemetry.LiveTrackingResponse;
import com.asuncion.erp.dto.telemetry.NoSqlDatabaseInfo;
import com.asuncion.erp.nosql.DriverTelemetryDocument;
import com.asuncion.erp.nosql.NoSqlTelemetryService;
import com.asuncion.erp.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

@RestController
@RequestMapping("/api/v1/telemetry")
@Tag(name = "11. Telemetría GPS en Vivo & Base de Datos NoSQL", description = "Transmisión y rastreo en tiempo real de repartidores en ruta con almacenamiento NoSQL (MongoDB / Document Store)")
public class DriverTelemetryController {

    private final NoSqlTelemetryService telemetryService;
    private final AuthService authService;

    public DriverTelemetryController(NoSqlTelemetryService telemetryService, AuthService authService) {
        this.telemetryService = telemetryService;
        this.authService = authService;
    }

    @PostMapping("/driver/ping")
    @Operation(summary = "Emitir ping GPS de ubicación en tiempo real del repartidor motorizado hacia la base de datos NoSQL")
    public ResponseEntity<DriverTelemetryDocument> recordDriverPing(
            @Valid @RequestBody DriverLocationPingRequest request
    ) {
        AppUser driverUser = authService.getCurrentUserOrNull();
        return ResponseEntity.ok(telemetryService.recordDriverPing(request, driverUser));
    }

    @GetMapping("/orders/{orderNumber}/live")
    @Operation(summary = "Consultar ubicación en vivo, rumbo, velocidad, distancia restante y tiempo estimado de llegada (ETA)")
    public ResponseEntity<LiveTrackingResponse> getLiveTracking(@PathVariable String orderNumber) {
        return ResponseEntity.ok(telemetryService.getLiveTracking(orderNumber));
    }

    @GetMapping(value = "/orders/{orderNumber}/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    @Operation(summary = "Suscripción Server-Sent Events (SSE) para recibir actualizaciones fluidas de posición del repartidor en el mapa")
    public SseEmitter subscribeLiveTracking(@PathVariable String orderNumber) {
        return telemetryService.subscribeToLiveTracking(orderNumber);
    }

    @PostMapping("/orders/{orderNumber}/simulate-step")
    @Operation(summary = "Simular avance de ruta del repartidor para demostraciones en vivo de tracking GPS")
    public ResponseEntity<LiveTrackingResponse> simulateRouteStep(
            @PathVariable String orderNumber,
            @RequestParam(name = "progress", required = false, defaultValue = "0.5") Double progress
    ) {
        return ResponseEntity.ok(telemetryService.simulateRouteStep(orderNumber, progress));
    }

    @GetMapping("/nosql/status")
    @Operation(summary = "Consultar estado de conexión del motor NoSQL (MongoDB / Document Store) y métricas de colección")
    public ResponseEntity<NoSqlDatabaseInfo> getNoSqlStatus() {
        return ResponseEntity.ok(telemetryService.getNoSqlInfo());
    }
}
