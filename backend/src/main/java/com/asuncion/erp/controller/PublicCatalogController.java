package com.asuncion.erp.controller;

import com.asuncion.erp.dto.catalog.CategoryDto;
import com.asuncion.erp.dto.catalog.PartResponse;
import com.asuncion.erp.dto.catalog.VehicleMakeDto;
import com.asuncion.erp.dto.catalog.VehicleModelDto;
import com.asuncion.erp.service.CatalogService;
import com.asuncion.erp.service.StockReservationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/catalog")
@Tag(name = "02. Catálogo Público & Compatibilidad Vehicular", description = "Buscador predictivo por OEM/SKU y filtrado multivariable Marca-Modelo-Año")
public class PublicCatalogController {

    private final CatalogService catalogService;
    private final StockReservationService stockReservationService;

    public PublicCatalogController(
            CatalogService catalogService,
            StockReservationService stockReservationService
    ) {
        this.catalogService = catalogService;
        this.stockReservationService = stockReservationService;
    }

    @GetMapping("/categories")
    @Operation(summary = "Listar categorías activas de sistemas automotrices")
    public ResponseEntity<List<CategoryDto>> getCategories() {
        return ResponseEntity.ok(catalogService.getCategories());
    }

    @GetMapping("/vehicle-makes")
    @Operation(summary = "Listar marcas de vehículos")
    public ResponseEntity<List<VehicleMakeDto>> getVehicleMakes() {
        return ResponseEntity.ok(catalogService.getVehicleMakes());
    }

    @GetMapping("/vehicle-models")
    @Operation(summary = "Listar modelos de vehículos (filtrable por makeId)")
    public ResponseEntity<List<VehicleModelDto>> getVehicleModels(
            @RequestParam(required = false) Long makeId
    ) {
        return ResponseEntity.ok(catalogService.getVehicleModels(makeId));
    }

    @GetMapping("/parts")
    @Operation(summary = "Buscar repuestos activos con filtros de compatibilidad vehicular y stock")
    public ResponseEntity<List<PartResponse>> searchParts(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long makeId,
            @RequestParam(required = false) Long modelId,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Boolean onlyInStock
    ) {
        return ResponseEntity.ok(catalogService.searchPublicParts(q, categoryId, makeId, modelId, year, onlyInStock));
    }

    @GetMapping("/parts/{id}")
    @Operation(summary = "Obtener ficha técnica completa, galería WebP y matriz de compatibilidad de un repuesto")
    public ResponseEntity<PartResponse> getPartById(@PathVariable Long id) {
        return ResponseEntity.ok(catalogService.getPublicPartById(id));
    }

    @PostMapping("/reservations/sync")
    @Operation(summary = "Sincronizar reserva temporal de stock (estado RESERVADO) para carrito activo y evitar sobreventa concurrente")
    public ResponseEntity<StockReservationService.ReservationSyncResponse> syncCartReservation(
            @RequestBody StockReservationService.ReservationSyncRequest request
    ) {
        return ResponseEntity.ok(stockReservationService.syncReservation(
                request != null ? request.sessionId() : null,
                request != null ? request.items() : List.of()
        ));
    }

    @DeleteMapping("/reservations/{sessionId}")
    @Operation(summary = "Liberar reserva temporal de stock de una sesión de compra")
    public ResponseEntity<Map<String, Object>> releaseCartReservation(@PathVariable String sessionId) {
        stockReservationService.releaseSession(sessionId);
        return ResponseEntity.ok(Map.of("released", true, "sessionId", sessionId));
    }

    @GetMapping("/reservations/status")
    @Operation(summary = "Consultar mapa global de unidades actualmente en estado RESERVADO")
    public ResponseEntity<Map<Long, Integer>> getReservationsStatus() {
        return ResponseEntity.ok(stockReservationService.getAllReservedQuantities());
    }
}
