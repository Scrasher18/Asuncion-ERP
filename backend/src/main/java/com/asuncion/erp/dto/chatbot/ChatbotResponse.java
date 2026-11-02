package com.asuncion.erp.dto.chatbot;

import com.asuncion.erp.dto.catalog.PartResponse;
import com.asuncion.erp.dto.order.OrderResponse;

import java.time.Instant;
import java.util.List;

public record ChatbotResponse(
        String sessionId,
        String reply,
        String intent,
        String engineUsed,
        Instant timestamp,
        OrderResponse trackedOrder,
        List<PartResponse> suggestedParts,
        List<String> quickReplies
) {
}
