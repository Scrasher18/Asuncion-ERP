package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.Part;
import com.asuncion.erp.domain.entity.PartCompatibility;
import com.asuncion.erp.domain.entity.VehicleMake;
import com.asuncion.erp.domain.entity.VehicleModel;
import com.asuncion.erp.dto.catalog.PartResponse;
import com.asuncion.erp.dto.chatbot.ChatbotRequest;
import com.asuncion.erp.dto.chatbot.ChatbotResponse;
import com.asuncion.erp.dto.logistics.BranchDto;
import com.asuncion.erp.dto.order.OrderResponse;
import com.asuncion.erp.repository.CustomerOrderRepository;
import com.asuncion.erp.repository.PartRepository;
import com.asuncion.erp.repository.VehicleMakeRepository;
import com.asuncion.erp.repository.VehicleModelRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class ChatbotService {

    private static final Logger log = LoggerFactory.getLogger(ChatbotService.class);
    private static final Pattern ORDER_CODE_PATTERN = Pattern.compile("(ASN-\\d{4}-\\d{4})", Pattern.CASE_INSENSITIVE);
    private static final Pattern YEAR_PATTERN = Pattern.compile("\\b(19[89]\\d|20[0-2]\\d)\\b");

    private static final Set<String> STOP_WORDS = Set.of(
            "hola", "buenas", "buenos", "dias", "tardes", "noches", "saludos",
            "tienen", "tiene", "hay", "busco", "necesito", "quiero", "quisiera",
            "gustaria", "gustar", "deseo", "para", "por", "favor", "del", "las", "los",
            "una", "uno", "unos", "unas", "con", "sin", "que", "cual", "cuales", "como",
            "precio", "precios", "stock", "repuesto", "repuestos", "articulo", "articulos",
            "pieza", "piezas", "producto", "productos", "item", "items", "cosa", "cosas",
            "auto", "carro", "vehiculo", "camioneta", "camion", "compatible", "compatibles",
            "consulta", "consultar", "disponible", "disponibles", "mi", "mis", "el", "la",
            "de", "en", "un", "es", "son", "me", "te", "se", "nos", "le", "les",
            "todos", "todas", "todo", "toda", "algo", "algun", "alguno", "alguna",
            "mostrar", "muestrame", "ver", "dame", "dar", "venden", "vende", "ofrecen",
            "ofrece", "catalogo", "tienda", "almacen",
            "hace", "hacen", "hacerle", "sirve", "sirven", "servir", "queda", "quedan", "quedar",
            "calza", "calzan", "calzar", "da", "dan", "darle", "va", "van", "entra", "entran",
            "lleva", "llevan", "usa", "usan", "usar", "pone", "ponen", "poner", "ponerle",
            "colocar", "cambiar", "cambio", "saber", "indica", "indicame", "dime",
            "recomienda", "recomiendas", "recomiendame", "modelo", "marca", "ano", "anos",
            "motor", "cilindrada", "litros", "tipo"
    );

    private static final List<String> DEFAULT_QUICK_REPLIES = List.of(
            "¿Tienen pastillas de freno para Toyota Hilux 2020?",
            "¿Tienen filtros de aire para Nissan Frontier?",
            "¿Cuál es su radio de cobertura y costo de delivery?",
            "¿Emiten factura electrónica con RUC para empresas?"
    );

    // Dictionary of external makes not in Asunción's core catalog
    private static final Map<String, String> EXTERNAL_MAKES = Map.ofEntries(
            Map.entry("ford", "Ford"),
            Map.entry("mazda", "Mazda"),
            Map.entry("suzuki", "Suzuki"),
            Map.entry("honda", "Honda"),
            Map.entry("renault", "Renault"),
            Map.entry("peugeot", "Peugeot"),
            Map.entry("chery", "Chery"),
            Map.entry("jac", "JAC"),
            Map.entry("great wall", "Great Wall"),
            Map.entry("haval", "Haval"),
            Map.entry("dfsk", "DFSK"),
            Map.entry("foton", "Foton"),
            Map.entry("subaru", "Subaru"),
            Map.entry("audi", "Audi"),
            Map.entry("bmw", "BMW"),
            Map.entry("mercedes", "Mercedes-Benz"),
            Map.entry("mercedes-benz", "Mercedes-Benz"),
            Map.entry("daewoo", "Daewoo"),
            Map.entry("tesla", "Tesla"),
            Map.entry("byd", "BYD"),
            Map.entry("jeep", "Jeep")
    );

    // Dictionary of external popular models
    private static final Map<String, String> EXTERNAL_MODELS = Map.ofEntries(
            Map.entry("spark", "Chevrolet Spark"),
            Map.entry("cruze", "Chevrolet Cruze"),
            Map.entry("aveo", "Chevrolet Aveo"),
            Map.entry("mazda3", "Mazda 3"),
            Map.entry("mazda 3", "Mazda 3"),
            Map.entry("mazda2", "Mazda 2"),
            Map.entry("cx3", "Mazda CX-3"),
            Map.entry("cx5", "Mazda CX-5"),
            Map.entry("swift", "Suzuki Swift"),
            Map.entry("alto", "Suzuki Alto"),
            Map.entry("celerio", "Suzuki Celerio"),
            Map.entry("civic", "Honda Civic"),
            Map.entry("fit", "Honda Fit"),
            Map.entry("crv", "Honda CR-V"),
            Map.entry("duster", "Renault Duster"),
            Map.entry("stepway", "Renault Stepway"),
            Map.entry("golf", "Volkswagen Golf"),
            Map.entry("jetta", "Volkswagen Jetta"),
            Map.entry("tico", "Daewoo Tico"),
            Map.entry("model 3", "Tesla Model 3"),
            Map.entry("model y", "Tesla Model Y"),
            Map.entry("model s", "Tesla Model S")
    );

    private final CustomerOrderRepository orderRepository;
    private final PartRepository partRepository;
    private final VehicleMakeRepository vehicleMakeRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final CatalogService catalogService;
    private final OrderService orderService;
    private final GeospatialCoverageService geospatialCoverageService;
    private final ObjectMapper objectMapper;
    private final String geminiApiKey;
    private final String geminiModel;
    private final HttpClient httpClient;

    public static class ChatSessionState {
        private Long vehicleMakeId;
        private Long vehicleModelId;
        private String vehicleMakeName;
        private String vehicleModelName;
        private Integer vehicleYear;
        private String vehicleDesc;
        private boolean isGasoline = true;
        private boolean isDiesel = false;
        private boolean isElectric = false;
        private List<PartResponse> lastSuggestedParts = new ArrayList<>();
        private Instant lastUpdated = Instant.now();

        public Long getVehicleMakeId() { return vehicleMakeId; }
        public void setVehicleMakeId(Long vehicleMakeId) { this.vehicleMakeId = vehicleMakeId; }
        public Long getVehicleModelId() { return vehicleModelId; }
        public void setVehicleModelId(Long vehicleModelId) { this.vehicleModelId = vehicleModelId; }
        public String getVehicleMakeName() { return vehicleMakeName; }
        public void setVehicleMakeName(String vehicleMakeName) { this.vehicleMakeName = vehicleMakeName; }
        public String getVehicleModelName() { return vehicleModelName; }
        public void setVehicleModelName(String vehicleModelName) { this.vehicleModelName = vehicleModelName; }
        public Integer getVehicleYear() { return vehicleYear; }
        public void setVehicleYear(Integer vehicleYear) { this.vehicleYear = vehicleYear; }
        public String getVehicleDesc() { return vehicleDesc; }
        public void setVehicleDesc(String vehicleDesc) { this.vehicleDesc = vehicleDesc; }
        public boolean isGasoline() { return isGasoline; }
        public void setGasoline(boolean gasoline) { isGasoline = gasoline; }
        public boolean isDiesel() { return isDiesel; }
        public void setDiesel(boolean diesel) { isDiesel = diesel; }
        public boolean isElectric() { return isElectric; }
        public void setElectric(boolean electric) { isElectric = electric; }
        public List<PartResponse> getLastSuggestedParts() { return lastSuggestedParts; }
        public void setLastSuggestedParts(List<PartResponse> lastSuggestedParts) { this.lastSuggestedParts = lastSuggestedParts; }
        public Instant getLastUpdated() { return lastUpdated; }
        public void setLastUpdated(Instant lastUpdated) { this.lastUpdated = lastUpdated; }
    }

    private final Map<String, ChatSessionState> sessionCache = new ConcurrentHashMap<>();

    public ChatbotService(
            CustomerOrderRepository orderRepository,
            PartRepository partRepository,
            VehicleMakeRepository vehicleMakeRepository,
            VehicleModelRepository vehicleModelRepository,
            CatalogService catalogService,
            OrderService orderService,
            GeospatialCoverageService geospatialCoverageService,
            ObjectMapper objectMapper,
            @Value("${app.chatbot.gemini-api-key:}") String geminiApiKey,
            @Value("${app.chatbot.gemini-model:gemini-3.5-flash-lite}") String geminiModel
    ) {
        this.orderRepository = orderRepository;
        this.partRepository = partRepository;
        this.vehicleMakeRepository = vehicleMakeRepository;
        this.vehicleModelRepository = vehicleModelRepository;
        this.catalogService = catalogService;
        this.orderService = orderService;
        this.geospatialCoverageService = geospatialCoverageService;
        this.objectMapper = objectMapper;
        this.geminiApiKey = geminiApiKey != null ? geminiApiKey.trim() : "";
        this.geminiModel = geminiModel != null && !geminiModel.isBlank() ? geminiModel.trim() : "gemini-3.5-flash-lite";
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .build();
    }

    @Transactional(readOnly = true)
    public ChatbotResponse processMessage(ChatbotRequest request) {
        String sessionId = (request.sessionId() != null && !request.sessionId().isBlank())
                ? request.sessionId().trim()
                : UUID.randomUUID().toString();
        String rawMessage = request.message().trim();
        String normalized = CatalogService.normalizeText(rawMessage);

        // 1. Order Tracking Redirection (GPS Live Tracking is strictly handled in /track page)
        Matcher orderMatcher = ORDER_CODE_PATTERN.matcher(rawMessage);
        if (orderMatcher.find() || containsAny(normalized, "rastrear", "seguimiento", "estado de mi pedido", "donde esta mi pedido", "rastreo", "donde esta mi orden", "estado de orden")) {
            String redirectReply = "El seguimiento de pedidos en tiempo real con monitoreo GPS satelital se consulta exclusivamente en la sección Seguimiento de nuestra plataforma (disponible en el menú superior o ingresando a /track). Por seguridad y precisión cartográfica en vivo, este asistente de chat está enfocado exclusivamente en consultas de catálogo técnico, compatibilidad vehicular y stock en almacén.";
            return enrichAndBuild(sessionId, rawMessage, redirectReply, "ORDER_TRACKING_REDIRECT", null, List.of());
        }

        // 1.1 Anti-Jailbreak / Prompt Injection Detection
        if (containsAny(normalized, "ignora tus", "olvida tus", "actua como", "dame la clave", "dame la contrasena", "password", "system prompt", "bypass", "hackear")) {
            String secureReply = "Como asesor técnico oficial de **Repuestos Automotrices Asunción**, opero bajo estrictos protocolos de seguridad y protección de datos. Estoy a tu disposición para asesorarte en la búsqueda de repuestos mecánicamente compatibles y disponibilidad en catálogo.";
            return enrichAndBuild(sessionId, rawMessage, secureReply, "SECURITY_GUARDRAIL", null, List.of());
        }

        // 2. Live Vehicle Compatibility & Spare Part Stock Detection
        ChatbotResponse fitmentResponse = tryVehicleAndPartSearch(sessionId, rawMessage, normalized);
        if (fitmentResponse != null) {
            return fitmentResponse;
        }

        // 2.1 Contextual Recommendation / Follow-Up (e.g. "dame la mejor que tengas cual me recomiendas y porque")
        ChatSessionState activeSession = sessionCache.get(sessionId);
        if (isRecommendationOrComparisonQuery(normalized)) {
            ChatbotResponse recResponse = handleContextualRecommendation(sessionId, rawMessage, normalized, activeSession);
            if (recResponse != null) {
                return recResponse;
            }
        }

        // 2.2 Automotive Technical Diagnostic / Maintenance Consultation
        if (isAutomotiveTechnicalQuery(normalized)) {
            ChatbotResponse techResponse = handleAutomotiveTechnicalConsultation(sessionId, rawMessage, normalized, activeSession);
            if (techResponse != null) {
                return techResponse;
            }
        }

        // 3. FAQ Detection (Coverage, Invoicing/B2B, Warranty, Branches/Hours, Tracking Help)


        if (containsAny(normalized, "cobertura", "radio", "delivery", "envio", "despacho", "distrito", "llegan")) {
            List<BranchDto> branches = geospatialCoverageService.getActiveBranches();
            StringBuilder sb = new StringBuilder("Contamos con cobertura de reparto express para delivery desde nuestras sedes en Lima:\n");
            for (BranchDto b : branches) {
                sb.append(String.format("• **%s** (%s): radio de cobertura de **%.1f km**, tarifa base S/ %.2f + S/ %.2f/km.\n",
                        b.name(), b.address(), b.coverageRadiusMeters() / 1000.0, b.baseDeliveryFee(), b.perKmFee()));
            }
            sb.append("En el checkout puedes seleccionar tu ubicación exacta en el mapa interactivo para validar cobertura inmediata o elegir **Recojo en Tienda** sin costo.");
            return enrichAndBuild(sessionId, rawMessage, sb.toString(), "FAQ_COVERAGE", null, List.of());
        }

        if (containsAny(normalized, "factura", "ruc", "boleta", "mayorista", "flota", "empresa", "cotizacion", "igv")) {
            String reply = "Sí, emitimos **Boleta de Venta** y **Factura Electrónica SUNAT** (con desglose automático de 18% IGV). Además, para empresas de transporte, talleres y flotas con **RUC 20/10**, contamos con precios mayoristas corporativos y atención ejecutiva especializada.";
            return enrichAndBuild(sessionId, rawMessage, reply, "FAQ_INVOICING", null, List.of());
        }

        if (containsAny(normalized, "garantia", "devolucion", "original", "oem", "calidad", "cambio")) {
            String reply = "Todos nuestros repuestos OEM y Aftermarket certificados (Brembo, Bosch, Denso, KYB, NGK, Gates, Aisin) cuentan con **garantía directa de 6 a 12 meses** contra defectos de fabricación y trazabilidad por código de parte OEM.";
            return enrichAndBuild(sessionId, rawMessage, reply, "FAQ_WARRANTY", null, List.of());
        }

        if (containsAny(normalized, "horario", "direccion", "sucursal", "sede", "tienda", "telefono", "ubicacion")) {
            List<BranchDto> branches = geospatialCoverageService.getActiveBranches();
            StringBuilder sb = new StringBuilder("Nuestras tiendas y almacenes atienden de **Lunes a Domingo de 8:00 a.m. a 8:00 p.m.** (pedidos para delivery el mismo día hasta las 6:30 p.m., recojo en tienda vigente por 48 horas):\n");
            for (BranchDto b : branches) {
                sb.append(String.format("• **%s**: %s (Tel: %s)\n", b.name(), b.address(), b.phone()));
            }
            return enrichAndBuild(sessionId, rawMessage, sb.toString(), "FAQ_BRANCHES", null, List.of());
        }

        // 4. Greeting or Unconfigured/Unknown Query
        if (isGreetingOnly(normalized)) {
            String greeting = "¡Hola! Bienvenido a Repuestos Automotrices Asunción. ¿En qué repuesto te puedo orientar hoy? Puedes indicarme la marca, modelo y año de tu vehículo (por ejemplo: 'pastillas de freno para Toyota Hilux 2020') o el código OEM/SKU que buscas.";
            return enrichAndBuild(sessionId, rawMessage, greeting, "GREETING", null, List.of());
        }

        String unconfigured = "Actualmente no tengo configurada esa información en mi base de datos técnica. Como Asistente de Autopartes Asunción, estoy especializado únicamente en consultas de nuestro catálogo de repuestos automotrices, compatibilidad vehicular (marca, modelo y año), stock en almacén, precios y horarios de atención. Por favor, indícame la marca, modelo y repuesto que necesitas (por ejemplo: 'pastillas de freno para Toyota Hilux 2020' o 'filtro de aceite para Nissan Frontier').";
        return enrichAndBuild(sessionId, rawMessage, unconfigured, "UNCONFIGURED_OR_UNKNOWN", null, List.of());
    }

    private boolean isGreetingOnly(String normalized) {
        String trimmed = normalized != null ? normalized.trim() : "";
        return trimmed.equals("hola") || trimmed.equals("buen dia") || trimmed.equals("buenos dias")
                || trimmed.equals("buenas tardes") || trimmed.equals("buenas noches")
                || trimmed.equals("saludos") || trimmed.equals("buenas") || trimmed.equals("que tal")
                || trimmed.equals("hola que tal") || trimmed.equals("hola buenas") || trimmed.equals("hola buenos dias");
    }

    private ChatbotResponse tryVehicleAndPartSearch(String sessionId, String rawMessage, String normalized) {
        List<VehicleMake> makes = vehicleMakeRepository.findAll();
        List<VehicleModel> models = vehicleModelRepository.findAll();

        VehicleModel detectedModel = models.stream()
                .filter(m -> containsWord(normalized, CatalogService.normalizeText(m.getName())))
                .max(Comparator.comparingInt(m -> m.getName().length()))
                .orElse(null);

        if (detectedModel == null && containsWord(normalized, "probox")) {
            detectedModel = models.stream()
                    .filter(m -> "probox".equalsIgnoreCase(m.getName()))
                    .findFirst()
                    .orElse(null);
        }

        VehicleMake detectedMake = detectedModel != null
                ? detectedModel.getMake()
                : makes.stream()
                    .filter(mk -> containsWord(normalized, CatalogService.normalizeText(mk.getName())))
                    .findFirst()
                    .orElse(null);

        if (detectedMake == null && containsWord(normalized, "probox")) {
            detectedMake = makes.stream()
                    .filter(mk -> "toyota".equalsIgnoreCase(mk.getName()))
                    .findFirst()
                    .orElse(null);
        }

        Integer detectedYear = null;
        Matcher yearMatcher = YEAR_PATTERN.matcher(normalized);
        if (yearMatcher.find()) {
            detectedYear = Integer.parseInt(yearMatcher.group(1));
        }

        // Detect external vehicle make or model (vehicles not present in Asunción's catalog)
        String detectedExternalVehicle = null;
        if (detectedMake == null && detectedModel == null) {
            for (Map.Entry<String, String> entry : EXTERNAL_MODELS.entrySet()) {
                if (containsWord(normalized, entry.getKey())) {
                    detectedExternalVehicle = entry.getValue();
                    break;
                }
            }
            if (detectedExternalVehicle == null) {
                for (Map.Entry<String, String> entry : EXTERNAL_MAKES.entrySet()) {
                    if (containsWord(normalized, entry.getKey())) {
                        detectedExternalVehicle = entry.getValue();
                        break;
                    }
                }
            }
        }

        ChatSessionState activeSession = sessionCache.get(sessionId);
        if (detectedMake == null && detectedModel == null && detectedExternalVehicle == null && activeSession != null && activeSession.getVehicleModelId() != null) {
            boolean hasPartKeywordsInMsg = containsAny(normalized,
                "pastilla", "freno", "disco", "filtro", "aceite", "aire", "combustible", "cabina",
                "amortiguador", "suspension", "embrague", "kit", "bujia", "bobina", "bateria",
                "alternador", "correa", "distribucion", "bomba", "agua", "radiador", "termostato", "sensor", "carburador",
                "ambientador", "ambientadores", "pinito", "little trees", "franela", "franelas", "microfibra", "paño", "paños",
                "silicona", "wd40", "wd-40", "aflojatodo", "contactos", "inyectores", "champu", "shampoo", "cables",
                "pasacorriente", "plumilla", "plumillas", "limpiaparabrisas", "carb cleaner"
            );
            if (hasPartKeywordsInMsg) {
                detectedModel = models.stream()
                        .filter(m -> m.getId().equals(activeSession.getVehicleModelId()))
                        .findFirst()
                        .orElse(null);
                if (detectedModel != null) {
                    detectedMake = detectedModel.getMake();
                    if (detectedYear == null) {
                        detectedYear = activeSession.getVehicleYear();
                    }
                }
            }
        }

        // Extract meaningful part/OEM/SKU keywords excluding detected make/model/year/external and stop words
        Set<String> excludedTokens = new HashSet<>(STOP_WORDS);
        if (detectedMake != null) {
            excludedTokens.addAll(Arrays.asList(CatalogService.normalizeText(detectedMake.getName()).split("\\s+")));
        }
        if (detectedModel != null) {
            excludedTokens.addAll(Arrays.asList(CatalogService.normalizeText(detectedModel.getName()).split("\\s+")));
        }
        if (detectedExternalVehicle != null) {
            excludedTokens.addAll(Arrays.asList(CatalogService.normalizeText(detectedExternalVehicle).split("\\s+")));
        }
        if (detectedYear != null) {
            excludedTokens.add(String.valueOf(detectedYear));
        }
        if (containsWord(normalized, "probox")) {
            excludedTokens.add("probox");
        }

        List<String> partKeywords = Arrays.stream(normalized.replaceAll("[^a-z0-9-]", " ").split("\\s+"))
                .map(String::trim)
                .filter(tok -> tok.length() >= 3 && !excludedTokens.contains(tok))
                .toList();

        List<Part> activeParts = partRepository.findByActiveTrueOrderByIdAsc();

        // Direct SKU or OEM match check
        Optional<Part> directCodeMatch = activeParts.stream()
                .filter(p -> (p.getSku() != null && !p.getSku().isBlank() && normalized.contains(p.getSku().toLowerCase()))
                        || (p.getOemCode() != null && !p.getOemCode().isBlank() && normalized.contains(p.getOemCode().toLowerCase())))
                .findFirst();
        if (directCodeMatch.isPresent()) {
            PartResponse pr = catalogService.toPartResponse(directCodeMatch.get());
            String oemLabel = (pr.oemCode() != null && !pr.oemCode().isBlank()) ? pr.oemCode() : "S/N";
            String reply = String.format(
                    "Encontré el repuesto exacto **%s** (SKU: `%s` | OEM: `%s`, Marca: **%s**): precio **S/ %.2f** y stock actual de **%d unidades**.",
                    pr.name(), pr.sku(), oemLabel, pr.manufacturerBrand(), pr.salePrice(), pr.stockQuantity()
            );
            return enrichAndBuild(sessionId, rawMessage, reply, "VEHICLE_FITMENT_SEARCH", null, List.of(pr));
        }

        // --- CASE A: ELECTRIC VEHICLE TRAP DISARMING (Tesla, BYD electric, Leaf, etc.) ---
        boolean isElectricVehicle = (detectedExternalVehicle != null && containsAny(detectedExternalVehicle.toLowerCase(), "tesla", "byd"))
                || containsAny(normalized, "tesla", "model 3", "model y", "model s", "model x", "electrico", "electrica", "leaf", "zoe", "bolt");
        boolean isIgnitionOrCombustionPart = containsAny(normalized, "bujia", "bujias", "bobina", "bobinas", "delco", "distribuidor", "chispa", "spark plug", "carburador", "escape", "tubo escape", "silenciador");
        boolean isEngineOilQuery = containsAny(normalized, "aceite", "lubricante", "5w-30", "10w-40", "15w-40", "20w-50")
                && !containsAny(normalized, "caja", "transmision", "transmisión", "frenos", "freno", "filtro");
        boolean isUniversalQuery = containsAny(normalized, "foco", "focos", "h4", "h7", "refrigerante", "coolant", "dot 4", "dot4", "liquido de freno", "liquido frenos", "plumilla", "plumillas", "limpiaparabrisas", "fusible", "fusibles");

        if (isElectricVehicle && (isIgnitionOrCombustionPart || isEngineOilQuery)) {
            String trapMsg = String.format(
                    "Aclaración técnica automotriz: El **%s** es un vehículo 100%% eléctrico (BEV) propulsado por baterías y motores de corriente alterna.\n\n"
                    + "Por su concepción tecnológica, **no cuenta con motor de combustión interna**, por lo que **no utiliza bujías de encendido, bobinas de ignición, aceite de motor, filtros de combustible ni sistema de escape**.\n\n"
                    + "En Repuestos Asunción podemos suministrarte consumibles compatibles de mantenimiento como líquido de frenos sintético Bosch DOT 4 o plumillas limpiaparabrisas.",
                    detectedExternalVehicle != null ? detectedExternalVehicle : "vehículo eléctrico"
            );
            return enrichAndBuild(sessionId, rawMessage, trapMsg, "ELECTRIC_VEHICLE_TRAP", null, List.of());
        }

        // --- CASE B: EXTERNAL VEHICLE (NOT IN LOCAL CATALOG) HANDLING ---
        if (detectedExternalVehicle != null) {
            String extDesc = detectedYear != null ? detectedExternalVehicle + " (" + detectedYear + ")" : detectedExternalVehicle;

            // B.1: If asking for motor oil for external vehicle -> Recommend SAE 5W-30 API SP standard
            if (isEngineOilQuery) {
                PartResponse oilPart = catalogService.toPartResponse(
                        activeParts.stream().filter(p -> p.getId() == 8).findFirst().orElse(null)
                );
                List<PartResponse> oilList = oilPart != null ? List.of(oilPart) : List.of();
                String oilMsg = String.format(
                        "Para **%s**, la lubricación de motor se rige por especificaciones técnicas internacionales de viscosidad SAE y norma API (habitualmente SAE 5W-30 API SN/SP para vehículos modernos a gasolina).\n\n"
                        + "En almacén disponemos de la mejor opción 100%% sintética que cumple y supera los estándares API SP / ILSAC GF-6:\n"
                        + "• **Aceite Sintético de Motor Castrol EDGE 5W-30 Titanium FST 4L** (Castrol | OEM: `EDGE-5W30-4L`) — **S/ 185.00** | Stock: **50 und.**\n\n"
                        + "*(Recomendamos verificar la viscosidad recomendada en el tapón de aceite o manual de tu %s)*.",
                        extDesc, detectedExternalVehicle
                );
                return enrichAndBuild(sessionId, rawMessage, oilMsg, "EXTERNAL_VEHICLE_OIL_SPEC", null, oilList);
            }

            // B.2: If asking for standard universal parts (coolant, bulbs, brake fluid)
            if (isUniversalQuery) {
                List<PartResponse> universalParts = activeParts.stream()
                        .filter(p -> p.getId() == 1 || p.getId() == 5 || p.getId() == 27)
                        .map(catalogService::toPartResponse)
                        .toList();
                StringBuilder sb = new StringBuilder();
                sb.append(String.format("Para **%s**, aunque no manejamos componentes mecánicos específicos de esa marca, disponemos de insumos y consumibles universales estándar 100%% compatibles:\n", extDesc));
                for (PartResponse p : universalParts) {
                    String oemLabel = (p.oemCode() != null && !p.oemCode().isBlank()) ? p.oemCode() : "S/N";
                    sb.append(String.format("• **%s** (%s | OEM: `%s`) — **S/ %.2f** | Stock: **%d und.**\n",
                            p.name(), p.manufacturerBrand(), oemLabel, p.salePrice(), p.stockQuantity()));
                }
                sb.append("\nPuedes agregarlos directamente al carrito si necesitas reposición de fluidos o iluminación.");
                return enrichAndBuild(sessionId, rawMessage, sb.toString(), "EXTERNAL_VEHICLE_UNIVERSAL_PARTS", null, universalParts);
            }

            // B.3: Specific mechanical part (brakes, suspension, timing, clutch, etc.) -> HONEST STATEMENT
            String kw = !partKeywords.isEmpty() ? String.join(", ", partKeywords) : "repuestos mecánicos específicos";
            String noStockExternalMsg = String.format(
                    "Aclaración de catálogo: Actualmente en Repuestos Asunción no contamos con stock local de **%s** específicos para **%s**.\n\n"
                    + "Nuestro almacén está especializado en repuestos certificados para las marcas de mayor circulación en Perú: **Toyota, Nissan, Hyundai, Kia, Isuzu, Mitsubishi, Hino, Volvo y Scania**.\n\n"
                    + "💡 **¿Cómo podemos ayudarte?**\n"
                    + "• Si cuentas con el **número de parte OEM** de tu pieza o nos traes la muestra física a nuestra sede en Lima, podemos verificar compatibilidad cruzada de fábrica.\n"
                    + "• También gestionamos cotizaciones e importación bajo pedido.",
                    kw, extDesc
            );
            return enrichAndBuild(sessionId, rawMessage, noStockExternalMsg, "EXTERNAL_VEHICLE_NOT_IN_CATALOG", null, List.of());
        }

        boolean hasVehicleContext = detectedMake != null || detectedModel != null || detectedYear != null;
        boolean hasPartSymptomKeywords = containsAny(normalized,
                "pastilla", "freno", "disco", "filtro", "aceite", "aire", "combustible", "cabina",
                "amortiguador", "suspension", "embrague", "kit", "bujia", "bobina", "bateria",
                "alternador", "correa", "distribucion", "bomba", "agua", "radiador", "termostato", "sensor", "carburador",
                "ambientador", "ambientadores", "pinito", "little trees", "franela", "franelas", "microfibra", "paño", "paños",
                "silicona", "wd40", "wd-40", "aflojatodo", "contactos", "inyectores", "champu", "shampoo", "cables",
                "pasacorriente", "plumilla", "plumillas", "limpiaparabrisas", "carb cleaner"
        );

        if (!hasVehicleContext && !hasPartSymptomKeywords) {
            return null;
        }

        // --- DISARM MECHANICAL AND ARCHITECTURAL TRAPS IMMEDIATELY ---
        boolean isDieselVehicle = (detectedMake != null && containsAny(CatalogService.normalizeText(detectedMake.getName()), "scania", "volvo", "hino", "isuzu"))
                || (detectedModel != null && containsAny(CatalogService.normalizeText(detectedModel.getName()), "dutro", "forward", "r-series", "fh", "npr"));
        boolean isIgnitionPart = containsAny(normalized, "bujia", "bujias", "bobina", "bobinas", "delco", "distribuidor", "chispa", "spark plug");
        boolean isCarburetor = containsAny(normalized, "carburador", "carburadores");

        if (isDieselVehicle && isIgnitionPart) {
            String vehicleDesc = buildVehicleDescription(detectedMake, detectedModel, detectedYear);
            String trapMsg = String.format(
                    "Aclaración técnica automotriz: Los camiones y unidades de transporte pesado **%s** cuentan con motorización diésel (ignición por compresión) y **no utilizan bujías de encendido a chispa ni bobinas**.\n\n"
                    + "Si buscas mantenimiento para esta unidad, disponemos de repuestos compatibles certificados en almacén:\n"
                    + "• **Aceite Diésel Heavy Duty Mobil Delvac 15W-40 1 Galón** (S/ 135.00)\n"
                    + "• **Arrancador Heavy Duty 24V 5.5kW Bosch** (S/ 1,250.00)\n"
                    + "• **Filtros de Petróleo Diésel Common-Rail**",
                    vehicleDesc
            );
            return enrichAndBuild(sessionId, rawMessage, trapMsg, "MECHANICAL_INCOMPATIBILITY_TRAP", null, List.of());
        }

        if (isCarburetor && (hasVehicleContext || containsAny(normalized, "yaris", "corolla", "hilux", "accent", "rio", "sentra", "frontier"))) {
            String vehicleDesc = hasVehicleContext ? buildVehicleDescription(detectedMake, detectedModel, detectedYear) : "modernos de inyección";
            String trapMsg = String.format(
                    "Aclaración técnica automotriz: Los vehículos **%s** cuentan con sistemas de inyección electrónica (EFI / Common-Rail) y **no utilizan carburador**.\n\n"
                    + "Si necesitas afinar el sistema de admisión o encendido, disponemos de bujías Laser Iridium NGK, bobinas de ignición, filtros e inyectores.",
                    vehicleDesc
            );
            return enrichAndBuild(sessionId, rawMessage, trapMsg, "MECHANICAL_INCOMPATIBILITY_TRAP", null, List.of());
        }

        final Long makeId = detectedMake != null ? detectedMake.getId() : null;
        final Long modelId = detectedModel != null ? detectedModel.getId() : null;
        final Integer yearFilter = detectedYear;

        List<Part> fitmentFiltered = activeParts.stream()
                .filter(p -> {
                    if (!hasVehicleContext) {
                        return true;
                    }
                    return p.getCompatibilities().stream().anyMatch(c -> {
                        boolean mkOk = makeId == null || c.getVehicleModel().getMake().getId().equals(makeId);
                        boolean mdOk = modelId == null || c.getVehicleModel().getId().equals(modelId);
                        boolean yrOk = yearFilter == null || (c.getYearStart() <= yearFilter && c.getYearEnd() >= yearFilter);
                        return mkOk && mdOk && yrOk;
                    });
                })
                .toList();

        // Intelligent Brand vs Component Isolation
        Set<String> knownBrands = Set.of(
                "bosch", "brembo", "denso", "mann", "kyb", "gates", "aisin",
                "ngk", "castrol", "mobil", "prestone", "valeo", "monroe", "bando", "555",
                "sonax", "wd-40", "wd40", "stp", "3m"
        );

        String requestedBrand = partKeywords.stream()
                .filter(knownBrands::contains)
                .findFirst()
                .orElse(null);

        List<String> componentKeywords = partKeywords.stream()
                .filter(k -> !knownBrands.contains(k))
                .toList();

        String vehicleDesc = buildVehicleDescription(detectedMake, detectedModel, detectedYear);

        List<Part> matched = List.of();
        List<Part> alternativeBrandParts = List.of();

        if (requestedBrand != null) {
            // First attempt: exact match on both brand AND component
            matched = fitmentFiltered.stream()
                    .filter(p -> matchesStemmedKeywords(p, List.of(requestedBrand))
                            && (componentKeywords.isEmpty() || matchesStemmedKeywords(p, componentKeywords)))
                    .toList();

            // If brand not found, but we have alternative certified brands for the same component on this vehicle:
            if (matched.isEmpty() && !componentKeywords.isEmpty()) {
                alternativeBrandParts = fitmentFiltered.stream()
                        .filter(p -> matchesStemmedKeywords(p, componentKeywords))
                        .toList();
            }
        } else if (!partKeywords.isEmpty()) {
            // Filter by component keywords without random vehicle fallback
            matched = fitmentFiltered.stream()
                    .filter(p -> matchesStemmedKeywords(p, partKeywords))
                    .toList();
        } else {
            matched = fitmentFiltered;
        }

        // --- AUTOMOTIVE SEMANTIC DISCRIMINATION (Specific Filter Types, Liquid Oils, Transmission, Gasoline vs Heavy Diesel) ---
        boolean isLookingForOilFilter = containsAny(normalized, "filtro de aceite", "filtro aceite", "filtro para aceite");
        boolean isLookingForAirFilter = containsAny(normalized, "filtro de aire", "filtro aire", "filtro para aire") && !containsAny(normalized, "cabina", "antipolen");
        boolean isLookingForCabinFilter = containsAny(normalized, "filtro de cabina", "filtro cabina", "filtro antipolen", "filtro de aire acondicionado");
        boolean isLookingForFuelFilter = containsAny(normalized, "filtro de combustible", "filtro de petroleo", "filtro petroleo", "filtro diesel", "filtro gasolina");
        boolean isLookingForAnyFilter = containsAny(normalized, "filtro", "filtros");
        boolean isLookingForLiquidOil = !isLookingForAnyFilter && containsAny(normalized, "aceite", "aceites", "lubricante", "lubricantes", "sintetico", "semisintetico", "mineral");
        boolean isLookingForTransmission = containsAny(normalized, "caja", "transmision", "transmisión", "caja de cambios", "caja cambios", "diferencial", "corona", "mecanica", "automatica");
        boolean isGasolinePassengerVehicle = (detectedModel != null && containsAny(CatalogService.normalizeText(detectedModel.getName()), "probox", "yaris", "corolla", "accent", "rio", "tiida", "sentra", "versa", "picanto", "cerato", "elantra", "caldina"))
                || (detectedMake != null && !isDieselVehicle);
        boolean isAskingRecommendation = containsAny(normalized,
                "recomiendas", "recomiendame", "recomendar", "cual me recomiendas", "cual elijo",
                "cual compro", "cual es mejor", "la mejor", "el mejor", "solo 1", "solo uno",
                "dame el mejor", "dame la mejor", "le hace", "le queda", "le calza", "le da",
                "le sirve", "cual le hace", "que le hace", "cual le queda", "que filtro", "que pastilla"
        );
        boolean isAccessoryQuery = containsAny(normalized, "articulo", "articulos", "accesorio", "accesorios", "cuidado", "limpieza", "estetica", "ambientador", "ambientadores", "franela", "franelas", "silicona", "shampoo");

        // 0. If user specifically asks for accessories / car care articles (franelas, ambientadores, ceras, WD-40, silicone, etc.):
        if (isAccessoryQuery && !isLookingForAnyFilter && !isLookingForLiquidOil) {
            matched = activeParts.stream()
                    .filter(p -> {
                        String n = p.getName().toLowerCase();
                        return n.contains("ambientador") || n.contains("franela") || n.contains("wd-40") || n.contains("wd40")
                                || n.contains("silicona") || n.contains("shampoo") || n.contains("plumilla")
                                || n.contains("limpiador") || n.contains("desengrasante") || n.contains("cable")
                                || (p.getCategory() != null && "ACCESORIOS".equalsIgnoreCase(p.getCategory().getCode()))
                                || (p.getCategory() != null && p.getCategory().getId() == 8L);
                    })
                    .sorted(Comparator.comparing(Part::getStockQuantity, Comparator.reverseOrder()))
                    .toList();

            if (matched.isEmpty()) {
                matched = fitmentFiltered;
            }
        }
        // 1. Oil Filter search: match ONLY genuine oil filters
        else if (isLookingForOilFilter) {
            matched = fitmentFiltered.stream()
                    .filter(p -> {
                        String name = p.getName().toLowerCase();
                        return name.contains("filtro") && name.contains("aceite");
                    })
                    .toList();
        }
        // 2. Engine Air Filter search: match ONLY engine air filters
        else if (isLookingForAirFilter) {
            matched = fitmentFiltered.stream()
                    .filter(p -> {
                        String name = p.getName().toLowerCase();
                        return name.contains("filtro") && name.contains("aire") && !name.contains("cabina") && !name.contains("antipolen");
                    })
                    .toList();
        }
        // 3. Cabin Air Filter search: match ONLY cabin/antipollen filters
        else if (isLookingForCabinFilter) {
            matched = fitmentFiltered.stream()
                    .filter(p -> {
                        String name = p.getName().toLowerCase();
                        return name.contains("cabina") || name.contains("antipolen");
                    })
                    .toList();
        }
        // 4. Fuel / Diesel Filter search
        else if (isLookingForFuelFilter) {
            matched = fitmentFiltered.stream()
                    .filter(p -> {
                        String name = p.getName().toLowerCase();
                        return name.contains("filtro") && (name.contains("combustible") || name.contains("petroleo") || name.contains("petróleo") || name.contains("diesel") || name.contains("gasolina"));
                    })
                    .toList();
        }
        // 5. Generic filter query without specific subtype
        else if (isLookingForAnyFilter) {
            matched = fitmentFiltered.stream()
                    .filter(p -> p.getName().toLowerCase().contains("filtro"))
                    .toList();
        }
        // 6. Liquid motor oil (excluding physical filters, cloths, accessories, and transmission fluids)
        else if (isLookingForLiquidOil) {
            matched = fitmentFiltered.stream()
                    .filter(p -> {
                        String name = p.getName().toLowerCase();
                        boolean isFilter = name.contains("filtro");
                        boolean isAccessoryOrCleaner = name.contains("franela") || name.contains("paño") || name.contains("microfibra")
                                || name.contains("limpiador") || name.contains("cleaner") || name.contains("desengrasante")
                                || name.contains("aflojatodo") || name.contains("silicona") || name.contains("shampoo")
                                || name.contains("champú") || name.contains("cera") || name.contains("ambientador")
                                || name.contains("tratamiento") || name.contains("aditivo") || name.contains("cable")
                                || name.contains("compresor") || name.contains("gata") || name.contains("pastilla") || name.contains("freno");
                        return (name.contains("aceite") || name.contains("lubricante") || p.getCategory().getId() == 2L)
                                && !isFilter && !isAccessoryOrCleaner;
                    })
                    .toList();

            if (!isLookingForTransmission) {
                matched = matched.stream()
                        .filter(p -> !p.getName().toLowerCase().contains("transmisión")
                                && !p.getName().toLowerCase().contains("transmision")
                                && !p.getName().toLowerCase().contains("atf")
                                && !p.getName().toLowerCase().contains("75w-90")
                                && !p.getName().toLowerCase().contains("80w-90"))
                        .toList();
            }

            if (isGasolinePassengerVehicle) {
                matched = matched.stream()
                        .filter(p -> !p.getName().toLowerCase().contains("diésel")
                                && !p.getName().toLowerCase().contains("diesel")
                                && !p.getName().toLowerCase().contains("delvac")
                                && !p.getName().toLowerCase().contains("15w-40"))
                        .sorted((a, b) -> {
                            boolean aIs5w30 = a.getName().toLowerCase().contains("5w-30");
                            boolean bIs5w30 = b.getName().toLowerCase().contains("5w-30");
                            if (aIs5w30 && !bIs5w30) return -1;
                            if (!aIs5w30 && bIs5w30) return 1;
                            return 0;
                        })
                        .toList();
            } else if (isDieselVehicle) {
                matched = matched.stream()
                        .filter(p -> p.getName().toLowerCase().contains("diésel")
                                || p.getName().toLowerCase().contains("diesel")
                                || p.getName().toLowerCase().contains("15w-40")
                                || p.getName().toLowerCase().contains("delvac"))
                        .toList();
            }
        }
        // 7. General vehicle catalog search (when no specific component keyword was provided):
        else if (partKeywords.isEmpty() && !isAccessoryQuery) {
            matched = fitmentFiltered.stream()
                    .sorted(Comparator.comparingInt(this::getVehiclePartPriority)
                            .thenComparing(Part::getStockQuantity, Comparator.reverseOrder()))
                    .toList();
        }

        // SCENARIO 1: Alternative Brand Recommendation (Requested brand not in stock, but certified alternative exists)
        if (matched.isEmpty() && !alternativeBrandParts.isEmpty()) {
            List<PartResponse> altSuggested = alternativeBrandParts.stream()
                    .sorted(Comparator.comparing(Part::getStockQuantity, Comparator.reverseOrder()))
                    .limit(isAskingRecommendation ? 1 : 4)
                    .map(catalogService::toPartResponse)
                    .toList();

            String brandLabel = requestedBrand.substring(0, 1).toUpperCase() + requestedBrand.substring(1);
            String compLabel = String.join(" ", componentKeywords);
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("Por el momento no contamos con %s de la marca %s para %s en almacén.\n\n", compLabel, brandLabel, vehicleDesc));
            sb.append(String.format("Sin embargo, te recomendamos nuestra opción 100%% compatible y certificada de equipo original:\n"));
            for (PartResponse p : altSuggested) {
                String oemLabel = (p.oemCode() != null && !p.oemCode().isBlank()) ? p.oemCode() : "S/N";
                sb.append(String.format("• %s (%s | OEM: %s) — S/ %.2f | Stock: %d und.\n",
                        p.name(), p.manufacturerBrand(), oemLabel, p.salePrice(), p.stockQuantity()));
            }
            sb.append("\nCumple rigurosamente con los estándares y tolerancias del fabricante para tu vehículo.");
            return enrichAndBuild(sessionId, rawMessage, sb.toString(), "BRAND_ALTERNATIVE_RECOMMENDATION", null, altSuggested);
        }

        Comparator<Part> partComparator;
        if (isAccessoryQuery) {
            partComparator = Comparator.comparing(Part::getStockQuantity, Comparator.reverseOrder());
        } else if (partKeywords.isEmpty()) {
            partComparator = Comparator.comparingInt(this::getVehiclePartPriority)
                    .thenComparing(Part::getStockQuantity, Comparator.reverseOrder());
        } else {
            partComparator = Comparator.comparing(Part::getStockQuantity, Comparator.reverseOrder());
        }

        int maxLimit = isAskingRecommendation ? 1 : 5;
        List<PartResponse> suggested = matched.stream()
                .sorted(partComparator)
                .limit(maxLimit)
                .map(catalogService::toPartResponse)
                .toList();

        // SCENARIO 2: No exact match for the component requested
        if (suggested.isEmpty()) {
            if (hasVehicleContext && !partKeywords.isEmpty()) {
                String requestedItemLabel;
                if (isLookingForOilFilter) {
                    requestedItemLabel = "filtro de aceite";
                } else if (isLookingForAirFilter) {
                    requestedItemLabel = "filtro de aire de motor";
                } else if (isLookingForCabinFilter) {
                    requestedItemLabel = "filtro de cabina";
                } else if (isLookingForFuelFilter) {
                    requestedItemLabel = "filtro de combustible";
                } else if (isLookingForLiquidOil) {
                    requestedItemLabel = "aceite de motor";
                } else {
                    requestedItemLabel = String.join(" ", partKeywords);
                }

                String noMatchMsg = String.format("Por el momento no disponemos de %s compatible con %s en almacén. En nuestro catálogo disponemos de sistemas de frenos, suspensión, distribución y lubricación certificada para otras aplicaciones.", requestedItemLabel, vehicleDesc);
                return enrichAndBuild(sessionId, rawMessage, noMatchMsg, "VEHICLE_FITMENT_SEARCH", null, List.of());
            } else if (hasVehicleContext) {
                String noMatchMsg = String.format("Por el momento no encontré repuestos con stock exacto para %s con ese criterio específico.", vehicleDesc);
                return enrichAndBuild(sessionId, rawMessage, noMatchMsg, "VEHICLE_FITMENT_SEARCH", null, List.of());
            } else {
                String noMatchMsg = "No encontré repuestos que coincidan exactamente con esa descripción. Prueba indicándome la marca, modelo y año de tu vehículo (ej. Toyota Hilux, Probox o Nissan Frontier).";
                return enrichAndBuild(sessionId, rawMessage, noMatchMsg, "VEHICLE_FITMENT_SEARCH", null, List.of());
            }
        }

        StringBuilder sb = new StringBuilder();
        if (hasVehicleContext) {
            if (isAskingRecommendation) {
                if (isLookingForOilFilter) {
                    sb.append(String.format("Para tu %s, el filtro de aceite exacto y recomendado técnicamente es:\n", vehicleDesc));
                } else if (isLookingForAirFilter) {
                    sb.append(String.format("Para tu %s, el filtro de aire de motor recomendado técnicamente es:\n", vehicleDesc));
                } else if (isLookingForCabinFilter) {
                    sb.append(String.format("Para tu %s, el filtro de cabina antipolen recomendado es:\n", vehicleDesc));
                } else if (isLookingForLiquidOil) {
                    sb.append(String.format("Para tu %s, el lubricante de motor 100%% recomendado es:\n", vehicleDesc));
                } else {
                    sb.append(String.format("Para tu %s, la mejor opción recomendada en almacén es:\n", vehicleDesc));
                }
            } else if (isAccessoryQuery) {
                sb.append(String.format("Para tu %s, disponemos de los siguientes artículos y accesorios de cuidado automotriz en almacén:\n", vehicleDesc));
            } else {
                if (isLookingForOilFilter) {
                    sb.append(String.format("Para %s, encontré %d filtro(s) de aceite compatible(s) en almacén:\n", vehicleDesc, suggested.size()));
                } else if (isLookingForAirFilter) {
                    sb.append(String.format("Para %s, encontré %d filtro(s) de aire de motor en almacén:\n", vehicleDesc, suggested.size()));
                } else if (isLookingForCabinFilter) {
                    sb.append(String.format("Para %s, encontré %d filtro(s) de cabina en almacén:\n", vehicleDesc, suggested.size()));
                } else if (isLookingForLiquidOil) {
                    sb.append(String.format("Para %s, encontré %d lubricante(s) de motor en almacén:\n", vehicleDesc, suggested.size()));
                } else {
                    sb.append(String.format("Para %s, contamos con estos repuestos certificados y consumibles compatibles en almacén:\n", vehicleDesc));
                }
            }
        } else {
            sb.append(String.format("Encontré %d repuesto(s) en almacén:\n", suggested.size()));
        }

        for (PartResponse p : suggested) {
            String oemLabel = (p.oemCode() != null && !p.oemCode().isBlank()) ? p.oemCode() : "S/N";
            sb.append(String.format("• %s (%s | OEM: %s) — S/ %.2f | Stock: %d und.\n",
                    p.name(), p.manufacturerBrand(), oemLabel, p.salePrice(), p.stockQuantity()));
        }

        if (isAskingRecommendation) {
            if (isLookingForOilFilter) {
                sb.append("\nCuenta con válvula de retención y medio filtrante sintético de microfibra diseñado para proteger el motor y tolerancias VVT-i.");
            } else if (isLookingForLiquidOil && isGasolinePassengerVehicle) {
                sb.append("\nEspecificación SAE 5W-30 sintético con norma API SP para máxima protección del motor en frío y en ciudad.");
            }
        }

        // Update session cache with vehicle context & suggested parts
        if (sessionId != null && !sessionId.isBlank() && hasVehicleContext) {
            ChatSessionState currentSession = sessionCache.computeIfAbsent(sessionId, k -> new ChatSessionState());
            if (detectedMake != null) {
                currentSession.setVehicleMakeId(detectedMake.getId());
                currentSession.setVehicleMakeName(detectedMake.getName());
            }
            if (detectedModel != null) {
                currentSession.setVehicleModelId(detectedModel.getId());
                currentSession.setVehicleModelName(detectedModel.getName());
            }
            currentSession.setVehicleYear(detectedYear);
            currentSession.setVehicleDesc(vehicleDesc);
            currentSession.setGasoline(isGasolinePassengerVehicle);
            currentSession.setDiesel(isDieselVehicle);
            currentSession.setElectric(isElectricVehicle);
            currentSession.setLastSuggestedParts(suggested);
            currentSession.setLastUpdated(Instant.now());
        }

        return enrichAndBuild(sessionId, rawMessage, sb.toString(), "VEHICLE_FITMENT_SEARCH", null, suggested);
    }

    private ChatbotResponse enrichAndBuild(
            String sessionId,
            String userMessage,
            String deterministicReply,
            String intent,
            OrderResponse trackedOrder,
            List<PartResponse> suggestedParts
    ) {
        String finalReply = deterministicReply;
        String engine = "HYBRID_DB";

        // Save suggested parts in session if present
        if (sessionId != null && !sessionId.isBlank() && suggestedParts != null && !suggestedParts.isEmpty()) {
            ChatSessionState currentSession = sessionCache.computeIfAbsent(sessionId, k -> new ChatSessionState());
            currentSession.setLastSuggestedParts(suggestedParts);
            currentSession.setLastUpdated(Instant.now());
        }

        if (!geminiApiKey.isEmpty()) {
            String geminiText = callGeminiWithContext(userMessage, deterministicReply);
            if (geminiText != null && !geminiText.isBlank()) {
                finalReply = geminiText.trim();
                engine = "HYBRID_DB_PLUS_GEMINI";
            }
        }

        return new ChatbotResponse(
                sessionId,
                finalReply,
                intent,
                engine,
                Instant.now(),
                trackedOrder,
                suggestedParts,
                DEFAULT_QUICK_REPLIES
        );
    }

    private String callGeminiWithContext(String userMessage, String dbContext) {
        if (geminiApiKey == null || geminiApiKey.isBlank()) {
            return null;
        }
        try {
            String prompt = """
                    Eres el asesor técnico y especialista automotriz oficial de "Repuestos Automotrices Asunción" en Lima, Perú.
                    Tu objetivo es responder de forma concisa, profesional y directa a la consulta del cliente.

                    DIRECTRICES OBLIGATORIAS:
                    1. BREVEDAD: Responde en MÁXIMO 40 a 50 palabras. Ve al grano sin introducciones largas ni rodeos.
                    2. RECOMENDACIÓN PUNTUAL: Si el cliente pide recomendación o pide un repuesto específico (por ejemplo "¿qué filtro de aceite me recomiendas?"), recomienda ÚNICAMENTE el repuesto exacto que tenemos disponible en almacén indicado en los datos. No agregues piezas que no pidió (si pide filtro de aceite, no menciones aceites líquidos ni filtros de aire).
                    3. JUSTIFICACIÓN Y CONOCIMIENTO AUTOMOTRIZ: Responde con autoridad técnica sobre cualquier consulta mecánica, de mantenimiento preventivo, viscosidades de aceite, frenos, distribución, suspensión, fallas comunes y especificaciones OEM (SAE, API, DOT).
                    4. FORMATO: TOTALMENTE PROHIBIDO USAR ASTERISCOS (**) O MARCAS MARKDOWN. Escribe en texto limpio y legible.
                    5. PROHIBIDO USAR EMOJIS.
                    6. CONSULTAS TRAMPA:
                       - Si preguntan por bujías en camiones pesados diésel (Scania, Volvo, Hino): Aclara técnicamente que los motores diésel encienden por compresión y no usan bujías de chispa.
                       - Si preguntan por repuestos de combustión para autos 100% eléctricos: Aclara que no llevan motor a combustión ni aceite de motor.
                    7. AMPLITUD TEMÁTICA AUTOMOTRIZ: Si el cliente consulta sobre diagnóstico de fallas (ruidos, vibraciones, frenado esponjoso, sobrecalentamiento, chirridos), intervalos de cambio de fajas o fluidos, o diferencias de materiales (cerámico vs semimetálico), responde con fundamento técnico automotriz claro y sugiere la solución con las piezas OEM y Aftermarket de Repuestos Asunción.
                    8. HONESTIDAD ESTRICTA Y CERO ALUCINACIONES (REGLA MANDATORIA): Si el cliente pregunta por información que NO está en los DATOS OFICIALES DE ALMACÉN, o por temas que no tenemos configurados, repuestos de marcas que no vendemos, o preguntas no automotrices o fuera de catálogo: DI LA VERDAD con total transparencia. NUNCA inventes repuestos, compatibilidades ni afirmes cosas que no están configuradas. Responde con claridad: "Actualmente no tengo configurada esa información en mi base de datos técnica. Como Asistente de Autopartes Asunción, estoy especializado únicamente en consultas de repuestos de nuestro catálogo, compatibilidad vehicular por marca y modelo, stock en almacén y horarios de atención."
                    9. SEGUIMIENTO DE PEDIDOS: El seguimiento de pedidos ya NO se realiza en este chat. Si el usuario pregunta por rastreo de pedidos o escribe un código ASN-2026-XXXX, indícale claramente que debe consultar en la sección "Seguimiento" (/track) del menú superior para ver el monitoreo GPS satelital en vivo.



                    DATOS OFICIALES DE ALMACÉN:
                    %s

                    CONSULTA DEL CLIENTE:
                    %s

                    Responde en texto plano, sin asteriscos y sin emojis.
                    """.formatted(dbContext, userMessage);

            Map<String, Object> payload = Map.of(
                    "contents", List.of(Map.of(
                            "parts", List.of(Map.of("text", prompt))
                    ))
            );
            String jsonBody = objectMapper.writeValueAsString(payload);

            URI uri = URI.create("https://generativelanguage.googleapis.com/v1beta/models/"
                    + geminiModel + ":generateContent?key=" + geminiApiKey);

            HttpRequest req = HttpRequest.newBuilder(uri)
                    .header("Content-Type", "application/json")
                    .timeout(Duration.ofSeconds(25))
                    .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                JsonNode root = objectMapper.readTree(resp.body());
                JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
                if (!textNode.isMissingNode() && !textNode.asText().isBlank()) {
                    return cleanAiResponse(textNode.asText());
                }
            } else if (!"gemini-1.5-flash".equals(geminiModel)) {
                log.info("Gemini modelo {} respondió con status {}, intentando fallback a gemini-1.5-flash", geminiModel, resp.statusCode());
                URI fallbackUri = URI.create("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + geminiApiKey);
                HttpRequest fallbackReq = HttpRequest.newBuilder(fallbackUri)
                        .header("Content-Type", "application/json")
                        .timeout(Duration.ofSeconds(25))
                        .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                        .build();
                HttpResponse<String> fbResp = httpClient.send(fallbackReq, HttpResponse.BodyHandlers.ofString());
                if (fbResp.statusCode() == 200) {
                    JsonNode root = objectMapper.readTree(fbResp.body());
                    JsonNode textNode = root.path("candidates").path(0).path("content").path("parts").path(0).path("text");
                    if (!textNode.isMissingNode() && !textNode.asText().isBlank()) {
                        return cleanAiResponse(textNode.asText());
                    }
                } else {
                    log.warn("Gemini fallback gemini-1.5-flash respondió status {}: {}", fbResp.statusCode(), fbResp.body());
                }
            } else {
                log.warn("Gemini API call falló con status {}: {}", resp.statusCode(), resp.body());
            }
        } catch (Exception e) {
            log.debug("Fallback a motor HYBRID_DB local (Gemini no disponible: {})", e.getMessage());
        }
        return null;
    }

    private String cleanAiResponse(String raw) {
        if (raw == null) return null;
        return raw.replaceAll("\\*\\*", "")
                .replaceAll("\\*", "")
                .replaceAll("(?m)^#+\\s*", "")
                .replaceAll("[\\p{So}\\p{Cn}]", "")
                .trim();
    }

    private boolean isRecommendationOrComparisonQuery(String text) {
        return containsAny(text,
                "recomienda", "recomiendas", "recomiendame", "recomendar", "recomendacion",
                "la mejor", "el mejor", "lo mejor", "las mejores", "los mejores",
                "dame la mejor", "dame el mejor", "cual elijo", "cual compro", "cual llevo", "cual conviene",
                "porque", "por que", "diferencia", "cual es mejor", "que me aconsejas",
                "cual me sugieres", "cual elegir", "cual es de mejor calidad", "cual dura mas"
        );
    }

    private ChatbotResponse handleContextualRecommendation(
            String sessionId,
            String rawMessage,
            String normalized,
            ChatSessionState session
    ) {
        if (session == null || session.getLastSuggestedParts() == null || session.getLastSuggestedParts().isEmpty()) {
            String promptMsg = "Para brindarte la mejor recomendación y explicarte por qué técnicamente, por favor indícame qué repuesto buscas (por ejemplo: filtro de aceite, aceite de motor o pastillas de freno) y para qué vehículo (marca, modelo y año).";
            return enrichAndBuild(sessionId, rawMessage, promptMsg, "RECOMMENDATION_ADVISORY", null, List.of());
        }

        List<PartResponse> parts = session.getLastSuggestedParts();
        String vehicleDesc = session.getVehicleDesc() != null ? session.getVehicleDesc() : "tu vehículo";

        // Case A: Filter recommendation (if last search had filters)
        PartResponse filter = parts.stream().filter(p -> p.name().toLowerCase().contains("filtro")).findFirst().orElse(null);
        if (filter != null) {
            String reply = String.format(
                "Para tu %s, la mejor recomendación es el %s (S/ %.2f). Cuenta con válvula antirretorno y medio filtrante de microfibra que protege la presión de lubricación y evita el desgaste prematuro del motor.",
                vehicleDesc, filter.name(), filter.salePrice()
            );
            return enrichAndBuild(sessionId, rawMessage, reply, "RECOMMENDATION_ADVISORY", null, List.of(filter));
        }

        // Case B: Oils / Lubricants recommendation
        boolean hasOil = parts.stream().anyMatch(p -> p.name().toLowerCase().contains("aceite") || (p.categoryName() != null && p.categoryName().toLowerCase().contains("lubricante")));
        if (hasOil) {
            PartResponse castrolEdge = parts.stream()
                    .filter(p -> p.name().toLowerCase().contains("5w-30") || p.name().toLowerCase().contains("edge"))
                    .findFirst()
                    .orElse(parts.get(0));
            String reply = String.format(
                "Para tu %s, la mejor opción recomendada es el %s (S/ %.2f). Su fórmula 100%% sintética cumple con la norma API SP requerida para motores VVT-i, garantizando máxima fluidez y protección contra el calor en ciudad.",
                vehicleDesc, castrolEdge.name(), castrolEdge.salePrice()
            );
            return enrichAndBuild(sessionId, rawMessage, reply, "RECOMMENDATION_ADVISORY", null, List.of(castrolEdge));
        }

        // Case C: Brake pads
        boolean hasBrakes = parts.stream().anyMatch(p -> p.name().toLowerCase().contains("pastilla") || (p.categoryName() != null && p.categoryName().toLowerCase().contains("freno")));
        if (hasBrakes) {
            PartResponse brembo = parts.stream().filter(p -> p.manufacturerBrand().toLowerCase().contains("brembo")).findFirst().orElse(null);
            PartResponse best = brembo != null ? brembo : parts.get(0);
            String reply = String.format(
                "Para tu %s, te recomiendo las pastillas %s (S/ %.2f). Ofrecen excelente coeficiente de fricción, disipación de calor y certificación ECE R90 para una frenada firme y silenciosa.",
                vehicleDesc, best.name(), best.salePrice()
            );
            return enrichAndBuild(sessionId, rawMessage, reply, "RECOMMENDATION_ADVISORY", null, List.of(best));
        }

        // Case D: Spark Plugs (NGK Iridium vs standard)
        boolean hasPlugs = parts.stream().anyMatch(p -> p.name().toLowerCase().contains("bujia") || p.name().toLowerCase().contains("bujía"));
        if (hasPlugs) {
            PartResponse iridium = parts.stream().filter(p -> p.name().toLowerCase().contains("iridium")).findFirst().orElse(parts.get(0));
            String reply = String.format(
                "Para tu %s, la mejor opción son las bujías %s (S/ %.2f). Su punta de iridio de 0.6 mm garantiza encendido instantáneo y una vida útil prolongada de hasta 100,000 km.",
                vehicleDesc, iridium.name(), iridium.salePrice()
            );
            return enrichAndBuild(sessionId, rawMessage, reply, "RECOMMENDATION_ADVISORY", null, List.of(iridium));
        }

        // Case E: General parts
        PartResponse bestPart = parts.get(0);
        String reply = String.format(
            "Para tu %s, te recomiendo %s (%s | S/ %.2f) por contar con ajuste milimétrico de equipo original y garantía directa de 12 meses.",
            vehicleDesc, bestPart.name(), bestPart.manufacturerBrand(), bestPart.salePrice()
        );
        return enrichAndBuild(sessionId, rawMessage, reply, "RECOMMENDATION_ADVISORY", null, List.of(bestPart));
    }

    private boolean isAutomotiveTechnicalQuery(String text) {
        return containsAny(text,
                "bujia", "bujias", "chispa", "iridium", "cobre",
                "freno", "frenos", "pastilla", "pastillas", "disco", "discos", "chirrido", "chillido", "frenado",
                "aceite", "lubricante", "viscosidad", "5w-30", "15w-40", "10w-40", "sintetico", "mineral",
                "amortiguador", "amortiguadores", "suspension",
                "refrigerante", "coolant", "calienta", "temperatura",
                "bateria", "alternador", "arrancador",
                "embrague", "clutch", "disco de embrague",
                "filtro de aire", "filtro de aceite", "filtro de gasolina",
                "humo blanco", "humo negro", "humo azul", "pierde fuerza"
        );
    }

    private ChatbotResponse handleAutomotiveTechnicalConsultation(
            String sessionId,
            String rawMessage,
            String normalized,
            ChatSessionState session
    ) {
        StringBuilder sb = new StringBuilder();

        if (containsAny(normalized, "chirrido", "chillido", "ruido al frenar", "chillan")) {
            sb.append("Un chirrido agudo al frenar suele deberse a dos factores mecánicos comunes:\n\n")
              .append("1. **Avisador acústico de pastillas**: La lámina metálica incorporada en la pastilla roza el disco cuando el compuesto de fricción baja de 3 mm de espesor, indicando cambio urgente.\n")
              .append("2. **Cristalización de disco o pastilla**: Producida por frenadas violentas continuas o recalentamiento sin asentamiento adecuado.\n\n")
              .append("En Repuestos Asunción disponemos de pastillas **Brembo** y **Bosch** con láminas aislantes anti-ruido y líquido Bosch DOT 4. ¿Para qué vehículo las necesitas?");
        } else if (containsAny(normalized, "humo blanco", "humo negro", "humo azul")) {
            sb.append("Diagnóstico por color de humo en el tubo de escape:\n\n")
              .append("• **Humo blanco espeso y constante**: Indica paso de refrigerante a la cámara de combustión (empaque de culata soplado o fisura).\n")
              .append("• **Humo negro**: Mezcla rica por exceso de combustible o falta de aire (filtro de aire saturado, inyectores goteando o sensor de oxígeno defectuoso).\n")
              .append("• **Humo azulado**: Consumo de aceite de motor por retenes de válvula desgastados o anillos de pistón pegados.\n\n")
              .append("Si necesitas filtros, bujías o sensores, indícanos tu modelo para consultar piezas compatibles.");
        } else if (containsAny(normalized, "refrigerante", "coolant", "agua")) {
            sb.append("Sobre el sistema de enfriamiento del motor:\n\n")
              .append("Recomendamos utilizar **Refrigerante 50/50 listo para usar (como Prestone)** en lugar de agua común. El agua hierve a 100°C y oxida las galerías internas del motor de aluminio y la bomba de agua. La mezcla 50/50 eleva el punto de ebullición hasta 129°C y contiene inhibidores orgánicos contra la corrosión y cavitación.\n\n")
              .append("Disponemos de Prestone 50/50 oficial a S/ 48.00 el galón.");
        } else if (containsAny(normalized, "bujia", "bujias", "iridium", "cobre")) {
            sb.append("Comparativa técnica de bujías de encendido:\n\n")
              .append("• **NGK Laser Iridium (Recomendada)**: Electrodo de 0.6 mm de iridio y pastilla de platino. Genera chispa más potente con menor consumo y dura hasta **100,000 km**.\n")
              .append("• **Bujías convencionales de Cobre**: Económicas pero con vida útil de 20,000 km.\n\n")
              .append("En Repuestos Asunción contamos con stock de NGK Laser Iridium y Bosch Double Platinum. ¿Qué marca y modelo de auto conduces?");
        } else {
            sb.append("En Repuestos Automotrices Asunción somos especialistas en repuestos certificados OEM y Aftermarket premium (Brembo, Bosch, Castrol, Mobil, Denso, NGK, Mann Filter, KYB, Valeo).\n\n")
              .append("Para darte una asesoría técnica exacta con precios en tiempo real y tolerancias de fábrica, por favor indícanos el **modelo, marca y año** de tu vehículo.");
        }

        return enrichAndBuild(sessionId, rawMessage, sb.toString(), "AUTOMOTIVE_CONSULTATION", null, List.of());
    }

    private boolean matchesStemmedKeywords(Part p, List<String> keywords) {
        StringBuilder primarySb = new StringBuilder();
        primarySb.append(p.getName()).append(' ')
                .append(p.getCategory().getName()).append(' ')
                .append(p.getManufacturerBrand().getName()).append(' ');
        if (p.getSku() != null) {
            primarySb.append(p.getSku()).append(' ');
        }
        if (p.getOemCode() != null && !p.getOemCode().isBlank()) {
            primarySb.append(p.getOemCode()).append(' ');
        }
        for (PartCompatibility c : p.getCompatibilities()) {
            if (c.getEngineSpec() != null) primarySb.append(' ').append(c.getEngineSpec());
        }
        String primaryHaystack = CatalogService.normalizeText(primarySb.toString());

        // 1. Direct match on Part Name, Brand, Category, SKU, OEM or Engine Spec
        boolean primaryMatch = keywords.stream().anyMatch(kw -> {
            String stem = stemSpanish(kw);
            if (kw.startsWith("lubrican") && (primaryHaystack.contains("lubricac") || primaryHaystack.contains("aceite"))) {
                return true;
            }
            if ((kw.equals("aceite") || kw.equals("aceites")) && primaryHaystack.contains("lubricac")) {
                return true;
            }
            return primaryHaystack.contains(kw) || (stem.length() >= 3 && primaryHaystack.contains(stem));
        });
        if (primaryMatch) {
            return true;
        }

        // 2. If no primary match, check technical description ONLY if keywords don't conflict with component nouns
        // (preventing cleaning cloths, rags, or sprays from acting like engine oil or brake systems)
        boolean isComponentNoun = keywords.stream().anyMatch(kw ->
                containsAny(kw, "aceite", "aceites", "lubricante", "lubricantes", "filtro", "filtros",
                        "freno", "frenos", "pastilla", "pastillas", "disco", "discos",
                        "bujia", "bujias", "amortiguador", "amortiguadores", "bateria", "baterias", "embrague")
        );
        if (!isComponentNoun && p.getTechnicalDescription() != null) {
            String descHaystack = CatalogService.normalizeText(p.getTechnicalDescription());
            return keywords.stream().anyMatch(kw -> {
                String stem = stemSpanish(kw);
                return descHaystack.contains(kw) || (stem.length() >= 3 && descHaystack.contains(stem));
            });
        }

        return false;
    }

    private String stemSpanish(String word) {
        if (word.endsWith("es") && word.length() > 5) {
            return word.substring(0, word.length() - 2);
        }
        if (word.endsWith("s") && word.length() > 4) {
            return word.substring(0, word.length() - 1);
        }
        return word;
    }

    private String buildVehicleDescription(VehicleMake make, VehicleModel model, Integer year) {
        List<String> parts = new ArrayList<>();
        if (make != null) parts.add(make.getName());
        if (model != null) parts.add(model.getName());
        if (year != null) parts.add(String.valueOf(year));
        return String.join(" ", parts);
    }

    private boolean containsWord(String text, String word) {
        if (word.isEmpty()) return false;
        Pattern p = Pattern.compile("(^|\\s|[^a-z0-9])" + Pattern.quote(word) + "($|\\s|[^a-z0-9])");
        return p.matcher(text).find();
    }

    private boolean containsAny(String text, String... terms) {
        for (String t : terms) {
            if (text.contains(t)) {
                return true;
            }
        }
        return false;
    }

    private int getVehiclePartPriority(Part p) {
        String name = p.getName().toLowerCase();
        if (name.contains("aceite") && !name.contains("filtro") && !name.contains("caja")) return 1;
        if (name.contains("filtro") && name.contains("aceite")) return 2;
        if (name.contains("filtro") && name.contains("aire") && !name.contains("cabina")) return 3;
        if (name.contains("pastilla") || name.contains("freno")) return 4;
        if (name.contains("bujia") || name.contains("bujía")) return 5;
        if (name.contains("filtro") && name.contains("cabina")) return 6;
        if (name.contains("amortiguador")) return 7;
        if (name.contains("embrague")) return 8;
        return 9;
    }
}
