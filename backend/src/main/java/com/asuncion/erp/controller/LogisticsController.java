package com.asuncion.erp.controller;

import com.asuncion.erp.dto.logistics.BranchDto;
import com.asuncion.erp.dto.logistics.BranchUpdateRequest;
import com.asuncion.erp.dto.logistics.CoverageValidationRequest;
import com.asuncion.erp.dto.logistics.CoverageValidationResponse;
import com.asuncion.erp.service.GeospatialCoverageService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@Tag(name = "04. Logística Geoespacial & Cobertura PostGIS", description = "Círculos paramétricos de cobertura por sucursal y validación espacial ST_DWithin / ST_Distance")
public class LogisticsController {

    private final GeospatialCoverageService geospatialCoverageService;

    public LogisticsController(GeospatialCoverageService geospatialCoverageService) {
        this.geospatialCoverageService = geospatialCoverageService;
    }

    @GetMapping("/api/v1/logistics/branches")
    @Operation(summary = "Listar sucursales activas con coordenadas WGS84 y radio de cobertura")
    public ResponseEntity<List<BranchDto>> getActiveBranches() {
        return ResponseEntity.ok(geospatialCoverageService.getActiveBranches());
    }

    @PostMapping("/api/v1/logistics/validate-coverage")
    @Operation(summary = "Validar si una coordenada geográfica se encuentra dentro del radio de entrega permitido")
    public ResponseEntity<CoverageValidationResponse> validateCoverage(
            @Valid @RequestBody CoverageValidationRequest request
    ) {
        return ResponseEntity.ok(geospatialCoverageService.validateCoverage(
                request.latitude(),
                request.longitude(),
                request.branchId()
        ));
    }

    @GetMapping("/api/v1/admin/branches")
    @Operation(summary = "Listar todas las sucursales para configuración administrativa")
    public ResponseEntity<List<BranchDto>> getAllBranchesAdmin() {
        return ResponseEntity.ok(geospatialCoverageService.getAllBranches());
    }

    @PutMapping("/api/v1/admin/branches/{id}")
    @Operation(summary = "Actualizar parámetros geoespaciales, radio de cobertura y tarifas de una sucursal")
    public ResponseEntity<BranchDto> updateBranch(
            @PathVariable Long id,
            @Valid @RequestBody BranchUpdateRequest request
    ) {
        return ResponseEntity.ok(geospatialCoverageService.updateBranch(id, request));
    }
}
