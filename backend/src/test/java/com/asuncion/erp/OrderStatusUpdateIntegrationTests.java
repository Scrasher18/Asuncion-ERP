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

    @Test
    @DisplayName("SUNAT billing rules: IGV-inclusive pricing, Boleta >= 700 DNI enforcement, Clientes Varios < 700, RUC -> Factura")
    void shouldEnforceSunatBillingRulesAndIgvInclusivePricing() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");

        // Inspect catalog to pick a part with stock so we can test both < 700 and >= 700 deterministically
        MvcResult partRes = mockMvc.perform(get("/api/v1/catalog/parts/{id}", 1L))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode partJson = objectMapper.readTree(partRes.getResponse().getContentAsString());
        java.math.BigDecimal retailPrice = new java.math.BigDecimal(partJson.get("salePrice").asText());
        java.math.BigDecimal wholesalePrice = partJson.hasNonNull("wholesalePrice")
                && partJson.get("wholesalePrice").decimalValue().compareTo(java.math.BigDecimal.ZERO) > 0
                ? partJson.get("wholesalePrice").decimalValue()
                : retailPrice;
        java.math.BigDecimal posMultiUnitPrice = wholesalePrice.compareTo(retailPrice) < 0 ? wholesalePrice : retailPrice;
        int qtyForOver700 = Math.max(4, (int) Math.ceil(720.0 / posMultiUnitPrice.doubleValue()));

        // A. Boleta >= S/ 700 without DNI must be rejected (400 Bad Request)
        String over700NoDni = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "MOSTRADOR"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", ""),
                Map.entry("billingBusinessName", "CLIENTES VARIOS"),
                Map.entry("recipientName", "CLIENTES VARIOS"),
                Map.entry("paymentMethod", "MOSTRADOR_EFECTIVO"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", qtyForOver700)))
        ));
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(over700NoDni))
                .andExpect(status().isBadRequest());

        // B. Boleta >= S/ 700 with valid DNI + full name succeeds & preserves IGV-inclusive pricing
        java.math.BigDecimal expectedGross = posMultiUnitPrice.multiply(java.math.BigDecimal.valueOf(qtyForOver700))
                .setScale(2, java.math.RoundingMode.HALF_UP);
        java.math.BigDecimal expectedBase = expectedGross.divide(new java.math.BigDecimal("1.18"), 2, java.math.RoundingMode.HALF_UP);
        java.math.BigDecimal expectedIgv = expectedGross.subtract(expectedBase).setScale(2, java.math.RoundingMode.HALF_UP);

        String over700WithDni = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "MOSTRADOR"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", "71156519"),
                Map.entry("billingBusinessName", "Luis Oscar Pérez"),
                Map.entry("recipientName", "Luis Oscar Pérez"),
                Map.entry("paymentMethod", "MOSTRADOR_EFECTIVO"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", qtyForOver700)))
        ));
        MvcResult boleta700Res = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(over700WithDni))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceType").value("BOLETA"))
                .andExpect(jsonPath("$.billingDocumentNumber").value("71156519"))
                .andReturn();

        JsonNode boletaNode = objectMapper.readTree(boleta700Res.getResponse().getContentAsString());
        assertThat(new java.math.BigDecimal(boletaNode.get("totalAmount").asText())).isEqualByComparingTo(expectedGross);
        assertThat(new java.math.BigDecimal(boletaNode.get("subtotal").asText())).isEqualByComparingTo(expectedBase);
        assertThat(new java.math.BigDecimal(boletaNode.get("taxAmount").asText())).isEqualByComparingTo(expectedIgv);

        // C. Boleta < S/ 700 without DNI normalizes cleanly to CLIENTES VARIOS
        String under700Anon = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "MOSTRADOR"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", ""),
                Map.entry("billingBusinessName", "Cliente en Caja"),
                Map.entry("recipientName", "Cliente en Caja"),
                Map.entry("paymentMethod", "MOSTRADOR_EFECTIVO"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(under700Anon))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceType").value("BOLETA"))
                .andExpect(jsonPath("$.billingBusinessName").value("CLIENTES VARIOS"));

        // D. Entering 11-digit RUC selects FACTURA and stores billingAddress even on PICKUP/MOSTRADOR
        String facturaOrder = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "MOSTRADOR"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", "20608899114"),
                Map.entry("billingBusinessName", "REPUESTOS DEMO SAC"),
                Map.entry("billingAddress", "Av. Las Flores 456, San Isidro, Lima"),
                Map.entry("recipientName", "Compras Demo"),
                Map.entry("paymentMethod", "MOSTRADOR_YAPE_PLIN"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(facturaOrder))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceType").value("FACTURA"))
                .andExpect(jsonPath("$.billingDocumentNumber").value("20608899114"))
                .andExpect(jsonPath("$.billingAddress").value("Av. Las Flores 456, San Isidro, Lima"));
    }

    @Test
    @DisplayName("Online orders reject Clientes Varios, wrong delivery PIN returns 400, and forgot-password falls back to identity verification")
    void shouldRejectClientesVariosOnlineValidateWrongPinAndResetPasswordByIdentity() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");
        String driverJwt = loginAndExtractJwt("motorizado@asuncion.pe", "Asuncion2026!");

        // 1. Online < S/ 700 order cannot use "Clientes Varios"; must require customer's real name
        String onlineClientesVarios = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "PICKUP"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", ""),
                Map.entry("billingBusinessName", "Clientes Varios"),
                Map.entry("recipientName", "Clientes Varios"),
                Map.entry("paymentMethod", "YAPE"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onlineClientesVarios))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("nombres y apellidos")));

        String onlineRealNameNoDni = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "PICKUP"),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingDocumentNumber", ""),
                Map.entry("billingBusinessName", "María Torres Quispe"),
                Map.entry("recipientName", "María Torres Quispe"),
                Map.entry("paymentMethod", "YAPE"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));
        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(onlineRealNameNoDni))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.invoiceType").value("BOLETA"))
                .andExpect(jsonPath("$.billingBusinessName").value("María Torres Quispe"));

        // 2. Delivery completion rejects incorrect 4-digit security PIN with clear alert message, succeeds with real PIN
        String deliveryPayload = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "DELIVERY"),
                Map.entry("deliveryAddress", "Av. Sta. Anita 250, Santa Anita, Lima"),
                Map.entry("deliveryLatitude", -12.0450),
                Map.entry("deliveryLongitude", -76.9580),
                Map.entry("invoiceType", "BOLETA"),
                Map.entry("billingBusinessName", "Carlos Vega León"),
                Map.entry("recipientName", "Carlos Vega León"),
                Map.entry("paymentMethod", "TRANSFERENCIA"),
                Map.entry("items", List.of(Map.of("partId", 1, "quantity", 1)))
        ));
        MvcResult delivCreated = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(deliveryPayload))
                .andExpect(status().isCreated())
                .andReturn();
        JsonNode delivJson = objectMapper.readTree(delivCreated.getResponse().getContentAsString());
        long delivId = delivJson.get("id").asLong();
        String expectedPin = delivJson.get("deliverySecurityCode").asText();
        assertThat(expectedPin).matches("\\d{4}");

        // Wrong PIN ("0000" is never generated in 1000..9999)
        mockMvc.perform(post("/api/v1/delivery/orders/{id}/complete", delivId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + driverJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "receiverName", "Carlos Vega León",
                                "securityCode", "0000"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Código de seguridad de entrega incorrecto")));

        // Real PIN completes delivery
        mockMvc.perform(post("/api/v1/delivery/orders/{id}/complete", delivId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "receiverName", "Carlos Vega León",
                                "securityCode", expectedPin
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENTREGADO"));

        // 3. Forgot password: unknown email returns NOT_FOUND; registered email without SMTP falls back to DNI + Phone identity reset
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", "noexiste.prueba@asuncion.pe"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.deliveryChannel").value("NOT_FOUND"));

        String resetEmail = "reset.prueba." + System.currentTimeMillis() + "@asuncion.pe";
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "fullName", "Usuario Recuperación",
                                "email", resetEmail,
                                "password", "ClaveInicial1!",
                                "phone", "944112233",
                                "documentType", "DNI",
                                "documentNumber", "45889911"
                        ))))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", resetEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.deliveryChannel").value("IDENTITY_VERIFICATION"))
                .andExpect(jsonPath("$.requiresDocument").value(true))
                .andExpect(jsonPath("$.requiresPhone").value(true));

        // Mismatched DNI must fail
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", resetEmail,
                                "documentNumber", "00000000",
                                "phone", "944112233",
                                "newPassword", "NuevaClave2@"
                        ))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("DNI/RUC")));

        // Matching DNI + +51-prefixed/spaced phone resets password cleanly
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "email", resetEmail,
                                "documentNumber", "45889911",
                                "phone", "+51 944 112 233",
                                "newPassword", "NuevaClave2@"
                        ))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true));

        // Verify login works with the new password
        loginAndExtractJwt(resetEmail, "NuevaClave2@");
    }
}
