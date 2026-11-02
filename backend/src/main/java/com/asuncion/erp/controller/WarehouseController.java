package com.asuncion.erp.controller;

import com.asuncion.erp.domain.entity.AppUser;
import com.asuncion.erp.dto.order.OrderResponse;
import com.asuncion.erp.dto.order.ReadyForDispatchRequest;
import com.asuncion.erp.service.AuthService;
import com.asuncion.erp.service.OrderService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/warehouse")
@Tag(name = "06. Módulo de Almacén & Picking", description = "Preparación de pedidos, verificación por ubicación de estantería y pase a despacho")
public class WarehouseController {

    private final OrderService orderService;
    private final AuthService authService;

    public WarehouseController(OrderService orderService, AuthService authService) {
        this.orderService = orderService;
        this.authService = authService;
    }

    @GetMapping("/orders")
    @Operation(summary = "Listar pedidos pendientes y activos en almacén (CONFIRMADO, EN_PREPARACION, LISTO_PARA_DESPACHO)")
    public ResponseEntity<List<OrderResponse>> getWarehouseOrders() {
        return ResponseEntity.ok(orderService.getWarehouseOrders());
    }

    @PatchMapping("/orders/{id}/items/{itemId}/toggle-picked")
    @Operation(summary = "Marcar o desmarcar un ítem como recolectado (picked) durante el picking")
    public ResponseEntity<OrderResponse> togglePicked(
            @PathVariable Long id,
            @PathVariable Long itemId
    ) {
        AppUser operator = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.toggleItemPicked(id, itemId, operator));
    }

    @PatchMapping("/orders/{id}/start-picking")
    @Operation(summary = "Iniciar preparación del pedido en almacén (EN_PREPARACION)")
    public ResponseEntity<OrderResponse> startPicking(@PathVariable Long id) {
        AppUser operator = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.startPicking(id, operator));
    }

    @PatchMapping("/orders/{id}/ready-for-dispatch")
    @Operation(summary = "Finalizar picking, asignar motorizado opcionalmente y marcar LISTO_PARA_DESPACHO")
    public ResponseEntity<OrderResponse> readyForDispatch(
            @PathVariable Long id,
            @RequestBody(required = false) ReadyForDispatchRequest request
    ) {
        AppUser operator = authService.getCurrentUser();
        return ResponseEntity.ok(orderService.markReadyForDispatch(id, request, operator));
    }
}
