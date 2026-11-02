package com.asuncion.erp.controller;

import com.asuncion.erp.dto.autocomplete.PartTemplateSuggestionDto;
import com.asuncion.erp.dto.autocomplete.VehicleModelSuggestionDto;
import com.asuncion.erp.service.AutomotiveAutocompleteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/admin/autocomplete")
@Tag(name = "10. Autocompletado Inteligente de Autopartes & NHTSA vPIC", description = "Catálogo predictivo de repuestos del mercado peruano, marcas OEM/Aftermarket y modelos oficiales NHTSA")
public class AdminAutocompleteController {

    private final AutomotiveAutocompleteService autocompleteService;

    public AdminAutocompleteController(AutomotiveAutocompleteService autocompleteService) {
        this.autocompleteService = autocompleteService;
    }

    @GetMapping("/parts")
    @Operation(summary = "Sugerir plantillas de repuestos automotrices reales (Narva, Bosch, Brembo, Mann-Filter, KYB, NGK, etc.)")
    public ResponseEntity<List<PartTemplateSuggestionDto>> suggestParts(
            @RequestParam(name = "q", required = false, defaultValue = "") String q
    ) {
        return ResponseEntity.ok(autocompleteService.suggestParts(q));
    }

    @GetMapping("/brands")
    @Operation(summary = "Autocompletar marcas fabricantes OEM y Aftermarket")
    public ResponseEntity<List<String>> suggestBrands(
            @RequestParam(name = "q", required = false, defaultValue = "") String q
    ) {
        return ResponseEntity.ok(autocompleteService.suggestBrands(q));
    }

    @GetMapping("/vehicle-makes")
    @Operation(summary = "Listar marcas populares de vehículos en el parque automotor peruano")
    public ResponseEntity<List<String>> suggestVehicleMakes(
            @RequestParam(name = "q", required = false, defaultValue = "") String q
    ) {
        return ResponseEntity.ok(autocompleteService.suggestVehicleMakes(q));
    }

    @GetMapping("/vehicle-models")
    @Operation(summary = "Sugerir modelos comerciales en Perú combinados en tiempo real con la API oficial NHTSA vPIC")
    public ResponseEntity<List<VehicleModelSuggestionDto>> suggestVehicleModels(
            @RequestParam(name = "make") String make
    ) {
        return ResponseEntity.ok(autocompleteService.suggestVehicleModels(make));
    }
}
