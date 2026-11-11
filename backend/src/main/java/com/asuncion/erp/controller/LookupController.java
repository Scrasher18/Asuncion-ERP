package com.asuncion.erp.controller;

import com.asuncion.erp.dto.lookup.AddressSuggestionDto;
import com.asuncion.erp.dto.lookup.DocumentLookupResponse;
import com.asuncion.erp.service.ExternalLookupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/lookup")
@Tag(name = "09. Consultas en Vivo RENIEC / SUNAT & Geocodificación Perú", description = "Autocompletado instantáneo de DNI (8 dígitos), RUC (11 dígitos) y direcciones en Perú")
public class LookupController {

    private final ExternalLookupService externalLookupService;

    public LookupController(ExternalLookupService externalLookupService) {
        this.externalLookupService = externalLookupService;
    }

    @GetMapping("/document/{number}")
    @Operation(summary = "Consultar DNI (RENIEC) o RUC (SUNAT) en vivo con respaldo local")
    public ResponseEntity<DocumentLookupResponse> lookupDocument(@PathVariable String number) {
        return ResponseEntity.ok(externalLookupService.lookupDocument(number));
    }

    @GetMapping("/address")
    @Operation(summary = "Autocompletar direcciones y coordenadas GPS dentro del Perú vía OpenStreetMap Nominatim")
    public ResponseEntity<List<AddressSuggestionDto>> autocompleteAddress(
            @RequestParam(name = "q", required = false, defaultValue = "") String q
    ) {
        return ResponseEntity.ok(externalLookupService.autocompleteAddress(q));
    }

    @GetMapping("/reverse-address")
    @Operation(summary = "Obtener dirección aproximada en Perú a partir de coordenadas latitud/longitud")
    public ResponseEntity<AddressSuggestionDto> reverseAddress(
            @RequestParam("lat") double lat,
            @RequestParam("lng") double lng
    ) {
        AddressSuggestionDto resolved = externalLookupService.reverseAddress(lat, lng);
        if (resolved == null) {
            return ResponseEntity.noContent().build();
        }
        return ResponseEntity.ok(resolved);
    }
}
