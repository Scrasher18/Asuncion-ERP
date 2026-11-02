package com.asuncion.erp.dto.telemetry;

import java.time.Instant;

public record TelemetryPointDto(
        Double latitude,
        Double longitude,
        Double speedKmh,
        Double headingDegrees,
        Instant timestamp
) {
}
