package com.asuncion.erp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "app.storage.local.base-dir=./target/test-uploads",
        "app.mail.async=false"
})
class OrderStatusUpdateIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String loginAndExtractJwt(String email, String password) throws Exception {
        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", email, "password", password))))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("token").asText();
    }

    @Test
    @DisplayName("PATCH /orders/{id}/status handles PICKUP collection without driver, RBAC, and DELIVERY cancel")
    void shouldHandlePickupPaymentCollectionDeliveryGuardAndCancellation() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        String sellerJwt = loginAndExtractJwt("ventas1@asuncion.pe", "Asuncion2026!");
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");

        // 1. Create a PICKUP order with pending payment at counter
        String pickupPayload = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "PICKUP"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("paymentMethod", "CONTRA_ENTREGA"),
                Map.entry("recipientName", "Betsy Vila"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));

        MvcResult pickupRes = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(pickupPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"))
                .andReturn();

        long pickupOrderId = objectMapper.readTree(pickupRes.getResponse().getContentAsString()).get("id").asLong();

        // CLIENTE is forbidden from mutating order operational status
        mockMvc.perform(patch("/api/v1/orders/{id}/status", pickupOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "EN_PREPARACION"))))
                .andExpect(status().isForbidden());

        // VENDEDOR moves pickup order to EN_PREPARACION -> LISTO_PARA_DESPACHO
        mockMvc.perform(patch("/api/v1/orders/{id}/status", pickupOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + sellerJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "EN_PREPARACION"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EN_PREPARACION"));

        mockMvc.perform(patch("/api/v1/orders/{id}/status", pickupOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + sellerJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "LISTO_PARA_DESPACHO"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LISTO_PARA_DESPACHO"))
                .andExpect(jsonPath("$.assignedDriverId").value(org.hamcrest.Matchers.nullValue()));

        // ADMIN completes counter collection & delivery with YAPE and no assigned driver
        MvcResult completedPickup = mockMvc.perform(patch("/api/v1/orders/{id}/status", pickupOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "status", "ENTREGADO",
                                "paymentMethod", "YAPE",
                                "receiverName", "Betsy Vila",
                                "receiverDocument", "44556677",
                                "notes", "Cobrado en caja"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENTREGADO"))
                .andExpect(jsonPath("$.paymentMethod").value("YAPE"))
                .andExpect(jsonPath("$.assignedDriverId").value(org.hamcrest.Matchers.nullValue()))
                .andExpect(jsonPath("$.deliveryProof.receiverName").value("Betsy Vila"))
                .andReturn();

        JsonNode completedNode = objectMapper.readTree(completedPickup.getResponse().getContentAsString());
        assertThat(completedNode.path("assignedDriverId").isNull()).isTrue();

        // 2. Create DELIVERY order and verify EN_RUTA requires assigned driver & CANCELADO restores stock
        MvcResult stockBeforeRes = mockMvc.perform(get("/api/v1/catalog/parts/{id}", 2L))
                .andExpect(status().isOk())
                .andReturn();
        int initialStock = objectMapper.readTree(stockBeforeRes.getResponse().getContentAsString()).get("stockQuantity").asInt();

        String deliveryPayload = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "DELIVERY"),
                Map.entry("deliveryAddress", "Av. Sta. Anita 250, Santa Anita, Lima"),
                Map.entry("deliveryLatitude", -12.0450),
                Map.entry("deliveryLongitude", -76.9580),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("paymentMethod", "TRANSFERENCIA"),
                Map.entry("items", List.of(Map.of("partId", 2, "quantity", 2)))
        ));

        MvcResult deliveryRes = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(deliveryPayload))
                .andExpect(status().isCreated())
                .andReturn();
        long deliveryOrderId = objectMapper.readTree(deliveryRes.getResponse().getContentAsString()).get("id").asLong();

        // Moving DELIVERY to EN_RUTA without assigned driver is rejected with 400
        mockMvc.perform(patch("/api/v1/orders/{id}/status", deliveryOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "EN_RUTA"))))
                .andExpect(status().isBadRequest());

        // Cancelling restores stock cleanly
        mockMvc.perform(patch("/api/v1/orders/{id}/status", deliveryOrderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("status", "CANCELADO", "notes", "Prueba cancelación"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELADO"));

        MvcResult stockAfterRes = mockMvc.perform(get("/api/v1/catalog/parts/{id}", 2L))
                .andExpect(status().isOk())
                .andReturn();
        int restoredStock = objectMapper.readTree(stockAfterRes.getResponse().getContentAsString()).get("stockQuantity").asInt();
        assertThat(restoredStock).isEqualTo(initialStock);
    }
}
