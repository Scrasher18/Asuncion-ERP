package com.asuncion.erp.dto.order;

import java.time.Instant;

public record OrderStatusHistoryDto(
        Long id,
        String previousStatus,
        String newStatus,
        String changedByName,
        String comments,
        Instant changedAt
) {
}
