package com.asuncion.erp.dto.notification;

public record TestEmailResponse(
        boolean success,
        String status,
        String message
) {
}
