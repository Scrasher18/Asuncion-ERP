package com.asuncion.erp.dto.order;

import com.asuncion.erp.domain.entity.DriverStatus;

public record DriverSummaryDto(
        Long id,
        String fullName,
        String phone,
        String email,
        DriverStatus status,
        String activeOrderNumber
) {
}
