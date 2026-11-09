package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.domain.enums.OrderStatus;
import com.asuncion.erp.dto.order.OrderCreateRequest;
import com.asuncion.erp.dto.order.OrderResponse;
import com.asuncion.erp.service.AuthService;
import com.asuncion.erp.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/orders")
@Tag(name = "05. Pedidos E-Commerce & Rastreo", description = "Checkout con validación geoespacial estricta (HTTP 422 fuera de cobertura) y seguimiento en tiempo real")
public class OrderController {

    private final OrderService orderService;
    private final AuthService authService;

    public OrderController(OrderService orderService, AuthService authService) {
        this.orderService = orderService;
        this.authService = authService;
    }

    @PostMapping
    @Operation(summary = "Crear nuevo pedido validando stock e imponiendo validación geoespacial estricta para DELIVERY")
    public ResponseEntity<OrderResponse> createOrder(@Valid @RequestBody OrderCreateRequest request) {
        AppUser currentUser = authService.getCurrentUser();
        OrderResponse created = orderService.createOrder(request, currentUser);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @GetMapping("/my-orders")
    @Operation(summary = "Listar historial de pedidos del cliente autenticado")
    public ResponseEntity<List<OrderResponse>> getMyOrders() {
        AppUser currentUser = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.getMyOrders(currentUser));
    }

    @GetMapping("/track/{orderNumber}")
    @Operation(summary = "Consultar estado en vivo, bitácora y comprobante de entrega de un pedido por su código")
    public ResponseEntity<OrderResponse> trackOrder(@PathVariable String orderNumber) {
        return ResponseEntity.ok(orderService.trackByOrderNumber(orderNumber));
    }

    @GetMapping
    @Operation(summary = "Listar todos los pedidos del sistema (filtrable por estado para ADMIN y VENDEDOR)")
    public ResponseEntity<List<OrderResponse>> getAllOrders(
            @RequestParam(required = false) OrderStatus status
    ) {
        return ResponseEntity.ok(orderService.getAllOrders(status));
    }

    @PatchMapping("/{id}/cancel")
    @Operation(summary = "Cancelar pedido o registrar entrega fallida (restituyendo stock físico automáticamente)")
    public ResponseEntity<OrderResponse> cancelOrder(
            @PathVariable Long id,
            @RequestBody(required = false) Map<String, String> body
    ) {
        AppUser currentUser = authService.getCurrentUser();
        String reason = body != null ? body.get("reason") : null;
        return ResponseEntity.ok(orderService.cancelOrder(id, reason, currentUser));
    }

    @PostMapping("/admin/cleanup-expired-pickups")
    @Operation(summary = "Ejecutar manualmente la limpieza y retorno de stock de pedidos de recojo vencidos (+48h)")
    public ResponseEntity<Map<String, Object>> cleanupExpiredPickups() {
        int count = orderService.autoCancelExpiredPickupOrders();
        return ResponseEntity.ok(Map.of(
                "cancelledOrdersCount", count,
                "message", count > 0 
                        ? "Se cancelaron " + count + " pedidos de recojo vencidos y su stock fue reincorporado al inventario." 
                        : "No hay pedidos de recojo con más de 48 horas vencidas."
        ));
    }
}