package com.asuncion.erp.dto.telemetry;

import jakarta.validation.constraints.NotNull;

public record DriverLocationPingRequest(
        Long orderId,

        String orderNumber,

        @NotNull(message = "La latitud es obligatoria")
        Double latitude,

        @NotNull(message = "La longitud es obligatoria")
        Double longitude,

        Double speedKmh,

        Double headingDegrees,

        Double accuracyMeters,

        Integer batteryPercent,

        String notes
) {
}
