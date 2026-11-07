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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
@TestPropertySource(properties = {
        "app.storage.local.base-dir=./target/test-uploads",
        "app.mail.async=false"
})
class AsuncionErpIntegrationTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    private String loginAndExtractJwt(String email, String password) throws Exception {
        String payload = objectMapper.writeValueAsString(Map.of(
                "email", email,
                "password", password
        ));

        MvcResult res = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andReturn();

        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return json.get("token").asText();
    }

    @Test
    @DisplayName("1. JWT Authentication & Granular RBAC Enforcement across Roles")
    void shouldAuthenticateAndEnforceGranularRbac() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");
        String sellerJwt = loginAndExtractJwt("ventas1@asuncion.pe", "Asuncion2026!");
        String driverJwt = loginAndExtractJwt("motorizado@asuncion.pe", "Asuncion2026!");

        // Authenticated /me profile
        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("admin@asuncion.pe"))
                .andExpect(jsonPath("$.roles[0]").value("ADMIN"));

        // Unauthenticated request to protected endpoint -> 401
        mockMvc.perform(get("/api/v1/admin/analytics/dashboard"))
                .andExpect(status().isUnauthorized());

        // CLIENTE denied on ADMIN/VENDEDOR analytics & warehouse orders -> 403
        mockMvc.perform(get("/api/v1/admin/analytics/dashboard")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/v1/warehouse/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt))
                .andExpect(status().isForbidden());

        // VENDEDOR authorized on warehouse orders -> 200
        mockMvc.perform(get("/api/v1/warehouse/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + sellerJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        // MOTORIZADO authorized on delivery orders -> 200
        mockMvc.perform(get("/api/v1/delivery/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + driverJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @DisplayName("2. Geospatial Coverage Validation & Strict HTTP 422 Order Rejection Outside Radius")
    void shouldValidateGeospatialCoverageAndRejectOutOfBoundsOrderWith422() throws Exception {
        // Inside Sede Central - Santa Anita 2.5 km radius (~260m away)
        String insidePayload = objectMapper.writeValueAsString(Map.of(
                "latitude", -12.0450,
                "longitude", -76.9580,
                "branchId", 1
        ));

        mockMvc.perform(post("/api/v1/logistics/validate-coverage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(insidePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.covered").value(true))
                .andExpect(jsonPath("$.branchId").value(1))
                .andExpect(jsonPath("$.allowedRadiusMeters").value(2500.0))
                .andExpect(jsonPath("$.estimatedDeliveryFee").isNumber());

        // Outside all branches' radius (Lurín Sur: ~28 km away)
        String outsidePayload = objectMapper.writeValueAsString(Map.of(
                "latitude", -12.2750,
                "longitude", -76.8700
        ));

        mockMvc.perform(post("/api/v1/logistics/validate-coverage")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(outsidePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.covered").value(false));

        // Attempt to create DELIVERY order outside coverage -> MUST return HTTP 422 Unprocessable Entity
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");
        String invalidOrderPayload = objectMapper.writeValueAsString(Map.of(
                "branchId", 1,
                "deliveryType", "DELIVERY",
                "deliveryAddress", "Antigua Panamericana Sur Km 36, Lurín",
                "deliveryLatitude", -12.2750,
                "deliveryLongitude", -76.8700,
                "invoiceType", "FACTURA",
                "items", List.of(Map.of("partId", 1, "quantity", 1))
        ));

        mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidOrderPayload))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.status").value(422))
                .andExpect(jsonPath("$.error").value("OUT_OF_COVERAGE_RADIUS"))
                .andExpect(jsonPath("$.distanceMeters").isNumber())
                .andExpect(jsonPath("$.allowedRadiusMeters").value(2500.0));
    }

    @Test
    @DisplayName("3. Full End-to-End Order Lifecycle: Checkout -> Warehouse Picking -> Motorizado GPS Route -> Proof of Delivery")
    void shouldCompleteFullOrderWarehouseAndMotorizadoDeliveryLifecycle() throws Exception {
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        String driverJwt = loginAndExtractJwt("motorizado@asuncion.pe", "Asuncion2026!");

        // 1. Customer creates valid DELIVERY order inside coverage
        String validOrderPayload = objectMapper.writeValueAsString(Map.ofEntries(
                Map.entry("branchId", 1),
                Map.entry("deliveryType", "DELIVERY"),
                Map.entry("deliveryAddress", "Av. Sta. Anita 250, Santa Anita, Lima"),
                Map.entry("deliveryReference", "Puerta Principal"),
                Map.entry("deliveryLatitude", -12.0450),
                Map.entry("deliveryLongitude", -76.9580),
                Map.entry("invoiceType", "FACTURA"),
                Map.entry("billingDocumentNumber", "20608912345"),
                Map.entry("billingBusinessName", "Flotas Andinas SAC"),
                Map.entry("paymentMethod", "TRANSFERENCIA"),
                Map.entry("items", List.of(Map.of("partId", 3, "quantity", 2)))
        ));

        MvcResult createRes = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(validOrderPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CONFIRMADO"))
                .andExpect(jsonPath("$.orderNumber").isNotEmpty())
                .andReturn();

        JsonNode createdOrder = objectMapper.readTree(createRes.getResponse().getContentAsString());
        long orderId = createdOrder.get("id").asLong();
        long itemId = createdOrder.get("items").get(0).get("id").asLong();
        String orderNumber = createdOrder.get("orderNumber").asText();

        // 2. Order preparation: Admin/Sales starts picking, toggles item picked, marks ready for dispatch
        mockMvc.perform(patch("/api/v1/warehouse/orders/{id}/start-picking", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EN_PREPARACION"));

        mockMvc.perform(patch("/api/v1/warehouse/orders/{id}/items/{itemId}/toggle-picked", orderId, itemId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].picked").value(true));

        mockMvc.perform(patch("/api/v1/warehouse/orders/{id}/ready-for-dispatch", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("warehouseNotes", "Embalaje sellado OK"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LISTO_PARA_DESPACHO"));

        // 3. Motorizado starts GPS route and completes delivery with photo evidence
        mockMvc.perform(patch("/api/v1/delivery/orders/{id}/start-route", orderId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + driverJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("EN_RUTA"));

        MockMultipartFile evidencePhoto = new MockMultipartFile(
                "evidenceImage",
                "comprobante-entrega.png",
                MediaType.IMAGE_PNG_VALUE,
                generateSamplePngBytes(1400, 900)
        );

        mockMvc.perform(multipart("/api/v1/delivery/orders/{id}/complete", orderId)
                        .file(evidencePhoto)
                        .param("receiverName", "Ing. Martín Torres")
                        .param("receiverDocument", "43891029")
                        .param("deliveryNotes", "Entregado en almacén de flota con sello")
                        .param("capturedLatitude", "-12.0450")
                        .param("capturedLongitude", "-76.9580")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + driverJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENTREGADO"))
                .andExpect(jsonPath("$.deliveryProof.receiverName").value("Ing. Martín Torres"))
                .andExpect(jsonPath("$.deliveryProof.evidenceImageUrl").isNotEmpty());

        // 4. Public order tracking reflects complete audit trail & delivery proof
        mockMvc.perform(get("/api/v1/orders/track/{orderNumber}", orderNumber))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ENTREGADO"))
                .andExpect(jsonPath("$.statusHistory.length()").value(5));
    }

    @Test
    @DisplayName("4. Admin WebP Multimedia Upload & Catalog Multi-Variable Fitment Search")
    void shouldFilterCatalogByFitmentAndOptimizeUploadedPartImage() throws Exception {
        // Fitment filter: Toyota (makeId=1), Hilux (modelId=1), year=2020
        MvcResult catalogRes = mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("makeId", "1")
                        .param("modelId", "1")
                        .param("year", "2020")
                        .param("onlyInStock", "true"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode parts = objectMapper.readTree(catalogRes.getResponse().getContentAsString());
        assertThat(parts.isArray()).isTrue();
        assertThat(parts.size()).isGreaterThanOrEqualTo(4);
        assertThat(parts.get(0).get("images").get(0).get("isPrimary").asBoolean()).isTrue();

        // Verify genuine differentiation across Year (1980 vs 2022) and Model (Hino 500 Series vs Dutro 300)
        MvcResult modelsRes = mockMvc.perform(get("/api/v1/catalog/vehicle-models"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode allModels = objectMapper.readTree(modelsRes.getResponse().getContentAsString());
        Long hinoMakeId = null;
        Long hino500Id = null;
        Long hinoDutroId = null;
        Long yarisId = null;
        for (JsonNode m : allModels) {
            String make = m.get("makeName").asText();
            String name = m.get("name").asText();
            if ("Hino".equalsIgnoreCase(make) && "500 Series".equalsIgnoreCase(name)) {
                hinoMakeId = m.get("makeId").asLong();
                hino500Id = m.get("id").asLong();
            } else if ("Hino".equalsIgnoreCase(make) && "Dutro 300".equalsIgnoreCase(name)) {
                hinoDutroId = m.get("id").asLong();
            } else if ("Toyota".equalsIgnoreCase(make) && "Yaris".equalsIgnoreCase(name)) {
                yarisId = m.get("id").asLong();
            }
        }
        assertThat(hino500Id).isNotNull();
        assertThat(hinoDutroId).isNotNull();
        assertThat(yarisId).isNotNull();

        JsonNode hino500Classic = objectMapper.readTree(mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("makeId", String.valueOf(hinoMakeId))
                        .param("modelId", String.valueOf(hino500Id))
                        .param("year", "1980"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode hino500Modern = objectMapper.readTree(mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("makeId", String.valueOf(hinoMakeId))
                        .param("modelId", String.valueOf(hino500Id))
                        .param("year", "2022"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode hinoDutroModern = objectMapper.readTree(mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("makeId", String.valueOf(hinoMakeId))
                        .param("modelId", String.valueOf(hinoDutroId))
                        .param("year", "2022"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        JsonNode yaris2020 = objectMapper.readTree(mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("makeId", "1")
                        .param("modelId", String.valueOf(yarisId))
                        .param("year", "2020"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());

        java.util.List<String> skus500Classic = new java.util.ArrayList<>();
        hino500Classic.forEach(n -> skus500Classic.add(n.get("sku").asText()));
        java.util.List<String> skus500Modern = new java.util.ArrayList<>();
        hino500Modern.forEach(n -> skus500Modern.add(n.get("sku").asText()));
        java.util.List<String> skusDutroModern = new java.util.ArrayList<>();
        hinoDutroModern.forEach(n -> skusDutroModern.add(n.get("sku").asText()));
        java.util.List<String> skusHilux2020 = new java.util.ArrayList<>();
        parts.forEach(n -> skusHilux2020.add(n.get("sku").asText()));
        java.util.List<String> skusYaris2020 = new java.util.ArrayList<>();
        yaris2020.forEach(n -> skusYaris2020.add(n.get("sku").asText()));

        assertThat(skus500Classic).isNotEmpty();
        assertThat(skus500Modern).isNotEmpty();
        assertThat(skus500Classic).isNotEqualTo(skus500Modern);
        assertThat(skus500Modern).isNotEqualTo(skusDutroModern);
        assertThat(skusHilux2020).isNotEqualTo(skusYaris2020);

        // Admin uploads high-res image (1600x1200) -> resized & optimized via WebP pipeline
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        MockMultipartFile partPhoto = new MockMultipartFile(
                "files",
                "disco-brembo-hd.png",
                MediaType.IMAGE_PNG_VALUE,
                generateSamplePngBytes(1600, 1200)
        );

        mockMvc.perform(multipart("/api/v1/admin/parts/1/images")
                        .file(partPhoto)
                        .param("primaryIndex", "0")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.images.length()").value(2))
                .andExpect(jsonPath("$.primaryImageUrl").isNotEmpty());
    }

    @Test
    @DisplayName("5. Hybrid Chatbot Assistant: Live Vehicle Compatibility & Live Order Tracking")
    void shouldAnswerVehicleFitmentAndOrderTrackingViaChatbot() throws Exception {
        // Vehicle compatibility & stock query
        String fitmentMsg = objectMapper.writeValueAsString(Map.of(
                "message", "Hola, ¿tienen pastillas de freno para Toyota Hilux 2020?",
                "sessionId", "test-session-fitment"
        ));

        mockMvc.perform(post("/api/v1/chatbot/message")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(fitmentMsg))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("VEHICLE_FITMENT_SEARCH"))
                .andExpect(jsonPath("$.suggestedParts").isArray())
                .andExpect(jsonPath("$.suggestedParts[0].sku").isNotEmpty());

        // Live order tracking query
        String trackingMsg = objectMapper.writeValueAsString(Map.of(
                "message", "Por favor estado de mi pedido ASN-2026-0012",
                "sessionId", "test-session-track"
        ));

        mockMvc.perform(post("/api/v1/chatbot/message")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(trackingMsg))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("ORDER_TRACKING"))
                .andExpect(jsonPath("$.trackedOrder.orderNumber").value("ASN-2026-0012"))
                .andExpect(jsonPath("$.trackedOrder.status").value("EN_RUTA"));

        // Conversational accessory query for vehicle
        String accessoryMsg = objectMapper.writeValueAsString(Map.of(
                "message", "Hola me gustaria articulos para mi toyota probox",
                "sessionId", "test-session-probox-acc"
        ));

        MvcResult accResult = mockMvc.perform(post("/api/v1/chatbot/message")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(accessoryMsg))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("VEHICLE_FITMENT_SEARCH"))
                .andExpect(jsonPath("$.suggestedParts").isArray())
                .andReturn();

        String accReply = objectMapper.readTree(accResult.getResponse().getContentAsString()).get("reply").asText();
        assertThat(accReply).doesNotContain("gustaria");
        assertThat(accReply).doesNotContain("Por el momento no disponemos de");

        // Specific single part recommendation query (filtro de aceite)
        String recFilterMsg = objectMapper.writeValueAsString(Map.of(
                "message", "Que filtro de aceite me recomiendas para mi probox ?",
                "sessionId", "test-session-probox-filter"
        ));

        MvcResult filterResult = mockMvc.perform(post("/api/v1/chatbot/message")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(recFilterMsg))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intent").value("VEHICLE_FITMENT_SEARCH"))
                .andExpect(jsonPath("$.suggestedParts.length()").value(1))
                .andReturn();

        JsonNode filterJson = objectMapper.readTree(filterResult.getResponse().getContentAsString());
        String partName = filterJson.get("suggestedParts").get(0).get("name").asText();
        assertThat(partName.toLowerCase()).contains("filtro").contains("aceite");
        assertThat(partName.toLowerCase()).doesNotContain("cabina");
    }

    @Test
    @DisplayName("6. Executive Analytics Dashboard: KPIs, Dynamic Salesperson Ranking & Inventory Rotation")
    void shouldReturnExecutiveAnalyticsDashboard() throws Exception {
        String vendedorJwt = loginAndExtractJwt("ventas1@asuncion.pe", "Asuncion2026!");

        MvcResult res = mockMvc.perform(get("/api/v1/admin/analytics/dashboard")
                        .param("days", "30")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.kpis.totalRevenue").isNumber())
                .andExpect(jsonPath("$.kpis.grossProfit").isNumber())
                .andExpect(jsonPath("$.salespersonRanking.length()").value(3))
                .andExpect(jsonPath("$.salespersonRanking[0].rankPosition").value(1))
                .andExpect(jsonPath("$.highRotationParts").isArray())
                .andExpect(jsonPath("$.lowRotationParts").isArray())
                .andExpect(jsonPath("$.salesByCategory").isArray())
                .andReturn();

        JsonNode root = objectMapper.readTree(res.getResponse().getContentAsString());
        assertThat(root.path("kpis").path("totalRevenue").asDouble()).isGreaterThan(50000.0);
        assertThat(root.path("highRotationParts").size()).isGreaterThan(0);
        assertThat(root.path("lowRotationParts").get(0).path("rotationStatus").asText()).isEqualTo("SIN_MOVIMIENTO");
    }

    @Test
    @DisplayName("7. Optional SKU, OEM Code & Warehouse Location with Auto-Generated ASU-<CAT3>-XXXX SKU")
    void shouldCreateAndUpdatePartWithoutSkuOemOrWarehouseLocation() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");

        // Create spare part omitting sku, oemCode, and warehouseLocation completely
        String createPayload = objectMapper.writeValueAsString(Map.of(
                "name", "Foco Halógeno H4 12V 60/55W Luz Alta y Baja",
                "technicalDescription", "Bulbo halógeno alemán Narva H4 12V 60/55W P43t.",
                "manufacturerBrand", "Narva",
                "categoryId", 6,
                "purchasePrice", 8.50,
                "salePrice", 16.00,
                "stockQuantity", 40
        ));

        MvcResult createRes = mockMvc.perform(post("/api/v1/admin/parts")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createPayload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sku").isNotEmpty())
                .andExpect(jsonPath("$.oemCode").isEmpty())
                .andExpect(jsonPath("$.warehouseLocation").isEmpty())
                .andReturn();

        JsonNode createdPart = objectMapper.readTree(createRes.getResponse().getContentAsString());
        long partId = createdPart.get("id").asLong();
        String generatedSku = createdPart.get("sku").asText();
        assertThat(generatedSku).startsWith("ASU-ELE-");

        // Update part with blank SKU -> preserves auto-generated ASU-ELE-XXXX SKU
        String updatePayload = objectMapper.writeValueAsString(Map.of(
                "sku", "   ",
                "oemCode", "",
                "name", "Foco Halógeno H4 12V 60/55W Luz Alta y Baja Narva",
                "manufacturerBrand", "Narva",
                "categoryId", 6,
                "purchasePrice", 8.50,
                "salePrice", 17.50,
                "stockQuantity", 45,
                "warehouseLocation", ""
        ));

        mockMvc.perform(put("/api/v1/admin/parts/{id}", partId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(updatePayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sku").value(generatedSku))
                .andExpect(jsonPath("$.oemCode").isEmpty())
                .andExpect(jsonPath("$.warehouseLocation").isEmpty());

        // Public catalog & chatbot search remain 100% null-safe with null oemCode
        MvcResult narvaSearch = mockMvc.perform(get("/api/v1/catalog/parts")
                        .param("q", "narva halogeno h4"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode narvaMatches = objectMapper.readTree(narvaSearch.getResponse().getContentAsString());
        java.util.List<String> narvaSkus = new java.util.ArrayList<>();
        narvaMatches.forEach(n -> narvaSkus.add(n.get("sku").asText()));
        assertThat(narvaSkus).contains(generatedSku);
    }

    @Test
    @DisplayName("8. Smart Spare Parts Autocomplete (Narva H4), Vehicle Quick-Import & Public Lookup Endpoints")
    void shouldAutocompleteNarvaPartsQuickImportVehiclesAndLookupPublicly() throws Exception {
        String vendedorJwt = loginAndExtractJwt("ventas1@asuncion.pe", "Asuncion2026!");

        // 1. Narva H4 autocomplete template
        MvcResult partsRes = mockMvc.perform(get("/api/v1/admin/autocomplete/parts")
                        .param("q", "narva h4")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andReturn();

        JsonNode suggestions = objectMapper.readTree(partsRes.getResponse().getContentAsString());
        assertThat(suggestions.size()).isGreaterThanOrEqualTo(2);
        boolean hasNarva48881 = false;
        for (JsonNode s : suggestions) {
            if ("Narva".equals(s.path("manufacturerBrand").asText())
                    && "48881".equals(s.path("oemCode").asText())) {
                hasNarva48881 = true;
                break;
            }
        }
        assertThat(hasNarva48881).isTrue();

        // 2. Brands & Vehicle Makes/Models autocomplete
        mockMvc.perform(get("/api/v1/admin/autocomplete/brands")
                        .param("q", "narv")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("Narva"));

        mockMvc.perform(get("/api/v1/admin/autocomplete/vehicle-makes")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());

        mockMvc.perform(get("/api/v1/admin/autocomplete/vehicle-models")
                        .param("make", "Toyota")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Hilux"));

        // 3. Idempotent Vehicle Quick-Import
        String quickImportPayload = objectMapper.writeValueAsString(Map.of(
                "makeName", "Suzuki",
                "models", List.of(
                        Map.of("name", "Swift", "vehicleType", "HATCHBACK"),
                        Map.of("name", "Vitara", "vehicleType", "SUV")
                )
        ));

        mockMvc.perform(post("/api/v1/admin/vehicles/quick-import")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(quickImportPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // 4. Public /api/v1/lookup endpoints accessible without JWT & always HTTP 200 OK
        mockMvc.perform(get("/api/v1/lookup/document/12345"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.found").value(false));

        mockMvc.perform(get("/api/v1/lookup/address").param("q", "ab"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    @DisplayName("9. Automated HTML Email Notifications Outbox & Admin SMTP Configuration")
    void shouldGenerateOrderEmailNotificationLogsAndManageSmtpConfig() throws Exception {
        String adminJwt = loginAndExtractJwt("admin@asuncion.pe", "Asuncion2026!");
        String vendedorJwt = loginAndExtractJwt("ventas1@asuncion.pe", "Asuncion2026!");
        String clientJwt = loginAndExtractJwt("cliente@empresa.pe", "Asuncion2026!");

        // VENDEDOR must be forbidden from ADMIN-only notifications config
        mockMvc.perform(get("/api/v1/admin/notifications/config")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + vendedorJwt))
                .andExpect(status().isForbidden());

        // Create an order -> triggers COMPRA_CONFIRMADA and NUEVO_PEDIDO_TIENDA
        String orderPayload = objectMapper.writeValueAsString(Map.of(
                "branchId", 1,
                "deliveryType", "PICKUP",
                "invoiceType", "BOLETA",
                "paymentMethod", "YAPE_PLIN",
                "items", List.of(Map.of("partId", 3, "quantity", 1))
        ));

        MvcResult orderRes = mockMvc.perform(post("/api/v1/orders")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + clientJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(orderPayload))
                .andExpect(status().isCreated())
                .andReturn();

        String orderNumber = objectMapper.readTree(orderRes.getResponse().getContentAsString())
                .get("orderNumber").asText();

        // Retrieve notification logs as ADMIN
        MvcResult logsRes = mockMvc.perform(get("/api/v1/admin/notifications/logs")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andReturn();

        JsonNode logs = objectMapper.readTree(logsRes.getResponse().getContentAsString());
        boolean foundCompraConfirmada = false;
        boolean foundNuevoPedidoTienda = false;
        for (JsonNode logNode : logs) {
            if (orderNumber.equals(logNode.path("orderNumber").asText())) {
                String eventType = logNode.path("eventType").asText();
                if ("COMPRA_CONFIRMADA".equals(eventType)) {
                    foundCompraConfirmada = true;
                    assertThat(logNode.path("htmlBody").asText()).contains("#EA580C");
                }
                if ("NUEVO_PEDIDO_TIENDA".equals(eventType)) {
                    foundNuevoPedidoTienda = true;
                }
            }
        }
        assertThat(foundCompraConfirmada).isTrue();
        assertThat(foundNuevoPedidoTienda).isTrue();

        // Update SMTP config and verify blank password on subsequent update preserves saved password
        String putConfigWithPass = objectMapper.writeValueAsString(Map.of(
                "enabled", false,
                "smtpHost", "smtp.gmail.com",
                "smtpPort", 587,
                "username", "notificaciones.asuncion@gmail.com",
                "password", "abcd efgh ijkl mnop",
                "fromName", "Repuestos Asunción",
                "adminNotificationEmail", "gerencia@asuncion.pe"
        ));

        mockMvc.perform(put("/api/v1/admin/notifications/config")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putConfigWithPass))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPassword").value(true))
                .andExpect(jsonPath("$.adminNotificationEmail").value("gerencia@asuncion.pe"));

        String putConfigWithoutPass = objectMapper.writeValueAsString(Map.of(
                "enabled", false,
                "smtpHost", "smtp.gmail.com",
                "smtpPort", 587,
                "username", "notificaciones.asuncion@gmail.com",
                "password", "",
                "fromName", "Repuestos Asunción Perú",
                "adminNotificationEmail", "gerencia@asuncion.pe"
        ));

        mockMvc.perform(put("/api/v1/admin/notifications/config")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminJwt)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(putConfigWithoutPass))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasPassword").value(true))
                .andExpect(jsonPath("$.fromName").value("Repuestos Asunción Perú"));
    }

    private byte[] generateSamplePngBytes(int width, int height) throws Exception {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(new Color(30, 41, 59));
        g.fillRect(0, 0, width, height);
        g.setColor(new Color(239, 68, 68));
        g.fillOval(width / 4, height / 4, width / 2, height / 2);
        g.dispose();

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }
}
