package com.asuncion.erp.dto.telemetry;

import java.time.Instant;
import java.util.List;

public record LiveTrackingResponse(
        Long orderId,
        String orderNumber,
        String orderStatus,
        Long driverId,
        String driverName,
        String driverPhone,
        Double currentLatitude,
        Double currentLongitude,
        Double destinationLatitude,
        Double destinationLongitude,
        String destinationAddress,
        Double originLatitude,
        Double originLongitude,
        String branchName,
        Double speedKmh,
        Double headingDegrees,
        Double distanceRemainingMeters,
        Integer etaMinutes,
        String statusMessage,
        boolean isLive,
        Instant lastPingAt,
        List<TelemetryPointDto> routeHistory,
        String noSqlEngine,
        String noSqlCollection
) {
}
