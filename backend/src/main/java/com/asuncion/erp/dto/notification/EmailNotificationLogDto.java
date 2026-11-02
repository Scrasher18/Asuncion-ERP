package com.asuncion.erp.dto.notification;

import java.time.Instant;

public record EmailNotificationLogDto(
        Long id,
        String eventType,
        String recipientEmail,
        String subject,
        String htmlBody,
        String orderNumber,
        String deliveryStatus,
        String errorMessage,
        Instant createdAt
) {
}
