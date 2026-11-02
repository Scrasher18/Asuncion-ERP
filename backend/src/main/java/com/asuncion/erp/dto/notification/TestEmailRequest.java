package com.asuncion.erp.dto.notification;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record TestEmailRequest(
        @NotBlank(message = "El correo destinatario es obligatorio")
        @Email(message = "El formato del correo electrónico no es válido")
        String recipientEmail
) {
}
