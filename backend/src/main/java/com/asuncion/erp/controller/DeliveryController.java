package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.entity.DriverStatus;
import com.asuncion.erp.dto.order.DriverSummaryDto;
import com.asuncion.erp.dto.order.OrderResponse;
import com.asuncion.erp.service.AuthService;
import com.asuncion.erp.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/delivery")
@Tag(name = "07. Módulo Motorizado / Despacho GPS", description = "Panel PWA para repartidores, inicio de ruta GPS y captura de evidencia fotográfica WebP de entrega")
public class DeliveryController {

    private final OrderService orderService;
    private final AuthService authService;

    public DeliveryController(OrderService orderService, AuthService authService) {
        this.orderService = orderService;
        this.authService = authService;
    }

    @GetMapping("/drivers")
    @Operation(summary = "Listar repartidores motorizados activos")
    public ResponseEntity<List<DriverSummaryDto>> getDrivers() {
        return ResponseEntity.ok(orderService.getDrivers());
    }

    @GetMapping("/orders")
    @Operation(summary = "Listar pedidos asignados o listos para despacho para el motorizado")
    public ResponseEntity<List<OrderResponse>> getDeliveryOrders() {
        AppUser currentUser = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.getDeliveryOrders(currentUser));
    }

    @PatchMapping("/orders/{id}/start-route")
    @Operation(summary = "Iniciar ruta GPS hacia el cliente (transición a EN_RUTA)")
    public ResponseEntity<OrderResponse> startRoute(@PathVariable Long id) {
        AppUser currentUser = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.startRoute(id, currentUser));
    }

    @PostMapping("/orders/{id}/complete")
    @Operation(summary = "Registrar entrega exitosa con foto de comprobante WebP y coordenadas GPS capturadas")
    public ResponseEntity<OrderResponse> completeDeliveryMultipart(
            @PathVariable Long id,
            @RequestParam(value = "evidenceImage", required = false) MultipartFile evidenceImage,
            @RequestParam(value = "receiverName", required = false) String receiverName,
            @RequestParam(value = "receiverDocument", required = false) String receiverDocument,
            @RequestParam(value = "deliveryNotes", required = false) String deliveryNotes,
            @RequestParam(value = "capturedLatitude", required = false) Double capturedLatitude,
            @RequestParam(value = "capturedLongitude", required = false) Double capturedLongitude,
            @RequestParam(value = "securityCode", required = false) String securityCode
    ) {
        AppUser currentUser = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.completeDelivery(
                id,
                evidenceImage,
                receiverName,
                receiverDocument,
                deliveryNotes,
                capturedLatitude,
                capturedLongitude,
                securityCode,
                currentUser
        ));
    }

    @PostMapping(value = "/orders/{id}/complete", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Registrar entrega exitosa vía JSON")
    public ResponseEntity<OrderResponse> completeDeliveryJson(
            @PathVariable Long id,
            @RequestBody Map<String, Object> body
    ) {
        AppUser currentUser = authService.getCurrentUser();
        String receiverName = body.get("receiverName") != null ? String.valueOf(body.get("receiverName")) : null;
        String receiverDoc = body.get("receiverDocument") != null ? String.valueOf(body.get("receiverDocument")) : null;
        String notes = body.get("deliveryNotes") != null ? String.valueOf(body.get("deliveryNotes")) : null;
        Double lat = body.get("capturedLatitude") instanceof Number n ? n.doubleValue() : null;
        Double lng = body.get("capturedLongitude") instanceof Number n ? n.doubleValue() : null;
        String securityCode = body.get("securityCode") != null ? String.valueOf(body.get("securityCode")) : null;

        return ResponseEntity.ok(orderService.completeDelivery(
                id, null, receiverName, receiverDoc, notes, lat, lng, securityCode, currentUser
        ));
    }

    @PatchMapping("/my-status")
    @Operation(summary = "Actualizar estado operativo del motorizado actual (DISPONIBLE, RETORNANDO, FUERA_DE_TURNO)")
    public ResponseEntity<DriverSummaryDto> updateMyStatus(@RequestBody Map<String, String> body) {
        AppUser currentUser = authService.getCurrentUser();
        String statusStr = body.get("status");
        DriverStatus status = DriverStatus.valueOf(statusStr.toUpperCase().trim());
        return ResponseEntity.ok(orderService.updateDriverStatus(currentUser.getId(), status, currentUser));
    }

    @PatchMapping("/drivers/{id}/status")
    @Operation(summary = "Actualizar estado operativo de un motorizado por ID (Admin o el propio motorizado)")
    public ResponseEntity<DriverSummaryDto> updateDriverStatus(
            @PathVariable Long id,
            @RequestBody Map<String, String> body
    ) {
        AppUser currentUser = authService.getCurrentUser();
        String statusStr = body.get("status");
        DriverStatus status = DriverStatus.valueOf(statusStr.toUpperCase().trim());
        return ResponseEntity.ok(orderService.updateDriverStatus(id, status, currentUser));
    }
}
