package com.asuncion.erp.controller;

import com.asuncion.erp.dto.chatbot.ChatbotRequest;
import com.asuncion.erp.dto.chatbot.ChatbotResponse;
import com.asuncion.erp.service.ChatbotService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/chatbot")
@Tag(name = "09. Chatbot Asistente Técnico Híbrido", description = "Consulta de compatibilidad vehicular, stock en tiempo real, rastreo de pedidos y conector RAG Gemini")
public class ChatbotController {

    private final ChatbotService chatbotService;

    public ChatbotController(ChatbotService chatbotService) {
        this.chatbotService = chatbotService;
    }

    @PostMapping("/message")
    @Operation(summary = "Enviar consulta al asistente interactivo conectado al catálogo y pedidos en vivo")
    public ResponseEntity<ChatbotResponse> sendMessage(@Valid @RequestBody ChatbotRequest request) {
        return ResponseEntity.ok(chatbotService.processMessage(request));
    }
}
