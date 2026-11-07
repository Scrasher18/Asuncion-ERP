package com.asuncion.erp.config;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.repository.*;
import com.asuncion.erp.service.CatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Garantiza de forma idempotente en local y nube (<= 100 productos totales) que:
 * 1) Todas las marcas, modelos, las 8 categorías automotrices y las 9 viscosidades SAE existan con stock activo.
 * 2) Las compatibilidades vehiculares diferencien de forma real y coherente por MARCA, MODELO y ERA DE AÑO:
 *    - Era Clásica (1980–1996/1998): repuestos clásicos reales (bombines, fajas en V, faros cristal H4, 20W-50/15W-40).
 *    - Era Intermedia (1997/1999–2011/2013): generación intermedia (10W-30/10W-40, retenes Viton, homocinéticas, etc.).
 *    - Era Moderna (2012/2014–2026): línea OEM moderna segmentada por tipo de chasis y origen de marca
 *      (Camión Pesado, Camión Mediano, Pick-Up Diésel, Van Comercial, SUV, Sedán Japonés, Coreano y Euro/LatAm).
 * 3) Ninguna combinación válida (Marca + Modelo + Año 1980..2026 + Sistema) quede vacía en pruebas.
 */
@Component
@Order(25)
public class CatalogMatrixSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogMatrixSeeder.class);
    private static final int MAX_CATALOG_PARTS = 100;
    private static final Set<String> ALLOWED_DB_VEHICLE_TYPES = Set.of(
            "SEDAN", "HATCHBACK", "SUV", "PICKUP", "VAN", "COMERCIAL", "CROSSOVER"
    );

    private enum ModelProfile {
        HEAVY_TRACTOR,
        MEDIUM_TRUCK,
        PICKUP_DIESEL,
        COMMERCIAL_VAN,
        SUV_CROSSOVER,
        SEDAN_JAPANESE,
        SEDAN_KOREAN,
        SEDAN_EURO_LATAM
    }

    private enum BrandOriginGroup {
        JAPANESE, KOREAN, EURO_LATAM, HEAVY_FLEET
    }

    private record SeedPartSpec(
            String sku,
            String oemCode,
            String name,
            String description,
            String categoryCode,
            String brandName,
            String brandOrigin,
            String purchasePrice,
            String salePrice,
            String wholesalePrice,
            int defaultStock,
            String warehouseLocation,
            String imagePath,
            boolean prioritySupplement
    ) {
    }

    /**
     * Incluye primero los 24 SKUs suplementarios sin colisión (Flota Pesada, Serie Clásica y Grados SAE faltantes)
     * seguidos de los SKUs base para entornos locales limpios (sin sobrescribir jamás nombres existentes en Neon).
     */
    private static final List<SeedPartSpec> SEED_SPECS = List.of(
            // ==================== SUPLEMENTOS SIN COLISIÓN: FLOTA PESADA, CLÁSICOS Y LUBRICANTES SAE ====================
            new SeedPartSpec(
                    "ASU-FRE-007", "47550-CLAS80",
                    "Bombín / Cilindro Auxiliar Hidráulico de Rueda Serie Clásica Bosch",
                    "Cilindro hidráulico de hierro fundido rectificado con copelas EPDM para sistemas de freno clásicos (1980–1998).",
                    "FRENOS", "Bosch", "Alemania", "38.00", "68.00", "56.00", 34, "PAS-A4-N1",
                    "/uploads/parts/asu-fre-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-008", "04495-CLAS85",
                    "Juego de Zapatas y Resortes de Freno Posterior Serie Clásica Brembo",
                    "Forro de fricción remachado de alta resistencia térmica para tambores de vehículos clásicos (1980–1998).",
                    "FRENOS", "Brembo", "Italia", "72.00", "125.00", "105.00", 30, "PAS-A4-N2",
                    "/uploads/parts/asu-fre-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-009", "47201-E0120",
                    "Válvula / Cilindro Maestro de Freno Doble Circuito Heavy-Duty Brembo",
                    "Cuerpo en aleación anodizada de alta presión para frenado de camiones y transporte comercial.",
                    "FRENOS", "Brembo", "Italia", "260.00", "420.00", "375.00", 16, "PAS-A3-N2",
                    "/uploads/parts/asu-fre-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-010", "04495-E0410",
                    "Juego de Bloques y Zapatas de Freno Neumático Flota Pesada Bosch",
                    "Fricción remachada de servicio severo para ejes de carga de camiones Hino, Isuzu, Scania y Volvo.",
                    "FRENOS", "Bosch", "Alemania", "145.00", "240.00", "210.00", 22, "PAS-A3-N3",
                    "/uploads/parts/asu-fre-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-011", "DOT4-1000-BOSCH",
                    "Líquido de Frenos 100% Sintético DOT 4 Bosch Envase 1 Litro",
                    "Punto de ebullición seco 260°C para sistemas hidráulicos ABS y embragues hidráulicos.",
                    "FRENOS", "Bosch", "Alemania", "24.00", "42.00", "35.00", 48, "PAS-A2-N3",
                    "/uploads/parts/asu-fre-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-010", "GTX-20W50-1G",
                    "Aceite Multigrado Alto Kilometraje Castrol GTX 20W-50 Anti-Borra (1 Galón)",
                    "Viscosidad SAE 20W-50 API SL/CF diseñada para máxima presión y sellado en motores clásicos (1980–2000).",
                    "FILTROS", "Castrol", "Reino Unido", "68.00", "115.00", "98.00", 32, "PAS-B4-N1",
                    "/uploads/parts/asu-fil-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-011", "SYNT-75W90-1L",
                    "Lubricante Sintético de Caja y Transmisión Castrol Syntrans 75W-90 (1L)",
                    "Viscosidad SAE 75W-90 API GL-4/GL-5 100% sintético para cajas manuales sincronizadas y transferencias 4x4.",
                    "FILTROS", "Castrol", "Reino Unido", "42.00", "72.00", "60.00", 30, "PAS-B4-N2",
                    "/uploads/parts/asu-tra-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-012", "MOBHD-80W90-1G",
                    "Aceite para Corona y Diferencial Pesado Mobilube HD 80W-90 API GL-5 (1 Galón)",
                    "Viscosidad SAE 80W-90 extrema presión para diferenciales hipoidales de pickups, furgones y camiones.",
                    "FILTROS", "Mobil", "Estados Unidos", "76.00", "128.00", "110.00", 26, "PAS-B4-N3",
                    "/uploads/parts/asu-tra-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-013", "P550588-HD",
                    "Filtro Separador de Agua y Petróleo Heavy-Duty Flota Pesada Mann-Filter",
                    "Cartucho blindado de alto caudal para motores diésel Euro IV/V de camiones Hino, Isuzu, Volvo y Scania.",
                    "FILTROS", "Mann-Filter", "Alemania", "64.00", "112.00", "95.00", 28, "PAS-B1-N4",
                    "/uploads/parts/asu-fil-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-014", "W920-CLAS80",
                    "Filtro de Aceite Blindado Rosca Estándar Serie Clásica Mann-Filter",
                    "Carcasa de acero reforzado y válvula anti-retorno para motores clásicos carburados y diésel (1980–1998).",
                    "FILTROS", "Mann-Filter", "Alemania", "20.00", "38.00", "31.00", 52, "PAS-B5-N1",
                    "/uploads/parts/asu-fil-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-015", "WK842-CLAS85",
                    "Prefiltro / Trampa Metálica de Combustible Serie Clásica y Pesada Bosch",
                    "Elemento decantador metálico de impurezas y agua para motores diésel y gasolina clásicos (1980–1998).",
                    "FILTROS", "Bosch", "Alemania", "28.00", "52.00", "43.00", 44, "PAS-B5-N2",
                    "/uploads/parts/asu-fil-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-016", "MOB1-0W20-4L",
                    "Aceite 100% Sintético Mobil 1 Advanced Fuel Economy 0W-20 (4L)",
                    "Viscosidad SAE 0W-20 API SP / ILSAC GF-6A para motores modernos a gasolina VVT-i e híbridos.",
                    "FILTROS", "Mobil", "Estados Unidos", "118.00", "195.00", "172.00", 28, "PAS-B2-N1",
                    "/uploads/parts/asu-fil-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-017", "MAG-5W40-4L",
                    "Aceite 100% Sintético Castrol Magnatec 5W-40 Turbo Protección (4L)",
                    "Viscosidad SAE 5W-40 API SP / ACEA C3 para motores turbo diésel ligero, GDI y multipunto modernos.",
                    "FILTROS", "Castrol", "Reino Unido", "115.00", "192.00", "168.00", 30, "PAS-B2-N3",
                    "/uploads/parts/asu-fil-007.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-018", "MOB-10W30-4L",
                    "Aceite Semisintético Mobil Super 2000 10W-30 Multigrado (4L)",
                    "Viscosidad SAE 10W-30 semisintético para motores a gasolina y GLP de generación intermedia (1998–2013).",
                    "FILTROS", "Mobil", "Estados Unidos", "78.00", "132.00", "115.00", 34, "PAS-B3-N1",
                    "/uploads/parts/asu-fil-008.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-019", "MAG-10W40-4L",
                    "Aceite Semisintético Castrol Magnatec 10W-40 Moléculas Inteligentes (4L)",
                    "Viscosidad SAE 10W-40 con protección antidesgaste para vehículos de trabajo continuo (1997–2013).",
                    "FILTROS", "Castrol", "Reino Unido", "82.00", "139.00", "120.00", 36, "PAS-B3-N2",
                    "/uploads/parts/asu-fil-009.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-020", "DELVAC-15W40-1G",
                    "Aceite Diésel Heavy Duty Mobil Delvac MX 15W-40 API CK-4 (1 Galón)",
                    "Viscosidad SAE 15W-40 servicio pesado para motores turbo diésel de camiones Hino, Isuzu, Scania, Volvo y flotas.",
                    "FILTROS", "Mobil", "Estados Unidos", "82.00", "135.00", "118.00", 48, "PAS-B3-N3",
                    "/uploads/parts/asu-fil-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-007", "65490-MONROE-HD",
                    "Amortiguador Reforzado de Cabina y Eje Monroe Magnum Heavy-Duty",
                    "Pistón sobredimensionado con válvula hidráulica de control de carga para camiones y transporte pesado.",
                    "SUSPENSION", "Monroe", "Estados Unidos", "245.00", "395.00", "350.00", 18, "PAS-C2-N1",
                    "/uploads/parts/asu-sus-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-008", "45420-E0110-HD",
                    "Barra y Terminal de Dirección Acero Forjado Flota Pesada KYB",
                    "Terminal cónico de aleación cromo-molibdeno tratado térmicamente para ejes direccionales de camiones.",
                    "SUSPENSION", "KYB", "Japón", "135.00", "225.00", "195.00", 20, "PAS-C2-N3",
                    "/uploads/parts/asu-sus-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-009", "344200-CLAS80",
                    "Amortiguador Hidráulico Reforzado Doble Efecto Serie Clásica KYB",
                    "Construcción tubular soldada de alta resistencia para chasis clásicos de autos, pickups y camiones (1980–1998).",
                    "SUSPENSION", "KYB", "Japón", "115.00", "195.00", "168.00", 28, "PAS-C3-N1",
                    "/uploads/parts/asu-sus-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-010", "K9082-CLAS85",
                    "Kit de Bujes y Pines de Muelles / Estabilizadora Serie Clásica KYB",
                    "Elastómero de poliuretano de alta densidad para suspensiones clásicas de ballesta y trapecio (1980–1998).",
                    "SUSPENSION", "KYB", "Japón", "26.00", "48.00", "39.00", 42, "PAS-C3-N2",
                    "/uploads/parts/asu-sus-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-005", "7415-CLAS80",
                    "Faja Trapezoidal Dentada en V Serie Clásica Alternador y Ventilador Gates",
                    "Correa automotriz e industrial Green-Stripe resistente al calor y aceite para motores clásicos (1980–1998).",
                    "MOTOR", "Gates", "Estados Unidos", "24.00", "45.00", "37.00", 48, "PAS-D3-N1",
                    "/uploads/parts/asu-mot-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-006", "VS500-CLAS85",
                    "Juego de Retenes de Cigüeñal y Empaquetaduras en Viton Denso",
                    "Sellos radiales de alta temperatura para estanqueidad de motores de generación intermedia (1997–2013).",
                    "MOTOR", "Denso", "Japón", "48.00", "85.00", "72.00", 30, "PAS-D3-N2",
                    "/uploads/parts/asu-mot-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-007", "K080991HD-GATES",
                    "Faja Acanalada Poli-V Ventilador y Alternador Gates FleetRunner Heavy-Duty",
                    "Compuesto EPDM verde de servicio severo para accesorios de camiones Hino, Isuzu, Scania y Volvo.",
                    "MOTOR", "Gates", "Estados Unidos", "62.00", "105.00", "88.00", 32, "PAS-D2-N3",
                    "/uploads/parts/asu-mot-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-006", "31250-E0620-HD",
                    "Kit de Embrague Cerámico Heavy-Duty 380mm/430mm Flota Pesada Valeo",
                    "Conjunto prensa, disco cerametálico y collarín reforzado para camiones de carga pesada y tractos.",
                    "TRANSMISION", "Valeo", "Francia", "920.00", "1490.00", "1340.00", 12, "PAS-E2-N2",
                    "/uploads/parts/asu-tra-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-007", "GUT23-CLAS80",
                    "Cruceta de Cardán y Eje Propulsor Acero Forjado con Grasera Aisin",
                    "Dados templados con rodillos de agujas y grasera central para cardanes clásicos, 4x4 y camiones.",
                    "TRANSMISION", "Aisin", "Japón", "45.00", "79.00", "66.00", 36, "PAS-E3-N1",
                    "/uploads/parts/asu-tra-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-008", "BRG-CLAS85",
                    "Rodamiento Collarín de Embrague Blindado Alta Carga Serie Clásica Valeo",
                    "Pista de acero al cromo sellada de baja fricción para sistemas de embrague mecánico e hidráulico.",
                    "TRANSMISION", "Valeo", "Francia", "58.00", "98.00", "84.00", 26, "PAS-E3-N2",
                    "/uploads/parts/asu-tra-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-006", "0001231005-HD",
                    "Arrancador / Motor de Partida Heavy-Duty 24V 5.5kW Motores Diésel Bosch",
                    "Alto par de arranque en frío para motores diésel comerciales de 4.0L a 13.0L en camiones y buses.",
                    "ELECTRICO", "Bosch", "Alemania", "750.00", "1250.00", "1100.00", 12, "PAS-F2-N2",
                    "/uploads/parts/asu-ele-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-007", "27060-E0290-HD",
                    "Alternador Industrial Brushless 24V 90A Camiones y Flota Denso",
                    "Alternador sin escobillas sellado contra polvo para sistema eléctrico pesado de 24 voltios.",
                    "ELECTRICO", "Denso", "Japón", "540.00", "880.00", "790.00", 14, "PAS-F2-N3",
                    "/uploads/parts/asu-ele-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-008", "0580464-CLAS80",
                    "Bomba Eléctrica Auxiliar de Combustible Externa Serie Clásica Bosch",
                    "Bomba en línea de caudal constante para cebado y alimentación en motores clásicos (1980–1998).",
                    "ELECTRICO", "Bosch", "Alemania", "110.00", "185.00", "158.00", 30, "PAS-F4-N1",
                    "/uploads/parts/asu-ele-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-009", "0332019-CLAS80",
                    "Relé Conmutador Metálico 5 Pines + Portafusible Térmico Clásico Bosch",
                    "Contactos de aleación de plata de alta capacidad para arranque, luces y claxon en vehículos clásicos.",
                    "ELECTRICO", "Bosch", "Alemania", "18.00", "34.00", "27.00", 58, "PAS-F4-N2",
                    "/uploads/parts/asu-ele-007.webp", true
            ),
            new SeedPartSpec(
                    "ASU-REF-005", "16400-E0480-HD",
                    "Radiador / Enfriador Heavy-Duty Flota Diésel + Viscoso Térmico Denso",
                    "Núcleo de aluminio brasado sobredimensionado para camiones de carga pesada y rutas de altura.",
                    "REFRIGERACION", "Denso", "Japón", "540.00", "890.00", "795.00", 12, "PAS-G2-N2",
                    "/uploads/parts/asu-ref-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-REF-006", "TH82-CLAS80",
                    "Termostato Mecánico de Latón y Cobre 82°C Serie Clásica Aisin",
                    "Válvula térmica de respuesta exacta con empaque incluido para enfriamiento de motores clásicos (1980–1998).",
                    "REFRIGERACION", "Aisin", "Japón", "30.00", "55.00", "46.00", 38, "PAS-G3-N1",
                    "/uploads/parts/asu-ref-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-CAR-007", "87910-E0190-HD",
                    "Espejo Panorámico Doble Ángulo + Faro Neblinero Ruta Pesada Depo",
                    "Conjunto exterior reforzado anti-vibración para cabinas de camiones Hino, Isuzu, Volvo y Scania.",
                    "CARROCERIA", "Depo", "Taiwán", "165.00", "275.00", "240.00", 16, "PAS-H2-N2",
                    "/uploads/parts/asu-car-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-CAR-008", "SB700-CLAS80",
                    "Unidad Óptica Sellada Cristal Templado H4 Serie Clásica Depo",
                    "Lente de vidrio templado con reflector metálico aluminizado para frentes clásicos (1980–1998).",
                    "CARROCERIA", "Depo", "Taiwán", "65.00", "115.00", "96.00", 32, "PAS-H3-N1",
                    "/uploads/parts/asu-car-001.webp", true
            ),

            // ==================== BASE PARTS PARA ENTORNOS LOCALES LIMPIOS (SI NO EXISTEN YA EN BD) ====================
            new SeedPartSpec(
                    "ASU-FRE-001", "04465-0K240",
                    "Juego de Pastillas de Freno Delanteras Cerámicas Brembo",
                    "Compuesto cerámico NAO de baja emisión de polvo y lámina antirruido para camionetas pick-up y furgones.",
                    "FRENOS", "Brembo", "Italia", "145.00", "235.00", "205.00", 28, "PAS-A1-N1",
                    "/uploads/parts/asu-fre-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-FRE-003", "04465-0D150",
                    "Juego de Pastillas de Freno Delanteras QuietCast Bosch",
                    "Fórmula cerámica/semimetálica silenciosa con chaflán progresivo para sedanes y hatchbacks modernos.",
                    "FRENOS", "Bosch", "Alemania", "85.00", "145.00", "125.00", 36, "PAS-A2-N1",
                    "/uploads/parts/asu-fre-003.webp", false
            ),
            new SeedPartSpec(
                    "ASU-FRE-006", "04495-0K120",
                    "Juego de Zapatas de Freno Posteriores para Tambor Bendix",
                    "Zapatas vulcanizadas de alta adherencia térmica para eje posterior de camionetas y utilitarios.",
                    "FRENOS", "Bosch", "Alemania", "110.00", "185.00", "158.00", 24, "PAS-A3-N1",
                    "/uploads/parts/asu-fre-006.webp", false
            ),
            new SeedPartSpec(
                    "ASU-FIL-001", "90915-YZZD2",
                    "Filtro de Aceite Blindado de Alto Flujo Denso First Time Fit",
                    "Válvula antidrenaje de silicona y medio filtrante sintético multicapa para motores japoneses.",
                    "FILTROS", "Denso", "Japón", "18.00", "35.00", "28.00", 55, "PAS-B1-N1",
                    "/uploads/parts/asu-fil-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-FIL-009", "EDGE-5W30-4L",
                    "Aceite Sintético Castrol EDGE 5W-30 Titanium FST 4L",
                    "Aceite 100% sintético SAE 5W-30 API SP / ACEA C3 con tecnología Fluid Titanium para motores modernos.",
                    "FILTROS", "Castrol", "Reino Unido", "110.00", "185.00", "160.00", 45, "PAS-B2-N2",
                    "/uploads/parts/asu-fil-009.webp", false
            ),
            new SeedPartSpec(
                    "ASU-SUS-001", "48510-0K180",
                    "Amortiguador Delantero Monotubo Gas-A-Just KYB",
                    "Nitrógeno de alta presión y vástago cromado reforzado para camionetas pick-up 4x4 y furgones.",
                    "SUSPENSION", "KYB", "Japón", "210.00", "345.00", "305.00", 22, "PAS-C1-N1",
                    "/uploads/parts/asu-sus-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-SUS-002", "48510-0D290",
                    "Amortiguador Delantero McPherson Excel-G KYB",
                    "Presurizado con nitrógeno de doble tubo para restaurar estabilidad original en sedanes y SUVs.",
                    "SUSPENSION", "KYB", "Japón", "165.00", "275.00", "240.00", 26, "PAS-C1-N2",
                    "/uploads/parts/asu-sus-002.webp", false
            ),
            new SeedPartSpec(
                    "ASU-MOT-002", "13506-21030",
                    "Kit de Cadena de Distribución Completo Tsubaki Japón",
                    "Cadena de distribución silenciosa de alta resistencia con guías y tensor hidráulico OEM.",
                    "MOTOR", "Aisin", "Japón", "210.00", "340.00", "298.00", 20, "PAS-D1-N2",
                    "/uploads/parts/asu-mot-002.webp", false
            ),
            new SeedPartSpec(
                    "ASU-MOT-004", "7PK1515",
                    "Faja de Accesorios Multivía Micro-V Gates Heavy Duty",
                    "Correa acanalada de EPDM resistente a altas temperaturas para pickups y utilitarios diésel.",
                    "MOTOR", "Gates", "Estados Unidos", "55.00", "95.00", "80.00", 30, "PAS-D2-N1",
                    "/uploads/parts/asu-mot-004.webp", false
            ),
            new SeedPartSpec(
                    "ASU-TRA-001", "TYK-2244-EXEDY",
                    "Kit de Embrague Completo (Plato, Disco y Collarín) Exedy Japón",
                    "Kit original japonés con resortes torsionales y forros orgánicos balanceados para sedanes y SUVs.",
                    "TRANSMISION", "Aisin", "Japón", "240.00", "395.00", "345.00", 20, "PAS-E1-N2",
                    "/uploads/parts/asu-tra-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-TRA-002", "KT-345-AISIN",
                    "Kit de Embrague Heavy Duty Reforzado 3 Piezas Aisin Japón",
                    "Kit de embrague reforzado de especificación minera y carga para camionetas pick-up y furgones.",
                    "TRANSMISION", "Aisin", "Japón", "380.00", "620.00", "550.00", 16, "PAS-E1-N1",
                    "/uploads/parts/asu-tra-002.webp", false
            ),
            new SeedPartSpec(
                    "ASU-ELE-001", "ILKAR7B11",
                    "Pack x4 Bujías Laser Iridium NGK Originales Japón",
                    "Electrodo central ultrafino de iridio de 0.6mm soldado por láser para motores gasolina modernos.",
                    "ELECTRICO", "NGK", "Japón", "115.00", "189.00", "165.00", 35, "PAS-F1-N1",
                    "/uploads/parts/asu-ele-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-ELE-005", "48881-NARVA",
                    "Par de Focos Halógenos H4 Range Power 110+ Narva 12V 60/55W",
                    "Cristal de cuarzo UV alemán con haz luminoso de alta visibilidad en carretera y neblina.",
                    "ELECTRICO", "Narva", "Alemania", "35.00", "64.00", "52.00", 48, "PAS-F3-N1",
                    "/uploads/parts/asu-ele-005.webp", false
            ),
            new SeedPartSpec(
                    "ASU-REF-001", "16100-29155",
                    "Bomba de Agua Centrífuga de Aluminio Gates / Aisin",
                    "Turbina balanceada dinámicamente con sello mecánico de carburo de silicio libre de fugas.",
                    "REFRIGERACION", "Aisin", "Japón", "155.00", "255.00", "225.00", 24, "PAS-G1-N2",
                    "/uploads/parts/asu-ref-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-REF-002", "16100-09600",
                    "Bomba de Agua para Motor Diésel Heavy Duty Aisin Japón",
                    "Bomba de refrigerante de alta capacidad para motores turbodiésel de pickups y furgones.",
                    "REFRIGERACION", "Aisin", "Japón", "195.00", "320.00", "280.00", 18, "PAS-G2-N1",
                    "/uploads/parts/asu-ref-002.webp", false
            ),
            new SeedPartSpec(
                    "ASU-REF-004", "AF-2100-PRESTONE",
                    "Refrigerante Anticorrosivo Larga Vida 50/50 Prestone Rojo / Rosa 1 Galón",
                    "Fórmula prediluida 50/50 con tecnología Cor-Guard que protege radiadores de aluminio hasta 129°C.",
                    "REFRIGERACION", "Prestone", "Estados Unidos", "48.00", "82.00", "70.00", 60, "PAS-G1-N1",
                    "/uploads/parts/asu-ref-004.webp", false
            ),
            new SeedPartSpec(
                    "ASU-CAR-001", "81110-0KP00",
                    "Faro Delantero Principal Tipo Halógeno/LED TYC Derecho",
                    "Óptica delantera con mica de policarbonato anti-UV y reflectores parabólicos de alta proyección.",
                    "CARROCERIA", "Depo", "Taiwán", "210.00", "350.00", "310.00", 18, "PAS-H1-N1",
                    "/uploads/parts/asu-car-001.webp", false
            ),
            new SeedPartSpec(
                    "ASU-CAR-003", "81130-0D640",
                    "Faro Delantero Principal Fondo Cromo con Lupa Depo",
                    "Faro principal con proyector tipo lupa para corte de luz nítido en sedanes y hatchbacks modernos.",
                    "CARROCERIA", "Depo", "Taiwán", "195.00", "325.00", "285.00", 18, "PAS-H1-N2",
                    "/uploads/parts/asu-car-003.webp", false
            ),
            new SeedPartSpec(
                    "ASU-CAR-005", "3397007297-BOSCH",
                    "Par de Plumillas Limpiaparabrisas Aerotwin Planas Bosch 24\" y 16\"",
                    "Plumillas aerodinámicas sin articulaciones metálicas con goma de doble componente silenciosa.",
                    "CARROCERIA", "Bosch", "Alemania", "45.00", "78.00", "65.00", 36, "PAS-H2-N1",
                    "/uploads/parts/asu-car-004.webp", false
            )
    );

    private final boolean matrixEnabled;
    private final boolean asyncWarmup;
    private final PlatformTransactionManager transactionManager;
    private final JdbcTemplate jdbcTemplate;
    private final CategoryRepository categoryRepository;
    private final ManufacturerBrandRepository brandRepository;
    private final VehicleMakeRepository makeRepository;
    private final VehicleModelRepository modelRepository;
    private final PartRepository partRepository;
    private final CatalogService catalogService;

    public CatalogMatrixSeeder(
            @Value("${app.catalog-matrix.enabled:true}") boolean matrixEnabled,
            @Value("${app.startup.async-warmup:false}") boolean asyncWarmup,
            @Lazy PlatformTransactionManager transactionManager,
            @Lazy JdbcTemplate jdbcTemplate,
            @Lazy CategoryRepository categoryRepository,
            @Lazy ManufacturerBrandRepository brandRepository,
            @Lazy VehicleMakeRepository makeRepository,
            @Lazy VehicleModelRepository modelRepository,
            @Lazy PartRepository partRepository,
            @Lazy CatalogService catalogService
    ) {
        this.matrixEnabled = matrixEnabled;
        this.asyncWarmup = asyncWarmup;
        this.transactionManager = transactionManager;
        this.jdbcTemplate = jdbcTemplate;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.makeRepository = makeRepository;
        this.modelRepository = modelRepository;
        this.partRepository = partRepository;
        this.catalogService = catalogService;
    }

    @Override
    public void run(String... args) {
        if (asyncWarmup) {
            return;
        }
        executeMatrixSeed();
    }

    public void executeMatrixSeed() {
        if (!matrixEnabled) {
            return;
        }
        try {
            TransactionTemplate tx = new TransactionTemplate(transactionManager);

            // Paso 1: Asegurar marcas, modelos, descripciones limpias y repuestos suplementarios (<= 100)
            tx.executeWithoutResult(status -> {
                ensureStandardMakesAndModels();
                healCorruptedDescriptions();
                Map<String, Category> categoriesByCode = loadCategoriesByCode();
                upsertSeedParts(categoriesByCode);
                replenishDepletedStock();
            });

            // Paso 2: Si existen filas antiguas con rango plano 1980..2026 (v1), limpiarlas antes de reconstruir
            Long blanketCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM part_vehicle_compatibilities WHERE year_start = 1980 AND year_end = 2026",
                    Long.class
            );
            boolean shouldRebuildFullMatrix = blanketCount != null && blanketCount > 5;
            if (shouldRebuildFullMatrix) {
                tx.executeWithoutResult(status -> {
                    int deleted = jdbcTemplate.update(
                            "DELETE FROM part_vehicle_compatibilities WHERE year_start = 1980 AND year_end = 2026"
                    );
                    log.info("Limpiadas {} compatibilidades planas heredadas (1980-2026) para aplicar segmentación real por modelo y año.", deleted);
                });
            }

            // Paso 3: Construir compatibilidades diferenciadas por Marca + Modelo + Era de Año (1980..2026)
            tx.executeWithoutResult(status -> {
                Map<String, Category> categoriesByCode = loadCategoriesByCode();
                buildDifferentiatedFitmentMatrix(categoriesByCode);
            });

            catalogService.evictCatalogCache();
            log.info("Matriz automotriz diferenciada por Marca/Modelo/Año lista ({} repuestos totales <= {}).",
                    partRepository.count(), MAX_CATALOG_PARTS);
        } catch (Exception e) {
            log.warn("Verificación de matriz combinable finalizó con aviso: {}", e.getMessage());
        }
    }

    private void ensureStandardMakesAndModels() {
        VehicleMake toyota = ensureMake("Toyota");
        VehicleMake hyundai = ensureMake("Hyundai");
        VehicleMake nissan = ensureMake("Nissan");
        VehicleMake kia = ensureMake("Kia");
        VehicleMake mitsubishi = ensureMake("Mitsubishi");
        VehicleMake hino = ensureMake("Hino");
        VehicleMake isuzu = ensureMake("Isuzu");
        VehicleMake scania = ensureMake("Scania");
        VehicleMake volvo = ensureMake("Volvo");
        VehicleMake vw = ensureMake("Volkswagen");
        VehicleMake chevrolet = ensureMake("Chevrolet");

        ensureModel(toyota, "Hilux", "PICKUP");
        ensureModel(toyota, "Corolla", "SEDAN");
        ensureModel(toyota, "Yaris", "SEDAN");
        ensureModel(toyota, "RAV4", "SUV");
        ensureModel(toyota, "Hiace", "VAN");
        ensureModel(toyota, "Fortuner", "SUV");
        ensureModel(toyota, "Probox", "COMERCIAL");

        ensureModel(hyundai, "Tucson", "SUV");
        ensureModel(hyundai, "Accent", "SEDAN");
        ensureModel(hyundai, "Elantra", "SEDAN");
        ensureModel(hyundai, "H-100", "COMERCIAL");

        ensureModel(nissan, "Frontier", "PICKUP");
        ensureModel(nissan, "Sentra", "SEDAN");
        ensureModel(nissan, "Tiida", "SEDAN");
        ensureModel(nissan, "Versa", "SEDAN");
        ensureModel(nissan, "Urvan", "VAN");

        ensureModel(kia, "Sportage", "SUV");
        ensureModel(kia, "Rio", "SEDAN");
        ensureModel(kia, "Cerato", "SEDAN");
        ensureModel(kia, "Picanto", "HATCHBACK");
        ensureModel(kia, "K2700", "COMERCIAL");

        ensureModel(mitsubishi, "L200", "PICKUP");
        ensureModel(mitsubishi, "Canter", "COMERCIAL");

        ensureModel(hino, "Dutro 300", "COMERCIAL");
        ensureModel(hino, "500 Series", "COMERCIAL");

        ensureModel(isuzu, "D-Max", "PICKUP");
        ensureModel(isuzu, "Forward FTR", "COMERCIAL");
        ensureModel(isuzu, "NPR Reward", "COMERCIAL");

        ensureModel(scania, "P410", "COMERCIAL");
        ensureModel(scania, "R-Series Heavy", "COMERCIAL");

        ensureModel(volvo, "FH 460 / 500", "COMERCIAL");

        ensureModel(vw, "Amarok", "PICKUP");
        ensureModel(vw, "Gol", "HATCHBACK");

        ensureModel(chevrolet, "Onix", "SEDAN");
        ensureModel(chevrolet, "Sail", "SEDAN");
    }

    /**
     * Restaura descripciones técnicas reales en caso de que una versión previa haya escrito texto "universal"
     * sobre repuestos específicos preexistentes en Neon.
     */
    private void healCorruptedDescriptions() {
        List<Part> all = partRepository.findAll();
        for (Part p : all) {
            String sku = p.getSku() != null ? p.getSku().toUpperCase() : "";
            String name = p.getName() != null ? p.getName().toLowerCase() : "";
            String desc = p.getTechnicalDescription() != null ? p.getTechnicalDescription().toLowerCase() : "";
            boolean dirty = false;

            if ("ASU-FRE-004".equals(sku) && name.contains("trw") && desc.contains("ebullic")) {
                p.setTechnicalDescription("Pastillas cerámicas europeas libres de cobre con lámina antirruido multicapa para SUVs y crossovers modernos.");
                dirty = true;
            } else if ("ASU-FIL-003".equals(sku) && name.contains("mann") && desc.contains("5w-30")) {
                p.setTechnicalDescription("Filtro de aceite blindado spin-on alemán con válvula antidrenaje de silicona para motores Volkswagen y Chevrolet.");
                dirty = true;
            } else if ("ASU-FIL-004".equals(sku) && name.contains("coreano") && desc.contains("15w-40")) {
                p.setTechnicalDescription("Filtro de aceite original Bosch P7028 con papel microporoso de alta retención para motores coreanos Hyundai y Kia.");
                dirty = true;
            } else if ("ASU-FIL-006".equals(sku) && name.contains("mann") && desc.contains("0w-20")) {
                p.setTechnicalDescription("Elemento filtrante de aire Mann-Filter de microfibra plisada con marco de poliuretano hermético.");
                dirty = true;
            } else if ("ASU-FIL-007".equals(sku) && name.contains("denso") && desc.contains("5w-40")) {
                p.setTechnicalDescription("Cartucho separador hidrofóbico de agua y petróleo diésel Common-Rail Denso para pickups y furgones.");
                dirty = true;
            } else if ("ASU-FIL-008".equals(sku) && name.contains("cabina") && desc.contains("10w-30")) {
                p.setTechnicalDescription("Filtro antipolen de cabina con carbón activado bacteriostático para aire acondicionado automotriz.");
                dirty = true;
            } else if ("ASU-FIL-009".equals(sku) && name.contains("5w-30") && desc.contains("10w-40")) {
                p.setTechnicalDescription("Aceite 100% sintético SAE 5W-30 API SP / ACEA C3 con tecnología Fluid Titanium para motores modernos.");
                dirty = true;
            }

            if (dirty) {
                partRepository.save(p);
            }
        }
    }

    private Map<String, Category> loadCategoriesByCode() {
        Map<String, Category> map = new HashMap<>();
        for (Category c : categoryRepository.findAll()) {
            String key = resolveStandardCategoryKey(c);
            if (key != null) {
                map.putIfAbsent(key, c);
            }
            if (c.getCode() != null) {
                map.putIfAbsent(c.getCode().toUpperCase(), c);
            }
        }
        return map;
    }

    private String resolveStandardCategoryKey(Category c) {
        if (c == null) return null;
        String text = ((c.getCode() != null ? c.getCode() : "") + " " + (c.getName() != null ? c.getName() : "")).toLowerCase();
        if (text.contains("fren")) return "FRENOS";
        if (text.contains("filtr") || text.contains("lubric")) return "FILTROS";
        if (text.contains("susp") || text.contains("direc")) return "SUSPENSION";
        if (text.contains("mot") || text.contains("distrib")) return "MOTOR";
        if (text.contains("transm") || text.contains("embrag")) return "TRANSMISION";
        if (text.contains("elec") || text.contains("ilum")) return "ELECTRICO";
        if (text.contains("refrig") || text.contains("clim")) return "REFRIGERACION";
        if (text.contains("carroc") || text.contains("faro")) return "CARROCERIA";
        if (text.contains("acces")) return "ACCESORIOS";
        return null;
    }

    private void upsertSeedParts(Map<String, Category> categoriesByCode) {
        long totalParts = partRepository.count();
        List<SeedPartSpec> ordered = new ArrayList<>(SEED_SPECS);
        ordered.sort(Comparator.comparingInt(s -> s.prioritySupplement() ? 0 : 1));

        for (SeedPartSpec spec : ordered) {
            Category cat = categoriesByCode.get(spec.categoryCode());
            if (cat == null) {
                continue;
            }
            Optional<Part> existingOpt = partRepository.findBySkuIgnoreCase(spec.sku());
            if (existingOpt.isPresent()) {
                Part existing = existingOpt.get();
                boolean changed = false;
                if (!existing.isActive()) {
                    existing.setActive(true);
                    changed = true;
                }
                if (existing.getStockQuantity() == null || existing.getStockQuantity() < 5) {
                    existing.setStockQuantity(spec.defaultStock());
                    changed = true;
                }
                if (existing.getImages().isEmpty()) {
                    PartImage img = new PartImage();
                    img.setPart(existing);
                    img.setObjectKey("parts/" + spec.sku().toLowerCase() + ".webp");
                    img.setImageUrl(spec.imagePath());
                    img.setMimeType("image/webp");
                    img.setFileSizeBytes(42000L);
                    img.setPrimary(true);
                    img.setDisplayOrder(0);
                    existing.getImages().add(img);
                    changed = true;
                }
                if (changed) {
                    partRepository.save(existing);
                }
            } else {
                if (totalParts >= MAX_CATALOG_PARTS) {
                    continue;
                }
                ManufacturerBrand brand = brandRepository.findByNameIgnoreCase(spec.brandName())
                        .orElseGet(() -> brandRepository.save(new ManufacturerBrand(spec.brandName(), spec.brandOrigin())));

                Part part = new Part();
                part.setSku(spec.sku());
                part.setOemCode(spec.oemCode());
                part.setName(spec.name());
                part.setTechnicalDescription(spec.description());
                part.setCategory(cat);
                part.setManufacturerBrand(brand);
                part.setPurchasePrice(new BigDecimal(spec.purchasePrice()).setScale(2, RoundingMode.HALF_UP));
                part.setSalePrice(new BigDecimal(spec.salePrice()).setScale(2, RoundingMode.HALF_UP));
                part.setWholesalePrice(new BigDecimal(spec.wholesalePrice()).setScale(2, RoundingMode.HALF_UP));
                part.setStockQuantity(spec.defaultStock());
                part.setMinStockLevel(5);
                part.setWarehouseLocation(spec.warehouseLocation());
                part.setActive(true);

                PartImage img = new PartImage();
                img.setPart(part);
                img.setObjectKey("parts/" + spec.sku().toLowerCase() + ".webp");
                img.setImageUrl(spec.imagePath());
                img.setMimeType("image/webp");
                img.setFileSizeBytes(42000L);
                img.setPrimary(true);
                img.setDisplayOrder(0);
                part.getImages().add(img);

                partRepository.save(part);
                totalParts++;
            }
        }
    }

    private void replenishDepletedStock() {
        for (Part p : partRepository.findAll()) {
            if (p.isActive() && (p.getStockQuantity() == null || p.getStockQuantity() <= 1)) {
                p.setStockQuantity(14);
                partRepository.save(p);
            }
        }
    }

    private void buildDifferentiatedFitmentMatrix(Map<String, Category> categoriesByCode) {
        List<VehicleModel> allModels = modelRepository.findAllByOrderByMakeNameAscNameAsc();
        List<Part> allParts = partRepository.findAllWithImagesOrderByIdAsc();
        if (!allParts.isEmpty()) {
            partRepository.hydrateCompatibilities(allParts);
        }

        Map<String, List<Part>> partsByCategoryKey = new HashMap<>();
        Map<String, Part> partBySku = new HashMap<>();
        for (Part p : allParts) {
            if (!p.isActive() || p.getStockQuantity() == null || p.getStockQuantity() <= 0) {
                continue;
            }
            if (p.getSku() != null) {
                partBySku.put(p.getSku().toUpperCase(), p);
            }
            String catKey = resolveStandardCategoryKey(p.getCategory());
            if (catKey != null && !"ACCESORIOS".equals(catKey)) {
                partsByCategoryKey.computeIfAbsent(catKey, k -> new ArrayList<>()).add(p);
            }
        }

        List<String> systemCodes = List.of(
                "FRENOS", "FILTROS", "SUSPENSION", "MOTOR",
                "TRANSMISION", "ELECTRICO", "REFRIGERACION", "CARROCERIA"
        );

        Set<Part> dirtyParts = new LinkedHashSet<>();

        for (int modelIdx = 0; modelIdx < allModels.size(); modelIdx++) {
            VehicleModel model = allModels.get(modelIdx);
            ModelProfile profile = classifyModelProfile(model);
            BrandOriginGroup origin = classifyBrandOrigin(model);

            // Cortes generacionales escalonados por modelo (sin huecos entre 1980 y 2026)
            String modelIdentity = (model.getMake().getName() + ":" + model.getName()).toLowerCase();
            int genShift = Math.floorMod(modelIdentity.hashCode(), 3); // 0, 1 o 2
            int classicEnd = 1996 + genShift;       // 1996, 1997 o 1998
            int midStart = classicEnd + 1;          // 1997, 1998 o 1999
            int midEnd = 2011 + genShift;           // 2011, 2012 o 2013
            int modernStart = midEnd + 1;           // 2012, 2013 o 2014

            for (String catKey : systemCodes) {
                List<Part> catParts = partsByCategoryKey.getOrDefault(catKey, List.of());
                if (catParts.isEmpty()) {
                    continue;
                }

                // Verificar si el modelo ya tiene cobertura real en las 3 eras para esta categoría
                boolean hasClassic = hasCoverageInWindow(catParts, model.getId(), 1980, classicEnd);
                boolean hasMid = hasCoverageInWindow(catParts, model.getId(), midStart, midEnd);
                boolean hasModern = hasCoverageInWindow(catParts, model.getId(), modernStart, 2026);

                // Rastrear qué SKUs ya están asignados a este modelo para NO repetir (part_id, model_id)
                Set<Long> assignedPartIdsForModel = catParts.stream()
                        .filter(p -> p.getCompatibilities().stream().anyMatch(c -> c.getVehicleModel().getId().equals(model.getId())))
                        .map(Part::getId)
                        .collect(Collectors.toSet());

                // 1. ERA CLÁSICA (1980 .. classicEnd)
                if (!hasClassic) {
                    List<Part> classicPool = selectClassicCandidates(catKey, profile, partBySku, catParts);
                    List<Part> chosenClassic = pickModelSubset(classicPool, assignedPartIdsForModel, modelIdx, catKey.equals("FILTROS") ? 2 : 1);
                    for (Part target : chosenClassic) {
                        addCompatibilityIfAbsent(
                                target, model, 1980, classicEnd,
                                engineSpecForEra(model, profile, 1),
                                "Serie clásica verificada (" + model.getMake().getName() + " " + model.getName() + ")",
                                dirtyParts
                        );
                        assignedPartIdsForModel.add(target.getId());
                    }
                }

                // 2. ERA MODERNA (modernStart .. 2026) — se asigna primero para reservar las piezas insignia OEM modernas
                if (!hasModern) {
                    List<Part> modernPool = selectModernCandidates(catKey, model, profile, origin, partBySku, catParts);
                    int modernDesiredCount = desiredModernCount(catKey, model, profile, modelIdx);
                    List<Part> chosenModern = pickModelSubset(modernPool, assignedPartIdsForModel, modelIdx, modernDesiredCount);
                    for (Part target : chosenModern) {
                        addCompatibilityIfAbsent(
                                target, model, modernStart, 2026,
                                engineSpecForEra(model, profile, 3),
                                "Compatibilidad OEM generación moderna (" + model.getMake().getName() + " " + model.getName() + ")",
                                dirtyParts
                        );
                        assignedPartIdsForModel.add(target.getId());
                    }
                }

                // 3. ERA INTERMEDIA (midStart .. midEnd)
                if (!hasMid) {
                    List<Part> midPool = selectMidGenCandidates(catKey, profile, origin, partBySku, catParts);
                    int midDesiredCount = (catKey.equals("FILTROS") && (modelIdx % 2 == 0)) ? 2 : 1;
                    List<Part> chosenMid = pickModelSubset(midPool, assignedPartIdsForModel, modelIdx + 1, midDesiredCount);
                    if (!chosenMid.isEmpty()) {
                        for (Part target : chosenMid) {
                            addCompatibilityIfAbsent(
                                    target, model, midStart, midEnd,
                                    engineSpecForEra(model, profile, 2),
                                    "Generación intermedia (" + model.getMake().getName() + " " + model.getName() + ")",
                                    dirtyParts
                            );
                            assignedPartIdsForModel.add(target.getId());
                        }
                    } else {
                        // Si la categoría solo tenía 1 pieza post-clásica disponible para ese perfil, ampliar su inicio a midStart
                        catParts.stream()
                                .flatMap(p -> p.getCompatibilities().stream().map(c -> Map.entry(p, c)))
                                .filter(e -> e.getValue().getVehicleModel().getId().equals(model.getId())
                                        && e.getValue().getYearStart() > midStart
                                        && e.getValue().getYearEnd() >= 2024)
                                .findFirst()
                                .ifPresent(entry -> {
                                    entry.getValue().setYearStart(midStart);
                                    dirtyParts.add(entry.getKey());
                                });
                    }
                }
            }
        }

        // Asegurar que ningún repuesto activo no-accesorio quede huérfano (0 compatibilidades)
        for (Part orphan : allParts) {
            if (!orphan.isActive()) continue;
            String catKey = resolveStandardCategoryKey(orphan.getCategory());
            if ("ACCESORIOS".equals(catKey)) continue;
            if (orphan.getCompatibilities().isEmpty() && !allModels.isEmpty()) {
                VehicleModel fallbackModel = pickBestFallbackModelForOrphan(orphan, allModels);
                ModelProfile prof = classifyModelProfile(fallbackModel);
                addCompatibilityIfAbsent(
                        orphan, fallbackModel, 2012, 2026,
                        engineSpecForEra(fallbackModel, prof, 3),
                        "Aplicación verificada OEM",
                        dirtyParts
                );
            }
        }

        if (!dirtyParts.isEmpty()) {
            partRepository.saveAll(dirtyParts);
        }
    }

    private boolean hasCoverageInWindow(List<Part> catParts, Long modelId, int windowStart, int windowEnd) {
        int probeYear = (windowStart + windowEnd) / 2;
        return catParts.stream().anyMatch(p -> p.getCompatibilities().stream()
                .anyMatch(c -> c.getVehicleModel().getId().equals(modelId)
                        && c.getYearStart() <= probeYear
                        && c.getYearEnd() >= probeYear));
    }

    private List<Part> selectClassicCandidates(
            String catKey,
            ModelProfile profile,
            Map<String, Part> bySku,
            List<Part> catParts
    ) {
        boolean isDieselOrHeavy = profile == ModelProfile.HEAVY_TRACTOR
                || profile == ModelProfile.MEDIUM_TRUCK
                || profile == ModelProfile.PICKUP_DIESEL
                || profile == ModelProfile.COMMERCIAL_VAN;

        boolean isRearDrive = isDieselOrHeavy || profile == ModelProfile.SUV_CROSSOVER;

        List<String> skus = switch (catKey) {
            case "FRENOS" -> List.of("ASU-FRE-007", "ASU-FRE-008");
            case "FILTROS" -> isDieselOrHeavy
                    ? List.of("ASU-FIL-015", "ASU-FIL-014", "ASU-FIL-020")
                    : List.of("ASU-FIL-014", "ASU-FIL-010");
            case "SUSPENSION" -> List.of("ASU-SUS-009", "ASU-SUS-010");
            case "MOTOR" -> List.of("ASU-MOT-005");
            case "TRANSMISION" -> isRearDrive
                    ? List.of("ASU-TRA-007", "ASU-TRA-008")
                    : List.of("ASU-TRA-008");
            case "ELECTRICO" -> isDieselOrHeavy
                    ? List.of("ASU-ELE-009", "ASU-ELE-008")
                    : List.of("ASU-ELE-008", "ASU-ELE-009");
            case "REFRIGERACION" -> List.of("ASU-REF-006");
            case "CARROCERIA" -> List.of("ASU-CAR-008");
            default -> List.of();
        };

        List<Part> resolved = resolveSkus(skus, bySku);
        return resolved.isEmpty() ? catParts : resolved;
    }

    private List<Part> selectMidGenCandidates(
            String catKey,
            ModelProfile profile,
            BrandOriginGroup origin,
            Map<String, Part> bySku,
            List<Part> catParts
    ) {
        List<String> skus = switch (catKey) {
            case "FRENOS" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-FRE-009", "ASU-FRE-006");
                case MEDIUM_TRUCK, PICKUP_DIESEL, COMMERCIAL_VAN -> List.of("ASU-FRE-006", "ASU-FRE-011");
                default -> List.of("ASU-FRE-011", "ASU-FRE-006");
            };
            case "FILTROS" -> switch (profile) {
                case HEAVY_TRACTOR, MEDIUM_TRUCK -> List.of("ASU-FIL-012", "ASU-FIL-020");
                case PICKUP_DIESEL, COMMERCIAL_VAN -> List.of("ASU-FIL-011", "ASU-FIL-012", "ASU-FIL-019");
                default -> origin == BrandOriginGroup.EURO_LATAM || origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-FIL-019", "ASU-FIL-018")
                        : List.of("ASU-FIL-018", "ASU-FIL-019", "ASU-FIL-011");
            };
            case "SUSPENSION" -> switch (profile) {
                case HEAVY_TRACTOR, MEDIUM_TRUCK -> List.of("ASU-SUS-007");
                case PICKUP_DIESEL, COMMERCIAL_VAN, SUV_CROSSOVER -> List.of("ASU-SUS-006", "ASU-SUS-005");
                default -> List.of("ASU-SUS-003", "ASU-SUS-005");
            };
            case "MOTOR" -> List.of("ASU-MOT-006");
            case "TRANSMISION" -> switch (profile) {
                case HEAVY_TRACTOR, MEDIUM_TRUCK, PICKUP_DIESEL, COMMERCIAL_VAN -> List.of("ASU-TRA-008", "ASU-TRA-007");
                default -> List.of("ASU-TRA-005", "ASU-TRA-008");
            };
            case "ELECTRICO" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-ELE-007");
                case MEDIUM_TRUCK, PICKUP_DIESEL, COMMERCIAL_VAN -> List.of("ASU-ELE-005");
                default -> origin == BrandOriginGroup.JAPANESE
                        ? List.of("ASU-ELE-003", "ASU-ELE-005")
                        : List.of("ASU-ELE-005", "ASU-ELE-002");
            };
            case "REFRIGERACION" -> List.of("ASU-REF-004");
            case "CARROCERIA" -> profile == ModelProfile.HEAVY_TRACTOR
                    ? List.of("ASU-CAR-007")
                    : List.of("ASU-CAR-005");
            default -> List.of();
        };

        List<Part> resolved = resolveSkus(skus, bySku);
        return resolved.isEmpty() ? catParts : resolved;
    }

    private List<Part> selectModernCandidates(
            String catKey,
            VehicleModel model,
            ModelProfile profile,
            BrandOriginGroup origin,
            Map<String, Part> bySku,
            List<Part> catParts
    ) {
        String modelName = model.getName().toLowerCase();
        boolean isProboxOrYaris = modelName.contains("yaris") || modelName.contains("probox");
        boolean isHiluxOrFortuner = modelName.contains("hilux") || modelName.contains("fortuner");

        List<String> skus = switch (catKey) {
            case "FRENOS" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-FRE-010", "ASU-FRE-009");
                case MEDIUM_TRUCK -> List.of("ASU-FRE-009", "ASU-FRE-010", "ASU-FRE-001");
                case PICKUP_DIESEL -> isHiluxOrFortuner
                        ? List.of("ASU-FRE-001", "ASU-FRE-002")
                        : List.of("ASU-FRE-002", "ASU-FRE-001");
                case COMMERCIAL_VAN -> isProboxOrYaris
                        ? List.of("ASU-FRE-003", "ASU-FRE-005")
                        : List.of("ASU-FRE-001", "ASU-FRE-002");
                case SUV_CROSSOVER -> isHiluxOrFortuner
                        ? List.of("ASU-FRE-004", "ASU-FRE-001")
                        : List.of("ASU-FRE-004", "ASU-FRE-003");
                case SEDAN_JAPANESE -> isProboxOrYaris
                        ? List.of("ASU-FRE-005", "ASU-FRE-003")
                        : List.of("ASU-FRE-003", "ASU-FRE-005");
                case SEDAN_KOREAN, SEDAN_EURO_LATAM -> List.of("ASU-FRE-003", "ASU-FRE-005");
            };
            case "FILTROS" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-FIL-013", "ASU-FIL-020");
                case MEDIUM_TRUCK -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-FIL-007", "ASU-FIL-020", "ASU-FIL-006")
                        : List.of("ASU-FIL-013", "ASU-FIL-007", "ASU-FIL-020");
                case PICKUP_DIESEL -> List.of("ASU-FIL-007", "ASU-FIL-002", "ASU-FIL-017", "ASU-FIL-001");
                case COMMERCIAL_VAN -> modelName.contains("probox")
                        ? List.of("ASU-FIL-001", "ASU-FIL-005", "ASU-FIL-009")
                        : List.of("ASU-FIL-007", "ASU-FIL-002", "ASU-FIL-017");
                case SUV_CROSSOVER -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-FIL-004", "ASU-FIL-009", "ASU-FIL-008")
                        : List.of("ASU-FIL-001", "ASU-FIL-009", "ASU-FIL-017", "ASU-FIL-008");
                case SEDAN_JAPANESE -> isProboxOrYaris
                        ? List.of("ASU-FIL-005", "ASU-FIL-016", "ASU-FIL-008", "ASU-FIL-001")
                        : List.of("ASU-FIL-001", "ASU-FIL-009", "ASU-FIL-016", "ASU-FIL-008");
                case SEDAN_KOREAN -> List.of("ASU-FIL-004", "ASU-FIL-006", "ASU-FIL-009", "ASU-FIL-016");
                case SEDAN_EURO_LATAM -> List.of("ASU-FIL-003", "ASU-FIL-017", "ASU-FIL-009");
            };
            case "SUSPENSION" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-SUS-008", "ASU-SUS-007");
                case MEDIUM_TRUCK -> List.of("ASU-SUS-007", "ASU-SUS-008");
                case PICKUP_DIESEL, COMMERCIAL_VAN -> isProboxOrYaris
                        ? List.of("ASU-SUS-002", "ASU-SUS-005")
                        : List.of("ASU-SUS-001", "ASU-SUS-005");
                case SUV_CROSSOVER -> List.of("ASU-SUS-004", "ASU-SUS-002");
                case SEDAN_JAPANESE -> List.of("ASU-SUS-002", "ASU-SUS-005");
                case SEDAN_KOREAN, SEDAN_EURO_LATAM -> List.of("ASU-SUS-002", "ASU-SUS-003");
            };
            case "MOTOR" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-MOT-007");
                case MEDIUM_TRUCK -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-MOT-004", "ASU-MOT-007")
                        : List.of("ASU-MOT-007", "ASU-MOT-004");
                case PICKUP_DIESEL, COMMERCIAL_VAN -> isProboxOrYaris
                        ? List.of("ASU-MOT-002")
                        : List.of("ASU-MOT-004");
                case SUV_CROSSOVER -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-MOT-003")
                        : (isHiluxOrFortuner ? List.of("ASU-MOT-004") : List.of("ASU-MOT-002"));
                case SEDAN_JAPANESE -> List.of("ASU-MOT-002");
                case SEDAN_KOREAN -> List.of("ASU-MOT-003");
                case SEDAN_EURO_LATAM -> List.of("ASU-MOT-001");
            };
            case "TRANSMISION" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-TRA-006");
                case MEDIUM_TRUCK -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-TRA-002", "ASU-TRA-006")
                        : List.of("ASU-TRA-006", "ASU-TRA-002");
                case PICKUP_DIESEL -> List.of("ASU-TRA-002");
                case COMMERCIAL_VAN -> isProboxOrYaris ? List.of("ASU-TRA-001") : List.of("ASU-TRA-002");
                case SUV_CROSSOVER -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-TRA-003")
                        : (isHiluxOrFortuner ? List.of("ASU-TRA-002") : List.of("ASU-TRA-001"));
                case SEDAN_JAPANESE -> isProboxOrYaris
                        ? List.of("ASU-TRA-005", "ASU-TRA-001")
                        : List.of("ASU-TRA-001", "ASU-TRA-005");
                case SEDAN_KOREAN -> List.of("ASU-TRA-003");
                case SEDAN_EURO_LATAM -> List.of("ASU-TRA-004");
            };
            case "ELECTRICO" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-ELE-006", "ASU-ELE-007");
                case MEDIUM_TRUCK -> List.of("ASU-ELE-006", "ASU-ELE-005");
                case PICKUP_DIESEL -> List.of("ASU-ELE-005");
                case COMMERCIAL_VAN -> isProboxOrYaris
                        ? List.of("ASU-ELE-001", "ASU-ELE-004")
                        : List.of("ASU-ELE-005");
                case SUV_CROSSOVER -> isHiluxOrFortuner
                        ? List.of("ASU-ELE-005")
                        : (origin == BrandOriginGroup.KOREAN
                                ? List.of("ASU-ELE-002", "ASU-ELE-001")
                                : List.of("ASU-ELE-001", "ASU-ELE-004"));
                case SEDAN_JAPANESE -> isProboxOrYaris
                        ? List.of("ASU-ELE-004", "ASU-ELE-003", "ASU-ELE-001")
                        : List.of("ASU-ELE-001", "ASU-ELE-004");
                case SEDAN_KOREAN, SEDAN_EURO_LATAM -> List.of("ASU-ELE-002", "ASU-ELE-001");
            };
            case "REFRIGERACION" -> switch (profile) {
                case HEAVY_TRACTOR, MEDIUM_TRUCK -> List.of("ASU-REF-005");
                case PICKUP_DIESEL -> List.of("ASU-REF-002");
                case COMMERCIAL_VAN -> isProboxOrYaris ? List.of("ASU-REF-001") : List.of("ASU-REF-002");
                case SUV_CROSSOVER -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-REF-003")
                        : (isHiluxOrFortuner ? List.of("ASU-REF-002") : List.of("ASU-REF-001"));
                case SEDAN_KOREAN -> List.of("ASU-REF-003");
                case SEDAN_JAPANESE, SEDAN_EURO_LATAM -> List.of("ASU-REF-001");
            };
            case "CARROCERIA" -> switch (profile) {
                case HEAVY_TRACTOR -> List.of("ASU-CAR-007");
                case MEDIUM_TRUCK -> List.of("ASU-CAR-007", "ASU-CAR-006");
                case PICKUP_DIESEL -> modelName.contains("hilux")
                        ? List.of("ASU-CAR-001", "ASU-CAR-002", "ASU-CAR-006")
                        : List.of("ASU-CAR-006", "ASU-CAR-001", "ASU-CAR-002");
                case COMMERCIAL_VAN -> isProboxOrYaris
                        ? List.of("ASU-CAR-003")
                        : List.of("ASU-CAR-006", "ASU-CAR-001");
                case SUV_CROSSOVER -> origin == BrandOriginGroup.KOREAN
                        ? List.of("ASU-CAR-004", "ASU-CAR-003")
                        : (isHiluxOrFortuner ? List.of("ASU-CAR-001", "ASU-CAR-006") : List.of("ASU-CAR-003"));
                case SEDAN_KOREAN -> List.of("ASU-CAR-004", "ASU-CAR-003");
                case SEDAN_JAPANESE, SEDAN_EURO_LATAM -> List.of("ASU-CAR-003", "ASU-CAR-004");
            };
            default -> List.of();
        };

        List<Part> resolved = resolveSkus(skus, bySku);
        return resolved.isEmpty() ? catParts : resolved;
    }

    private int desiredModernCount(String catKey, VehicleModel model, ModelProfile profile, int modelIdx) {
        String m = model.getName().toLowerCase();
        if ("FILTROS".equals(catKey)) {
            return (modelIdx % 2 == 0) ? 2 : 3;
        }
        if ("FRENOS".equals(catKey) && (m.contains("hilux") || (modelIdx % 3 == 0))) {
            return 2;
        }
        if ("CARROCERIA".equals(catKey) && m.contains("hilux")) {
            return 3;
        }
        if ("ELECTRICO".equals(catKey) && profile == ModelProfile.SEDAN_JAPANESE && m.contains("yaris")) {
            return 2;
        }
        return 1;
    }

    private List<Part> resolveSkus(List<String> skus, Map<String, Part> bySku) {
        List<Part> out = new ArrayList<>();
        for (String sku : skus) {
            Part p = bySku.get(sku.toUpperCase());
            if (p != null) {
                out.add(p);
            }
        }
        return out;
    }

    private List<Part> pickModelSubset(List<Part> pool, Set<Long> excludedPartIds, int seedIdx, int desiredCount) {
        List<Part> available = pool.stream()
                .filter(p -> !excludedPartIds.contains(p.getId()))
                .toList();
        if (available.isEmpty()) {
            return List.of();
        }
        int take = Math.min(desiredCount, available.size());
        List<Part> chosen = new ArrayList<>(take);
        int start = Math.floorMod(seedIdx, available.size());
        for (int i = 0; i < take; i++) {
            chosen.add(available.get((start + i) % available.size()));
        }
        return chosen;
    }

    private void addCompatibilityIfAbsent(
            Part part,
            VehicleModel model,
            int yearStart,
            int yearEnd,
            String engineSpec,
            String notes,
            Set<Part> dirtyParts
    ) {
        boolean existsForModel = part.getCompatibilities().stream()
                .anyMatch(c -> c.getVehicleModel().getId().equals(model.getId()));
        if (existsForModel) {
            return;
        }
        PartCompatibility pc = new PartCompatibility();
        pc.setPart(part);
        pc.setVehicleModel(model);
        pc.setYearStart(yearStart);
        pc.setYearEnd(yearEnd);
        pc.setEngineSpec(engineSpec);
        pc.setNotes(notes);
        part.getCompatibilities().add(pc);
        dirtyParts.add(part);
    }

    private VehicleModel pickBestFallbackModelForOrphan(Part part, List<VehicleModel> allModels) {
        String text = ((part.getName() != null ? part.getName() : "") + " "
                + (part.getTechnicalDescription() != null ? part.getTechnicalDescription() : "")).toLowerCase();
        for (VehicleModel m : allModels) {
            String mn = m.getName().toLowerCase();
            if (text.contains("coreano") && classifyBrandOrigin(m) == BrandOriginGroup.KOREAN) return m;
            if ((text.contains("volkswagen") || text.contains("chevrolet")) && classifyBrandOrigin(m) == BrandOriginGroup.EURO_LATAM) return m;
            if (text.contains("suv") && classifyModelProfile(m) == ModelProfile.SUV_CROSSOVER) return m;
            if ((text.contains("pesad") || text.contains("camion") || text.contains("24v")) && classifyModelProfile(m) == ModelProfile.HEAVY_TRACTOR) return m;
            if (mn.contains("hilux") && (text.contains("pickup") || text.contains("diesel") || text.contains("diésel"))) return m;
        }
        return allModels.get(0);
    }

    private ModelProfile classifyModelProfile(VehicleModel model) {
        String make = model.getMake() != null && model.getMake().getName() != null
                ? model.getMake().getName().toLowerCase()
                : "";
        String name = model.getName() != null ? model.getName().toLowerCase() : "";
        String type = model.getVehicleType() != null ? model.getVehicleType().toUpperCase() : "";

        // 1. Camiones pesados / Tractos (10T - 40T, 24V)
        if (make.contains("scania") || make.contains("volvo")
                || name.contains("500") || name.contains("forward") || name.contains("p410")
                || name.contains("r-series") || name.contains("fh")) {
            return ModelProfile.HEAVY_TRACTOR;
        }

        // 2. Camiones livianos / medianos de reparto urbano (3T - 6T)
        if (name.contains("dutro") || name.contains("npr") || name.contains("canter")
                || name.contains("h-100") || name.contains("k2700") || make.contains("hino")) {
            return ModelProfile.MEDIUM_TRUCK;
        }

        // 3. Pick-Ups Turbo Diésel 4x4 / 4x2
        if (name.contains("hilux") || name.contains("frontier") || name.contains("l200")
                || name.contains("d-max") || name.contains("amarok") || "PICKUP".equals(type)) {
            return ModelProfile.PICKUP_DIESEL;
        }

        // 4. Vans y Station Wagons Comerciales
        if (name.contains("hiace") || name.contains("urvan") || name.contains("probox") || "VAN".equals(type)) {
            return ModelProfile.COMMERCIAL_VAN;
        }

        // 5. SUVs y Crossovers
        if (name.contains("fortuner") || name.contains("rav4") || name.contains("tucson")
                || name.contains("sportage") || "SUV".equals(type) || "CROSSOVER".equals(type)) {
            return ModelProfile.SUV_CROSSOVER;
        }

        // 6. Sedanes y Hatchbacks por origen mecánico
        BrandOriginGroup origin = classifyBrandOrigin(model);
        if (origin == BrandOriginGroup.KOREAN) {
            return ModelProfile.SEDAN_KOREAN;
        }
        if (origin == BrandOriginGroup.EURO_LATAM) {
            return ModelProfile.SEDAN_EURO_LATAM;
        }
        return ModelProfile.SEDAN_JAPANESE;
    }

    private BrandOriginGroup classifyBrandOrigin(VehicleModel model) {
        String make = model.getMake() != null && model.getMake().getName() != null
                ? model.getMake().getName().toLowerCase()
                : "";
        if (make.contains("hyundai") || make.contains("kia")) {
            return BrandOriginGroup.KOREAN;
        }
        if (make.contains("volkswagen") || make.contains("chevrolet")) {
            return BrandOriginGroup.EURO_LATAM;
        }
        if (make.contains("scania") || make.contains("volvo") || make.contains("hino") || make.contains("isuzu")) {
            return BrandOriginGroup.HEAVY_FLEET;
        }
        return BrandOriginGroup.JAPANESE;
    }

    private String engineSpecForEra(VehicleModel model, ModelProfile profile, int era) {
        return switch (profile) {
            case HEAVY_TRACTOR -> era == 1
                    ? "Diésel Aspirado / Turbo Mecánico Flota Clásica"
                    : (era == 2 ? "Turbo Diésel Intercooler Euro III" : "Turbo Diésel Common-Rail Euro IV / Euro V");
            case MEDIUM_TRUCK -> era == 1
                    ? "Diésel 3.5L / 4.0L Inyección Mecánica"
                    : (era == 2 ? "Turbo Diésel 3.0L / 4.0L Euro III" : "Turbo Diésel Common-Rail 2.5L / 4.0L Euro IV");
            case PICKUP_DIESEL -> era == 1
                    ? "2.2L / 2.4L Diésel & Gasolina Serie Clásica"
                    : (era == 2 ? "2.5L / 3.0L Turbo Diésel D-4D / CRDi" : "2.4L / 2.8L Turbo Diésel Intercooler 6MT");
            case COMMERCIAL_VAN -> era == 1
                    ? "1.8L / 2.4L Serie Clásica Comercial"
                    : (era == 2 ? "1.5L VVT-i / 2.5L Diésel Comercial" : "1.5L 1NZ-FE / 2.8L Turbo Diésel");
            case SUV_CROSSOVER -> era == 1
                    ? "2.0L / 2.4L Multipunto Serie Clásica"
                    : (era == 2 ? "2.0L / 2.4L DOHC 16V" : "2.0L / 2.5L Dual VVT-i / MPi");
            case SEDAN_KOREAN -> era == 1
                    ? "1.3L / 1.5L SOHC Serie Clásica"
                    : (era == 2 ? "1.4L / 1.6L Alpha / Beta DOHC" : "1.4L / 1.6L Gamma MPi DOHC 16V");
            case SEDAN_EURO_LATAM -> era == 1
                    ? "1.6L AP / SOHC Serie Clásica"
                    : (era == 2 ? "1.4L / 1.6L 8V Multipunto" : "1.2L / 1.6L MSI / Ecotec");
            case SEDAN_JAPANESE -> era == 1
                    ? "1.3L / 1.6L Carburado / EFI Clásico"
                    : (era == 2 ? "1.5L / 1.8L VVT-i DOHC" : "1.5L / 1.8L Dual VVT-i / DOHC");
        };
    }

    private VehicleMake ensureMake(String name) {
        return makeRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> makeRepository.save(new VehicleMake(name)));
    }

    private VehicleModel ensureModel(VehicleMake make, String name, String type) {
        String safeType = (type != null && ALLOWED_DB_VEHICLE_TYPES.contains(type.toUpperCase()))
                ? type.toUpperCase()
                : "COMERCIAL";
        return modelRepository.findByMakeIdAndNameIgnoreCase(make.getId(), name)
                .orElseGet(() -> modelRepository.save(new VehicleModel(make, name, safeType)));
    }
}
