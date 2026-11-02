package com.asuncion.erp.dto.notification;

public record MailConfigUpdateRequest(
        boolean enabled,
        String smtpHost,
        Integer smtpPort,
        String username,
        String password,
        String fromName,
        String adminNotificationEmail
) {
}
