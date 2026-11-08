package com.asuncion.erp.dto.order;

public record CustomComboPairRequest(
        Long mainPartId,
        Long complementPartId
) {
}
