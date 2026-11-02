package com.asuncion.erp.dto.catalog;

public record CategoryDto(
        Long id,
        String code,
        String name,
        String description
) {
}
