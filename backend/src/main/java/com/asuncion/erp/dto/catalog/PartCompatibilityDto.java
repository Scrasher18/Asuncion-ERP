package com.asuncion.erp.dto.catalog;

public record PartCompatibilityDto(
        Long id,
        Long makeId,
        String makeName,
        Long modelId,
        String modelName,
        Integer yearStart,
        Integer yearEnd,
        String engineSpec,
        String notes
) {
}
