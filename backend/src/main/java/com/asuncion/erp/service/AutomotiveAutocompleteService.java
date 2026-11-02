package com.asuncion.erp.service;

import com.asuncion.erp.domain.entity.ManufacturerBrand;
import com.asuncion.erp.domain.entity.VehicleModel;
import com.asuncion.erp.dto.autocomplete.PartTemplateSuggestionDto;
import com.asuncion.erp.dto.autocomplete.VehicleModelSuggestionDto;
import com.asuncion.erp.repository.ManufacturerBrandRepository;
import com.asuncion.erp.repository.VehicleMakeRepository;
import com.asuncion.erp.repository.VehicleModelRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class AutomotiveAutocompleteService {

    private static final Logger log = LoggerFactory.getLogger(AutomotiveAutocompleteService.class);

    private static final List<String> CURATED_BRANDS = List.of(
            "Narva", "Bosch", "Brembo", "Denso", "NGK", "KYB", "Mann-Filter", "Valeo",
            "Aisin", "Gates", "Philips", "Osram", "Sakura", "Monroe", "Exedy", "Castrol",
            "Mobil", "Shell", "Etna", "GMB", "TYC", "Kashiyama", "Mitsuboshi", "Continental",
            "Toyota Genuine", "Hyundai Mobis", "ACDelco", "TRW", "SKF", "NTN",
            "Depo", "Liqui Moly", "Mahle", "Koyo"
    );

    private static final List<String> POPULAR_PERU_MAKES = List.of(
            "Toyota", "Hyundai", "Kia", "Nissan", "Chevrolet", "Suzuki", "Volkswagen",
            "Mitsubishi", "Mazda", "Honda", "Ford", "Subaru", "Changan", "JAC",
            "Great Wall", "Haval", "Peugeot", "Renault", "Isuzu", "Mercedes-Benz"
    );

    private static final Map<String, List<VehicleModelSuggestionDto>> CURATED_PERU_MODELS = buildCuratedPeruModels();
    private static final List<PartTemplateSuggestionDto> CURATED_PARTS = buildCuratedPeruvianParts();

    private final ManufacturerBrandRepository manufacturerBrandRepository;
    private final VehicleMakeRepository vehicleMakeRepository;
    private final VehicleModelRepository vehicleModelRepository;
    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final Map<String, List<VehicleModelSuggestionDto>> nhtsaCache = new ConcurrentHashMap<>();

    public AutomotiveAutocompleteService(
            ManufacturerBrandRepository manufacturerBrandRepository,
            VehicleMakeRepository vehicleMakeRepository,
            VehicleModelRepository vehicleModelRepository,
            ObjectMapper objectMapper
    ) {
        this.manufacturerBrandRepository = manufacturerBrandRepository;
        this.vehicleMakeRepository = vehicleMakeRepository;
        this.vehicleModelRepository = vehicleModelRepository;
        this.objectMapper = objectMapper;
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
    }

    public List<PartTemplateSuggestionDto> suggestParts(String q) {
        if (q == null || q.isBlank()) {
            return CURATED_PARTS.subList(0, Math.min(12, CURATED_PARTS.size()));
        }

        List<String> tokens = Arrays.stream(CatalogService.normalizeText(q).split("\\s+"))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();

        if (tokens.isEmpty()) {
            return CURATED_PARTS.subList(0, Math.min(12, CURATED_PARTS.size()));
        }

        record ScoredTemplate(PartTemplateSuggestionDto dto, int score) {
        }

        List<ScoredTemplate> matches = new ArrayList<>();
        for (PartTemplateSuggestionDto item : CURATED_PARTS) {
            String primaryText = CatalogService.normalizeText(
                    item.name() + " " + item.manufacturerBrand() + " " + (item.oemCode() != null ? item.oemCode() : "")
            );
            String fullHaystack = primaryText + " " + CatalogService.normalizeText(
                    item.categoryCode() + " " + item.technicalDescription() + " " + String.join(" ", item.commonVehicles())
            );

            boolean allMatch = tokens.stream().allMatch(fullHaystack::contains);
            if (!allMatch) {
                continue;
            }

            int score = 0;
            if (tokens.stream().allMatch(primaryText::contains)) {
                score += 50;
            }
            String normOem = CatalogService.normalizeText(item.oemCode());
            String normBrand = CatalogService.normalizeText(item.manufacturerBrand());
            String normName = CatalogService.normalizeText(item.name());
            for (String tok : tokens) {
                if (!normOem.isEmpty() && normOem.equals(tok)) score += 40;
                else if (!normOem.isEmpty() && normOem.contains(tok)) score += 20;
                if (normBrand.equals(tok)) score += 25;
                else if (normBrand.contains(tok)) score += 12;
                if (normName.startsWith(tok)) score += 15;
                else if (normName.contains(tok)) score += 8;
            }
            matches.add(new ScoredTemplate(item, score));
        }

        return matches.stream()
                .sorted(Comparator.comparingInt(ScoredTemplate::score).reversed())
                .limit(20)
                .map(ScoredTemplate::dto)
                .toList();
    }

    public List<String> suggestBrands(String q) {
        Map<String, String> merged = new LinkedHashMap<>();
        for (String brand : CURATED_BRANDS) {
            merged.putIfAbsent(CatalogService.normalizeText(brand), brand);
        }
        for (ManufacturerBrand dbBrand : manufacturerBrandRepository.findAll()) {
            if (dbBrand.getName() != null && !dbBrand.getName().isBlank()) {
                merged.putIfAbsent(CatalogService.normalizeText(dbBrand.getName()), dbBrand.getName().trim());
            }
        }

        String normQuery = CatalogService.normalizeText(q);
        if (normQuery.isBlank()) {
            return new ArrayList<>(merged.values());
        }

        return merged.entrySet().stream()
                .filter(e -> e.getKey().contains(normQuery))
                .sorted(Comparator.comparingInt((Map.Entry<String, String> e) -> e.getKey().startsWith(normQuery) ? 0 : 1)
                        .thenComparing(Map.Entry::getValue))
                .map(Map.Entry::getValue)
                .toList();
    }

    public List<String> suggestVehicleMakes(String q) {
        Map<String, String> merged = new LinkedHashMap<>();
        for (String make : POPULAR_PERU_MAKES) {
            merged.putIfAbsent(CatalogService.normalizeText(make), make);
        }
        vehicleMakeRepository.findAllByOrderByNameAsc().forEach(dbMake -> {
            if (dbMake.getName() != null && !dbMake.getName().isBlank()) {
                merged.putIfAbsent(CatalogService.normalizeText(dbMake.getName()), dbMake.getName().trim());
            }
        });

        String normQuery = CatalogService.normalizeText(q);
        if (normQuery.isBlank()) {
            return new ArrayList<>(merged.values());
        }
        return merged.entrySet().stream()
                .filter(e -> e.getKey().contains(normQuery))
                .map(Map.Entry::getValue)
                .toList();
    }

    public List<VehicleModelSuggestionDto> suggestVehicleModels(String makeName) {
        if (makeName == null || makeName.isBlank()) {
            return List.of();
        }
        String cleanMake = makeName.trim();
        String normMake = CatalogService.normalizeText(cleanMake);

        Map<String, VehicleModelSuggestionDto> deduplicated = new LinkedHashMap<>();

        // 1. Curated Peruvian commercial models first (accurate vehicleType & local market priority)
        List<VehicleModelSuggestionDto> curated = CURATED_PERU_MODELS.getOrDefault(normMake, List.of());
        for (VehicleModelSuggestionDto m : curated) {
            deduplicated.putIfAbsent(CatalogService.normalizeText(m.name()), m);
        }

        // 2. Existing models registered in ERP DB
        vehicleMakeRepository.findByNameIgnoreCase(cleanMake).ifPresent(dbMake -> {
            List<VehicleModel> dbModels = vehicleModelRepository.findByMakeIdOrderByNameAsc(dbMake.getId());
            for (VehicleModel dm : dbModels) {
                deduplicated.putIfAbsent(
                        CatalogService.normalizeText(dm.getName()),
                        new VehicleModelSuggestionDto(dm.getName(), dm.getVehicleType())
                );
            }
        });

        // 3. Official NHTSA vPIC API live models
        List<VehicleModelSuggestionDto> nhtsaModels = fetchNhtsaModels(cleanMake, normMake);
        for (VehicleModelSuggestionDto nm : nhtsaModels) {
            if (deduplicated.size() >= 40) {
                break;
            }
            deduplicated.putIfAbsent(CatalogService.normalizeText(nm.name()), nm);
        }

        List<VehicleModelSuggestionDto> result = new ArrayList<>(deduplicated.values());
        return result.size() > 40 ? result.subList(0, 40) : result;
    }

    private List<VehicleModelSuggestionDto> fetchNhtsaModels(String makeName, String normKey) {
        List<VehicleModelSuggestionDto> cached = nhtsaCache.get(normKey);
        if (cached != null) {
            return cached;
        }

        try {
            String encoded = URLEncoder.encode(makeName, StandardCharsets.UTF_8).replace("+", "%20");
            URI uri = URI.create("https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMake/" + encoded + "?format=json");

            HttpRequest req = HttpRequest.newBuilder(uri)
                    .timeout(Duration.ofSeconds(4))
                    .header("User-Agent", "RepuestosAsuncionApp/1.0")
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (resp.statusCode() != 200 || resp.body() == null || resp.body().isBlank()) {
                return List.of();
            }

            JsonNode root = objectMapper.readTree(resp.body());
            JsonNode results = root.path("Results");
            if (!results.isArray()) {
                return List.of();
            }

            List<VehicleModelSuggestionDto> parsed = new ArrayList<>();
            for (JsonNode node : results) {
                String modelName = node.path("Model_Name").asText("").trim();
                if (!isCleanPassengerOrLightCommercialModel(modelName)) {
                    continue;
                }
                parsed.add(new VehicleModelSuggestionDto(modelName, inferVehicleType(modelName)));
                if (parsed.size() >= 45) {
                    break;
                }
            }
            if (!parsed.isEmpty()) {
                nhtsaCache.put(normKey, List.copyOf(parsed));
            }
            return parsed;
        } catch (Exception e) {
            log.debug("NHTSA vPIC API no disponible para '{}': {}", makeName, e.getMessage());
            return List.of();
        }
    }

    private static boolean isCleanPassengerOrLightCommercialModel(String name) {
        if (name == null || name.length() < 2 || name.length() > 32) {
            return false;
        }
        String lower = name.toLowerCase(Locale.ROOT);
        if (lower.contains("trailer") || lower.contains("motorcycle") || lower.contains("scooter")
                || lower.contains("chassis") || lower.contains("incomplete") || lower.contains("tractor")
                || lower.contains("forklift") || lower.contains("bus")) {
            return false;
        }
        return name.matches("[A-Za-z0-9][A-Za-z0-9 \\-/().]*");
    }

    private static String inferVehicleType(String modelName) {
        String u = modelName.toUpperCase(Locale.ROOT);
        if (u.contains("HILUX") || u.contains("FRONTIER") || u.contains("AMAROK") || u.contains("RANGER")
                || u.contains("L200") || u.contains("TACOMA") || u.contains("TUNDRA") || u.contains("COLORADO")
                || u.contains("SILVERADO") || u.contains("F-150") || u.contains("BT-50") || u.contains("D-MAX")
                || u.contains("WINGLE") || u.contains("POER") || u.contains("NP300") || u.contains("SAVEIRO")) {
            return "PICKUP";
        }
        if (u.contains("HIACE") || u.contains("URVAN") || u.contains("STARIA") || u.contains("H-1")
                || u.contains("AVANZA") || u.contains("APV") || u.contains("SPRINTER") || u.contains("TRANSIT")
                || u.contains("PARTNER") || u.contains("BERLINGO") || u.contains("KANGOO") || u.contains("N300")) {
            return "VAN";
        }
        if (u.contains("RAV4") || u.contains("TUCSON") || u.contains("SPORTAGE") || u.contains("SANTA FE")
                || u.contains("CRETA") || u.contains("SELTOS") || u.contains("SORENTO") || u.contains("FORTUNER")
                || u.contains("PRADO") || u.contains("4RUNNER") || u.contains("KICKS") || u.contains("QASHQAI")
                || u.contains("X-TRAIL") || u.contains("PATHFINDER") || u.contains("TIGUAN") || u.contains("TAOS")
                || u.contains("T-CROSS") || u.contains("TRACKER") || u.contains("CAPTIVA") || u.contains("TAHOE")
                || u.contains("VITARA") || u.contains("JIMNY") || u.contains("CX-") || u.contains("CR-V")
                || u.contains("HR-V") || u.contains("PILOT") || u.contains("EXPLORER") || u.contains("ESCAPE")
                || u.contains("ECOSPORT") || u.contains("FORESTER") || u.contains("OUTBACK") || u.contains("XV")
                || u.contains("CROSSTREK") || u.contains("OUTLANDER") || u.contains("ASX") || u.contains("MONTERO")
                || u.contains("DUSTER") || u.contains("KOLEOS") || u.contains("2008") || u.contains("3008")
                || u.contains("5008") || u.contains("JOLION") || u.contains("H6") || u.contains("CS15")
                || u.contains("CS35") || u.contains("CS55") || u.contains("JS2") || u.contains("JS3") || u.contains("JS4")) {
            return "SUV";
        }
        if (u.contains("PICANTO") || u.contains("I10") || u.contains("I20") || u.contains("SWIFT")
                || u.contains("BALENO") || u.contains("CELERIO") || u.contains("ALTO") || u.contains("GOL")
                || u.contains("POLO") || u.contains("GOLF") || u.contains("MARCH") || u.contains("SPARK")
                || u.contains("FIT") || u.contains("FIESTA") || u.contains("208") || u.contains("SANDERO")
                || u.contains("KWID")) {
            return "HATCHBACK";
        }
        return "SEDAN";
    }

    private static Map<String, List<VehicleModelSuggestionDto>> buildCuratedPeruModels() {
        Map<String, List<VehicleModelSuggestionDto>> map = new HashMap<>();

        map.put("toyota", List.of(
                vm("Hilux", "PICKUP"), vm("Yaris", "SEDAN"), vm("Corolla", "SEDAN"),
                vm("RAV4", "SUV"), vm("Fortuner", "SUV"), vm("Hiace", "VAN"),
                vm("Avanza", "VAN"), vm("Rush", "SUV"), vm("Raize", "SUV"),
                vm("Corolla Cross", "SUV"), vm("Etios", "SEDAN"), vm("Land Cruiser Prado", "SUV")
        ));
        map.put("hyundai", List.of(
                vm("Accent", "SEDAN"), vm("Tucson", "SUV"), vm("Elantra", "SEDAN"),
                vm("Creta", "SUV"), vm("Grand i10", "HATCHBACK"), vm("Santa Fe", "SUV"),
                vm("i20", "HATCHBACK"), vm("H-100", "VAN"), vm("H-1", "VAN"),
                vm("Venue", "SUV"), vm("Staria", "VAN")
        ));
        map.put("kia", List.of(
                vm("Rio", "SEDAN"), vm("Picanto", "HATCHBACK"), vm("Sportage", "SUV"),
                vm("Soluto", "SEDAN"), vm("Seltos", "SUV"), vm("Sonet", "SUV"),
                vm("Cerato", "SEDAN"), vm("Sorento", "SUV"), vm("K2700", "PICKUP")
        ));
        map.put("nissan", List.of(
                vm("Frontier", "PICKUP"), vm("Sentra", "SEDAN"), vm("Versa", "SEDAN"),
                vm("Kicks", "SUV"), vm("X-Trail", "SUV"), vm("Qashqai", "SUV"),
                vm("Tiida", "SEDAN"), vm("March", "HATCHBACK"), vm("Urvan", "VAN")
        ));
        map.put("chevrolet", List.of(
                vm("Onix", "SEDAN"), vm("Sail", "SEDAN"), vm("Tracker", "SUV"),
                vm("Captiva", "SUV"), vm("N300", "VAN"), vm("N400", "VAN"),
                vm("Groove", "SUV"), vm("Spin", "VAN"), vm("Colorado", "PICKUP"), vm("Spark GT", "HATCHBACK")
        ));
        map.put("suzuki", List.of(
                vm("Swift", "HATCHBACK"), vm("Dzire", "SEDAN"), vm("Vitara", "SUV"),
                vm("Grand Nomade", "SUV"), vm("Ertiga", "VAN"), vm("XL7", "SUV"),
                vm("Alto", "HATCHBACK"), vm("Celerio", "HATCHBACK"), vm("Baleno", "HATCHBACK"),
                vm("Jimny", "SUV"), vm("APV", "VAN")
        ));
        map.put("volkswagen", List.of(
                vm("Amarok", "PICKUP"), vm("Gol", "HATCHBACK"), vm("Virtus", "SEDAN"),
                vm("Polo", "HATCHBACK"), vm("T-Cross", "SUV"), vm("Nivus", "SUV"),
                vm("Taos", "SUV"), vm("Tiguan", "SUV"), vm("Jetta", "SEDAN"), vm("Saveiro", "PICKUP")
        ));
        map.put("mitsubishi", List.of(
                vm("L200", "PICKUP"), vm("ASX", "SUV"), vm("Outlander", "SUV"),
                vm("Xpander", "VAN"), vm("Montero Sport", "SUV"), vm("Eclipse Cross", "SUV"), vm("Mirage", "HATCHBACK")
        ));
        map.put("mazda", List.of(
                vm("Mazda 3", "SEDAN"), vm("Mazda 2", "SEDAN"), vm("CX-30", "SUV"),
                vm("CX-5", "SUV"), vm("CX-3", "SUV"), vm("CX-9", "SUV"), vm("BT-50", "PICKUP")
        ));
        map.put("honda", List.of(
                vm("CR-V", "SUV"), vm("HR-V", "SUV"), vm("Civic", "SEDAN"),
                vm("WR-V", "SUV"), vm("City", "SEDAN"), vm("Pilot", "SUV"), vm("Fit", "HATCHBACK")
        ));
        map.put("ford", List.of(
                vm("Ranger", "PICKUP"), vm("Territory", "SUV"), vm("Escape", "SUV"),
                vm("Explorer", "SUV"), vm("EcoSport", "SUV"), vm("F-150", "PICKUP"),
                vm("Maverick", "PICKUP"), vm("Transit", "VAN")
        ));
        map.put("subaru", List.of(
                vm("Forester", "SUV"), vm("Crosstrek", "SUV"), vm("XV", "SUV"),
                vm("Outback", "SUV"), vm("Impreza", "SEDAN"), vm("Evoltis", "SUV"), vm("WRX", "SEDAN")
        ));
        map.put("changan", List.of(
                vm("CS15", "SUV"), vm("CS35 Plus", "SUV"), vm("CS55 Plus", "SUV"),
                vm("Alsvin", "SEDAN"), vm("New Van", "VAN"), vm("Hunter", "PICKUP"), vm("UNI-T", "SUV")
        ));
        map.put("jac", List.of(
                vm("JS2", "SUV"), vm("JS3", "SUV"), vm("JS4", "SUV"),
                vm("T6", "PICKUP"), vm("T8", "PICKUP"), vm("Refine", "VAN"), vm("Sunray", "VAN")
        ));
        map.put("great wall", List.of(
                vm("Poer", "PICKUP"), vm("Wingle 5", "PICKUP"), vm("Wingle 7", "PICKUP")
        ));
        map.put("haval", List.of(
                vm("Jolion", "SUV"), vm("H6", "SUV"), vm("Dargo", "SUV")
        ));
        map.put("peugeot", List.of(
                vm("Partner", "VAN"), vm("2008", "SUV"), vm("3008", "SUV"),
                vm("5008", "SUV"), vm("208", "HATCHBACK"), vm("301", "SEDAN"), vm("Landtrek", "PICKUP")
        ));
        map.put("renault", List.of(
                vm("Duster", "SUV"), vm("Kwid", "HATCHBACK"), vm("Logan", "SEDAN"),
                vm("Stepway", "HATCHBACK"), vm("Oroch", "PICKUP"), vm("Koleos", "SUV"),
                vm("Kangoo", "VAN"), vm("Master", "VAN")
        ));
        map.put("isuzu", List.of(
                vm("D-Max", "PICKUP"), vm("MU-X", "SUV"), vm("NLR", "VAN"), vm("NPR", "VAN")
        ));
        map.put("mercedes-benz", List.of(
                vm("Sprinter", "VAN"), vm("Vito", "VAN"), vm("Clase C", "SEDAN"),
                vm("GLA", "SUV"), vm("GLC", "SUV"), vm("GLE", "SUV")
        ));

        return Collections.unmodifiableMap(map);
    }

    private static List<PartTemplateSuggestionDto> buildCuratedPeruvianParts() {
        List<PartTemplateSuggestionDto> list = new ArrayList<>();

        // ==================== 1. ELECTRICO (Narva, Philips, Osram, NGK, Denso, Etna, Bosch) ====================
        list.add(pt(
                "Foco Halógeno H4 12V 60/55W Luz Alta y Baja",
                "Narva", "ELECTRICO", "48881",
                "Bulbo halógeno alemán Narva Standard H4 12V 60/55W casquillo P43t con filtro UV para faros principales.",
                "8.50", "16.00", "13.50",
                List.of("Toyota Yaris", "Toyota Hilux", "Hyundai Accent", "Kia Rio", "Nissan Sentra", "Suzuki Swift")
        ));
        list.add(pt(
                "Foco Halógeno H4 12V 100/90W Rallye",
                "Narva", "ELECTRICO", "48901",
                "Bulbo halógeno de alta potencia Narva Range Power Rallye H4 12V 100/90W P43t para ruta y uso off-road.",
                "12.00", "24.00", "20.00",
                List.of("Toyota Hilux", "Nissan Frontier", "Mitsubishi L200", "Volkswagen Amarok")
        ));
        list.add(pt(
                "Foco Halógeno H7 12V 55W",
                "Narva", "ELECTRICO", "48328",
                "Foco halógeno Narva H7 12V 55W base PX26d de haz preciso y cristal de cuarzo con bloqueo UV.",
                "9.50", "18.00", "15.00",
                List.of("Hyundai Tucson", "Kia Sportage", "Volkswagen Gol", "Volkswagen Amarok", "Peugeot 2008")
        ));
        list.add(pt(
                "Foco Halógeno H11 12V 55W Neblinero",
                "Narva", "ELECTRICO", "48078",
                "Foco halógeno Narva H11 12V 55W socket PGJ19-2 ideal para faros neblineros y luz baja proyectora.",
                "14.00", "26.00", "22.00",
                List.of("Toyota Corolla", "Toyota RAV4", "Toyota Hilux", "Nissan Kicks", "Honda CR-V")
        ));
        list.add(pt(
                "Foco Lágrima T10 W5W 12V",
                "Narva", "ELECTRICO", "17177",
                "Foco miniatura cuña T10 W5W 12V 5W base W2.1x9.5d para luz de posición, placa y salón interior.",
                "1.50", "4.00", "3.00",
                List.of("Toyota Yaris", "Hyundai Accent", "Kia Rio", "Nissan Versa", "Chevrolet Onix")
        ));
        list.add(pt(
                "Foco Doble Contacto P21/5W 12V Stop",
                "Narva", "ELECTRICO", "17916",
                "Foco incandescente doble filamento Narva 1157 P21/5W 12V 21/5W BAY15d para luz de freno y posición posterior.",
                "2.00", "5.00", "3.80",
                List.of("Toyota Hilux", "Toyota Yaris", "Hyundai H-100", "Kia Picanto", "Nissan Frontier")
        ));
        list.add(pt(
                "Par de Focos LED H4 12V/24V 6500K Blanco Frío",
                "Narva", "ELECTRICO", "18032",
                "Kit x2 bombillas Narva Range Performance LED H4 6500K con disipador térmico compacto y corte antideslumbrante.",
                "78.00", "139.00", "118.00",
                List.of("Toyota Hilux", "Toyota Yaris", "Hyundai Accent", "Kia Rio", "Suzuki Swift")
        ));
        list.add(pt(
                "Par de Focos Halógenos H4 X-tremeVision Pro150 12V",
                "Philips", "ELECTRICO", "12342XVPS2",
                "Blíster x2 focos Philips H4 12V 60/55W con hasta 150% más brillo y cristal de cuarzo Diamond Precision.",
                "58.00", "99.00", "85.00",
                List.of("Toyota Yaris", "Toyota Hilux", "Hyundai Accent", "Kia Rio", "Chevrolet Sail")
        ));
        list.add(pt(
                "Par de Focos LED H7 Osram LEDriving HL Bright 6000K",
                "Osram", "ELECTRICO", "64210DWBRT",
                "Set de 2 lámparas LED Osram H7 12V 6000K luz blanca día con hasta +300% luminosidad y ventilador activo.",
                "95.00", "169.00", "145.00",
                List.of("Hyundai Tucson", "Kia Sportage", "Volkswagen Tiguan", "Mazda CX-5")
        ));
        list.add(pt(
                "Juego x4 Bujías Laser Iridium Larga Duración",
                "NGK", "ELECTRICO", "ILKAR7B11",
                "Pack de 4 bujías japonesas NGK con electrodo central de iridio 0.6mm para 80,000 km y ahorro de combustible.",
                "110.00", "185.00", "160.00",
                List.of("Toyota Corolla", "Toyota Yaris", "Toyota RAV4", "Nissan Sentra")
        ));
        list.add(pt(
                "Juego x4 Bujías Iridium TT Doble Aguja",
                "Denso", "ELECTRICO", "IXUH22I",
                "Juego de 4 bujías Denso Iridium Twin-Tip de 0.4mm para motores multipunto coreanos y japoneses.",
                "98.00", "168.00", "145.00",
                List.of("Hyundai Accent", "Hyundai Elantra", "Kia Rio", "Kia Soluto", "Suzuki Swift")
        ));
        list.add(pt(
                "Bobina de Encendido Independiente Tipo Lápiz 12V",
                "Denso", "ELECTRICO", "90919-02258",
                "Bobina de encendido directo OEM Denso de alta energía dieléctrica y resistencia a temperatura de culata.",
                "92.00", "158.00", "136.00",
                List.of("Toyota Corolla", "Toyota Yaris", "Toyota Avanza")
        ));
        list.add(pt(
                "Bobina de Encendido Electrónica 1.4L / 1.6L",
                "Bosch", "ELECTRICO", "27301-2B010",
                "Bobina de encendido original Bosch con núcleo laminado para motores Gamma 1.4 y 1.6 MPI.",
                "85.00", "145.00", "125.00",
                List.of("Hyundai Accent", "Hyundai Elantra", "Kia Rio", "Kia Cerato")
        ));
        list.add(pt(
                "Batería Automotriz 12V 13 Placas 65Ah Libre Mantenimiento",
                "Etna", "ELECTRICO", "ETN-13P-PRO",
                "Batería sellada Etna Pro 12V 65Ah 550 CCA con rejilla expandida calcio-plata para arranque en frío.",
                "210.00", "329.00", "290.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Hyundai Accent", "Hyundai Tucson", "Kia Rio", "Nissan Sentra")
        ));
        list.add(pt(
                "Batería Automotriz Bosch S4 12V 75Ah 680 CCA Heavy Duty",
                "Bosch", "ELECTRICO", "0092S47028",
                "Batería Bosch S4 PowerFrame 12V 75Ah libre de mantenimiento para camionetas Pick-Up y SUV diésel.",
                "295.00", "459.00", "410.00",
                List.of("Toyota Hilux", "Nissan Frontier", "Mitsubishi L200", "Volkswagen Amarok", "Hyundai Santa Fe")
        ));

        // ==================== 2. FRENOS (Bosch, Brembo, Kashiyama, TRW) ====================
        list.add(pt(
                "Juego de Pastillas de Freno Delanteras Cerámicas Hilux",
                "Brembo", "FRENOS", "04465-0K240",
                "Compuesto cerámico Brembo NAO sin asbesto, bajo polvo y láminas antirruido multicapa para uso severo.",
                "142.00", "235.00", "202.00",
                List.of("Toyota Hilux", "Toyota Fortuner", "Toyota Hiace")
        ));
        list.add(pt(
                "Juego de Pastillas de Freno Delanteras QuietCast Yaris / Etios",
                "Bosch", "FRENOS", "04465-52260",
                "Pastillas delanteras Bosch cerámicas con ranura térmica central y chaflán progresivo silencioso.",
                "68.00", "119.00", "102.00",
                List.of("Toyota Yaris", "Toyota Etios", "Toyota Raize")
        ));
        list.add(pt(
                "Juego de Pastillas de Freno Delanteras Kashiyama Japón",
                "Kashiyama", "FRENOS", "58101-1RA00",
                "Pastillas japonesas MK Kashiyama de fricción estable y larga vida útil para sedanes de servicio urbano/taxi.",
                "58.00", "98.00", "84.00",
                List.of("Hyundai Accent", "Kia Rio", "Kia Soluto", "Hyundai Grand i10")
        ));
        list.add(pt(
                "Pastillas de Freno Delanteras Cerámicas SUV Coreanas",
                "Bosch", "FRENOS", "58101-D7A50",
                "Juego de pastillas delanteras Bosch para SUV con sensor acústico de desgaste e inscripción ECE-R90.",
                "92.00", "159.00", "138.00",
                List.of("Hyundai Tucson", "Kia Sportage", "Hyundai Creta", "Kia Seltos")
        ));
        list.add(pt(
                "Par de Discos de Freno Ventilados Delanteros 319mm",
                "Brembo", "FRENOS", "43512-0K120",
                "Par de discos ventilados Brembo en hierro alto carbono con pintura UV anticorrosiva y balanceo electrónico.",
                "285.00", "459.00", "405.00",
                List.of("Toyota Hilux", "Toyota Fortuner")
        ));
        list.add(pt(
                "Par de Discos de Freno Ventilados Delanteros 256mm Sedán",
                "Bosch", "FRENOS", "51712-1R000",
                "Set x2 discos de freno delanteros ventilados Bosch BD1620 rectificados de precisión sin vibración.",
                "135.00", "225.00", "195.00",
                List.of("Hyundai Accent", "Kia Rio", "Kia Soluto")
        ));
        list.add(pt(
                "Juego de Zapatas de Freno Posteriores Tambor Pick-Up",
                "Kashiyama", "FRENOS", "04495-0K120",
                "Set de 4 zapatas posteriores vulcanizadas de alta fricción para freno de tambor de carga pesada.",
                "95.00", "165.00", "142.00",
                List.of("Toyota Hilux", "Nissan Frontier", "Mitsubishi L200")
        ));
        list.add(pt(
                "Líquido de Frenos Sintético DOT 4 500ml ABS/ESP",
                "Bosch", "FRENOS", "1987479107",
                "Fluido hidráulico sintético Bosch DOT 4 punto de ebullición seco 265°C compatible con sistemas ABS y ESP.",
                "14.00", "26.00", "22.00",
                List.of("Toyota Corolla", "Hyundai Tucson", "Kia Rio", "Volkswagen Amarok", "Chevrolet Onix")
        ));

        // ==================== 3. FILTROS & LUBRICANTES (Mann-Filter, Denso, Sakura, Bosch, Castrol, Mobil, Shell) ====================
        list.add(pt(
                "Filtro de Aceite Blindado Rosca 3/4-16 Válvula Anti-Drenaje",
                "Mann-Filter", "FILTROS", "W68/3",
                "Filtro de aceite alemán Mann-Filter con válvula bypass calibrada y diafragma de silicona anti-retorno.",
                "16.00", "29.90", "25.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Toyota RAV4", "Suzuki Swift")
        ));
        list.add(pt(
                "Filtro de Aceite Heavy-Duty Diésel Pick-Up",
                "Denso", "FILTROS", "90915-YZZD2",
                "Filtro de aceite original Denso de microfibra sintética de alta capacidad para motores Toyota GD/KD.",
                "22.00", "42.00", "35.50",
                List.of("Toyota Hilux", "Toyota Hiace", "Toyota Fortuner", "Toyota Land Cruiser Prado")
        ));
        list.add(pt(
                "Filtro de Aceite Blindado Motores Coreanos MPI",
                "Bosch", "FILTROS", "26300-35505",
                "Filtro de aceite Bosch original para motores Hyundai y Kia 1.2L, 1.4L, 1.6L y 2.0L gasolina.",
                "15.00", "28.00", "23.50",
                List.of("Hyundai Accent", "Hyundai Tucson", "Hyundai Elantra", "Kia Rio", "Kia Sportage")
        ));
        list.add(pt(
                "Elemento Filtro de Combustible Diésel Common-Rail Euro V",
                "Mann-Filter", "FILTROS", "23390-0L070",
                "Cartucho separador de agua al 99.6% Mann-Filter PU8007 para protección de inyectores Common-Rail.",
                "38.00", "72.00", "61.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Toyota Fortuner")
        ));
        list.add(pt(
                "Filtro de Aire de Motor Panel Celulosa Plisada",
                "Sakura", "FILTROS", "17801-0Y040",
                "Filtro de aire primario Sakura A-33980 con marco de poliuretano flexible de sellado hermético.",
                "18.00", "34.00", "28.50",
                List.of("Toyota Yaris", "Toyota Etios")
        ));
        list.add(pt(
                "Filtro de Aire de Motor Heavy-Duty Ciclónico Pick-Up",
                "Mann-Filter", "FILTROS", "17801-0L040",
                "Filtro de aire Mann-Filter de alta retención de polvo fino para rutas afirmadas y operaciones mineras.",
                "44.00", "79.00", "67.00",
                List.of("Toyota Hilux", "Toyota Fortuner")
        ));
        list.add(pt(
                "Filtro de Cabina Aire Acondicionado Carbón Activado",
                "Sakura", "FILTROS", "87139-0N010",
                "Filtro antipolen Sakura con capa de carbón activado antibacteriano neutralizador de gases y olores.",
                "21.00", "39.00", "32.50",
                List.of("Toyota Corolla", "Toyota Hilux", "Toyota Yaris", "Toyota RAV4")
        ));
        list.add(pt(
                "Aceite de Motor Castrol Magnatec 10W-40 Semisintético Galón 4L",
                "Castrol", "FILTROS", "CAS-MAG-10W40-4L",
                "Lubricante semisintético Castrol Magnatec 10W-40 API SP/CF con moléculas inteligentes antidesgaste en arranque.",
                "86.00", "139.00", "122.00",
                List.of("Toyota Yaris", "Hyundai Accent", "Kia Rio", "Nissan Sentra", "Suzuki Swift")
        ));
        list.add(pt(
                "Aceite de Motor Mobil 1 5W-30 Full Sintético Galón 4L",
                "Mobil", "FILTROS", "MOB1-5W30-4L",
                "Aceite 100% sintético Mobil 1 5W-30 API SP ILSAC GF-6A para máxima limpieza y rendimiento hasta 10,000 km.",
                "128.00", "199.00", "176.00",
                List.of("Toyota Corolla", "Toyota RAV4", "Hyundai Tucson", "Kia Sportage", "Mazda CX-5", "Honda CR-V")
        ));
        list.add(pt(
                "Aceite de Motor Shell Helix HX5 20W-50 Multigrado Galón 4L",
                "Shell", "FILTROS", "SHL-HX5-20W50-4L",
                "Lubricante multigrado premium Shell Helix HX5 20W-50 API SN con tecnología de limpieza activa para motores con recorrido.",
                "66.00", "109.00", "94.00",
                List.of("Toyota Yaris", "Hyundai Accent", "Kia Rio", "Nissan Tiida", "Chevrolet Sail")
        ));
        list.add(pt(
                "Aceite Diésel Shell Rimula R4 X 15W-40 Turbo Diésel Balde 4L",
                "Shell", "FILTROS", "SHL-RIM-15W40-4L",
                "Aceite heavy-duty Shell Rimula R4 X 15W-40 CI-4 Plus con triple protección contra hollín y ácidos en turbo diésel.",
                "74.00", "124.00", "108.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Nissan Frontier", "Hyundai H-100", "Mitsubishi L200")
        ));

        // ==================== 4. SUSPENSION (KYB, Monroe, TRW, SKF, NTN) ====================
        list.add(pt(
                "Amortiguador Delantero a Gas Presurizado Excel-G Pick-Up",
                "KYB", "SUSPENSION", "340124",
                "Amortiguador japonés KYB Excel-G bitubo presurizado con gas nitrógeno y vástago cromado duro.",
                "178.00", "298.00", "262.00",
                List.of("Toyota Hilux", "Toyota Fortuner")
        ));
        list.add(pt(
                "Amortiguador Delantero McPherson a Gas Sedán",
                "KYB", "SUSPENSION", "3330091",
                "Strut delantero KYB Excel-G calibrado para recuperar estabilidad de frenado y confort original.",
                "138.00", "229.00", "199.00",
                List.of("Hyundai Accent", "Kia Rio", "Kia Soluto")
        ));
        list.add(pt(
                "Par de Amortiguadores Posteriores Monroe Adventure 4x4",
                "Monroe", "SUSPENSION", "D8064",
                "Set x2 amortiguadores posteriores Monroe Adventure de alta presión diseñados para carga y trocha.",
                "245.00", "399.00", "350.00",
                List.of("Toyota Hilux", "Nissan Frontier", "Mitsubishi L200", "Volkswagen Amarok")
        ));
        list.add(pt(
                "Trapecio Inferior de Suspensión Completo con Bujes y Rótula",
                "TRW", "SUSPENSION", "54500-1R000",
                "Brazo oscilante delantero de acero estampado TRW con bujes de caucho natural y rótula sellada.",
                "145.00", "245.00", "212.00",
                List.of("Hyundai Accent", "Kia Rio", "Toyota Yaris")
        ));
        list.add(pt(
                "Par de Terminales de Dirección Exteriores Reforzados",
                "TRW", "SUSPENSION", "45046-09281",
                "Juego izquierdo y derecho de terminales de dirección forjados con guardapolvo de neopreno.",
                "78.00", "135.00", "116.00",
                List.of("Toyota Hilux", "Toyota Yaris", "Hyundai Tucson", "Nissan Frontier")
        ));
        list.add(pt(
                "Rodaje / Bocamasa de Rueda Delantera con Sensor ABS",
                "SKF", "SUSPENSION", "VKBA6891",
                "Cubo rodamiento sellado de doble hilera SKF con anillo magnético codificador ABS integrado.",
                "165.00", "279.00", "242.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Hyundai Tucson", "Nissan Sentra")
        ));
        list.add(pt(
                "Rodaje de Rueda Delantera Doble Hilera Japón",
                "NTN", "SUSPENSION", "AU0930-4L",
                "Rodamiento japonés NTN de acero al cromo carburizado de alta precisión y grasa sintética de por vida.",
                "92.00", "158.00", "136.00",
                List.of("Hyundai Accent", "Kia Rio", "Suzuki Swift", "Chevrolet Sail")
        ));

        // ==================== 5. MOTOR (Gates, Mitsuboshi, Continental, Toyota Genuine, Hyundai Mobis) ====================
        list.add(pt(
                "Kit de Faja de Distribución + Rodaje Templador PowerGrip",
                "Gates", "MOTOR", "TCK338",
                "Kit completo Gates con correa sincronizada HNBR de fibra de vidrio y poleas tensoras para 100,000 km.",
                "195.00", "329.00", "288.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Hyundai Accent", "Kia Rio", "Chevrolet Sail")
        ));
        list.add(pt(
                "Faja de Accesorios Micro-V Acanalada 6PK1880 Alternador/Aire",
                "Mitsuboshi", "MOTOR", "6PK1880",
                "Correa serpentín japonesa Mitsuboshi EPDM resistente al agrietamiento térmico y chirridos.",
                "42.00", "76.00", "65.00",
                List.of("Toyota Corolla", "Toyota Yaris", "Hyundai Tucson", "Kia Sportage", "Nissan Sentra")
        ));
        list.add(pt(
                "Kit de Distribución + Tensor Hidráulico BiTDI",
                "Continental", "MOTOR", "CT1139K2",
                "Kit alemán Continental Contitech para motores diésel 2.0 TDI / BiTDI con rodillos guía reforzados.",
                "340.00", "549.00", "485.00",
                List.of("Volkswagen Amarok", "Volkswagen Tiguan")
        ));
        list.add(pt(
                "Empaquetadura de Culata Multilámina de Acero (MLS)",
                "Toyota Genuine", "MOTOR", "11115-0L050",
                "Junta de culata original Toyota en acero inoxidable multicapa recubierta en fluoroelastómero Viton.",
                "165.00", "275.00", "240.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Toyota Corolla")
        ));
        list.add(pt(
                "Empaque de Tapa de Balancines / Válvulas Caucho ACM",
                "Hyundai Mobis", "MOTOR", "22441-2B002",
                "Junta original Hyundai Mobis resistente al aceite caliente para sellado libre de fugas en tapa de válvulas.",
                "32.00", "58.00", "49.00",
                List.of("Hyundai Accent", "Hyundai Elantra", "Kia Rio", "Kia Cerato")
        ));
        list.add(pt(
                "Soporte de Motor Hidráulico Derecho Anti-Vibración",
                "Hyundai Mobis", "MOTOR", "21810-1R000",
                "Taco soporte hidráulico de motor OEM con cámara amortiguadora para eliminar vibraciones en cabina.",
                "135.00", "229.00", "198.00",
                List.of("Hyundai Accent", "Kia Rio", "Toyota Yaris")
        ));

        // ==================== 6. TRANSMISION (Valeo, Exedy, Aisin, GMB) ====================
        list.add(pt(
                "Kit de Embrague 3 Piezas (Plato, Disco y Collarín) Sedán",
                "Valeo", "TRANSMISION", "HDK-184",
                "Kit de embrague Valeo PHC Korea original de accionamiento suave y forro orgánico de alta durabilidad.",
                "245.00", "415.00", "365.00",
                List.of("Hyundai Accent", "Kia Rio", "Kia Soluto", "Hyundai Elantra")
        ));
        list.add(pt(
                "Kit de Embrague Japonés Exedy (Plato, Disco y Collarín)",
                "Exedy", "TRANSMISION", "TYK2154",
                "Kit completo Exedy Japón con resortes torsionales reforzados para tráfico intenso y servicio urbano.",
                "290.00", "485.00", "425.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Nissan Sentra", "Nissan Versa")
        ));
        list.add(pt(
                "Kit de Embrague Heavy-Duty 275mm Pick-Up 4x4 Turbo Diésel",
                "Aisin", "TRANSMISION", "31250-0K280",
                "Kit OEM japonés Aisin reforzado para alto torque en camionetas 4x4 de minería y carga.",
                "650.00", "1050.00", "930.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Mitsubishi L200", "Nissan Frontier")
        ));
        list.add(pt(
                "Bomba Principal de Embrague Cilindro Maestro",
                "Aisin", "TRANSMISION", "31420-0K013",
                "Cilindro maestro hidráulico de embrague Aisin en aluminio anodizado con sellos japoneses.",
                "115.00", "195.00", "168.00",
                List.of("Toyota Hilux", "Toyota Yaris", "Toyota Hiace")
        ));
        list.add(pt(
                "Cruceta de Cardán Universal Engrasable Heavy-Duty",
                "GMB", "TRANSMISION", "GUT-23",
                "Cruceta japonesa GMB en acero cromo-molibdeno con grasera central para árboles de transmisión Pick-Up.",
                "45.00", "79.00", "68.00",
                List.of("Toyota Hilux", "Toyota Hiace", "Nissan Frontier", "Mitsubishi L200")
        ));

        // ==================== 7. REFRIGERACION (GMB, Aisin, Denso, Gates) ====================
        list.add(pt(
                "Bomba de Agua de Aluminio Fundido con Empaquetadura",
                "GMB", "REFRIGERACION", "GWT-144A",
                "Bomba de agua japonesa GMB con rodamiento sellado de alta carga y sello mecánico cerámico.",
                "105.00", "179.00", "155.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Hyundai Accent", "Kia Rio", "Suzuki Swift")
        ));
        list.add(pt(
                "Bomba de Agua Original Pick-Up Turbo Diésel",
                "Aisin", "REFRIGERACION", "16100-09460",
                "Bomba centrífuga de agua OEM Aisin con impulsor anticorrosivo de alto caudal térmico.",
                "175.00", "295.00", "258.00",
                List.of("Toyota Hilux", "Toyota Fortuner", "Toyota Hiace")
        ));
        list.add(pt(
                "Radiador de Agua en Aluminio Brazado Tanques Reforzados",
                "Denso", "REFRIGERACION", "16400-0L360",
                "Radiador Denso de aletas de alta densidad para óptima disipación térmica en costa y altura andina.",
                "310.00", "519.00", "455.00",
                List.of("Toyota Hilux", "Toyota Yaris", "Toyota Corolla", "Hyundai Accent")
        ));
        list.add(pt(
                "Termostato de Refrigeración 82°C Acero Inoxidable con Sello",
                "Gates", "REFRIGERACION", "90916-03129",
                "Termostato calibrado a 82°C con válvula de alivio jiggle-pin y empaque perimetral EPDM.",
                "35.00", "65.00", "55.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Toyota Hilux", "Hyundai Accent", "Kia Rio")
        ));
        list.add(pt(
                "Refrigerante Anticongelante Orgánico OAT 50/50 Galón 4L",
                "Bosch", "REFRIGERACION", "BOS-COOL-5050",
                "Refrigerante de larga duración listo para usar (-37°C a +129°C) inhibidor de cavitación en aluminio.",
                "38.00", "68.00", "58.00",
                List.of("Toyota Hilux", "Toyota Corolla", "Hyundai Tucson", "Kia Sportage", "Volkswagen Amarok")
        ));

        // ==================== 8. CARROCERIA (TYC, Depo, Bosch) ====================
        list.add(pt(
                "Faro Delantero Principal Derecho Policarbonato UV Hilux",
                "TYC", "CARROCERIA", "81110-0K620",
                "Faro óptico delantero derecho TYC certificación DOT/SAE con reflector cromado de alta precisión.",
                "235.00", "389.00", "340.00",
                List.of("Toyota Hilux")
        ));
        list.add(pt(
                "Faro Delantero Principal Izquierdo Yaris / Accent",
                "TYC", "CARROCERIA", "81150-0D640",
                "Unidad óptica delantera izquierda TYC con lente de policarbonato resistente al amarillamiento solar.",
                "185.00", "310.00", "270.00",
                List.of("Toyota Yaris", "Hyundai Accent", "Kia Rio")
        ));
        list.add(pt(
                "Faro Posterior / Calavera Trasera Derecha Bicolor",
                "TYC", "CARROCERIA", "81550-0K260",
                "Faro posterior derecho TYC sellado hermético contra polvo y agua con arnés portafoco original.",
                "125.00", "215.00", "185.00",
                List.of("Toyota Hilux", "Nissan Frontier", "Mitsubishi L200")
        ));
        list.add(pt(
                "Kit Par de Faros Neblineros Delanteros + Biseles y Cableado",
                "TYC", "CARROCERIA", "81210-0D042",
                "Set completo izquierdo y derecho de faros neblineros con focos H11, switch de tablero y relé.",
                "130.00", "225.00", "192.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Toyota Hilux", "Hyundai Accent")
        ));
        list.add(pt(
                "Espejo Retrovisor Exterior Eléctrico con Direccional LED",
                "TYC", "CARROCERIA", "87910-0K290",
                "Espejo lateral eléctrico abatible con luz direccional LED integrada y luna convexa panorámica.",
                "165.00", "279.00", "242.00",
                List.of("Toyota Hilux", "Toyota Yaris", "Hyundai Tucson", "Kia Sportage")
        ));
        list.add(pt(
                "Par de Plumillas Limpiaparabrisas Aerotwin Silicona Grafito",
                "Bosch", "CARROCERIA", "3397007297",
                "Set x2 plumillas aerodinámicas Bosch Aerotwin sin estructura metálica para barrido silencioso bajo lluvia.",
                "48.00", "85.00", "72.00",
                List.of("Toyota Yaris", "Toyota Corolla", "Toyota Hilux", "Hyundai Tucson", "Kia Rio", "Volkswagen Amarok")
        ));

        return Collections.unmodifiableList(list);
    }

    private static VehicleModelSuggestionDto vm(String name, String type) {
        return new VehicleModelSuggestionDto(name, type);
    }

    private static PartTemplateSuggestionDto pt(
            String name,
            String brand,
            String categoryCode,
            String oemCode,
            String description,
            String purchase,
            String sale,
            String wholesale,
            List<String> vehicles
    ) {
        return new PartTemplateSuggestionDto(
                name,
                brand,
                categoryCode,
                oemCode,
                description,
                new BigDecimal(purchase),
                new BigDecimal(sale),
                new BigDecimal(wholesale),
                vehicles
        );
    }
}
