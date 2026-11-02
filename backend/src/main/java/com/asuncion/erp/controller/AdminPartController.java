package com.asuncion.erp.controller;

import com.asuncion.erp.dto.autocomplete.VehicleQuickImportRequest;
import com.asuncion.erp.dto.catalog.*;
import com.asuncion.erp.service.CatalogService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "03. ERP Administración de Repuestos & Multimedia WebP", description = "Gestión integral de inventario OEM/SKU, compatibilidades N:M y carga optimizada a S3/MinIO")
public class AdminPartController {

    private final CatalogService catalogService;

    public AdminPartController(CatalogService catalogService) {
        this.catalogService = catalogService;
    }

    @GetMapping("/parts")
    @Operation(summary = "Listar todos los repuestos del ERP (incluye alertas de stock mínimo e inactivos)")
    public ResponseEntity<List<PartResponse>> getAdminParts(
            @RequestParam(required = false) Boolean lowStockOnly
    ) {
        return ResponseEntity.ok(catalogService.getAdminParts(lowStockOnly));
    }

    @PostMapping("/parts")
    @Operation(summary = "Crear nuevo repuesto con especificaciones técnicas y compatibilidades vehiculares")
    public ResponseEntity<PartResponse> createPart(@Valid @RequestBody PartUpsertRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createPart(request));
    }

    @PutMapping("/parts/{id}")
    @Operation(summary = "Actualizar repuesto y su matriz de compatibilidad vehicular")
    public ResponseEntity<PartResponse> updatePart(
            @PathVariable Long id,
            @Valid @RequestBody PartUpsertRequest request
    ) {
        return ResponseEntity.ok(catalogService.updatePart(id, request));
    }

    @DeleteMapping("/parts/{id}")
    @Operation(summary = "Desactivar lógicamente un repuesto del catálogo")
    public ResponseEntity<Void> deactivatePart(@PathVariable Long id) {
        catalogService.deactivatePart(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/parts/{id}/images", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Subir múltiples imágenes de repuesto con compresión automática a WebP hacia S3/MinIO")
    public ResponseEntity<PartResponse> uploadImages(
            @PathVariable Long id,
            @RequestParam(value = "files", required = false) List<MultipartFile> files,
            @RequestParam(value = "file", required = false) MultipartFile singleFile,
            @RequestParam(value = "primaryIndex", required = false) Integer primaryIndex
    ) {
        List<MultipartFile> merged = new ArrayList<>();
        if (files != null) {
            merged.addAll(files);
        }
        if (singleFile != null && !singleFile.isEmpty()) {
            merged.add(singleFile);
        }
        return ResponseEntity.ok(catalogService.uploadPartImages(id, merged, primaryIndex));
    }

    @PutMapping("/parts/{id}/images/{imageId}/primary")
    @Operation(summary = "Seleccionar imagen principal del repuesto")
    public ResponseEntity<PartResponse> setPrimaryImage(
            @PathVariable Long id,
            @PathVariable Long imageId
    ) {
        return ResponseEntity.ok(catalogService.setPrimaryImage(id, imageId));
    }

    @DeleteMapping("/parts/{id}/images/{imageId}")
    @Operation(summary = "Eliminar imagen del bucket de objetos y de la base de datos")
    public ResponseEntity<PartResponse> deleteImage(
            @PathVariable Long id,
            @PathVariable Long imageId
    ) {
        return ResponseEntity.ok(catalogService.deletePartImage(id, imageId));
    }

    @PostMapping("/vehicles/makes")
    @Operation(summary = "Registrar nueva marca vehicular")
    public ResponseEntity<VehicleMakeDto> createMake(@Valid @RequestBody VehicleMakeCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createVehicleMake(request));
    }

    @PostMapping("/vehicles/models")
    @Operation(summary = "Registrar nuevo modelo vehicular vinculado a una marca")
    public ResponseEntity<VehicleModelDto> createModel(@Valid @RequestBody VehicleModelCreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogService.createVehicleModel(request));
    }

    @PostMapping("/vehicles/quick-import")
    @Operation(summary = "Importar de forma idempotente una marca vehicular y múltiples modelos seleccionados")
    public ResponseEntity<List<VehicleModelDto>> quickImportVehicles(@Valid @RequestBody VehicleQuickImportRequest request) {
        return ResponseEntity.ok(catalogService.quickImportVehicles(request));
    }
}
