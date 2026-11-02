package com.asuncion.erp.dto.order;

import java.time.Instant;

public record DeliveryProofDto(
        Long id,
        String receiverName,
        String receiverDocument,
        String evidenceImageUrl,
        String deliveryNotes,
        Double capturedLatitude,
        Double capturedLongitude,
        Instant deliveredAt
) {
}
