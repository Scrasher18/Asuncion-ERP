package com.asuncion.erp.dto.catalog;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record PartCompatibilityRequest(
        @NotNull(message = "modelId es obligatorio")
        Long modelId,

        @NotNull(message = "yearStart es obligatorio")
        @Min(1950)
        @Max(2100)
        Integer yearStart,

        @NotNull(message = "yearEnd es obligatorio")
        @Min(1950)
        @Max(2100)
        Integer yearEnd,

        String engineSpec,
        String notes
) {
}
