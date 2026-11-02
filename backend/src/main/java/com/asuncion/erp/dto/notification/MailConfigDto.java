package com.asuncion.erp.dto.notification;

public record MailConfigDto(
        boolean enabled,
        String smtpHost,
        Integer smtpPort,
        String username,
        boolean hasPassword,
        String fromName,
        String adminNotificationEmail
) {
}
