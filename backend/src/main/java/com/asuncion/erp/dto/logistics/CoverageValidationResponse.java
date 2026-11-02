package com.asuncion.erp.dto.logistics;

import java.math.BigDecimal;

public record CoverageValidationResponse(
        boolean covered,
        Long branchId,
        String branchName,
        double branchLatitude,
        double branchLongitude,
        double customerLatitude,
        double customerLongitude,
        double distanceMeters,
        double allowedRadiusMeters,
        BigDecimal estimatedDeliveryFee,
        String validationEngine,
        String message
) {
}
