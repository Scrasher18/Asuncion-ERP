package com.asuncion.erp.dto.chatbot;

import jakarta.validation.constraints.NotBlank;

public record ChatbotRequest(
        @NotBlank(message = "El mensaje no puede estar vacío")
        String message,
        String sessionId
) {
}
