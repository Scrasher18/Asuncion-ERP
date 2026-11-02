package com.asuncion.erp.dto.catalog;

import com.fasterxml.jackson.annotation.JsonProperty;

public record PartImageDto(
        Long id,
        String imageUrl,
        String objectKey,
        String mimeType,
        Long fileSizeBytes,
        @JsonProperty("isPrimary")
        boolean isPrimary,
        Integer displayOrder
) {
}
