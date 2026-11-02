package com.asuncion.erp.dto.user;

import java.time.Instant;
import java.util.List;

public record AdminUserResponse(
        Long id,
        String fullName,
        String email,
        String phone,
        String documentType,
        String documentNumber,
        String role,
        List<String> roles,
        boolean active,
        String driverStatus,
        String employeeCode,
        String licenseNumber,
        String vehiclePlate,
        Instant createdAt
) {
}
