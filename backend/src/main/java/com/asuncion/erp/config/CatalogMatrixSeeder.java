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
 * Catálogo automotriz realista para el parque automotor peruano (1998–2026, hasta 100 productos):
 * 1) Registra y completa hasta 100 repuestos OEM reales con códigos, marcas, stock y fotos WebP verificadas.
 * 2) Actualiza en sitio cualquier SKU antiguo de "Serie Clásica (1980)" a repuestos OEM comerciales reales (1998–2026).
 * 3) Asigna compatibilidades reales según los años reales de fabricación, generaciones de chasis y códigos de motor
 *    de cada uno de los 35 modelos (ej. Hilux Vigo 2KD vs Revo 1GD, Onix 2013–2026, Amarok 2010–2026, Probox 2002–2026,
 *    Tiida 2006–2018, Hino 500 J08E Euro III vs Euro V, Scania DC13, Volvo D13, etc.).
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

    private record ModelTimeline(
            String makeName,
            String modelName,
            String vehicleType,
            ModelProfile profile,
            BrandOriginGroup origin,
            int gen1Start,
            int gen1End,
            String gen1Engine,
            int gen2Start,
            int gen2End,
            String gen2Engine
    ) {
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

    private static final List<ModelTimeline> REAL_MODEL_TIMELINES = List.of(
            // ==================== 1. TOYOTA ====================
            new ModelTimeline("Toyota", "Hilux", "PICKUP", ModelProfile.PICKUP_DIESEL, BrandOriginGroup.JAPANESE,
                    1998, 2015, "2.5L 2KD-FTV / 3.0L 1KD-FTV D-4D",
                    2016, 2026, "2.4L 2GD-FTV / 2.8L 1GD-FTV 6MT"),
            new ModelTimeline("Toyota", "Corolla", "SEDAN", ModelProfile.SEDAN_JAPANESE, BrandOriginGroup.JAPANESE,
                    1998, 2013, "1.6L 3ZZ-FE / 1.8L 1ZZ-FE VVT-i",
                    2014, 2026, "1.8L 2ZR-FE / 2.0L M20A-FKS"),
            new ModelTimeline("Toyota", "Yaris", "SEDAN", ModelProfile.SEDAN_JAPANESE, BrandOriginGroup.JAPANESE,
                    1999, 2013, "1.3L 2NZ-FE / 1.5L 1NZ-FE VVT-i",
                    2014, 2026, "1.3L 1NR-FE / 1.5L 2NR-FE Dual VVT-i"),
            new ModelTimeline("Toyota", "RAV4", "SUV", ModelProfile.SUV_CROSSOVER, BrandOriginGroup.JAPANESE,
                    1998, 2012, "2.0L 1AZ-FE / 2.4L 2AZ-FE VVT-i",
                    2013, 2026, "2.0L 3ZR-FAE / 2.5L A25A-FKS"),
            new ModelTimeline("Toyota", "Hiace", "VAN", ModelProfile.COMMERCIAL_VAN, BrandOriginGroup.JAPANESE,
                    1998, 2018, "2.5L 2KD-FTV / 3.0L 1KD-FTV Commuter",
                    2019, 2026, "2.8L 1GD-FTV Turbo Diésel H300"),
            new ModelTimeline("Toyota", "Fortuner", "SUV", ModelProfile.SUV_CROSSOVER, BrandOriginGroup.JAPANESE,
                    2005, 2015, "3.0L 1KD-FTV D-4D / 2.7L 2TR-FE",
                    2016, 2026, "2.8L 1GD-FTV / 2.4L 2GD-FTV 4x4"),
            new ModelTimeline("Toyota", "Probox", "COMERCIAL", ModelProfile.COMMERCIAL_VAN, BrandOriginGroup.JAPANESE,
                    2002, 2014, "1.3L 2NZ-FE / 1.5L 1NZ-FE NCP51",
                    2015, 2026, "1.5L 1NZ-FE / 1NR-FE NCP160"),

            // ==================== 2. HYUNDAI ====================
            new ModelTimeline("Hyundai", "Accent", "SEDAN", ModelProfile.SEDAN_KOREAN, BrandOriginGroup.KOREAN,
                    1998, 2011, "1.4L / 1.5L Alpha DOHC",
                    2012, 2026, "1.4L G4LC Kappa / 1.6L Gamma MPi"),
            new ModelTimeline("Hyundai", "Elantra", "SEDAN", ModelProfile.SEDAN_KOREAN, BrandOriginGroup.KOREAN,
                    1998, 2011, "1.6L / 2.0L Beta G4GC DOHC",
                    2012, 2026, "1.6L Gamma / 2.0L Nu MPi"),
            new ModelTimeline("Hyundai", "Tucson", "SUV", ModelProfile.SUV_CROSSOVER, BrandOriginGroup.KOREAN,
                    2005, 2015, "2.0L Theta II MPi / 2.0L CRDi",
                    2016, 2026, "2.0L Nu MPi / 1.6L T-GDi"),
            new ModelTimeline("Hyundai", "H-100", "COMERCIAL", ModelProfile.MEDIUM_TRUCK, BrandOriginGroup.KOREAN,
                    1998, 2012, "2.5L D4BB / D4BH Porter Turbo",
                    2013, 2026, "2.5L A2 D4CB CRDi 130HP Euro V"),

            // ==================== 3. NISSAN ====================
            new ModelTimeline("Nissan", "Frontier", "PICKUP", ModelProfile.PICKUP_DIESEL, BrandOriginGroup.JAPANESE,
                    1998, 2014, "2.4L KA24DE / 2.5L YD25 D22",
                    2015, 2026, "2.5L YD25DDTi / YS23 NP300"),
            new ModelTimeline("Nissan", "Sentra", "SEDAN", ModelProfile.SEDAN_JAPANESE, BrandOriginGroup.JAPANESE,
                    1998, 2012, "1.8L QG18DE / 2.0L MR20DE B15/B16",
                    2013, 2026, "1.8L MRA8DE / 2.0L MR20DD B17/B18"),
            new ModelTimeline("Nissan", "Tiida", "SEDAN", ModelProfile.SEDAN_JAPANESE, BrandOriginGroup.JAPANESE,
                    2006, 2011, "1.6L HR16DE / 1.8L MR18DE C11",
                    2012, 2018, "1.6L HR16DE 6MT C11X"),
            new ModelTimeline("Nissan", "Versa", "SEDAN", ModelProfile.SEDAN_JAPANESE, BrandOriginGroup.JAPANESE,
                    2012, 2019, "1.6L HR16DE DOHC N17",
                    2020, 2026, "1.6L HR16DE 118HP N18"),
            new ModelTimeline("Nissan", "Urvan", "VAN", ModelProfile.COMMERCIAL_VAN, BrandOriginGroup.JAPANESE,
                    1998, 2012, "2.7L TD27 / 3.0L ZD30DDTi E25",
                    2013, 2026, "2.5L YD25DDTi NV350 E26"),

            // ==================== 4. KIA ====================
            new ModelTimeline("Kia", "Sportage", "SUV", ModelProfile.SUV_CROSSOVER, BrandOriginGroup.KOREAN,
                    1998, 2015, "2.0L DOHC / Theta II SL",
                    2016, 2026, "2.0L Nu MPi / 1.6L T-GDi QL/NQ5"),
            new ModelTimeline("Kia", "Rio", "SEDAN", ModelProfile.SEDAN_KOREAN, BrandOriginGroup.KOREAN,
                    2000, 2011, "1.4L / 1.5L Alpha JB DOHC",
                    2012, 2026, "1.4L G4FA / G4LC Kappa UB/YB"),
            new ModelTimeline("Kia", "Cerato", "SEDAN", ModelProfile.SEDAN_KOREAN, BrandOriginGroup.KOREAN,
                    2004, 2012, "1.6L Gamma TD DOHC 16V",
                    2013, 2026, "1.6L Gamma / 2.0L Nu MPi YD/BD"),
            new ModelTimeline("Kia", "Picanto", "HATCHBACK", ModelProfile.SEDAN_KOREAN, BrandOriginGroup.KOREAN,
                    2004, 2016, "1.0L G3LA / 1.1L Epsilon SA/TA",
                    2017, 2026, "1.0L / 1.2L Kappa MPi JA"),
            new ModelTimeline("Kia", "K2700", "COMERCIAL", ModelProfile.MEDIUM_TRUCK, BrandOriginGroup.KOREAN,
                    1998, 2012, "2.7L J2 Diésel Bongo",
                    2013, 2026, "2.5L D4CB Turbo Diésel Bongo III"),

            // ==================== 5. MITSUBISHI ====================
            new ModelTimeline("Mitsubishi", "L200", "PICKUP", ModelProfile.PICKUP_DIESEL, BrandOriginGroup.JAPANESE,
                    1998, 2015, "2.5L 4D56 Turbo Diésel DI-D",
                    2016, 2026, "2.4L 4N15 MIVEC Turbo Diésel Triton"),
            new ModelTimeline("Mitsubishi", "Canter", "COMERCIAL", ModelProfile.MEDIUM_TRUCK, BrandOriginGroup.JAPANESE,
                    1998, 2011, "3.9L 4D34T Turbo Diésel Serie FE",
                    2012, 2026, "3.0L 4P10 / 4.9L 4M50 Fuso Euro V"),

            // ==================== 6. HINO ====================
            new ModelTimeline("Hino", "Dutro 300", "COMERCIAL", ModelProfile.MEDIUM_TRUCK, BrandOriginGroup.HEAVY_FLEET,
                    1999, 2011, "4.0L N04C-T Turbo Diésel Serie 300",
                    2012, 2026, "4.0L N04C-UV Common-Rail Euro IV/V"),
            new ModelTimeline("Hino", "500 Series", "COMERCIAL", ModelProfile.HEAVY_TRACTOR, BrandOriginGroup.HEAVY_FLEET,
                    1998, 2011, "7.7L J08C / J08E-TI Ranger 24V",
                    2012, 2026, "7.7L J08E-VD / A09C Euro V 24V"),

            // ==================== 7. ISUZU ====================
            new ModelTimeline("Isuzu", "D-Max", "PICKUP", ModelProfile.PICKUP_DIESEL, BrandOriginGroup.JAPANESE,
                    2003, 2012, "3.0L 4JH1-TC / 4JJ1-TC 4x4",
                    2013, 2026, "2.5L 4JK1-TCX / 3.0L 4JJ3-TCX"),
            new ModelTimeline("Isuzu", "Forward FTR", "COMERCIAL", ModelProfile.HEAVY_TRACTOR, BrandOriginGroup.HEAVY_FLEET,
                    1998, 2011, "7.8L 6HK1-TC Turbo Diésel 24V",
                    2012, 2026, "7.8L 6HK1-TCS Common-Rail Euro V 24V"),
            new ModelTimeline("Isuzu", "NPR Reward", "COMERCIAL", ModelProfile.MEDIUM_TRUCK, BrandOriginGroup.HEAVY_FLEET,
                    1998, 2011, "4.3L 4HF1 / 4.6L 4HG1-T Serie N",
                    2012, 2026, "5.2L 4HK1-TCN Reward Euro IV/V"),

            // ==================== 8. SCANIA ====================
            new ModelTimeline("Scania", "P410", "COMERCIAL", ModelProfile.HEAVY_TRACTOR, BrandOriginGroup.HEAVY_FLEET,
                    2005, 2016, "12.7L DC13 Euro IV Opticruise",
                    2017, 2026, "12.7L DC13 XPI Euro V 410HP"),
            new ModelTimeline("Scania", "R-Series Heavy", "COMERCIAL", ModelProfile.HEAVY_TRACTOR, BrandOriginGroup.HEAVY_FLEET,
                    2004, 2016, "12.7L DC13 / 15.6L DC16 Tracto",
                    2017, 2026, "12.7L DC13 XPI Euro V Ruta Pesada"),

            // ==================== 9. VOLVO ====================
            new ModelTimeline("Volvo", "FH 460 / 500", "COMERCIAL", ModelProfile.HEAVY_TRACTOR, BrandOriginGroup.HEAVY_FLEET,
                    1998, 2012, "12.1L D12D / 12.8L D13A Globetrotter",
                    2013, 2026, "12.8L D13C / D13K 460HP–500HP I-Shift"),

            // ==================== 10. VOLKSWAGEN ====================
            new ModelTimeline("Volkswagen", "Amarok", "PICKUP", ModelProfile.PICKUP_DIESEL, BrandOriginGroup.EURO_LATAM,
                    2010, 2016, "2.0L TDI / BiTDI 163HP–180HP 4Motion",
                    2017, 2026, "2.0L BiTDI 180HP / 3.0L V6 TDI"),
            new ModelTimeline("Volkswagen", "Gol", "HATCHBACK", ModelProfile.SEDAN_EURO_LATAM, BrandOriginGroup.EURO_LATAM,
                    1998, 2008, "1.6L / 1.8L AP Multipunto G3/G4",
                    2009, 2026, "1.6L EA111 / MSI G5/G6/G7/G8"),

            // ==================== 11. CHEVROLET ====================
            new ModelTimeline("Chevrolet", "Sail", "SEDAN", ModelProfile.SEDAN_EURO_LATAM, BrandOriginGroup.EURO_LATAM,
                    2010, 2015, "1.4L LCU S-TEC III DOHC",
                    2016, 2026, "1.5L L2B DVVT DOHC"),
            new ModelTimeline("Chevrolet", "Onix", "SEDAN", ModelProfile.SEDAN_EURO_LATAM, BrandOriginGroup.EURO_LATAM,
                    2013, 2019, "1.4L SPE/4 Multipunto Joy",
                    2020, 2026, "1.0L Turbo / 1.2L CSS Prime")
    );

    /**
     * Catálogo completo de hasta 100 repuestos OEM reales (sin SKUs artificiales de 1980).
     * Incluye los 45 SKUs suplementarios/actualizados + los SKUs base para entornos locales limpios.
     */
    private static final List<SeedPartSpec> SEED_SPECS = List.of(
            // ==================== 1. FRENOS (SUPLEMENTOS REALES OEM) ====================
            new SeedPartSpec(
                    "ASU-FRE-007", "47550-0K010",
                    "Cilindro Auxiliar / Bombín de Rueda Posterior Hidráulico Bosch",
                    "Cilindro hidráulico de hierro fundido rectificado con copelas EPDM para freno posterior de pickups y furgones.",
                    "FRENOS", "Bosch", "Alemania", "42.00", "74.00", "62.00", 34, "PAS-A4-N1",
                    "/uploads/parts/asu-fre-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-008", "42431-0K120",
                    "Par de Tambores de Freno Posteriores Balanceados Brembo",
                    "Tambores en fundición gris de alto carbono balanceados electrónicamente para camionetas pick-up y carga comercial.",
                    "FRENOS", "Brembo", "Italia", "185.00", "298.00", "262.00", 20, "PAS-A4-N2",
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
                    "Punto de ebullición seco 260°C compatible con sistemas hidráulicos ABS, EBD, ESP y embragues hidráulicos.",
                    "FRENOS", "Bosch", "Alemania", "24.00", "42.00", "35.00", 48, "PAS-A2-N3",
                    "/uploads/parts/asu-fre-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-012", "51712-1R000",
                    "Par de Discos de Freno Ventilados Delanteros 280mm Bosch",
                    "Discos ventilados con recubrimiento anticorrosivo para sedanes y hatchbacks coreanos y sudamericanos.",
                    "FRENOS", "Bosch", "Alemania", "140.00", "228.00", "198.00", 24, "PAS-A2-N2",
                    "/uploads/parts/asu-fre-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-013", "43512-02330",
                    "Par de Discos de Freno Ventilados 300mm Alto Carbono Brembo",
                    "Aleación G3000 UV Coated de alta disipación térmica para sedanes medianos y camionetas SUV.",
                    "FRENOS", "Brembo", "Italia", "175.00", "285.00", "248.00", 22, "PAS-A1-N3",
                    "/uploads/parts/asu-fre-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FRE-014", "T3030-BOSCH-HD",
                    "Cámara de Freno Neumático Doble Diafragma Tipo 30/30 Heavy-Duty Bosch",
                    "Pulmón actuador de freno de aire y estacionamiento por resorte para tractos y camiones pesados.",
                    "FRENOS", "Bosch", "Alemania", "190.00", "315.00", "275.00", 18, "PAS-A3-N4",
                    "/uploads/parts/asu-fre-006.webp", true
            ),

            // ==================== 2. FILTROS Y LUBRICACIÓN (9 GRADOS SAE + FILTRACIÓN OEM) ====================
            new SeedPartSpec(
                    "ASU-FIL-010", "GTX-20W50-1G",
                    "Aceite Multigrado Alto Kilometraje Castrol GTX 20W-50 Anti-Borra (1 Galón)",
                    "Viscosidad SAE 20W-50 API SL/CF diseñada para máxima presión y sellado en motores con alto recorrido (1998–2015).",
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
                    "ASU-FIL-014", "W920/21-MANN",
                    "Filtro de Aceite Spin-On Servicio Comercial Mann-Filter W 920/21",
                    "Carcasa reforzada de alta presión y válvula antirretorno para camiones medianos y utilitarios diésel.",
                    "FILTROS", "Mann-Filter", "Alemania", "28.00", "48.00", "40.00", 46, "PAS-B5-N1",
                    "/uploads/parts/asu-fil-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-015", "R90P-BOSCH",
                    "Elemento Filtro Primario Separador Racor 30 Micras Diésel Pesado Bosch",
                    "Cartucho coalescente decantador de agua al 99.8% para pre-filtración de flotas de camiones y tractos.",
                    "FILTROS", "Bosch", "Alemania", "52.00", "89.00", "76.00", 38, "PAS-B5-N2",
                    "/uploads/parts/asu-fil-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-016", "MOB1-0W20-4L",
                    "Aceite 100% Sintético Mobil 1 Advanced Fuel Economy 0W-20 (4L)",
                    "Viscosidad SAE 0W-20 API SP / ILSAC GF-6A para motores modernos Dual VVT-i, Kappa, Ecotec e híbridos.",
                    "FILTROS", "Mobil", "Estados Unidos", "118.00", "195.00", "172.00", 28, "PAS-B2-N1",
                    "/uploads/parts/asu-fil-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-017", "MAG-5W40-4L",
                    "Aceite 100% Sintético Castrol Magnatec 5W-40 Turbo Protección (4L)",
                    "Viscosidad SAE 5W-40 API SP / ACEA C3 para motores turbo diésel ligero D-4D/BiTDI/CRDi, GDI y multipunto.",
                    "FILTROS", "Castrol", "Reino Unido", "115.00", "192.00", "168.00", 30, "PAS-B2-N3",
                    "/uploads/parts/asu-fil-007.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-018", "MOB-10W30-4L",
                    "Aceite Semisintético Mobil Super 2000 10W-30 Multigrado (4L)",
                    "Viscosidad SAE 10W-30 API SP semisintético para sedanes, hatchbacks, vans comerciales y SUVs.",
                    "FILTROS", "Mobil", "Estados Unidos", "78.00", "132.00", "115.00", 34, "PAS-B3-N1",
                    "/uploads/parts/asu-fil-008.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-019", "MAG-10W40-4L",
                    "Aceite Semisintético Castrol Magnatec 10W-40 Moléculas Inteligentes (4L)",
                    "Viscosidad SAE 10W-40 con moléculas adherentes antidesgaste para vehículos de servicio continuo.",
                    "FILTROS", "Castrol", "Reino Unido", "82.00", "139.00", "120.00", 36, "PAS-B3-N2",
                    "/uploads/parts/asu-fil-009.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-020", "DELVAC-15W40-1G",
                    "Aceite Diésel Heavy Duty Mobil Delvac MX 15W-40 API CK-4 (1 Galón)",
                    "Viscosidad SAE 15W-40 servicio pesado para motores turbo diésel de camiones Hino, Isuzu, Scania, Volvo y pickups.",
                    "FILTROS", "Mobil", "Estados Unidos", "82.00", "135.00", "118.00", 48, "PAS-B3-N3",
                    "/uploads/parts/asu-fil-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-021", "C271250-MANN",
                    "Filtro de Aire Primario Cilíndrico Flota Pesada y Camiones Mann-Filter",
                    "Elemento radial de celulosa ignífuga con malla metálica interior para admisión de camiones y buses.",
                    "FILTROS", "Mann-Filter", "Alemania", "88.00", "149.00", "128.00", 24, "PAS-B5-N3",
                    "/uploads/parts/asu-fil-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-022", "03L115562-MANN",
                    "Filtro de Aceite Cartucho Ecológico Motores Euro V Mann-Filter HU 7008 z",
                    "Elemento filtrante libre de metales para motores modernos TDI, Ecotec y multipunto.",
                    "FILTROS", "Mann-Filter", "Alemania", "25.00", "45.00", "37.00", 40, "PAS-B5-N4",
                    "/uploads/parts/asu-fil-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-FIL-023", "0450905969-BOSCH",
                    "Filtro de Combustible en Línea Inyección Multipunto Gasolina Bosch",
                    "Carcasa de aluminio anticorrosiva con filtración de 5 micras para rieles de inyectores a gasolina.",
                    "FILTROS", "Bosch", "Alemania", "22.00", "39.00", "32.00", 42, "PAS-B5-N5",
                    "/uploads/parts/asu-fil-001.webp", true
            ),

            // ==================== 3. SUSPENSIÓN Y DIRECCIÓN ====================
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
                    "ASU-SUS-009", "845022-KYB",
                    "Par de Amortiguadores Posteriores de Carga Reforzados KYB Skorched4s",
                    "Amortiguadores hidroneumáticos para eje trasero de ballestas en pickups 4x4 y furgones comerciales.",
                    "SUSPENSION", "KYB", "Japón", "220.00", "360.00", "318.00", 22, "PAS-C3-N1",
                    "/uploads/parts/asu-sus-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-010", "SL-3640-555",
                    "Kit de Bieletas de Barra Estabilizadora Delantera 555 Japón",
                    "Articulaciones esféricas selladas de baja fricción que eliminan golpeteos en curvas y baches.",
                    "SUSPENSION", "KYB", "Japón", "54.00", "92.00", "78.00", 36, "PAS-C3-N2",
                    "/uploads/parts/asu-sus-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-011", "SA-3922R-555",
                    "Trapecio / Brazo Oscilante Inferior Delantero con Rótula y Bujes 555 Japón",
                    " Trapecio estampado en acero de alta resistencia listo para instalar en sedanes, hatchbacks y SUVs.",
                    "SUSPENSION", "KYB", "Japón", "160.00", "265.00", "232.00", 20, "PAS-C3-N3",
                    "/uploads/parts/asu-sus-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-012", "SU-3881-555",
                    "Trapecio Superior Forjado Reforzado 4x4 con Rótula 555 Japón",
                    "Brazo superior de suspensión independiente delantera para camionetas pick-up y SUVs todo terreno.",
                    "SUSPENSION", "KYB", "Japón", "195.00", "320.00", "282.00", 18, "PAS-C3-N4",
                    "/uploads/parts/asu-sus-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-SUS-013", "DAC4074W-KYB",
                    "Rodaje / Cubo Maza de Rueda Delantera con Sensor ABS Integrado KYB",
                    "Rodamiento doble hilera de bolas pre-engrasado y sellado de por vida con anillo magnético ABS.",
                    "SUSPENSION", "KYB", "Japón", "115.00", "190.00", "165.00", 26, "PAS-C3-N5",
                    "/uploads/parts/asu-sus-004.webp", true
            ),

            // ==================== 4. MOTOR Y DISTRIBUCIÓN ====================
            new SeedPartSpec(
                    "ASU-MOT-005", "38453-GATES",
                    "Tensor Automático de Faja de Accesorios con Polea Metálica Gates DriveAlign",
                    "Resorte torsional calibrado y rodamiento sellado de precisión para mantener tensión constante del alternador y A/C.",
                    "MOTOR", "Gates", "Estados Unidos", "110.00", "182.00", "158.00", 28, "PAS-D3-N1",
                    "/uploads/parts/asu-mot-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-006", "11213-21011",
                    "Juego de Empaquetadura de Tapa de Balancines y Sellos de Bujía Denso",
                    "Caucho acrílico-fluorosiliconado moldeado resistente a altas temperaturas para motores DOHC 16V.",
                    "MOTOR", "Denso", "Japón", "48.00", "85.00", "72.00", 34, "PAS-D3-N2",
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
                    "ASU-MOT-008", "KP15649XS-GATES",
                    "Kit de Distribución Completo + Bomba de Agua Motores TDI / Multipunto Gates",
                    "Incluye correa sincrónica HNBR reforzada, rodillos tensores y bomba de agua OEM para cambio integral.",
                    "MOTOR", "Gates", "Estados Unidos", "310.00", "495.00", "440.00", 16, "PAS-D3-N3",
                    "/uploads/parts/asu-mot-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-009", "12305-0D080",
                    "Soporte Hidráulico Derecho de Motor Antivibración Denso OEM",
                    "Cámara hidráulica interna que absorbe vibraciones del motor hacia el chasis en ralentí y aceleración.",
                    "MOTOR", "Denso", "Japón", "130.00", "218.00", "190.00", 22, "PAS-D3-N4",
                    "/uploads/parts/asu-mot-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-MOT-010", "17201-0L040",
                    "Conjunto Central Turbocompresor (CHRA) Balanceado Turbo Diésel Bosch",
                    "Núcleo rotativo de turbina de geometría variable balanceado a 150,000 RPM para pickups y camiones diésel.",
                    "MOTOR", "Bosch", "Alemania", "640.00", "1050.00", "930.00", 10, "PAS-D3-N5",
                    "/uploads/parts/asu-mot-002.webp", true
            ),

            // ==================== 5. EMBRAGUE Y TRANSMISIÓN ====================
            new SeedPartSpec(
                    "ASU-TRA-006", "31250-E0620-HD",
                    "Kit de Embrague Cerámico Heavy-Duty 380mm/430mm Flota Pesada Valeo",
                    "Conjunto prensa, disco cerametálico y collarín reforzado para camiones de carga pesada y tractos.",
                    "TRANSMISION", "Valeo", "Francia", "920.00", "1490.00", "1340.00", 12, "PAS-E2-N2",
                    "/uploads/parts/asu-tra-005.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-007", "GUT-23-AISIN",
                    "Cruceta de Árbol Cardán Acero Forjado Japón con Grasera Aisin",
                    "Dados templados con rodillos de agujas sellados para ejes propulsores de pickups 4x4, vans y camiones.",
                    "TRANSMISION", "Aisin", "Japón", "48.00", "84.00", "70.00", 36, "PAS-E3-N1",
                    "/uploads/parts/asu-tra-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-008", "CRT-086-AISIN",
                    "Cilindro Esclavo / Bombín Receptor de Embrague Hidráulico Aisin",
                    "Cuerpo en fundición anodizada con pistón de precisión y guardapolvo EPDM para cajas manuales.",
                    "TRANSMISION", "Aisin", "Japón", "68.00", "118.00", "99.00", 28, "PAS-E3-N2",
                    "/uploads/parts/asu-tra-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-009", "CMT-138-AISIN",
                    "Bomba / Cilindro Maestro Principal de Embrague Hidráulico Aisin",
                    "Bomba superior de pedal de embrague original japonesa para accionamiento suave sin fugas.",
                    "TRANSMISION", "Aisin", "Japón", "98.00", "165.00", "142.00", 24, "PAS-E3-N3",
                    "/uploads/parts/asu-tra-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-TRA-010", "836042-VALEO",
                    "Volante de Inercia Bimasa / Conversión Acero Forjado Turbo Diésel Valeo",
                    "Absorción torsional superior para cajas manuales de 6 velocidades en pickups y utilitarios modernos.",
                    "TRANSMISION", "Valeo", "Francia", "780.00", "1260.00", "1120.00", 10, "PAS-E3-N4",
                    "/uploads/parts/asu-tra-004.webp", true
            ),

            // ==================== 6. SISTEMA ELÉCTRICO E ILUMINACIÓN ====================
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
                    "ASU-ELE-008", "27060-0L190",
                    "Alternador Trifásico 12V 110A con Regulador Integrado y Polea OAP Denso",
                    "Puente rectificador con diodos avalancha de alta eficiencia para pickups, vans, sedanes y SUVs.",
                    "ELECTRICO", "Denso", "Japón", "420.00", "680.00", "598.00", 16, "PAS-F4-N1",
                    "/uploads/parts/asu-ele-006.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-009", "0001108405",
                    "Motor de Arranque / Arrancador Planetario 12V 1.4kW Bosch",
                    "Solenoide reforzado y reducción planetaria de bajo consumo para arranque instantáneo en sedanes y SUVs.",
                    "ELECTRICO", "Bosch", "Alemania", "290.00", "475.00", "420.00", 18, "PAS-F4-N2",
                    "/uploads/parts/asu-ele-007.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-010", "DG-601-DENSO",
                    "Pack x4 Bujías de Precalentamiento / Incandescencia Diésel Denso",
                    "Calentamiento ultrarrápido en 3 segundos para arranque en frío sin humo blanco en motores turbo diésel.",
                    "ELECTRICO", "Denso", "Japón", "120.00", "198.00", "172.00", 30, "PAS-F4-N3",
                    "/uploads/parts/asu-ele-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-011", "0258010032",
                    "Sensor de Oxígeno / Sonda Lambda Planar 4 Cables Pre-Catalizador Bosch",
                    "Elemento cerámico de circonio con calefactor integrado para mezcla aire-combustible óptima y ahorro.",
                    "ELECTRICO", "Bosch", "Alemania", "145.00", "238.00", "208.00", 24, "PAS-F4-N4",
                    "/uploads/parts/asu-ele-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-ELE-012", "22204-22010",
                    "Sensor de Flujo de Masa de Aire (MAF / Caudalímetro) Original Denso",
                    "Elemento sensor de hilo de platino de respuesta instantánea para inyección electrónica japonesa.",
                    "ELECTRICO", "Denso", "Japón", "135.00", "225.00", "195.00", 22, "PAS-F4-N5",
                    "/uploads/parts/asu-ele-004.webp", true
            ),

            // ==================== 7. REFRIGERACIÓN Y CLIMATIZACIÓN ====================
            new SeedPartSpec(
                    "ASU-REF-005", "16400-E0480-HD",
                    "Radiador / Enfriador Heavy-Duty Flota Diésel + Viscoso Térmico Denso",
                    "Núcleo de aluminio brasado sobredimensionado para camiones de carga pesada y rutas de altura.",
                    "REFRIGERACION", "Denso", "Japón", "540.00", "890.00", "795.00", 12, "PAS-G2-N2",
                    "/uploads/parts/asu-ref-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-REF-006", "WVT-015-AISIN",
                    "Termostato de Motor 82°C en Acero Inoxidable con Junta Aisin Japón",
                    "Apertura térmica calibrada de fábrica con válvula jiggle de purga para proteger culata y empaque.",
                    "REFRIGERACION", "Aisin", "Japón", "38.00", "65.00", "55.00", 38, "PAS-G3-N1",
                    "/uploads/parts/asu-ref-002.webp", true
            ),
            new SeedPartSpec(
                    "ASU-REF-007", "16400-0D400",
                    "Radiador de Aluminio Brasado Alta Disipación Sedán y SUV Denso",
                    "Panal de micro-tubos de aluminio con tanques en poliamida PA66 reforzada con fibra de vidrio.",
                    "REFRIGERACION", "Denso", "Japón", "245.00", "398.00", "350.00", 18, "PAS-G3-N2",
                    "/uploads/parts/asu-ref-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-REF-008", "16400-0L160",
                    "Radiador Sobredimensionado Doble Fila Turbo Diésel Pickups y Vans Denso",
                    "Capacidad térmica incrementada en 30% para trabajo pesado, remolque y rutas de sierra.",
                    "REFRIGERACION", "Denso", "Japón", "340.00", "550.00", "485.00", 15, "PAS-G3-N3",
                    "/uploads/parts/asu-ref-001.webp", true
            ),

            // ==================== 8. CARROCERÍA Y FAROS EXTERIORES ====================
            new SeedPartSpec(
                    "ASU-CAR-007", "87910-E0190-HD",
                    "Espejo Panorámico Doble Ángulo + Faro Neblinero Ruta Pesada Depo",
                    "Conjunto exterior reforzado anti-vibración para cabinas de camiones Hino, Isuzu, Volvo y Scania.",
                    "CARROCERIA", "Depo", "Taiwán", "165.00", "275.00", "240.00", 16, "PAS-H2-N2",
                    "/uploads/parts/asu-car-004.webp", true
            ),
            new SeedPartSpec(
                    "ASU-CAR-008", "81210-0D042",
                    "Kit de Faros Neblineros Delanteros Halógeno/LED con Bisel y Cableado Depo",
                    "Lente en policarbonato sellado IP67 para máxima visibilidad en neblina y lluvia intensa.",
                    "CARROCERIA", "Depo", "Taiwán", "115.00", "192.00", "168.00", 26, "PAS-H3-N1",
                    "/uploads/parts/asu-car-001.webp", true
            ),
            new SeedPartSpec(
                    "ASU-CAR-009", "87910-02916",
                    "Espejo Retrovisor Lateral Completo Abatible con Luna Convexa Depo",
                    "Carcasa en polímero ABS lista para pintar con regulación precisa sin vibración en carretera.",
                    "CARROCERIA", "Depo", "Taiwán", "110.00", "185.00", "160.00", 22, "PAS-H3-N2",
                    "/uploads/parts/asu-car-003.webp", true
            ),
            new SeedPartSpec(
                    "ASU-CAR-010", "68950-0W510",
                    "Par de Amortiguadores a Gas de Compuerta / Maletera Posterior KYB",
                    "Resortes neumáticos presurizados de apertura suave y sujeción firme para SUVs, vans y hatchbacks.",
                    "CARROCERIA", "KYB", "Japón", "65.00", "112.00", "95.00", 28, "PAS-H3-N3",
                    "/uploads/parts/asu-car-002.webp", true
            ),

            // ==================== BASE PARTS PARA ENTORNOS LOCALES LIMPIOS ====================
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

            // Paso 1: Asegurar las 11 marcas, 35 modelos reales y completar el catálogo hasta 100 repuestos reales OEM
            tx.executeWithoutResult(status -> {
                ensureStandardMakesAndModels();
                healLegacyDescriptions();
                Map<String, Category> categoriesByCode = loadCategoriesByCode();
                upsertSeedParts(categoriesByCode);
                replenishDepletedStock();
            });

            // Paso 2: Reconstruir con la matriz directa específica repuesto por repuesto
            Integer specificCount = jdbcTemplate.queryForObject(
                    "SELECT COUNT(*) FROM part_vehicle_compatibilities WHERE notes LIKE '%OEM Certificado%'",
                    Integer.class
            );
            if (specificCount == null || specificCount < 300) {
                tx.executeWithoutResult(status -> {
                    int deleted = jdbcTemplate.update("DELETE FROM part_vehicle_compatibilities");
                    log.info("Reconstruyendo compatibilidades específicas repuesto por repuesto ({} filas previas eliminadas).", deleted);
                });
            }

            // Paso 3: Asignar compatibilidades específicas auténticas directas
            tx.executeWithoutResult(status -> buildSpecificDirectFitments());

            catalogService.evictCatalogCache();
            log.info("Catálogo automotriz real sincronizado con éxito ({} repuestos activos <= {}).",
                    partRepository.count(), MAX_CATALOG_PARTS);
        } catch (Exception e) {
            log.warn("Verificación de catálogo automotriz finalizó con aviso: {}", e.getMessage());
        }
    }

    private void ensureStandardMakesAndModels() {
        for (ModelTimeline tl : REAL_MODEL_TIMELINES) {
            VehicleMake make = ensureMake(tl.makeName());
            ensureModel(make, tl.modelName(), tl.vehicleType());
        }
    }

    private void healLegacyDescriptions() {
        for (Part p : partRepository.findAll()) {
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

                // Si era uno de los SKUs con etiqueta "CLAS80"/"Serie Clásica" o descripción 1980, actualizarlo a repuesto OEM real
                String curOem = existing.getOemCode() != null ? existing.getOemCode().toUpperCase() : "";
                String curName = existing.getName() != null ? existing.getName().toLowerCase() : "";
                String curDesc = existing.getTechnicalDescription() != null ? existing.getTechnicalDescription().toLowerCase() : "";
                if (spec.prioritySupplement() && (curOem.contains("CLAS") || curName.contains("clásica")
                        || curName.contains("clasica") || curDesc.contains("1980"))) {
                    ManufacturerBrand brand = brandRepository.findByNameIgnoreCase(spec.brandName())
                            .orElseGet(() -> brandRepository.save(new ManufacturerBrand(spec.brandName(), spec.brandOrigin())));
                    existing.setOemCode(spec.oemCode());
                    existing.setName(spec.name());
                    existing.setTechnicalDescription(spec.description());
                    existing.setCategory(cat);
                    existing.setManufacturerBrand(brand);
                    existing.setPurchasePrice(new BigDecimal(spec.purchasePrice()).setScale(2, RoundingMode.HALF_UP));
                    existing.setSalePrice(new BigDecimal(spec.salePrice()).setScale(2, RoundingMode.HALF_UP));
                    existing.setWholesalePrice(new BigDecimal(spec.wholesalePrice()).setScale(2, RoundingMode.HALF_UP));
                    if (!existing.getImages().isEmpty()) {
                        existing.getImages().get(0).setImageUrl(spec.imagePath());
                    }
                    changed = true;
                }

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


    private record SpecificFitment(
            String sku,
            String makeName,
            String modelName,
            int yearStart,
            int yearEnd,
            String engineSpec,
            String notes
    ) {
    }

    private static final List<SpecificFitment> FITMENTS_FRENOS = List.of(
            // ASU-FRE-001: Pastillas Brembo NAO Delanteras
            new SpecificFitment("ASU-FRE-001", "Toyota", "Hilux", 2016, 2024, "2.8L 1GD-FTV / 2.4L 2GD-FTV 4x4", "Delantero pastillas cerámicas NAO Revo"),
            new SpecificFitment("ASU-FRE-001", "Toyota", "Fortuner", 2016, 2024, "2.8L 1GD-FTV 4x4", "Eje delantero ventilado SUV"),
            new SpecificFitment("ASU-FRE-001", "Toyota", "Hiace", 2019, 2024, "2.8L 1GD-FTV Commuter", "Delantero servicio pesado H300"),

            // ASU-FRE-002: Disco 297mm/319mm Brembo UV Coated
            new SpecificFitment("ASU-FRE-002", "Toyota", "Hilux", 2016, 2024, "2.8L 1GD-FTV / 2.4L 2GD-FTV", "Disco ventilado 297mm 6 huecos"),
            new SpecificFitment("ASU-FRE-002", "Toyota", "Fortuner", 2016, 2024, "2.8L 1GD-FTV", "Disco delantero ventilado 297mm"),

            // ASU-FRE-003: Pastillas Bosch QuietCast
            new SpecificFitment("ASU-FRE-003", "Toyota", "Yaris", 2014, 2024, "1.3L 1NR / 1.5L 2NR Dual VVT-i", "Pastillas QuietCast delanteras sedán y hatchback"),
            new SpecificFitment("ASU-FRE-003", "Toyota", "Probox", 2014, 2024, "1.5L 1NZ-FE NCP160", "Pastillas delanteras servicio comercial"),

            // ASU-FRE-004: Pastillas TRW Pro Cerámicas SUV
            new SpecificFitment("ASU-FRE-004", "Hyundai", "Tucson", 2016, 2024, "2.0L Nu MPi / 1.6L T-GDi", "Pastillas TRW Pro cerámicas SUV"),
            new SpecificFitment("ASU-FRE-004", "Kia", "Sportage", 2016, 2024, "2.0L Nu MPi / 2.0L CRDi", "Pastillas delanteras SUV QL/NQ5"),

            // ASU-FRE-005: Discos Ventilados 255mm Fremax
            new SpecificFitment("ASU-FRE-005", "Toyota", "Yaris", 2006, 2018, "1.3L 2NZ / 1.5L 1NZ-FE", "Par de discos ventilados 255mm Fremax"),
            new SpecificFitment("ASU-FRE-005", "Toyota", "Probox", 2002, 2018, "1.5L 1NZ-FE NCP51", "Discos delanteros 255mm"),

            // ASU-FRE-006: Zapatas de Freno Posteriores Bendix
            new SpecificFitment("ASU-FRE-006", "Toyota", "Hilux", 2005, 2015, "2.5L 2KD-FTV / 3.0L 1KD-FTV", "Zapatas de freno posterior para tambor Vigo"),
            new SpecificFitment("ASU-FRE-006", "Toyota", "Hiace", 2005, 2018, "2.5L 2KD-FTV Commuter", "Zapatas posteriores para tambor"),

            // ASU-FRE-007: Bombín Rueda Posterior Bosch
            new SpecificFitment("ASU-FRE-007", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Bombín hidráulico posterior Bosch"),
            new SpecificFitment("ASU-FRE-007", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L / 3.0L", "Cilindro de rueda posterior Bosch"),

            // ASU-FRE-008: Tambores Brembo Balanceados
            new SpecificFitment("ASU-FRE-008", "Toyota", "Hilux", 2016, 2024, "2.4L 2GD / 2.8L 1GD 4x4", "Par de tambores Brembo balanceados Revo"),
            new SpecificFitment("ASU-FRE-008", "Mitsubishi", "L200", 2016, 2024, "2.4L 4N15 MIVEC Triton", "Tambores posteriores balanceados"),

            // ASU-FRE-009: Cilindro Maestro Heavy-Duty Brembo
            new SpecificFitment("ASU-FRE-009", "Hino", "Dutro 300", 2012, 2024, "4.0L N04C Common-Rail", "Cilindro maestro doble circuito Heavy-Duty"),
            new SpecificFitment("ASU-FRE-009", "Isuzu", "NPR Reward", 2012, 2024, "5.2L 4HK1-TCN Euro IV/V", "Bomba principal de freno camión"),
            new SpecificFitment("ASU-FRE-009", "Mitsubishi", "Canter", 2012, 2024, "3.0L 4P10 / 4.9L 4M50", "Cilindro maestro de freno Brembo"),

            // ASU-FRE-010: Bloques Zapatas Neumáticas Flota Pesada Bosch
            new SpecificFitment("ASU-FRE-010", "Hino", "500 Series", 2012, 2026, "7.7L J08E Euro V", "Bloques y zapatas freno neumático 24V"),
            new SpecificFitment("ASU-FRE-010", "Isuzu", "Forward FTR", 2012, 2026, "7.8L 6HK1-TCS Euro V", "Frenos de aire tipo leva S-cam Bosch"),
            new SpecificFitment("ASU-FRE-010", "Scania", "P410", 2012, 2026, "12.7L DC13 XPI", "Bloques de fricción neumática eje tracción"),

            // ASU-FRE-011: Líquido Frenos DOT 4 Bosch 1L
            new SpecificFitment("ASU-FRE-011", "Toyota", "Hilux", 2016, 2024, "2.8L 1GD-FTV", "Líquido 100% sintético DOT 4 ABS/VSC"),
            new SpecificFitment("ASU-FRE-011", "Toyota", "Corolla", 2014, 2024, "1.8L 2ZR-FE / 2.0L", "Circuito hidráulico DOT 4 Bosch"),
            new SpecificFitment("ASU-FRE-011", "Toyota", "Yaris", 2014, 2024, "1.5L 2NR-FE", "Fluido de freno sintético DOT 4"),
            new SpecificFitment("ASU-FRE-011", "Hyundai", "Accent", 2012, 2024, "1.4L G4LC / 1.6L", "Líquido de freno DOT 4 Bosch"),
            new SpecificFitment("ASU-FRE-011", "Kia", "Rio", 2012, 2024, "1.4L Kappa", "Líquido de frenos y embrague"),
            new SpecificFitment("ASU-FRE-011", "Nissan", "Frontier", 2015, 2024, "2.5L YD25DDTi", "Circuito hidráulico DOT 4"),
            new SpecificFitment("ASU-FRE-011", "Volkswagen", "Amarok", 2010, 2024, "2.0L BiTDI", "Líquido de frenos alta temperatura"),
            new SpecificFitment("ASU-FRE-011", "Chevrolet", "Onix", 2013, 2024, "1.0T / 1.4L Joy", "Circuito de freno DOT 4 Bosch"),

            // ASU-FRE-012: Discos Ventilados 280mm Bosch
            new SpecificFitment("ASU-FRE-012", "Hyundai", "Accent", 2012, 2022, "1.4L G4LC / 1.6L Gamma", "Par de discos ventilados 280mm Bosch"),
            new SpecificFitment("ASU-FRE-012", "Kia", "Rio", 2012, 2022, "1.4L Kappa / 1.6L Gamma", "Discos delanteros ventilados 280mm"),
            new SpecificFitment("ASU-FRE-012", "Hyundai", "Elantra", 2012, 2020, "1.6L / 2.0L Nu", "Discos ventilados delanteros"),
            new SpecificFitment("ASU-FRE-012", "Kia", "Cerato", 2013, 2020, "1.6L / 2.0L Nu", "Discos de freno delanteros 280mm"),

            // ASU-FRE-013: Discos Ventilados 300mm Brembo
            new SpecificFitment("ASU-FRE-013", "Toyota", "Corolla", 2014, 2024, "1.8L 2ZR-FE / 2.0L M20A", "Discos ventilados 300mm Brembo alto carbono"),
            new SpecificFitment("ASU-FRE-013", "Toyota", "RAV4", 2013, 2024, "2.0L 3ZR / 2.5L A25A", "Discos delanteros 300mm UV Coated"),

            // ASU-FRE-014: Pulmón Freno Neumático 30/30 Bosch HD
            new SpecificFitment("ASU-FRE-014", "Scania", "P410", 2012, 2026, "12.7L DC13 Euro V", "Cámara neumática freno 30/30 doble diafragma"),
            new SpecificFitment("ASU-FRE-014", "Scania", "R-Series Heavy", 2012, 2026, "12.7L / 15.6L DC16", "Pulmón actuador de aire 30/30 Bosch"),
            new SpecificFitment("ASU-FRE-014", "Volvo", "FH 460 / 500", 2012, 2026, "12.8L D13C / D13K", "Cámara neumática de estacionamiento y servicio")
    );

    private static final List<SpecificFitment> FITMENTS_FILTROS = List.of(
            // ASU-FIL-001: Filtro Aceite Denso First Time Fit
            new SpecificFitment("ASU-FIL-001", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Filtro blindado alto flujo Denso"),
            new SpecificFitment("ASU-FIL-001", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L / 3.0L", "Filtro aceite Denso First Time Fit"),
            new SpecificFitment("ASU-FIL-001", "Toyota", "Fortuner", 2005, 2024, "2.7L 2TR / 3.0L 1KD / 2.8L 1GD", "Filtro de aceite blindado"),
            new SpecificFitment("ASU-FIL-001", "Toyota", "Probox", 2002, 2024, "1.3L 2NZ / 1.5L 1NZ-FE", "Filtro blindado rosca 3/4-16 UNF"),

            // ASU-FIL-002: Filtro Aire Motor Bosch
            new SpecificFitment("ASU-FIL-002", "Toyota", "Hilux", 2005, 2015, "2.5L 2KD / 3.0L 1KD D-4D", "Filtro de aire microfibra Bosch"),
            new SpecificFitment("ASU-FIL-002", "Nissan", "Frontier", 2008, 2018, "2.5L YD25DDTi", "Filtro de aire motor diésel Bosch"),
            new SpecificFitment("ASU-FIL-002", "Toyota", "Hiace", 2005, 2018, "2.5L 2KD Commuter", "Filtro de aire para furgón"),

            // ASU-FIL-003: Filtro Aceite Mann W 712/94
            new SpecificFitment("ASU-FIL-003", "Volkswagen", "Amarok", 2010, 2024, "2.0L TDI / BiTDI", "Filtro spin-on Mann W 712/94 con válvula alivio"),
            new SpecificFitment("ASU-FIL-003", "Volkswagen", "Gol", 2009, 2022, "1.6L EA111", "Filtro de aceite alemán Mann W 712/94"),
            new SpecificFitment("ASU-FIL-003", "Chevrolet", "Sail", 2010, 2022, "1.4L S-TEC III / 1.5L DVVT", "Filtro de aceite con válvula alivio"),
            new SpecificFitment("ASU-FIL-003", "Chevrolet", "Onix", 2013, 2024, "1.4L Joy / 1.0L Turbo", "Filtro de aceite spin-on Mann"),

            // ASU-FIL-004: Filtro Aceite Coreano Bosch P7028
            new SpecificFitment("ASU-FIL-004", "Hyundai", "Accent", 2012, 2024, "1.4L G4LC / 1.6L Gamma", "Filtro aceite original Bosch P7028"),
            new SpecificFitment("ASU-FIL-004", "Kia", "Rio", 2012, 2024, "1.4L Kappa / 1.6L Gamma", "Filtro aceite coreano Bosch P7028"),
            new SpecificFitment("ASU-FIL-004", "Hyundai", "Elantra", 2012, 2024, "1.6L / 2.0L Nu", "Filtro de aceite microporoso"),
            new SpecificFitment("ASU-FIL-004", "Kia", "Cerato", 2013, 2024, "1.6L / 2.0L Nu", "Filtro aceite Bosch P7028"),
            new SpecificFitment("ASU-FIL-004", "Hyundai", "Tucson", 2010, 2024, "2.0L Theta II / Nu", "Filtro de aceite spin-on"),
            new SpecificFitment("ASU-FIL-004", "Kia", "Sportage", 2011, 2024, "2.0L Nu MPi", "Filtro aceite motores coreanos"),

            // ASU-FIL-005: Filtro Aire Denso Plisado
            new SpecificFitment("ASU-FIL-005", "Toyota", "Yaris", 2014, 2024, "1.3L 1NR / 1.5L 2NR Dual VVT-i", "Filtro de aire plisado Denso Japón"),
            new SpecificFitment("ASU-FIL-005", "Toyota", "Probox", 2014, 2024, "1.5L 1NZ-FE NCP160", "Filtro de aire motor Denso"),

            // ASU-FIL-006: Filtro Aire Mann C 25 016
            new SpecificFitment("ASU-FIL-006", "Hyundai", "Accent", 2012, 2020, "1.4L / 1.6L Gamma", "Filtro de aire motor Mann C 25 016"),
            new SpecificFitment("ASU-FIL-006", "Kia", "Rio", 2012, 2020, "1.4L / 1.6L Gamma", "Filtro de aire plisado Mann"),
            new SpecificFitment("ASU-FIL-006", "Hyundai", "Elantra", 2012, 2020, "1.6L / 2.0L Nu", "Filtro de aire motor Mann"),

            // ASU-FIL-007: Filtro Combustible Diésel Denso
            new SpecificFitment("ASU-FIL-007", "Toyota", "Hilux", 2016, 2024, "2.4L 2GD / 2.8L 1GD", "Filtro combustible separador agua Denso"),
            new SpecificFitment("ASU-FIL-007", "Toyota", "Fortuner", 2016, 2024, "2.4L / 2.8L D-4D", "Cartucho primario Common-Rail"),
            new SpecificFitment("ASU-FIL-007", "Toyota", "Hiace", 2019, 2024, "2.8L 1GD Turbo Diésel", "Separador de agua combustible"),

            // ASU-FIL-008: Filtro Cabina Bosch Carbón Activado
            new SpecificFitment("ASU-FIL-008", "Toyota", "Hilux", 2005, 2024, "Todas las versiones", "Filtro cabina A/C carbón activado Bosch"),
            new SpecificFitment("ASU-FIL-008", "Toyota", "Fortuner", 2005, 2024, "Todas las versiones", "Filtro antipolen carbón activado"),
            new SpecificFitment("ASU-FIL-008", "Toyota", "Corolla", 2008, 2024, "1.8L / 2.0L", "Filtro de habitáculo bacteriostático"),
            new SpecificFitment("ASU-FIL-008", "Toyota", "Yaris", 2006, 2024, "1.3L / 1.5L", "Filtro A/C carbón activado"),
            new SpecificFitment("ASU-FIL-008", "Nissan", "Versa", 2012, 2024, "1.6L HR16DE", "Filtro de cabina carbón activado"),

            // ASU-FIL-009: Aceite Sintético Castrol EDGE 5W-30 (4L)
            new SpecificFitment("ASU-FIL-009", "Toyota", "Corolla", 2014, 2024, "1.8L 2ZR / 2.0L Dynamic Force", "Aceite 100% sintético Castrol EDGE 5W-30 (4L)"),
            new SpecificFitment("ASU-FIL-009", "Toyota", "RAV4", 2013, 2024, "2.0L 3ZR / 2.5L A25A", "Castrol EDGE 5W-30 Titanium FST"),
            new SpecificFitment("ASU-FIL-009", "Hyundai", "Tucson", 2016, 2024, "2.0L Nu MPi", "Aceite sintético 5W-30 API SP"),
            new SpecificFitment("ASU-FIL-009", "Kia", "Sportage", 2016, 2024, "2.0L Nu MPi", "Aceite sintético 5W-30 API SP"),
            new SpecificFitment("ASU-FIL-009", "Nissan", "Sentra", 2013, 2024, "1.8L MRA8DE / 2.0L", "Castrol EDGE 5W-30 Titanium"),
            new SpecificFitment("ASU-FIL-009", "Nissan", "Versa", 2012, 2024, "1.6L HR16DE", "Aceite sintético 5W-30"),

            // ASU-FIL-010: Aceite Castrol GTX 20W-50 (1G)
            new SpecificFitment("ASU-FIL-010", "Toyota", "Hilux", 1998, 2010, "2.5L 2KD / 2.7L 3RZ", "Aceite Castrol GTX 20W-50 Anti-Borra (1G)"),
            new SpecificFitment("ASU-FIL-010", "Nissan", "Frontier", 1998, 2010, "2.4L KA24DE / 2.5L TD27", "Aceite Castrol GTX 20W-50"),
            new SpecificFitment("ASU-FIL-010", "Hyundai", "H-100", 1998, 2010, "2.5L D4BB / D4BH Porter", "Aceite alta viscosidad 20W-50"),
            new SpecificFitment("ASU-FIL-010", "Kia", "K2700", 1998, 2010, "2.7L J2 Diésel Bongo", "Castrol GTX 20W-50 alto sellado"),

            // ASU-FIL-011: Castrol Syntrans 75W-90 (1L)
            new SpecificFitment("ASU-FIL-011", "Toyota", "Hilux", 2005, 2024, "2.5L / 2.8L / 3.0L 4x4", "Lubricante sintético caja/transfer Castrol 75W-90"),
            new SpecificFitment("ASU-FIL-011", "Mitsubishi", "L200", 2008, 2024, "2.5L / 2.4L 4x4", "Castrol Syntrans 75W-90 GL-4/GL-5"),
            new SpecificFitment("ASU-FIL-011", "Nissan", "Frontier", 2008, 2024, "2.5L YD25 6MT", "Sintético de caja manual 75W-90"),

            // ASU-FIL-012: Mobilube HD 80W-90 Corona (1G)
            new SpecificFitment("ASU-FIL-012", "Toyota", "Hilux", 2005, 2024, "Eje posterior LSD/Bloqueo", "Aceite Mobilube HD 80W-90 GL-5 (1G)"),
            new SpecificFitment("ASU-FIL-012", "Nissan", "Frontier", 2005, 2024, "Diferencial eje rígido", "Aceite extrema presión 80W-90"),
            new SpecificFitment("ASU-FIL-012", "Mitsubishi", "L200", 2005, 2024, "Corona trasera hipoidal", "Mobilube HD 80W-90 corona"),
            new SpecificFitment("ASU-FIL-012", "Hyundai", "H-100", 2005, 2024, "Diferencial de carga", "Aceite de corona 80W-90"),
            new SpecificFitment("ASU-FIL-012", "Kia", "K2700", 2005, 2024, "Diferencial eje posterior", "Aceite de corona 80W-90"),

            // ASU-FIL-013: Separador Petróleo Mann Heavy-Duty
            new SpecificFitment("ASU-FIL-013", "Hino", "500 Series", 2005, 2024, "7.7L J08E Euro IV/V", "Separador de agua y petróleo Heavy-Duty Mann"),
            new SpecificFitment("ASU-FIL-013", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1 Euro IV/V", "Filtro separador petróleo flota pesada"),
            new SpecificFitment("ASU-FIL-013", "Scania", "P410", 2008, 2024, "12.7L DC13 XPI", "Cartucho separador diésel pesado Mann"),
            new SpecificFitment("ASU-FIL-013", "Volvo", "FH 460 / 500", 2008, 2024, "12.8L D13C/D13K", "Filtro coalescente combustible pesado"),

            // ASU-FIL-014: Filtro Aceite Spin-On Mann W 920/21
            new SpecificFitment("ASU-FIL-014", "Hino", "Dutro 300", 2008, 2024, "4.0L N04C Common-Rail", "Filtro de aceite spin-on Mann W 920/21"),
            new SpecificFitment("ASU-FIL-014", "Isuzu", "NPR Reward", 2008, 2024, "5.2L 4HK1-TCN", "Filtro aceite camión mediano Mann"),
            new SpecificFitment("ASU-FIL-014", "Mitsubishi", "Canter", 2008, 2024, "3.9L 4D34 / 4.9L 4M50", "Filtro de aceite servicio severo W 920/21"),

            // ASU-FIL-015: Elemento Separador Racor R90P Bosch
            new SpecificFitment("ASU-FIL-015", "Scania", "P410", 2005, 2024, "12.7L DC13 410HP", "Elemento separador Racor 30 micras Bosch R90P"),
            new SpecificFitment("ASU-FIL-015", "Scania", "R-Series Heavy", 2005, 2024, "12.7L / 15.6L DC16", "Filtro Racor 30 micras diésel pesado"),
            new SpecificFitment("ASU-FIL-015", "Volvo", "FH 460 / 500", 2005, 2024, "12.8L D13A/D13C", "Cartucho decantador Racor R90P"),

            // ASU-FIL-016: Mobil 1 0W-20 AFE (4L)
            new SpecificFitment("ASU-FIL-016", "Toyota", "Yaris", 2017, 2024, "1.5L 2NR-FE Dual VVT-i", "Aceite Mobil 1 0W-20 AFE 100% sintético (4L)"),
            new SpecificFitment("ASU-FIL-016", "Toyota", "Corolla", 2019, 2024, "2.0L M20A Dynamic Force", "Mobil 1 0W-20 AFE economía combustible"),
            new SpecificFitment("ASU-FIL-016", "Chevrolet", "Onix", 2020, 2026, "1.0L Turbo / 1.2L CSS Prime", "Mobil 1 0W-20 dexos1 Gen3"),
            new SpecificFitment("ASU-FIL-016", "Nissan", "Versa", 2020, 2026, "1.6L HR16DE N18", "Aceite sintético 0W-20 API SP"),

            // ASU-FIL-017: Castrol Magnatec 5W-40 C3 (4L)
            new SpecificFitment("ASU-FIL-017", "Volkswagen", "Amarok", 2010, 2024, "2.0L BiTDI Euro V DPF", "Castrol Magnatec 5W-40 C3 Turbo Protección (4L)"),
            new SpecificFitment("ASU-FIL-017", "Toyota", "Hilux", 2016, 2024, "2.8L 1GD-FTV Euro V", "Aceite sintético 5W-40 ACEA C3"),
            new SpecificFitment("ASU-FIL-017", "Hyundai", "Tucson", 2016, 2024, "2.0L CRDi Turbo Diésel", "Castrol Magnatec 5W-40 C3"),
            new SpecificFitment("ASU-FIL-017", "Kia", "Sportage", 2016, 2024, "2.0L CRDi Turbo Diésel", "Aceite diésel ligero 5W-40 C3"),

            // ASU-FIL-018: Mobil Super 2000 10W-30 (4L)
            new SpecificFitment("ASU-FIL-018", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE VVT-i", "Aceite Mobil Super 2000 10W-30 semisintético (4L)"),
            new SpecificFitment("ASU-FIL-018", "Toyota", "Yaris", 2006, 2016, "1.3L 2NZ / 1.5L 1NZ", "Mobil Super 2000 10W-30 API SP"),
            new SpecificFitment("ASU-FIL-018", "Nissan", "Tiida", 2006, 2018, "1.6L HR16DE", "Aceite semisintético 10W-30"),
            new SpecificFitment("ASU-FIL-018", "Chevrolet", "Sail", 2010, 2018, "1.4L S-TEC III", "Mobil Super 10W-30 multigrado"),

            // ASU-FIL-019: Castrol Magnatec 10W-40 (4L)
            new SpecificFitment("ASU-FIL-019", "Nissan", "Frontier", 2005, 2018, "2.5L YD25DDTi D22/NP300", "Castrol Magnatec 10W-40 semisintético (4L)"),
            new SpecificFitment("ASU-FIL-019", "Mitsubishi", "L200", 2006, 2016, "2.5L 4D56 Turbo Diésel", "Castrol Magnatec 10W-40"),
            new SpecificFitment("ASU-FIL-019", "Chevrolet", "Sail", 2010, 2020, "1.4L / 1.5L", "Aceite Castrol Magnatec 10W-40"),
            new SpecificFitment("ASU-FIL-019", "Volkswagen", "Gol", 2008, 2020, "1.6L EA111 G5/G6", "Aceite semisintético 10W-40"),

            // ASU-FIL-020: Mobil Delvac MX 15W-40 (1G)
            new SpecificFitment("ASU-FIL-020", "Hino", "500 Series", 2000, 2024, "7.7L J08C / J08E", "Aceite diésel Mobil Delvac MX 15W-40 CK-4 (1G)"),
            new SpecificFitment("ASU-FIL-020", "Hino", "Dutro 300", 2000, 2024, "4.0L N04C Turbo Diésel", "Mobil Delvac MX 15W-40"),
            new SpecificFitment("ASU-FIL-020", "Isuzu", "Forward FTR", 2000, 2024, "7.8L 6HK1-TC 24V", "Aceite diésel pesado 15W-40"),
            new SpecificFitment("ASU-FIL-020", "Isuzu", "NPR Reward", 2000, 2024, "5.2L 4HK1-TCN", "Mobil Delvac 15W-40"),
            new SpecificFitment("ASU-FIL-020", "Toyota", "Hilux", 2000, 2018, "2.5L 2KD / 3.0L 1KD", "Aceite servicio pesado 15W-40"),

            // ASU-FIL-021: Filtro Aire Radial Mann C271250
            new SpecificFitment("ASU-FIL-021", "Hino", "500 Series", 2005, 2024, "7.7L J08E Ranger", "Filtro de aire cilíndrico radial Mann C271250"),
            new SpecificFitment("ASU-FIL-021", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1-TCS", "Filtro de aire admisión camión Mann"),
            new SpecificFitment("ASU-FIL-021", "Hino", "Dutro 300", 2008, 2024, "4.0L N04C Common-Rail", "Filtro de aire cilíndrico Mann"),

            // ASU-FIL-022: Filtro Cartucho Ecológico Mann HU 7008 z
            new SpecificFitment("ASU-FIL-022", "Volkswagen", "Amarok", 2010, 2024, "2.0L BiTDI 163HP/180HP", "Filtro cartucho ecológico Mann HU 7008 z"),
            new SpecificFitment("ASU-FIL-022", "Volkswagen", "Gol", 2014, 2022, "1.6L MSI 16V", "Filtro de aceite cartucho Mann"),

            // ASU-FIL-023: Filtro Combustible en Línea Bosch
            new SpecificFitment("ASU-FIL-023", "Chevrolet", "Sail", 2010, 2022, "1.4L / 1.5L DOHC", "Filtro de combustible en línea Bosch 5 micras"),
            new SpecificFitment("ASU-FIL-023", "Chevrolet", "Onix", 2013, 2020, "1.4L SPE/4 Joy", "Filtro nafta gasolina en línea Bosch"),
            new SpecificFitment("ASU-FIL-023", "Toyota", "Yaris", 2006, 2014, "1.3L / 1.5L", "Filtro combustible inyección multipunto"),
            new SpecificFitment("ASU-FIL-023", "Kia", "Picanto", 2006, 2020, "1.0L / 1.2L Kappa", "Filtro de gasolina en línea Bosch")
    );

    private static final List<SpecificFitment> FITMENTS_SUSPENSION = List.of(
            // ASU-SUS-001: Amortiguador Delantero KYB Gas-A-Just
            new SpecificFitment("ASU-SUS-001", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD 4x4", "Amortiguador delantero monotubo Gas-A-Just KYB"),
            new SpecificFitment("ASU-SUS-001", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L 4x4", "Amortiguador delantero monotubo nitrógeno"),
            new SpecificFitment("ASU-SUS-001", "Volkswagen", "Amarok", 2010, 2024, "2.0L BiTDI 4Motion", "Amortiguador delantero reforzado a gas"),

            // ASU-SUS-002: Amortiguador Delantero McPherson KYB Excel-G
            new SpecificFitment("ASU-SUS-002", "Toyota", "Yaris", 2014, 2024, "1.3L 1NR / 1.5L 2NR", "Amortiguador McPherson delantero Excel-G KYB"),
            new SpecificFitment("ASU-SUS-002", "Toyota", "Probox", 2014, 2024, "1.5L 1NZ-FE NCP160", "Amortiguador delantero bitubo a gas KYB"),

            // ASU-SUS-003: Amortiguador Delantero Monroe OESpectrum
            new SpecificFitment("ASU-SUS-003", "Hyundai", "Accent", 2012, 2022, "1.4L G4LC / 1.6L", "Amortiguador delantero a gas Monroe OESpectrum"),
            new SpecificFitment("ASU-SUS-003", "Kia", "Rio", 2012, 2022, "1.4L / 1.6L Gamma", "Amortiguador delantero presurizado Monroe"),

            // ASU-SUS-004: Amortiguador Delantero KYB Excel-G SUV
            new SpecificFitment("ASU-SUS-004", "Nissan", "Frontier", 2008, 2024, "2.5L YD25DDTi D22/NP300", "Amortiguador delantero a gas KYB Excel-G"),
            new SpecificFitment("ASU-SUS-004", "Hyundai", "Tucson", 2010, 2020, "2.0L Nu / CRDi", "Amortiguador delantero SUV KYB"),
            new SpecificFitment("ASU-SUS-004", "Kia", "Sportage", 2011, 2020, "2.0L Nu / CRDi", "Amortiguador delantero SUV KYB"),

            // ASU-SUS-005: Terminales Dirección Externos 555 Japón
            new SpecificFitment("ASU-SUS-005", "Toyota", "Hilux", 2005, 2024, "2.5L / 2.8L / 3.0L 4x4", "Terminales de dirección externos 555 Japón"),
            new SpecificFitment("ASU-SUS-005", "Mitsubishi", "L200", 2008, 2024, "2.5L / 2.4L Triton", "Terminales de dirección acero forjado 555"),

            // ASU-SUS-006: Rótulas de Suspensión Inferiores 555 Japón
            new SpecificFitment("ASU-SUS-006", "Toyota", "Hilux", 2005, 2024, "2.5L / 2.8L / 3.0L 4x4", "Par de rótulas de suspensión inferiores 555 Japón"),
            new SpecificFitment("ASU-SUS-006", "Mitsubishi", "L200", 2008, 2024, "2.5L / 2.4L Triton", "Rótulas inferiores reforzadas 555"),

            // ASU-SUS-007: Amortiguador Monroe Magnum Heavy-Duty
            new SpecificFitment("ASU-SUS-007", "Hino", "500 Series", 2005, 2024, "7.7L J08E", "Amortiguador cabina y eje Monroe Magnum HD"),
            new SpecificFitment("ASU-SUS-007", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1", "Amortiguador Heavy-Duty Monroe Magnum"),
            new SpecificFitment("ASU-SUS-007", "Scania", "P410", 2005, 2024, "12.7L DC13", "Amortiguador neumático eje y cabina"),
            new SpecificFitment("ASU-SUS-007", "Volvo", "FH 460 / 500", 2005, 2024, "12.8L D13", "Amortiguador de suspensión pesada Monroe"),

            // ASU-SUS-008: Terminal Dirección Forjado KYB Heavy-Duty
            new SpecificFitment("ASU-SUS-008", "Hino", "500 Series", 2005, 2024, "7.7L J08E", "Barra y terminal dirección forjado KYB"),
            new SpecificFitment("ASU-SUS-008", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1", "Terminal dirección eje delantero forjado"),
            new SpecificFitment("ASU-SUS-008", "Hino", "Dutro 300", 2008, 2024, "4.0L N04C", "Terminal de dirección camión mediano KYB"),
            new SpecificFitment("ASU-SUS-008", "Isuzu", "NPR Reward", 2008, 2024, "5.2L 4HK1", "Terminal cónico acero cromo-molibdeno"),

            // ASU-SUS-009: Amortiguadores Posteriores KYB Skorched4s
            new SpecificFitment("ASU-SUS-009", "Toyota", "Hilux", 2005, 2024, "Eje posterior ballestas 4x4", "Par amortiguadores carga KYB Skorched4s"),
            new SpecificFitment("ASU-SUS-009", "Nissan", "Frontier", 2008, 2024, "Ballestas eje trasero", "Amortiguadores hidroneumáticos carga pesada"),
            new SpecificFitment("ASU-SUS-009", "Mitsubishi", "L200", 2008, 2024, "Suspensión trasera ballestas", "KYB Skorched4s para trabajo severo"),

            // ASU-SUS-010: Bieletas Barra Estabilizadora 555 Japón
            new SpecificFitment("ASU-SUS-010", "Toyota", "Corolla", 2008, 2022, "1.8L / 2.0L", "Kit bieletas barra estabilizadora 555 Japón"),
            new SpecificFitment("ASU-SUS-010", "Toyota", "RAV4", 2008, 2022, "2.0L / 2.5L", "Bieletas delanteras selladas 555"),
            new SpecificFitment("ASU-SUS-010", "Toyota", "Yaris", 2008, 2022, "1.3L / 1.5L", "Bieletas barra estabilizadora delantera 555"),

            // ASU-SUS-011: Trapecio Delantero Inferior con Rótula 555
            new SpecificFitment("ASU-SUS-011", "Toyota", "Yaris", 2006, 2020, "1.3L 2NZ / 1.5L 1NZ", "Trapecio inferior derecho con rótula 555 Japón"),
            new SpecificFitment("ASU-SUS-011", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Brazo oscilante estampado acero alta resistencia 555"),

            // ASU-SUS-012: Trapecio Superior Forjado 4x4 555 Japón
            new SpecificFitment("ASU-SUS-012", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD 4x4", "Trapecio superior forjado con rótula 555 Japón"),
            new SpecificFitment("ASU-SUS-012", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L 4x4", "Brazo superior suspensión independiente 555"),

            // ASU-SUS-013: Rodaje Cubo Maza Delantera con ABS KYB
            new SpecificFitment("ASU-SUS-013", "Hyundai", "Accent", 2012, 2022, "1.4L / 1.6L", "Rodaje cubo maza delantera con sensor ABS KYB"),
            new SpecificFitment("ASU-SUS-013", "Kia", "Rio", 2012, 2022, "1.4L / 1.6L", "Maza de rueda delantera con anillo magnético ABS"),
            new SpecificFitment("ASU-SUS-013", "Chevrolet", "Sail", 2010, 2022, "1.4L / 1.5L", "Rodamiento doble hilera bolas pre-engrasado"),
            new SpecificFitment("ASU-SUS-013", "Chevrolet", "Onix", 2013, 2022, "1.4L Joy / 1.0T", "Cubo maza delantera con sensor ABS")
    );

    private static final List<SpecificFitment> FITMENTS_MOTOR = List.of(
            // ASU-MOT-001: Faja Distribución Gates PowerGrip
            new SpecificFitment("ASU-MOT-001", "Toyota", "Hilux", 2005, 2015, "2.5L 2KD / 3.0L 1KD D-4D", "Faja de distribución HNBR Gates PowerGrip"),
            new SpecificFitment("ASU-MOT-001", "Toyota", "Hiace", 2005, 2018, "2.5L 2KD-FTV Commuter", "Faja sincrónica de distribución"),
            new SpecificFitment("ASU-MOT-001", "Chevrolet", "Sail", 2010, 2020, "1.4L S-TEC III", "Faja distribución Gates"),
            new SpecificFitment("ASU-MOT-001", "Chevrolet", "Onix", 2013, 2019, "1.4L SPE/4 Multipunto", "Faja de distribución reforzada Gates"),

            // ASU-MOT-002: Kit Cadena Distribución Tsubaki Japón
            new SpecificFitment("ASU-MOT-002", "Toyota", "Yaris", 2006, 2020, "1.3L 2NZ / 1.5L 1NZ-FE", "Kit cadena distribución completo Tsubaki Japón"),
            new SpecificFitment("ASU-MOT-002", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE VVT-i", "Kit de cadena silenciosa con guías y tensor OEM"),
            new SpecificFitment("ASU-MOT-002", "Toyota", "Corolla", 2008, 2018, "1.6L / 1.8L 2ZR", "Cadena distribución silenciosa Tsubaki"),

            // ASU-MOT-003: Kit Cadena Distribución Gates Korea
            new SpecificFitment("ASU-MOT-003", "Hyundai", "Accent", 2012, 2020, "1.4L / 1.6L Gamma", "Kit cadena sincronización Gates Korea"),
            new SpecificFitment("ASU-MOT-003", "Kia", "Rio", 2012, 2020, "1.4L / 1.6L Gamma", "Kit de distribución por cadena Gates"),
            new SpecificFitment("ASU-MOT-003", "Hyundai", "Tucson", 2010, 2020, "2.0L Nu / Theta II", "Cadena de distribución DOHC 16V"),
            new SpecificFitment("ASU-MOT-003", "Kia", "Sportage", 2011, 2020, "2.0L Nu MPi", "Cadena de distribución Gates"),
            new SpecificFitment("ASU-MOT-003", "Hyundai", "H-100", 2012, 2022, "2.5L D4CB CRDi", "Cadena distribución motor diésel comercial"),

            // ASU-MOT-004: Faja Accesorios Gates 7PK1515
            new SpecificFitment("ASU-MOT-004", "Toyota", "Hilux", 2016, 2024, "2.4L 2GD / 2.8L 1GD", "Faja accesorios multivía Micro-V Gates 7PK1515"),
            new SpecificFitment("ASU-MOT-004", "Toyota", "Fortuner", 2016, 2024, "2.8L 1GD-FTV", "Correa acanalada EPDM resistente a temperatura"),
            new SpecificFitment("ASU-MOT-004", "Toyota", "Hiace", 2019, 2024, "2.8L 1GD H300", "Faja accesorios alternador y A/C Gates"),

            // ASU-MOT-005: Tensor Automático Gates DriveAlign
            new SpecificFitment("ASU-MOT-005", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Tensor automático faja accesorios Gates DriveAlign"),
            new SpecificFitment("ASU-MOT-005", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L", "Tensor con polea metálica Gates"),
            new SpecificFitment("ASU-MOT-005", "Nissan", "Frontier", 2008, 2024, "2.5L YD25DDTi", "Tensor automático faja accesorios Gates"),

            // ASU-MOT-006: Empaque Tapa Balancines Denso
            new SpecificFitment("ASU-MOT-006", "Toyota", "Yaris", 2006, 2022, "1.3L / 1.5L 1NZ/2NZ/2NR", "Juego empaque tapa balancines y sellos bujía Denso"),
            new SpecificFitment("ASU-MOT-006", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Empaque tapa balancines caucho fluorosiliconado"),
            new SpecificFitment("ASU-MOT-006", "Toyota", "Corolla", 2008, 2022, "1.8L 2ZR-FE", "Empaque balancines y sellos Denso OEM"),

            // ASU-MOT-007: Faja Heavy-Duty Gates FleetRunner
            new SpecificFitment("ASU-MOT-007", "Hino", "500 Series", 2005, 2024, "7.7L J08E", "Faja acanalada Heavy-Duty Gates FleetRunner K080991HD"),
            new SpecificFitment("ASU-MOT-007", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1", "Correa Poli-V servicio severo flota pesada"),
            new SpecificFitment("ASU-MOT-007", "Scania", "P410", 2008, 2024, "12.7L DC13", "Faja alternador y ventilador Gates Heavy-Duty"),
            new SpecificFitment("ASU-MOT-007", "Volvo", "FH 460 / 500", 2008, 2024, "12.8L D13", "Faja accesorios motor diésel pesado"),

            // ASU-MOT-008: Kit Distribución + Bomba Gates
            new SpecificFitment("ASU-MOT-008", "Volkswagen", "Amarok", 2010, 2022, "2.0L TDI / BiTDI", "Kit distribución completo + bomba de agua Gates"),
            new SpecificFitment("ASU-MOT-008", "Volkswagen", "Gol", 2009, 2022, "1.6L EA111", "Kit correa sincrónica + tensores + bomba Gates"),

            // ASU-MOT-009: Soporte Hidráulico Motor Denso
            new SpecificFitment("ASU-MOT-009", "Toyota", "Yaris", 2006, 2020, "1.3L / 1.5L", "Soporte hidráulico derecho motor antivibración Denso"),
            new SpecificFitment("ASU-MOT-009", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Soporte de motor con cámara hidráulica Denso OEM"),

            // ASU-MOT-010: Turbocompresor CHRA Bosch
            new SpecificFitment("ASU-MOT-010", "Toyota", "Hilux", 2005, 2015, "3.0L 1KD-FTV D-4D", "Conjunto central CHRA turbo balanceado Bosch"),
            new SpecificFitment("ASU-MOT-010", "Toyota", "Fortuner", 2005, 2015, "3.0L 1KD-FTV", "Núcleo de turbocompresor geometría variable Bosch")
    );

    private static final List<SpecificFitment> FITMENTS_TRANSMISION = List.of(
            // ASU-TRA-001: Kit Embrague Completo Exedy Japón
            new SpecificFitment("ASU-TRA-001", "Toyota", "Yaris", 2006, 2020, "1.3L / 1.5L 5MT", "Kit embrague completo plato, disco y collarín Exedy Japón"),
            new SpecificFitment("ASU-TRA-001", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE 5MT", "Kit de embrague balanceado Exedy"),

            // ASU-TRA-002: Kit Embrague Heavy Duty Aisin KT-345
            new SpecificFitment("ASU-TRA-002", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD 4x4 5MT/6MT", "Kit embrague Heavy-Duty reforzado Aisin KT-345"),
            new SpecificFitment("ASU-TRA-002", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L 4x4", "Kit embrague reforzado especificación minera Aisin"),

            // ASU-TRA-003: Kit Embrague Valeo Korea HD-85
            new SpecificFitment("ASU-TRA-003", "Hyundai", "Accent", 2012, 2022, "1.4L / 1.6L 6MT", "Kit embrague completo Valeo Korea HD-85"),
            new SpecificFitment("ASU-TRA-003", "Kia", "Rio", 2012, 2022, "1.4L / 1.6L 6MT", "Kit embrague Valeo con forro orgánico de fricción"),

            // ASU-TRA-004: Kit Embrague LuK RepSet Alemania
            new SpecificFitment("ASU-TRA-004", "Volkswagen", "Amarok", 2010, 2020, "2.0L BiTDI 6MT", "Kit embrague LuK RepSet Alemania"),
            new SpecificFitment("ASU-TRA-004", "Volkswagen", "Gol", 2009, 2022, "1.6L EA111 5MT", "Kit embrague LuK RepSet con collarín"),
            new SpecificFitment("ASU-TRA-004", "Chevrolet", "Sail", 2010, 2020, "1.4L / 1.5L 5MT", "Kit de embrague LuK RepSet"),
            new SpecificFitment("ASU-TRA-004", "Chevrolet", "Onix", 2013, 2020, "1.4L Joy 5MT", "Kit de embrague LuK RepSet"),

            // ASU-TRA-005: Junta Homocinética Lado Rueda HDK Japón
            new SpecificFitment("ASU-TRA-005", "Toyota", "Corolla", 2008, 2018, "1.6L / 1.8L 2ZR 6MT", "Junta homocinética lado rueda HDK Japón con fuelle"),
            new SpecificFitment("ASU-TRA-005", "Toyota", "Yaris", 2008, 2020, "1.5L 1NZ/2NR", "Homocinética exterior con grasa grafitada HDK"),

            // ASU-TRA-006: Kit Embrague Cerámico Flota Pesada Valeo
            new SpecificFitment("ASU-TRA-006", "Hino", "500 Series", 2005, 2024, "7.7L J08E 6MT/9MT", "Kit embrague cerámico 380mm/430mm Valeo"),
            new SpecificFitment("ASU-TRA-006", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1 6MT", "Kit embrague cerámico Heavy-Duty Valeo"),
            new SpecificFitment("ASU-TRA-006", "Scania", "P410", 2008, 2024, "12.7L DC13", "Embrague cerámico 430mm flota pesada Valeo"),
            new SpecificFitment("ASU-TRA-006", "Volvo", "FH 460 / 500", 2008, 2024, "12.8L D13", "Kit embrague doble disco cerametálico Valeo"),

            // ASU-TRA-007: Cruceta Árbol Cardán Aisin GUT-23
            new SpecificFitment("ASU-TRA-007", "Toyota", "Hilux", 2005, 2024, "Árbol cardán delantero/trasero 4x4", "Cruceta cardán acero forjado Aisin GUT-23 con grasera"),
            new SpecificFitment("ASU-TRA-007", "Toyota", "Hiace", 2005, 2024, "Eje cardán propulsor", "Cruceta con rodillos de agujas sellados Aisin"),
            new SpecificFitment("ASU-TRA-007", "Nissan", "Frontier", 2008, 2024, "Cardán 4x4", "Cruceta cardán reforzada Aisin Japón"),
            new SpecificFitment("ASU-TRA-007", "Mitsubishi", "L200", 2008, 2024, "Cardán 4x4", "Cruceta de transmisión forjada Aisin"),

            // ASU-TRA-008: Bombín Receptor Embrague Aisin
            new SpecificFitment("ASU-TRA-008", "Toyota", "Hilux", 2005, 2024, "2.5L / 2.8L / 3.0L", "Cilindro esclavo / bombín receptor embrague Aisin"),
            new SpecificFitment("ASU-TRA-008", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L", "Bombín receptor de embrague hidráulico Aisin CRT-086"),

            // ASU-TRA-009: Bomba Cilindro Maestro Embrague Aisin
            new SpecificFitment("ASU-TRA-009", "Toyota", "Hilux", 2005, 2024, "2.5L / 2.8L / 3.0L", "Bomba cilindro maestro principal embrague Aisin CMT-138"),
            new SpecificFitment("ASU-TRA-009", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L", "Bomba superior pedal de embrague Aisin Japón"),

            // ASU-TRA-010: Volante Bimasa Valeo
            new SpecificFitment("ASU-TRA-010", "Volkswagen", "Amarok", 2010, 2022, "2.0L BiTDI 163HP/180HP", "Volante de inercia bimasa reforzado Valeo"),
            new SpecificFitment("ASU-TRA-010", "Hyundai", "H-100", 2012, 2022, "2.5L D4CB CRDi", "Volante bimasa absorción torsional Valeo")
    );

    private static final List<SpecificFitment> FITMENTS_ELECTRICO = List.of(
            // ASU-ELE-001: Pack x4 Bujías Laser Iridium NGK
            new SpecificFitment("ASU-ELE-001", "Toyota", "Corolla", 2014, 2024, "1.8L 2ZR / 2.0L M20A", "Pack x4 bujías Laser Iridium NGK Japón ILKAR7B11"),
            new SpecificFitment("ASU-ELE-001", "Toyota", "Yaris", 2016, 2024, "1.5L 2NR Dual VVT-i", "Pack x4 bujías Laser Iridium NGK"),
            new SpecificFitment("ASU-ELE-001", "Toyota", "RAV4", 2013, 2024, "2.0L / 2.5L", "Bujías Iridium NGK larga vida 100,000km"),
            new SpecificFitment("ASU-ELE-001", "Nissan", "Sentra", 2013, 2024, "1.8L MRA8DE / 2.0L", "Pack x4 bujías Iridium NGK"),
            new SpecificFitment("ASU-ELE-001", "Nissan", "Versa", 2012, 2024, "1.6L HR16DE", "Bujías NGK Laser Iridium"),
            new SpecificFitment("ASU-ELE-001", "Chevrolet", "Onix", 2020, 2026, "1.0L Turbo / 1.2L CSS Prime", "Bujías Iridium ultrafinas NGK"),

            // ASU-ELE-002: Bobina Encendido Bosch Lápiz
            new SpecificFitment("ASU-ELE-002", "Hyundai", "Accent", 2012, 2024, "1.4L G4LC / 1.6L", "Bobina de encendido tipo lápiz Bosch"),
            new SpecificFitment("ASU-ELE-002", "Kia", "Rio", 2012, 2024, "1.4L / 1.6L Gamma", "Bobina independiente Bosch"),
            new SpecificFitment("ASU-ELE-002", "Hyundai", "Tucson", 2010, 2024, "2.0L Nu MPi", "Bobina encendido directa Bosch"),
            new SpecificFitment("ASU-ELE-002", "Kia", "Sportage", 2011, 2024, "2.0L Nu MPi", "Bobina encendido Bosch"),

            // ASU-ELE-003: Módulo Bomba Gasolina Sumergible Denso
            new SpecificFitment("ASU-ELE-003", "Toyota", "Hilux", 2005, 2024, "2.7L Gasolina / Tanque diésel", "Módulo bomba combustible sumergible Denso 3.8 Bar"),
            new SpecificFitment("ASU-ELE-003", "Toyota", "Yaris", 2006, 2020, "1.3L / 1.5L", "Bomba eléctrica gasolina sumergible Denso"),
            new SpecificFitment("ASU-ELE-003", "Toyota", "Corolla", 2008, 2020, "1.8L 2ZR", "Bomba eléctrica combustible Denso Japón"),

            // ASU-ELE-004: Bobina Encendido Denso Japón
            new SpecificFitment("ASU-ELE-004", "Toyota", "Yaris", 2006, 2020, "1.3L 2NZ / 1.5L 1NZ", "Bobina encendido electrónica Denso Japón"),
            new SpecificFitment("ASU-ELE-004", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Bobina de ignición independiente Denso"),
            new SpecificFitment("ASU-ELE-004", "Toyota", "Corolla", 2008, 2018, "1.8L 2ZR-FE", "Bobina de encendido Denso"),

            // ASU-ELE-005: Focos Halógenos Narva H4 12V 60/55W
            new SpecificFitment("ASU-ELE-005", "Toyota", "Hilux", 2005, 2020, "Halógeno H4", "Par focos halógenos Narva H4 12V 60/55W Range Power"),
            new SpecificFitment("ASU-ELE-005", "Toyota", "Yaris", 2006, 2020, "H4", "Focos halógenos alemanes Narva H4"),
            new SpecificFitment("ASU-ELE-005", "Toyota", "Probox", 2002, 2024, "H4", "Focos H4 12V 60/55W Narva"),
            new SpecificFitment("ASU-ELE-005", "Nissan", "Frontier", 2005, 2020, "H4", "Focos halógenos H4 cristal cuarzo Narva"),
            new SpecificFitment("ASU-ELE-005", "Hyundai", "Accent", 2006, 2020, "H4", "Focos Narva H4 alta luminosidad"),
            new SpecificFitment("ASU-ELE-005", "Kia", "Rio", 2006, 2020, "H4", "Focos halógenos Narva H4"),
            new SpecificFitment("ASU-ELE-005", "Volkswagen", "Gol", 2008, 2020, "H4", "Focos Narva H4 12V"),
            new SpecificFitment("ASU-ELE-005", "Chevrolet", "Sail", 2010, 2020, "H4", "Focos halógenos Narva H4"),

            // ASU-ELE-006: Arrancador 24V 5.5kW Bosch Heavy-Duty
            new SpecificFitment("ASU-ELE-006", "Hino", "500 Series", 2005, 2024, "7.7L J08E 24V", "Arrancador Heavy-Duty 24V 5.5kW Bosch"),
            new SpecificFitment("ASU-ELE-006", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1 24V", "Motor de partida diésel comercial Bosch 24V"),
            new SpecificFitment("ASU-ELE-006", "Scania", "P410", 2005, 2024, "12.7L DC13 24V", "Arrancador industrial Bosch 24V"),
            new SpecificFitment("ASU-ELE-006", "Volvo", "FH 460 / 500", 2005, 2024, "12.8L D13 24V", "Motor de arranque pesado Bosch 24V 5.5kW"),

            // ASU-ELE-007: Alternador Industrial Brushless 24V 90A Denso
            new SpecificFitment("ASU-ELE-007", "Hino", "500 Series", 2005, 2024, "7.7L J08E 24V", "Alternador industrial brushless 24V 90A Denso"),
            new SpecificFitment("ASU-ELE-007", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1 24V", "Alternador sin escobillas 24V Denso"),
            new SpecificFitment("ASU-ELE-007", "Hino", "Dutro 300", 2008, 2024, "4.0L N04C 24V", "Alternador sellado polvo Denso 24V 90A"),

            // ASU-ELE-008: Alternador 12V 110A Denso OAP
            new SpecificFitment("ASU-ELE-008", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Alternador trifásico 12V 110A con polea OAP Denso"),
            new SpecificFitment("ASU-ELE-008", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L", "Alternador Denso 12V 110A con regulador integrado"),
            new SpecificFitment("ASU-ELE-008", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L", "Alternador 12V 110A alta eficiencia Denso"),

            // ASU-ELE-009: Arrancador 12V 1.4kW Bosch
            new SpecificFitment("ASU-ELE-009", "Chevrolet", "Sail", 2010, 2022, "1.4L / 1.5L", "Motor de arranque planetario 12V 1.4kW Bosch"),
            new SpecificFitment("ASU-ELE-009", "Chevrolet", "Onix", 2013, 2022, "1.4L Joy / 1.0T", "Arrancador bajo consumo Bosch 12V"),
            new SpecificFitment("ASU-ELE-009", "Volkswagen", "Gol", 2009, 2022, "1.6L EA111", "Arrancador planetario Bosch 12V"),

            // ASU-ELE-010: Bujías Precalentamiento Denso
            new SpecificFitment("ASU-ELE-010", "Toyota", "Hilux", 2005, 2015, "2.5L 2KD / 3.0L 1KD D-4D", "Pack x4 bujías precalentamiento incandescencia Denso"),
            new SpecificFitment("ASU-ELE-010", "Toyota", "Hiace", 2005, 2018, "2.5L 2KD Commuter", "Bujías incandescencia arranque en frío Denso"),
            new SpecificFitment("ASU-ELE-010", "Nissan", "Frontier", 2008, 2016, "2.5L YD25DDTi", "Bujías precalentamiento rápido Denso diésel"),
            new SpecificFitment("ASU-ELE-010", "Hyundai", "H-100", 2012, 2022, "2.5L D4CB CRDi", "Bujías incandescencia diésel Denso"),

            // ASU-ELE-011: Sensor Oxígeno Bosch Planar
            new SpecificFitment("ASU-ELE-011", "Hyundai", "Accent", 2012, 2022, "1.4L / 1.6L", "Sensor de oxígeno / sonda lambda planar 4 cables Bosch"),
            new SpecificFitment("ASU-ELE-011", "Kia", "Rio", 2012, 2022, "1.4L / 1.6L", "Sonda lambda pre-catalizador Bosch"),
            new SpecificFitment("ASU-ELE-011", "Chevrolet", "Sail", 2010, 2020, "1.4L / 1.5L", "Sensor de oxígeno circonio Bosch"),
            new SpecificFitment("ASU-ELE-011", "Chevrolet", "Onix", 2013, 2020, "1.4L SPE/4 Joy", "Sonda lambda calefactada Bosch"),
            new SpecificFitment("ASU-ELE-011", "Volkswagen", "Gol", 2009, 2020, "1.6L EA111", "Sensor de oxígeno 4 cables Bosch"),

            // ASU-ELE-012: Sensor MAF Denso Japón
            new SpecificFitment("ASU-ELE-012", "Toyota", "Hilux", 2005, 2020, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Sensor de flujo masa de aire MAF Denso Japón"),
            new SpecificFitment("ASU-ELE-012", "Toyota", "Fortuner", 2005, 2020, "2.8L / 3.0L", "Caudalímetro MAF hilo platino Denso"),
            new SpecificFitment("ASU-ELE-012", "Toyota", "Yaris", 2006, 2018, "1.3L / 1.5L", "Sensor MAF inyección electrónica Denso"),
            new SpecificFitment("ASU-ELE-012", "Toyota", "Corolla", 2008, 2018, "1.8L 2ZR-FE", "Sensor MAF original Denso")
    );

    private static final List<SpecificFitment> FITMENTS_REFRIGERACION = List.of(
            // ASU-REF-001: Bomba Agua Aisin Aluminio
            new SpecificFitment("ASU-REF-001", "Toyota", "Yaris", 2006, 2020, "1.3L 2NZ / 1.5L 1NZ", "Bomba de agua centrífuga aluminio Aisin Japón"),
            new SpecificFitment("ASU-REF-001", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Bomba de agua turbina balanceada Aisin"),
            new SpecificFitment("ASU-REF-001", "Toyota", "Corolla", 2008, 2018, "1.6L / 1.8L 2ZR", "Bomba de agua Aisin con sello carburo de silicio"),

            // ASU-REF-002: Bomba Agua Diésel Aisin HD
            new SpecificFitment("ASU-REF-002", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Bomba de agua motor diésel Heavy Duty Aisin Japón"),
            new SpecificFitment("ASU-REF-002", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L", "Bomba refrigerante alta capacidad Aisin"),
            new SpecificFitment("ASU-REF-002", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L", "Bomba de agua diésel Aisin Japón"),

            // ASU-REF-003: Bomba Agua Valeo Korea
            new SpecificFitment("ASU-REF-003", "Hyundai", "Accent", 2012, 2020, "1.4L / 1.6L Gamma", "Bomba de agua alta eficiencia Valeo"),
            new SpecificFitment("ASU-REF-003", "Kia", "Rio", 2012, 2020, "1.4L / 1.6L Gamma", "Bomba de agua aluminio fundido Valeo"),
            new SpecificFitment("ASU-REF-003", "Hyundai", "Elantra", 2012, 2020, "1.6L / 2.0L Nu", "Bomba de refrigerante Valeo Korea"),
            new SpecificFitment("ASU-REF-003", "Kia", "Cerato", 2013, 2020, "1.6L / 2.0L Nu", "Bomba de agua Valeo"),

            // ASU-REF-004: Prestone 50/50 Rojo Larga Vida (1G)
            new SpecificFitment("ASU-REF-004", "Toyota", "Hilux", 2005, 2024, "Todas las versiones", "Refrigerante 50/50 Prestone Rojo Larga Vida (1G)"),
            new SpecificFitment("ASU-REF-004", "Toyota", "Yaris", 2006, 2024, "Todas las versiones", "Refrigerante Cor-Guard 50/50 Prestone"),
            new SpecificFitment("ASU-REF-004", "Toyota", "Corolla", 2008, 2024, "1.8L / 2.0L", "Prestone 50/50 protección hasta 129°C"),
            new SpecificFitment("ASU-REF-004", "Hyundai", "Accent", 2012, 2024, "Todas las versiones", "Anticorrosivo prediluido Prestone"),
            new SpecificFitment("ASU-REF-004", "Kia", "Sportage", 2011, 2024, "Gasolina y Diésel", "Refrigerante larga vida Prestone"),
            new SpecificFitment("ASU-REF-004", "Nissan", "Frontier", 2008, 2024, "Turbo Diésel", "Refrigerante Prestone 50/50"),
            new SpecificFitment("ASU-REF-004", "Volkswagen", "Amarok", 2010, 2024, "2.0L BiTDI", "Refrigerante Prestone 50/50"),
            new SpecificFitment("ASU-REF-004", "Chevrolet", "Onix", 2013, 2024, "1.0T / 1.4L", "Refrigerante Prestone 50/50"),

            // ASU-REF-005: Radiador Flota Pesada Denso HD
            new SpecificFitment("ASU-REF-005", "Hino", "500 Series", 2005, 2024, "7.7L J08E", "Radiador Heavy-Duty Denso con embrague viscoso térmico"),
            new SpecificFitment("ASU-REF-005", "Isuzu", "Forward FTR", 2005, 2024, "7.8L 6HK1", "Radiador aluminio brasado sobredimensionado Denso"),
            new SpecificFitment("ASU-REF-005", "Hino", "Dutro 300", 2008, 2024, "4.0L N04C", "Radiador camión mediano Denso"),

            // ASU-REF-006: Termostato Motor 82°C Aisin Japón
            new SpecificFitment("ASU-REF-006", "Toyota", "Hilux", 2005, 2024, "2.5L 2KD / 2.8L 1GD / 3.0L 1KD", "Termostato motor 82°C con junta Aisin Japón"),
            new SpecificFitment("ASU-REF-006", "Toyota", "Fortuner", 2005, 2024, "2.8L / 3.0L / 2.7L", "Termostato acero inoxidable Aisin WVT-015"),
            new SpecificFitment("ASU-REF-006", "Toyota", "Hiace", 2005, 2024, "2.5L / 2.8L", "Termostato calibrado de fábrica Aisin"),
            new SpecificFitment("ASU-REF-006", "Toyota", "Probox", 2002, 2024, "1.5L 1NZ-FE", "Termostato 82°C con válvula jiggle purga"),

            // ASU-REF-007: Radiador Aluminio Brasado Denso
            new SpecificFitment("ASU-REF-007", "Toyota", "Yaris", 2014, 2022, "1.3L 1NR / 1.5L 2NR", "Radiador aluminio brasado alta disipación Denso"),
            new SpecificFitment("ASU-REF-007", "Toyota", "Probox", 2014, 2024, "1.5L 1NZ-FE NCP160", "Radiador micro-tubos aluminio tanques PA66 Denso"),
            new SpecificFitment("ASU-REF-007", "Hyundai", "Accent", 2012, 2020, "1.4L / 1.6L", "Radiador refrigeración motor Denso"),
            new SpecificFitment("ASU-REF-007", "Kia", "Rio", 2012, 2020, "1.4L / 1.6L", "Radiador de aluminio Denso"),

            // ASU-REF-008: Radiador Doble Fila Turbo Diésel Denso
            new SpecificFitment("ASU-REF-008", "Toyota", "Hilux", 2016, 2024, "2.4L 2GD / 2.8L 1GD 4x4", "Radiador sobredimensionado doble fila diésel Denso"),
            new SpecificFitment("ASU-REF-008", "Toyota", "Fortuner", 2016, 2024, "2.8L 1GD 4x4", "Radiador capacidad térmica incrementada 30% Denso")
    );

    private static final List<SpecificFitment> FITMENTS_CARROCERIA = List.of(
            // ASU-CAR-001: Faro Delantero Derecho TYC
            new SpecificFitment("ASU-CAR-001", "Toyota", "Hilux", 2012, 2015, "Vigo Champ 4x4/4x2", "Faro delantero derecho halógeno/LED TYC"),
            new SpecificFitment("ASU-CAR-001", "Toyota", "Fortuner", 2012, 2015, "Champ SUV", "Faro delantero derecho TYC"),

            // ASU-CAR-002: Faro Delantero Izquierdo TYC
            new SpecificFitment("ASU-CAR-002", "Toyota", "Hilux", 2012, 2015, "Vigo Champ 4x4/4x2", "Faro delantero izquierdo halógeno/LED TYC"),
            new SpecificFitment("ASU-CAR-002", "Toyota", "Fortuner", 2012, 2015, "Champ SUV", "Faro delantero izquierdo TYC"),

            // ASU-CAR-003: Faro Delantero Lupa Depo
            new SpecificFitment("ASU-CAR-003", "Toyota", "Yaris", 2014, 2018, "Sedán y Hatchback", "Faro delantero principal fondo cromo con proyector lupa Depo"),

            // ASU-CAR-004: Faro Delantero Proyector Depo
            new SpecificFitment("ASU-CAR-004", "Hyundai", "Tucson", 2016, 2020, "TL Facelift SUV", "Faro delantero proyector halógeno/LED Depo"),
            new SpecificFitment("ASU-CAR-004", "Kia", "Sportage", 2016, 2020, "QL SUV", "Faro delantero proyector Depo"),

            // ASU-CAR-005: Plumillas Aerotwin Bosch 24" y 16"
            new SpecificFitment("ASU-CAR-005", "Toyota", "Yaris", 2006, 2024, "Todas las versiones", "Par plumillas limpiaparabrisas Aerotwin Bosch 24\" y 16\""),
            new SpecificFitment("ASU-CAR-005", "Toyota", "Corolla", 2008, 2024, "Sedán", "Plumillas aerodinámicas silenciosas Bosch Aerotwin"),
            new SpecificFitment("ASU-CAR-005", "Hyundai", "Accent", 2012, 2024, "Sedán/Hatchback", "Plumillas planas Bosch Aerotwin"),
            new SpecificFitment("ASU-CAR-005", "Kia", "Rio", 2012, 2024, "Sedán/Hatchback", "Plumillas dobles Bosch Aerotwin"),
            new SpecificFitment("ASU-CAR-005", "Nissan", "Versa", 2012, 2024, "Sedán", "Plumillas Aerotwin 24\"/16\" Bosch"),
            new SpecificFitment("ASU-CAR-005", "Chevrolet", "Sail", 2010, 2024, "Sedán", "Plumillas planas Bosch Aerotwin"),
            new SpecificFitment("ASU-CAR-005", "Chevrolet", "Onix", 2013, 2024, "Sedán/Hatchback", "Plumillas Aerotwin Bosch"),

            // ASU-CAR-006: Faro Posterior Completo Depo
            new SpecificFitment("ASU-CAR-006", "Toyota", "Hilux", 2012, 2020, "Vigo & Revo Pickup", "Faro posterior derecho completo con portalámparas Depo"),

            // ASU-CAR-007: Espejo Panorámico Depo Heavy-Duty
            new SpecificFitment("ASU-CAR-007", "Hino", "500 Series", 2005, 2024, "Cabina Ranger", "Espejo panorámico doble ángulo + neblinero Depo HD"),
            new SpecificFitment("ASU-CAR-007", "Isuzu", "Forward FTR", 2005, 2024, "Cabina FTR", "Espejo panorámico exterior antivibración Depo"),
            new SpecificFitment("ASU-CAR-007", "Scania", "P410", 2005, 2024, "Cabina P", "Espejo panorámico doble ángulo carretera Depo"),
            new SpecificFitment("ASU-CAR-007", "Volvo", "FH 460 / 500", 2005, 2024, "Globetrotter", "Espejo exterior reforzado pesados Depo"),

            // ASU-CAR-008: Kit Neblineros con Bisel Depo
            new SpecificFitment("ASU-CAR-008", "Toyota", "Yaris", 2014, 2020, "Sedán/Hatchback", "Kit faros neblineros delanteros con bisel y arnés Depo IP67"),
            new SpecificFitment("ASU-CAR-008", "Toyota", "Corolla", 2014, 2020, "Sedán", "Neblineros delanteros halógeno/LED Depo"),
            new SpecificFitment("ASU-CAR-008", "Toyota", "Hilux", 2016, 2020, "Revo 4x4", "Neblineros delanteros con cableado Depo"),

            // ASU-CAR-009: Espejo Retrovisor Abatible Depo
            new SpecificFitment("ASU-CAR-009", "Toyota", "Corolla", 2014, 2020, "Sedán", "Espejo retrovisor lateral abatible eléctrico con luna convexa Depo"),
            new SpecificFitment("ASU-CAR-009", "Toyota", "Yaris", 2014, 2020, "Sedán", "Espejo lateral con regulación eléctrica Depo"),

            // ASU-CAR-010: Amortiguadores Maletera KYB
            new SpecificFitment("ASU-CAR-010", "Toyota", "RAV4", 2013, 2020, "SUV", "Par amortiguadores a gas compuerta maletera KYB"),
            new SpecificFitment("ASU-CAR-010", "Hyundai", "Tucson", 2010, 2020, "SUV", "Resortes neumáticos compuerta posterior KYB"),
            new SpecificFitment("ASU-CAR-010", "Kia", "Sportage", 2011, 2020, "SUV", "Amortiguadores maletera a gas KYB"),
            new SpecificFitment("ASU-CAR-010", "Toyota", "Fortuner", 2010, 2020, "SUV", "Amortiguadores hidráulicos de compuerta KYB")
    );

    private void buildSpecificDirectFitments() {
        List<VehicleModel> allModels = modelRepository.findAllByOrderByMakeNameAscNameAsc();
        Map<String, VehicleModel> modelMap = new HashMap<>();
        for (VehicleModel m : allModels) {
            String make = m.getMake() != null ? m.getMake().getName() : "";
            modelMap.put((make + "|" + m.getName()).toLowerCase(), m);
        }

        List<Part> allParts = partRepository.findAllWithImagesOrderByIdAsc();
        if (!allParts.isEmpty()) {
            partRepository.hydrateCompatibilities(allParts);
        }
        Map<String, Part> partMap = new HashMap<>();
        for (Part p : allParts) {
            if (p.getSku() != null) {
                partMap.put(p.getSku().toUpperCase(), p);
            }
        }

        Set<Part> dirtyParts = new LinkedHashSet<>();

        List<SpecificFitment> allFitments = new ArrayList<>();
        allFitments.addAll(FITMENTS_FRENOS);
        allFitments.addAll(FITMENTS_FILTROS);
        allFitments.addAll(FITMENTS_SUSPENSION);
        allFitments.addAll(FITMENTS_MOTOR);
        allFitments.addAll(FITMENTS_TRANSMISION);
        allFitments.addAll(FITMENTS_ELECTRICO);
        allFitments.addAll(FITMENTS_REFRIGERACION);
        allFitments.addAll(FITMENTS_CARROCERIA);

        for (SpecificFitment f : allFitments) {
            Part part = partMap.get(f.sku().toUpperCase());
            if (part == null) continue;
            VehicleModel model = modelMap.get((f.makeName() + "|" + f.modelName()).toLowerCase());
            if (model == null) {
                for (VehicleModel m : allModels) {
                    if (m.getMake() != null && m.getMake().getName().equalsIgnoreCase(f.makeName())
                            && m.getName().toLowerCase().contains(f.modelName().toLowerCase())) {
                        model = m;
                        break;
                    }
                }
            }
            if (model == null) continue;

            final VehicleModel targetModel = model;
            boolean alreadyAttached = part.getCompatibilities().stream()
                    .anyMatch(c -> c.getVehicleModel().getId().equals(targetModel.getId())
                            && c.getYearStart() == f.yearStart()
                            && c.getYearEnd() == f.yearEnd());
            if (!alreadyAttached) {
                PartCompatibility pc = new PartCompatibility();
                pc.setPart(part);
                pc.setVehicleModel(targetModel);
                pc.setYearStart(f.yearStart());
                pc.setYearEnd(f.yearEnd());
                pc.setEngineSpec(f.engineSpec());
                pc.setNotes("OEM Certificado - " + f.notes());
                part.getCompatibilities().add(pc);
                dirtyParts.add(part);
            }
        }

        if (!dirtyParts.isEmpty()) {
            partRepository.saveAll(dirtyParts);
        }
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
