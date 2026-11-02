package com.asuncion.erp.dto.catalog;

public record VehicleModelDto(
        Long id,
        Long makeId,
        String makeName,
        String name,
        String vehicleType
) {
}
