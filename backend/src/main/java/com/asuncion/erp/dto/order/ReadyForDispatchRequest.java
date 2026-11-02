package com.asuncion.erp.dto.order;

public record ReadyForDispatchRequest(
        Long assignedDriverId,
        String warehouseNotes
) {
}
