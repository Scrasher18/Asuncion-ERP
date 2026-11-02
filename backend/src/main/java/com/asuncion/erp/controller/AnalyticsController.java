package com.asuncion.erp.controller;

import com.asuncion.erp.dto.analytics.DashboardAnalyticsResponse;
import com.asuncion.erp.service.AnalyticsService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/analytics")
@Tag(name = "08. Analítica Ejecutiva & BI", description = "KPIs financieros, ranking dinámico de vendedores con cumplimiento de metas y rotación de inventario")
public class AnalyticsController {

    private final AnalyticsService analyticsService;

    public AnalyticsController(AnalyticsService analyticsService) {
        this.analyticsService = analyticsService;
    }

    @GetMapping("/dashboard")
    @Operation(summary = "Obtener métricas del dashboard ejecutivo, ranking de vendedores y rotación de repuestos")
    public ResponseEntity<DashboardAnalyticsResponse> getDashboard(
            @RequestParam(defaultValue = "30") int days
    ) {
        return ResponseEntity.ok(analyticsService.getDashboardAnalytics(days));
    }
}
