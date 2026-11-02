package com.asuncion.erp.dto.logistics;

import java.math.BigDecimal;

public record BranchDto(
        Long id,
        String code,
        String name,
        String address,
        String phone,
        double latitude,
        double longitude,
        double coverageRadiusMeters,
        BigDecimal baseDeliveryFee,
        BigDecimal perKmFee,
        boolean active
) {
}
