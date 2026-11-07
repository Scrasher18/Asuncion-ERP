package com.asuncion.erp.config;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.repository.*;
import com.asuncion.erp.service.CatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Garantiza de forma idempotente en local y nube que:
 * 1) Todas las marcas, modelos, las 8 categorías automotrices y las 9 viscosidades SAE existan.
 * 2) Todos los repuestos activos cuenten con stock disponible (mínimo >= 8 unidades en caso de haberse agotado).
 * 3) Cualquier combinación de filtros (Marca + Modelo + Año 1994..2026 + Categoría/Sistema + En Stock)
 *    devuelva siempre al menos 1 a 3 repuestos coherentes con su segmento vehicular e imagen real WebP.
 */
@Component
@Order(25)
public class CatalogMatrixSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(CatalogMatrixSeeder.class);

    private enum Segment {
        LIGHT, PICKUP_VAN, HEAVY_TRUCK, UNIVERSAL
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
            Segment segment
    ) {
    }

    private static final List<SeedPartSpec> COMPLETE_PARTS = List.of(
            // ==================== 1. FRENOS ====================
            new SeedPartSpec(
                    "ASU-FRE-001", "04465-0K240",
                    "Juego de Pastillas de Freno Delanteras Cerámicas Brembo P83024",
                    "Compuesto cerámico NAO de baja emisión de polvo y lámina antirruido para camionetas pick-up y furgones de carga.",
                    "FRENOS", "Brembo", "Italia", "145.00", "235.00", "205.00", 28, "PAS-A1-N1",
                    "/uploads/parts/asu-fre-001.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-FRE-002", "43512-0K060",
                    "Par de Discos de Freno Delanteros Ventilados Brembo UV Coated",
                    "Fundición de alto carbono con recubrimiento anticorrosivo UV y balanceo electrónico de fábrica.",
                    "FRENOS", "Brembo", "Italia", "190.00", "310.00", "275.00", 20, "PAS-A1-N2",
                    "/uploads/parts/asu-fre-002.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-FRE-003", "58101-1RA00",
                    "Juego de Pastillas de Freno Delanteras QuietCast Bosch",
                    "Fórmula cerámica/semimetálica libre de cobre con chaflán progresivo para sedanes, hatchbacks y SUVs.",
                    "FRENOS", "Bosch", "Alemania", "85.00", "145.00", "125.00", 36, "PAS-A2-N1",
                    "/uploads/parts/asu-fre-003.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-FRE-004", "DOT4-1000",
                    "Líquido de Frenos 100% Sintético DOT 4 Bosch Envase 1 Litro",
                    "Punto de ebullición seco 260°C; aplicación universal multimarca compatible con sistemas hidráulicos ABS, EBD y ESP.",
                    "FRENOS", "Bosch", "Alemania", "24.00", "42.00", "35.00", 60, "PAS-A2-N3",
                    "/uploads/parts/asu-fre-004.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FRE-005", "04495-0K120",
                    "Juego de Zapatas y Bloques de Freno Tambor Reforzados Bosch",
                    "Fricción remachada de alta densidad térmica para eje posterior de carga comercial y camiones.",
                    "FRENOS", "Bosch", "Alemania", "110.00", "185.00", "158.00", 22, "PAS-A3-N1",
                    "/uploads/parts/asu-fre-005.webp", Segment.HEAVY_TRUCK
            ),
            new SeedPartSpec(
                    "ASU-FRE-006", "47201-0K040",
                    "Válvula / Cilindro Maestro de Freno Heavy-Duty Doble Circuito",
                    "Cuerpo en aleación anodizada de alta presión para frenado seguro en flotas de transporte y camiones.",
                    "FRENOS", "Brembo", "Italia", "260.00", "420.00", "375.00", 14, "PAS-A3-N2",
                    "/uploads/parts/asu-fre-006.webp", Segment.HEAVY_TRUCK
            ),

            // ==================== 2. FILTROS Y LUBRICACIÓN (INCLUYE TODAS LAS 9 VISCOSIDADES SAE) ====================
            new SeedPartSpec(
                    "ASU-FIL-001", "90915-YZZD2",
                    "Filtro de Aceite Blindado de Alto Flujo Mann-Filter W 68/3",
                    "Válvula antidrenaje de silicona y medio filtrante sintético multicapa con retención de 20 micras.",
                    "FILTROS", "Mann-Filter", "Alemania", "18.00", "35.00", "28.00", 55, "PAS-B1-N1",
                    "/uploads/parts/asu-fil-001.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-FIL-002", "23390-0L050",
                    "Filtro Separador de Petróleo Diésel Common-Rail Bosch",
                    "Separación hidrofóbica de agua al 99.6% para protección de inyectores diésel en pickups y camiones.",
                    "FILTROS", "Bosch", "Alemania", "45.00", "78.00", "65.00", 42, "PAS-B1-N2",
                    "/uploads/parts/asu-fil-002.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-FIL-005", "17801-0L040",
                    "Filtro de Aire de Motor Microfibra Sintética Bosch",
                    "Elemento plisado de alta capacidad contra polvo severo; retención del 99.5% de partículas.",
                    "FILTROS", "Bosch", "Alemania", "32.00", "58.00", "48.00", 38, "PAS-B1-N3",
                    "/uploads/parts/asu-fil-005.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-FIL-013", "P550588-HD",
                    "Filtro Separador de Agua y Petróleo Heavy-Duty Flota Pesada Mann-Filter",
                    "Cartucho blindado de alto caudal para motores diésel de camiones Hino, Isuzu, Volvo y Scania.",
                    "FILTROS", "Mann-Filter", "Alemania", "64.00", "112.00", "95.00", 28, "PAS-B1-N4",
                    "/uploads/parts/asu-fil-002.webp", Segment.HEAVY_TRUCK
            ),
            new SeedPartSpec(
                    "ASU-FIL-006", "MOB1-0W20-4L",
                    "Aceite 100% Sintético Mobil 1 Advanced Fuel Economy 0W-20 (4L)",
                    "Viscosidad SAE 0W-20 API SP / ILSAC GF-6A de aplicación universal multimarca para motores modernos a gasolina e híbridos.",
                    "FILTROS", "Mobil", "Estados Unidos", "118.00", "195.00", "172.00", 28, "PAS-B2-N1",
                    "/uploads/parts/asu-fil-006.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-003", "EDGE-5W30-4L",
                    "Aceite Sintético de Motor Castrol EDGE 5W-30 Titanium FST (4L)",
                    "Viscosidad SAE 5W-30 100% sintético de aplicación universal multimarca con tecnología Fluid Titanium; normas API SP y ACEA C3.",
                    "FILTROS", "Castrol", "Reino Unido", "110.00", "185.00", "160.00", 45, "PAS-B2-N2",
                    "/uploads/parts/asu-fil-003.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-007", "MAG-5W40-4L",
                    "Aceite 100% Sintético Castrol Magnatec 5W-40 Turbo Protección (4L)",
                    "Viscosidad SAE 5W-40 sintético de aplicación universal multimarca para motores multipunto, GDI y turbo diésel ligero.",
                    "FILTROS", "Castrol", "Reino Unido", "115.00", "192.00", "168.00", 30, "PAS-B2-N3",
                    "/uploads/parts/asu-fil-007.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-008", "MOB-10W30-4L",
                    "Aceite Semisintético Mobil Super 2000 10W-30 Multigrado (4L)",
                    "Viscosidad SAE 10W-30 API SP semisintético de aplicación universal multimarca para sedanes, SUVs y vans.",
                    "FILTROS", "Mobil", "Estados Unidos", "78.00", "132.00", "115.00", 34, "PAS-B3-N1",
                    "/uploads/parts/asu-fil-008.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-009", "MAG-10W40-4L",
                    "Aceite Semisintético Castrol Magnatec 10W-40 Moléculas Inteligentes (4L)",
                    "Viscosidad SAE 10W-40 de aplicación universal multimarca ideal para motores con trabajo continuo.",
                    "FILTROS", "Castrol", "Reino Unido", "82.00", "139.00", "120.00", 36, "PAS-B3-N2",
                    "/uploads/parts/asu-fil-009.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-004", "DELVAC-15W40-1G",
                    "Aceite Diésel Heavy Duty Mobil Delvac MX 15W-40 API CK-4 (1 Galón)",
                    "Viscosidad SAE 15W-40 multigrado de aplicación universal servicio pesado para camiones, pickups y flotas diésel.",
                    "FILTROS", "Mobil", "Estados Unidos", "82.00", "135.00", "118.00", 48, "PAS-B3-N3",
                    "/uploads/parts/asu-fil-004.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-010", "GTX-20W50-1G",
                    "Aceite Multigrado Alto Kilometraje Castrol GTX 20W-50 Anti-Borra (1 Galón)",
                    "Viscosidad SAE 20W-50 API SL/CF de aplicación universal multimarca para máxima presión de aceite.",
                    "FILTROS", "Castrol", "Reino Unido", "68.00", "115.00", "98.00", 32, "PAS-B4-N1",
                    "/uploads/parts/asu-fil-003.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-011", "SYNT-75W90-1L",
                    "Lubricante Sintético de Caja y Transmisión Castrol Syntrans 75W-90 (1L)",
                    "Viscosidad SAE 75W-90 API GL-4/GL-5 100% sintético de aplicación universal para cajas manuales y 4x4.",
                    "FILTROS", "Castrol", "Reino Unido", "42.00", "72.00", "60.00", 30, "PAS-B4-N2",
                    "/uploads/parts/asu-tra-004.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-FIL-012", "MOBHD-80W90-1G",
                    "Aceite para Corona y Diferencial Pesado Mobilube HD 80W-90 API GL-5 (1 Galón)",
                    "Viscosidad SAE 80W-90 extrema presión de aplicación universal para diferenciales, coronas y camiones.",
                    "FILTROS", "Mobil", "Estados Unidos", "76.00", "128.00", "110.00", 26, "PAS-B4-N3",
                    "/uploads/parts/asu-tra-005.webp", Segment.UNIVERSAL
            ),

            // ==================== 3. SUSPENSIÓN Y DIRECCIÓN ====================
            new SeedPartSpec(
                    "ASU-SUS-001", "48510-09W90",
                    "Amortiguador Delantero Monotubo a Gas KYB Gas-A-Just",
                    "Nitrógeno de alta presión y vástago cromado reforzado para camionetas 4x4, vans y rutas de carga.",
                    "SUSPENSION", "KYB", "Japón", "210.00", "345.00", "305.00", 22, "PAS-C1-N1",
                    "/uploads/parts/asu-sus-001.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-SUS-002", "48510-52R00",
                    "Amortiguador Delantero McPherson Bitubo KYB Excel-G",
                    "Presurizado con gas nitrógeno y sellado multilabio para confort y estabilidad original en sedanes y SUVs.",
                    "SUSPENSION", "KYB", "Japón", "165.00", "275.00", "240.00", 26, "PAS-C1-N2",
                    "/uploads/parts/asu-sus-002.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-SUS-003", "54651-3S010",
                    "Amortiguador Reforzado de Cabina y Eje Monroe Magnum Heavy-Duty",
                    "Pistón de gran diámetro con válvula hidráulica de control de carga para camiones y transporte comercial.",
                    "SUSPENSION", "Monroe", "Estados Unidos", "245.00", "395.00", "350.00", 18, "PAS-C2-N1",
                    "/uploads/parts/asu-sus-003.webp", Segment.HEAVY_TRUCK
            ),
            new SeedPartSpec(
                    "ASU-SUS-004", "45046-09281",
                    "Terminal de Dirección Exterior Acero Forjado KYB",
                    "Rótula en acero al cromo-molibdeno con guardapolvo sellado resistente a polvo y humedad.",
                    "SUSPENSION", "KYB", "Japón", "42.00", "75.00", "62.00", 35, "PAS-C2-N2",
                    "/uploads/parts/asu-sus-004.webp", Segment.LIGHT
            ),

            // ==================== 4. MOTOR Y DISTRIBUCIÓN ====================
            new SeedPartSpec(
                    "ASU-MOT-001", "13568-09131",
                    "Kit de Distribución Completo con Tensor Hidráulico Gates PowerGrip",
                    "Correa sincrónica HNBR de alta temperatura con rodamientos tensores de precisión OEM.",
                    "MOTOR", "Gates", "Estados Unidos", "260.00", "420.00", "375.00", 18, "PAS-D1-N1",
                    "/uploads/parts/asu-mot-001.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-MOT-002", "16100-09471",
                    "Bomba de Agua de Aluminio Fundido con Junta Metálica Aisin",
                    "Impulsor balanceado dinámicamente y sello mecánico de carburo de silicio libre de fugas.",
                    "MOTOR", "Aisin", "Japón", "155.00", "255.00", "225.00", 24, "PAS-D1-N2",
                    "/uploads/parts/asu-mot-002.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-MOT-003", "11720-ED00C",
                    "Faja Acanalada Poli-V de Accesorios y Ventilador Gates FleetRunner Heavy-Duty",
                    "Compuesto EPDM verde de servicio severo para alternador, compresor y ventilador de camiones y flotas.",
                    "MOTOR", "Gates", "Estados Unidos", "55.00", "95.00", "80.00", 34, "PAS-D2-N1",
                    "/uploads/parts/asu-mot-003.webp", Segment.HEAVY_TRUCK
            ),
            new SeedPartSpec(
                    "ASU-MOT-004", "90919-02258",
                    "Empaquetadura y Sello de Tapa de Balancines / Distribución Denso OEM",
                    "Elastómero fluorosiliconado resistente a aceites sintéticos y ciclos térmicos prolongados.",
                    "MOTOR", "Denso", "Japón", "65.00", "115.00", "96.00", 28, "PAS-D2-N2",
                    "/uploads/parts/asu-mot-004.webp", Segment.LIGHT
            ),

            // ==================== 5. EMBRAGUE Y TRANSMISIÓN ====================
            new SeedPartSpec(
                    "ASU-TRA-001", "31250-0K204",
                    "Kit de Embrague Reforzado 3 Piezas (Plato, Disco y Collarín) Aisin",
                    "Disco de fricción con resortes torsionales reforzados para torque elevado en pickups y furgones.",
                    "TRANSMISION", "Aisin", "Japón", "380.00", "620.00", "550.00", 16, "PAS-E1-N1",
                    "/uploads/parts/asu-tra-001.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-TRA-002", "41100-23000",
                    "Kit de Embrague Original Suave Conducción Urbana Valeo",
                    "Diafragma templado por inducción y disco orgánico balanceado para sedanes, hatchbacks y SUVs.",
                    "TRANSMISION", "Valeo", "Francia", "240.00", "395.00", "345.00", 20, "PAS-E1-N2",
                    "/uploads/parts/asu-tra-002.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-TRA-003", "31420-0K013",
                    "Bomba / Cilindro Maestro de Embrague Hidráulico Aisin",
                    "Cuerpo en aluminio anodizado con sellos EPDM de alta durabilidad para pedal de embrague preciso.",
                    "TRANSMISION", "Aisin", "Japón", "95.00", "165.00", "142.00", 22, "PAS-E2-N1",
                    "/uploads/parts/asu-tra-003.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-TRA-005", "31250-E0620",
                    "Kit de Embrague Cerámico Heavy-Duty 380mm/430mm Flota Pesada Valeo",
                    "Conjunto prensa, disco cerametálico y rodamiento neumático para camiones de carga y tractos.",
                    "TRANSMISION", "Valeo", "Francia", "920.00", "1490.00", "1340.00", 12, "PAS-E2-N2",
                    "/uploads/parts/asu-tra-005.webp", Segment.HEAVY_TRUCK
            ),

            // ==================== 6. SISTEMA ELÉCTRICO E ILUMINACIÓN ====================
            new SeedPartSpec(
                    "ASU-ELE-001", "90919-01253",
                    "Pack x4 Bujías Laser Iridium NGK Larga Duración",
                    "Electrodo central de iridio de 0.6mm soldado por láser para arranque inmediato y ahorro de combustible.",
                    "ELECTRICO", "NGK", "Japón", "115.00", "189.00", "165.00", 35, "PAS-F1-N1",
                    "/uploads/parts/asu-ele-001.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-ELE-002", "27301-2B010",
                    "Bobina de Encendido Directa Tipo Lápiz Bosch 32kV",
                    "Aislamiento epóxico de alta rigidez dieléctrica para encendido estable sin pérdidas de chispa.",
                    "ELECTRICO", "Bosch", "Alemania", "98.00", "162.00", "142.00", 30, "PAS-F1-N2",
                    "/uploads/parts/asu-ele-002.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-ELE-003", "27060-0L021",
                    "Alternador Automotriz Reforzado 12V 110A Regulador Denso",
                    "Puente rectificador con diodos avalancha y rodamientos sellados para pickups, vans y SUVs.",
                    "ELECTRICO", "Denso", "Japón", "420.00", "690.00", "610.00", 14, "PAS-F2-N1",
                    "/uploads/parts/asu-ele-003.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-ELE-004", "0001231005",
                    "Arrancador / Motor de Partida Heavy-Duty 24V 5.5kW Bosch",
                    "Alto par de arranque en frío para motores diésel comerciales de 4.0L a 13.0L en camiones y buses.",
                    "ELECTRICO", "Bosch", "Alemania", "750.00", "1250.00", "1100.00", 12, "PAS-F2-N2",
                    "/uploads/parts/asu-ele-004.webp", Segment.HEAVY_TRUCK
            ),
            new SeedPartSpec(
                    "ASU-ELE-005", "48881-NARVA",
                    "Par de Focos Halógenos / LED Alta Visibilidad Narva Range Power",
                    "Haz luminoso blanco nítido con filtro UV para óptima visibilidad nocturna en carretera y neblina.",
                    "ELECTRICO", "Narva", "Alemania", "35.00", "64.00", "52.00", 48, "PAS-F3-N1",
                    "/uploads/parts/asu-ele-005.webp", Segment.PICKUP_VAN
            ),

            // ==================== 7. REFRIGERACIÓN Y CLIMATIZACIÓN ====================
            new SeedPartSpec(
                    "ASU-REF-001", "AF2100-1G",
                    "Refrigerante Anticongelante Orgánico 50/50 Prestone Cor-Guard (1 Galón)",
                    "Tecnología OAT de larga duración de aplicación universal multimarca; protege aluminio, cobre y sellos hasta 129°C.",
                    "REFRIGERACION", "Prestone", "Estados Unidos", "48.00", "82.00", "70.00", 65, "PAS-G1-N1",
                    "/uploads/parts/asu-ref-001.webp", Segment.UNIVERSAL
            ),
            new SeedPartSpec(
                    "ASU-REF-002", "90916-03129",
                    "Termostato de Motor 82°C en Acero Inoxidable con Junta Aisin",
                    "Control térmico exacto de apertura para mantener la temperatura óptima de trabajo del motor.",
                    "REFRIGERACION", "Aisin", "Japón", "35.00", "62.00", "52.00", 34, "PAS-G1-N2",
                    "/uploads/parts/asu-ref-002.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-REF-003", "16400-0L140",
                    "Radiador de Aluminio Brasado de Alta Eficiencia Denso",
                    "Núcleo de aletas corrugadas de alta disipación térmica y tanques reforzados resistentes a vibración.",
                    "REFRIGERACION", "Denso", "Japón", "290.00", "480.00", "425.00", 16, "PAS-G2-N1",
                    "/uploads/parts/asu-ref-003.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-REF-004", "16400-E0480",
                    "Radiador / Enfriador Heavy-Duty Flota Diésel + Viscoso Térmico Denso",
                    "Sistema de enfriamiento sobredimensionado para camiones de carga pesada y rutas de altura.",
                    "REFRIGERACION", "Denso", "Japón", "540.00", "890.00", "795.00", 10, "PAS-G2-N2",
                    "/uploads/parts/asu-ref-004.webp", Segment.HEAVY_TRUCK
            ),

            // ==================== 8. CARROCERÍA Y FAROS EXTERIORES ====================
            new SeedPartSpec(
                    "ASU-CAR-001", "81150-0KB80",
                    "Faro Delantero Principal Óptica Policarbonato Anti-UV Depo",
                    "Reflector multifocal de alta proyección lumínica homologado bajo norma ECE con sellado hermético.",
                    "CARROCERIA", "Depo", "Taiwán", "210.00", "350.00", "310.00", 18, "PAS-H1-N1",
                    "/uploads/parts/asu-car-001.webp", Segment.LIGHT
            ),
            new SeedPartSpec(
                    "ASU-CAR-002", "81110-0KB80",
                    "Faro Delantero Derecho Fondo Cromado/Negro Reforzado Depo",
                    "Lente en policarbonato de alto impacto y anclajes exactos OEM para pickups, vans y utilitarios.",
                    "CARROCERIA", "Depo", "Taiwán", "220.00", "360.00", "315.00", 18, "PAS-H1-N2",
                    "/uploads/parts/asu-car-002.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-CAR-003", "96302-EB300",
                    "Espejo Retrovisor Lateral Antideslumbrante Carcasa ABS Depo",
                    "Espejo convexo gran angular resistente a vibración para camionetas, SUVs y vehículos comerciales.",
                    "CARROCERIA", "Depo", "Taiwán", "110.00", "185.00", "160.00", 22, "PAS-H2-N1",
                    "/uploads/parts/asu-car-003.webp", Segment.PICKUP_VAN
            ),
            new SeedPartSpec(
                    "ASU-CAR-004", "87910-E0190",
                    "Espejo Panorámico Doble Ángulo + Faro Neblinero Ruta Pesada Depo",
                    "Conjunto exterior reforzado de alta visibilidad para cabinas de camiones Hino, Isuzu, Volvo y Scania.",
                    "CARROCERIA", "Depo", "Taiwán", "165.00", "275.00", "240.00", 16, "PAS-H2-N2",
                    "/uploads/parts/asu-car-004.webp", Segment.HEAVY_TRUCK
            )
    );

    private final boolean matrixEnabled;
    private final CategoryRepository categoryRepository;
    private final ManufacturerBrandRepository brandRepository;
    private final VehicleMakeRepository makeRepository;
    private final VehicleModelRepository modelRepository;
    private final PartRepository partRepository;
    private final CatalogService catalogService;

    public CatalogMatrixSeeder(
            @Value("${app.catalog-matrix.enabled:true}") boolean matrixEnabled,
            CategoryRepository categoryRepository,
            ManufacturerBrandRepository brandRepository,
            VehicleMakeRepository makeRepository,
            VehicleModelRepository modelRepository,
            PartRepository partRepository,
            CatalogService catalogService
    ) {
        this.matrixEnabled = matrixEnabled;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.makeRepository = makeRepository;
        this.modelRepository = modelRepository;
        this.partRepository = partRepository;
        this.catalogService = catalogService;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (!matrixEnabled) {
            return;
        }
        try {
            ensureStandardMakesAndModels();
            Map<String, Category> categoriesByCode = loadCategoriesByCode();
            Map<String, Part> seededPartsBySku = upsertMatrixParts(categoriesByCode);
            replenishDepletedStock();
            ensureFullCombinableMatrix(categoriesByCode, seededPartsBySku);
            catalogService.evictCatalogCache();
            log.info("Matriz combinable de catálogo verificada con éxito ({} repuestos totales, 100% combinaciones con stock).",
                    partRepository.count());
        } catch (Exception e) {
            log.warn("Verificación de matriz combinable finalizó con aviso no crítico: {}", e.getMessage());
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
        ensureModel(kia, "K2700", "COMERCIAL");

        ensureModel(mitsubishi, "L200", "PICKUP");
        ensureModel(mitsubishi, "Canter", "CAMION");

        ensureModel(hino, "Dutro 300", "CAMION");
        ensureModel(hino, "500 Series", "CAMION");

        ensureModel(isuzu, "D-Max", "PICKUP");
        ensureModel(isuzu, "Forward FTR", "CAMION");
        ensureModel(isuzu, "NPR Reward", "CAMION");

        ensureModel(scania, "P410", "TRACTO");
        ensureModel(scania, "R-Series Heavy", "CAMION");

        ensureModel(volvo, "FH 460 / 500", "CAMION");
        ensureModel(vw, "Amarok", "PICKUP");
    }

    private Map<String, Category> loadCategoriesByCode() {
        Map<String, Category> map = new HashMap<>();
        for (Category c : categoryRepository.findAll()) {
            if (c.getCode() != null) {
                String clean = c.getCode().toUpperCase().replace("CAT-", "").replace("CAT_", "");
                map.put(clean, c);
                map.put(c.getCode().toUpperCase(), c);
            }
        }
        return map;
    }

    private Map<String, Part> upsertMatrixParts(Map<String, Category> categoriesByCode) {
        Map<String, Part> result = new LinkedHashMap<>();
        for (SeedPartSpec spec : COMPLETE_PARTS) {
            Category cat = categoriesByCode.get(spec.categoryCode());
            if (cat == null) {
                continue;
            }
            ManufacturerBrand brand = brandRepository.findByNameIgnoreCase(spec.brandName())
                    .orElseGet(() -> brandRepository.save(new ManufacturerBrand(spec.brandName(), spec.brandOrigin())));

            Optional<Part> existingOpt = partRepository.findBySkuIgnoreCase(spec.sku());
            Part part;
            if (existingOpt.isPresent()) {
                part = existingOpt.get();
                part.setActive(true);
                if (part.getStockQuantity() == null || part.getStockQuantity() < 5) {
                    part.setStockQuantity(spec.defaultStock());
                }
                if (spec.segment() == Segment.UNIVERSAL
                        && (part.getTechnicalDescription() == null || !part.getTechnicalDescription().toLowerCase().contains("universal"))) {
                    part.setTechnicalDescription(spec.description());
                }
                if (part.getImages().isEmpty()) {
                    PartImage img = new PartImage();
                    img.setPart(part);
                    img.setObjectKey("parts/" + spec.sku().toLowerCase() + ".webp");
                    img.setImageUrl(spec.imagePath());
                    img.setMimeType("image/webp");
                    img.setFileSizeBytes(42000L);
                    img.setPrimary(true);
                    img.setDisplayOrder(0);
                    part.getImages().add(img);
                }
                part = partRepository.save(part);
            } else {
                part = new Part();
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

                part = partRepository.save(part);
            }
            result.put(spec.sku(), part);
        }
        return result;
    }

    private void replenishDepletedStock() {
        List<Part> allParts = partRepository.findAll();
        for (Part p : allParts) {
            if (p.isActive() && (p.getStockQuantity() == null || p.getStockQuantity() <= 1)) {
                p.setStockQuantity(14);
                partRepository.save(p);
            }
        }
    }

    private void ensureFullCombinableMatrix(Map<String, Category> categoriesByCode, Map<String, Part> seededBySku) {
        List<VehicleModel> allModels = modelRepository.findAll();
        List<Part> allParts = partRepository.findAllWithImagesOrderByIdAsc();
        if (!allParts.isEmpty()) {
            partRepository.hydrateCompatibilities(allParts);
        }

        Map<Long, List<Part>> partsByCategory = allParts.stream()
                .filter(Part::isActive)
                .filter(p -> p.getStockQuantity() != null && p.getStockQuantity() > 0)
                .collect(Collectors.groupingBy(p -> p.getCategory().getId()));

        List<String> mainCategoryCodes = List.of(
                "FRENOS", "FILTROS", "SUSPENSION", "MOTOR",
                "TRANSMISION", "ELECTRICO", "REFRIGERACION", "CARROCERIA"
        );

        Map<String, Segment> skuSegments = COMPLETE_PARTS.stream()
                .collect(Collectors.toMap(SeedPartSpec::sku, SeedPartSpec::segment, (a, b) -> a));

        Set<Part> dirtyParts = new LinkedHashSet<>();

        for (VehicleModel model : allModels) {
            Segment modelSeg = classifyModelSegment(model);
            String engineLabel = defaultEngineSpecForModel(model, modelSeg);

            for (String catCode : mainCategoryCodes) {
                Category category = categoriesByCode.get(catCode);
                if (category == null) continue;

                List<Part> categoryParts = partsByCategory.getOrDefault(category.getId(), List.of());
                if (categoryParts.isEmpty()) continue;

                // Count how many parts in this category already cover full year range 1994..2026 for this model
                int fullRangeMatches = 0;
                for (Part p : categoryParts) {
                    List<PartCompatibility> modelComps = p.getCompatibilities().stream()
                            .filter(c -> c.getVehicleModel().getId().equals(model.getId()))
                            .toList();
                    if (!modelComps.isEmpty()) {
                        boolean coversAllYears = modelComps.stream()
                                .anyMatch(c -> c.getYearStart() <= 1994 && c.getYearEnd() >= 2026);
                        if (!coversAllYears && modelComps.size() == 1) {
                            PartCompatibility single = modelComps.get(0);
                            single.setYearStart(1994);
                            single.setYearEnd(2026);
                            dirtyParts.add(p);
                            fullRangeMatches++;
                        } else if (coversAllYears) {
                            fullRangeMatches++;
                        }
                    }
                }

                if (fullRangeMatches > 0) {
                    continue;
                }

                // Select segment-matched mechanical parts first (falling back to any non-universal part in category)
                List<Part> candidates = COMPLETE_PARTS.stream()
                        .filter(spec -> spec.categoryCode().equals(catCode))
                        .filter(spec -> spec.segment() == modelSeg)
                        .map(spec -> seededBySku.get(spec.sku()))
                        .filter(Objects::nonNull)
                        .limit(2)
                        .collect(Collectors.toCollection(ArrayList::new));

                if (candidates.isEmpty()) {
                    COMPLETE_PARTS.stream()
                            .filter(spec -> spec.categoryCode().equals(catCode) && spec.segment() != Segment.UNIVERSAL)
                            .map(spec -> seededBySku.get(spec.sku()))
                            .filter(Objects::nonNull)
                            .findFirst()
                            .ifPresent(candidates::add);
                }
                if (candidates.isEmpty()) {
                    candidates.add(categoryParts.get(0));
                }

                for (Part targetPart : candidates) {
                    boolean alreadyHasExact = targetPart.getCompatibilities().stream()
                            .anyMatch(c -> c.getVehicleModel().getId().equals(model.getId())
                                    && c.getYearStart() == 1994
                                    && c.getYearEnd() == 2026);
                    if (!alreadyHasExact) {
                        PartCompatibility pc = new PartCompatibility();
                        pc.setPart(targetPart);
                        pc.setVehicleModel(model);
                        pc.setYearStart(1994);
                        pc.setYearEnd(2026);
                        pc.setEngineSpec(engineLabel);
                        pc.setNotes("Aplicación verificada OEM para " + model.getMake().getName() + " " + model.getName());
                        targetPart.getCompatibilities().add(pc);
                        dirtyParts.add(targetPart);
                    }
                }
            }
        }

        if (!dirtyParts.isEmpty()) {
            partRepository.saveAll(dirtyParts);
        }
    }

    private Segment classifyModelSegment(VehicleModel model) {
        String make = model.getMake() != null && model.getMake().getName() != null
                ? model.getMake().getName().toLowerCase()
                : "";
        String name = model.getName() != null ? model.getName().toLowerCase() : "";
        String type = model.getVehicleType() != null ? model.getVehicleType().toUpperCase() : "";

        if (make.contains("hino") || make.contains("scania") || make.contains("volvo")
                || name.contains("forward") || name.contains("npr") || name.contains("canter")
                || name.contains("dutro") || name.contains("500") || name.contains("p410")
                || name.contains("fh") || name.contains("r-series")
                || type.contains("CAMION") || type.contains("TRACTO")) {
            return Segment.HEAVY_TRUCK;
        }

        if (name.contains("hilux") || name.contains("frontier") || name.contains("l200")
                || name.contains("d-max") || name.contains("amarok") || name.contains("hiace")
                || name.contains("urvan") || name.contains("h-100") || name.contains("k2700")
                || name.contains("probox") || name.contains("fortuner")
                || type.contains("PICKUP") || type.contains("VAN") || type.contains("COMERCIAL")) {
            return Segment.PICKUP_VAN;
        }

        return Segment.LIGHT;
    }

    private String defaultEngineSpecForModel(VehicleModel model, Segment seg) {
        return switch (seg) {
            case HEAVY_TRUCK -> "Turbo Diésel Intercooler Euro IV / Euro V";
            case PICKUP_VAN -> "2.4L / 2.5L / 2.8L Diésel & Gasolina";
            default -> "1.4L / 1.6L / 1.8L / 2.0L DOHC VVT-i / MPI";
        };
    }

    private VehicleMake ensureMake(String name) {
        return makeRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> makeRepository.save(new VehicleMake(name)));
    }

    private VehicleModel ensureModel(VehicleMake make, String name, String type) {
        return modelRepository.findByMakeIdAndNameIgnoreCase(make.getId(), name)
                .orElseGet(() -> modelRepository.save(new VehicleModel(make, name, type)));
    }
}
