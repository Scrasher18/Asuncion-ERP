package com.asuncion.erp.config;

import com.asuncion.erp.domain.entity.*;
import com.asuncion.erp.domain.enums.OrderStatus;
import com.asuncion.erp.domain.enums.RoleName;
import com.asuncion.erp.repository.*;
import com.asuncion.erp.service.GeospatialCoverageService;
import com.asuncion.erp.service.ImageOptimizationService;
import com.asuncion.erp.service.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Component
public class DataSeeder implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataSeeder.class);
    private static final BigDecimal IGV = new BigDecimal("0.18");

    private final boolean seederEnabled;
    private final boolean asyncWarmup;
    private final String storageType;
    private final String localBaseDir;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final SalesQuotaRepository salesQuotaRepository;
    private final BranchRepository branchRepository;
    private final CategoryRepository categoryRepository;
    private final ManufacturerBrandRepository brandRepository;
    private final VehicleMakeRepository makeRepository;
    private final VehicleModelRepository modelRepository;
    private final PartRepository partRepository;
    private final CustomerOrderRepository orderRepository;
    private final PasswordEncoder passwordEncoder;
    private final GeospatialCoverageService geospatialCoverageService;
    private final ImageOptimizationService imageOptimizationService;
    private final StorageService storageService;

    public DataSeeder(
            @Value("${app.seeder.enabled:true}") boolean seederEnabled,
            @Value("${app.startup.async-warmup:false}") boolean asyncWarmup,
            @Value("${app.storage.type:local}") String storageType,
            @Value("${app.storage.local.base-dir:./uploads}") String localBaseDir,
            @Lazy RoleRepository roleRepository,
            @Lazy UserRepository userRepository,
            @Lazy SalesQuotaRepository salesQuotaRepository,
            @Lazy BranchRepository branchRepository,
            @Lazy CategoryRepository categoryRepository,
            @Lazy ManufacturerBrandRepository brandRepository,
            @Lazy VehicleMakeRepository makeRepository,
            @Lazy VehicleModelRepository modelRepository,
            @Lazy PartRepository partRepository,
            @Lazy CustomerOrderRepository orderRepository,
            @Lazy PasswordEncoder passwordEncoder,
            @Lazy GeospatialCoverageService geospatialCoverageService,
            @Lazy ImageOptimizationService imageOptimizationService,
            @Lazy StorageService storageService
    ) {
        this.seederEnabled = seederEnabled;
        this.asyncWarmup = asyncWarmup;
        this.storageType = storageType;
        this.localBaseDir = localBaseDir;
        this.roleRepository = roleRepository;
        this.userRepository = userRepository;
        this.salesQuotaRepository = salesQuotaRepository;
        this.branchRepository = branchRepository;
        this.categoryRepository = categoryRepository;
        this.brandRepository = brandRepository;
        this.makeRepository = makeRepository;
        this.modelRepository = modelRepository;
        this.partRepository = partRepository;
        this.orderRepository = orderRepository;
        this.passwordEncoder = passwordEncoder;
        this.geospatialCoverageService = geospatialCoverageService;
        this.imageOptimizationService = imageOptimizationService;
        this.storageService = storageService;
    }

    @Override
    @Transactional
    public void run(String... args) {
        if (asyncWarmup || !seederEnabled) {
            return;
        }
        executeSeed();
    }

    @Transactional
    public void executeSeed() {
        if (!seederEnabled) {
            return;
        }
        if (userRepository.count() > 0) {
            ensureLocalSeedImagesExist();
            return;
        }
        log.info("Inicializando datos empresariales para Repuestos Automotrices Asunción...");

        // 1. RBAC Roles
        Role rAdmin = ensureRole(RoleName.ADMIN, "Administrador General del ERP y Configuración Geoespacial");
        Role rVendedor = ensureRole(RoleName.VENDEDOR, "Ejecutivo Comercial B2C/B2B y Gestión de Catálogo");
        Role rMotorizado = ensureRole(RoleName.MOTORIZADO, "Repartidor Motorizado con Despacho GPS y Evidencia");
        Role rCliente = ensureRole(RoleName.CLIENTE, "Cliente Corporativo B2B o Particular B2C");

        String hashedPwd = passwordEncoder.encode("Asuncion2026!");

        // 2. Seeded Users
        AppUser admin = createUser("Carlos Mendoza", "admin@asuncion.pe", hashedPwd, "+51 999 111 222", "DNI", "43829104", rAdmin);
        AppUser ventas1 = createUser("Lucía Paredes", "ventas1@asuncion.pe", hashedPwd, "+51 999 211 301", "DNI", "45918273", rVendedor);
        AppUser ventas2 = createUser("Jorge Quispe", "ventas2@asuncion.pe", hashedPwd, "+51 999 211 302", "DNI", "46720195", rVendedor);
        AppUser ventas3 = createUser("Valeria Rojas", "ventas3@asuncion.pe", hashedPwd, "+51 999 211 303", "DNI", "47831206", rVendedor);
        AppUser motorizado = createUser("Miguel Ángel Soto", "motorizado@asuncion.pe", hashedPwd, "+51 999 411 501", "DNI", "48201937", rMotorizado);
        AppUser clienteFlota = createUser("Martín Torres - Flotas Andinas SAC", "cliente@empresa.pe", hashedPwd, "+51 987 654 321", "RUC", "20608912345", rCliente);
        AppUser clientePacifico = createUser("Consorcio Logístico Pacífico SAC", "compras@logisticapacifico.pe", hashedPwd, "+51 986 410 220", "RUC", "20547819203", rCliente);
        AppUser clienteTaller = createUser("Automotriz San Borja EIRL", "taller@automotrizsanborja.pe", hashedPwd, "+51 985 302 118", "RUC", "20601948271", rCliente);

        // Monthly Sales Quotas for current UTC year/month
        LocalDate nowDate = LocalDate.now(ZoneOffset.UTC);
        short yr = (short) nowDate.getYear();
        short mo = (short) nowDate.getMonthValue();
        salesQuotaRepository.save(new SalesQuota(ventas1, yr, mo, bd("45000.00")));
        salesQuotaRepository.save(new SalesQuota(ventas2, yr, mo, bd("40000.00")));
        salesQuotaRepository.save(new SalesQuota(ventas3, yr, mo, bd("35000.00")));

        // 3. Branches in Lima (WGS84 JTS Point SRID 4326)
        Branch sedeCentral = createBranch(
                "LIM-CENTRAL",
                "Autopartes Asuncion - Santa Anita",
                "Av. Sta. Ana 441, Lima 15011",
                "+51 987 654 321",
                -12.042941, -76.956697,
                2500.0, bd("10.00"), bd("1.50")
        );
        Branch sucursalNorte = createBranch(
                "LIM-NORTE",
                "Sucursal Norte Asunción - Los Olivos",
                "Av. Alfredo Mendiola 3810, Los Olivos, Lima",
                "+51 (01) 522-6410",
                -11.9912, -77.0706,
                6500.0, bd("10.00"), bd("1.40")
        );

        // 4. Categories & Manufacturer Brands
        Category catFrenos = ensureCategory("FRENOS", "Sistema de Frenos", "Pastillas cerámicas, discos ventilados, zapatas y bombas hidráulicas");
        Category catFiltros = ensureCategory("FILTROS", "Filtros y Lubricación", "Filtros de aceite, aire primario, combustible diésel common-rail y cabina");
        Category catSuspension = ensureCategory("SUSPENSION", "Suspensión y Dirección", "Amortiguadores a gas, trapecios, rótulas y terminales de dirección");
        Category catMotor = ensureCategory("MOTOR", "Motor y Distribución", "Kits de distribución, bombas de agua, fajas sincronizadas y empaquetaduras");
        Category catTransmision = ensureCategory("TRANSMISION", "Embrague y Transmisión", "Kits de embrague reforzados (plato, disco y collarín) para flota pesada y ligera");
        Category catElectrico = ensureCategory("ELECTRICO", "Sistema Eléctrico y Encendido", "Alternadores, arrancadores, bujías de iridio, bobinas y sensores OEM");
        Category catAccesorios = ensureCategory("ACCESORIOS", "Accesorios y Cuidado Automotriz", "Ambientadores, franelas de microfibra, lubricantes multiuso y limpieza");

        ManufacturerBrand brembo = ensureBrand("Brembo", "Italia");
        ManufacturerBrand bosch = ensureBrand("Bosch", "Alemania");
        ManufacturerBrand denso = ensureBrand("Denso", "Japón");
        ManufacturerBrand kyb = ensureBrand("KYB", "Japón");
        ManufacturerBrand aisin = ensureBrand("Aisin", "Japón");
        ManufacturerBrand gates = ensureBrand("Gates", "Estados Unidos");
        ManufacturerBrand ngk = ensureBrand("NGK", "Japón");
        ManufacturerBrand mann = ensureBrand("Mann-Filter", "Alemania");
        ManufacturerBrand threeM = ensureBrand("3M", "Estados Unidos");
        ManufacturerBrand littleTrees = ensureBrand("Little Trees", "Estados Unidos");

        // 5. Vehicle Makes & Models
        VehicleMake toyota = ensureMake("Toyota");
        VehicleMake hyundai = ensureMake("Hyundai");
        VehicleMake kia = ensureMake("Kia");
        VehicleMake nissan = ensureMake("Nissan");
        VehicleMake mitsubishi = ensureMake("Mitsubishi");
        VehicleMake hino = ensureMake("Hino");
        VehicleMake isuzu = ensureMake("Isuzu");
        VehicleMake scania = ensureMake("Scania");
        VehicleMake volkswagen = ensureMake("Volkswagen");

        VehicleModel hilux = ensureModel(toyota, "Hilux", "PICKUP");
        VehicleModel corolla = ensureModel(toyota, "Corolla", "SEDAN");
        VehicleModel yaris = ensureModel(toyota, "Yaris", "SEDAN");
        VehicleModel hiace = ensureModel(toyota, "Hiace", "VAN");
        VehicleModel probox = ensureModel(toyota, "Probox", "COMERCIAL");

        VehicleModel tucson = ensureModel(hyundai, "Tucson", "SUV");
        VehicleModel accent = ensureModel(hyundai, "Accent", "SEDAN");
        VehicleModel h100 = ensureModel(hyundai, "H-100", "COMERCIAL");

        VehicleModel sportage = ensureModel(kia, "Sportage", "SUV");
        VehicleModel rio = ensureModel(kia, "Rio", "SEDAN");

        VehicleModel frontier = ensureModel(nissan, "Frontier NP300", "PICKUP");
        VehicleModel sentra = ensureModel(nissan, "Sentra", "SEDAN");

        VehicleModel l200 = ensureModel(mitsubishi, "L200 Triton", "PICKUP");
        VehicleModel amarok = ensureModel(volkswagen, "Amarok", "PICKUP");

        VehicleModel dutro = ensureModel(hino, "Dutro 300", "COMERCIAL");
        VehicleModel hino500 = ensureModel(hino, "500 Series", "COMERCIAL");
        VehicleModel forward = ensureModel(isuzu, "Forward FTR", "COMERCIAL");
        VehicleModel npr = ensureModel(isuzu, "NPR Reward", "COMERCIAL");
        VehicleModel scaniaP410 = ensureModel(scania, "P410", "COMERCIAL");

        Instant now = Instant.now();

        // 6. Spare Parts with Generated WebP Product Illustrations & Vehicle Fitment Matrix
        Part p1 = createPartWithWebp(
                "ASN-FRN-0001", "04465-0K240",
                "Juego de Pastillas de Freno Delanteras Cerámicas",
                "Compuesto cerámico NAO de baja emisión de polvo y alta resistencia térmica (650°C), incluye láminas antirruido.",
                catFrenos, brembo, bd("145.00"), bd("239.90"), bd("205.00"), 34, 8, "PAS-A1-EST-04", now.minus(60, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2016, 2024, "2.8L 1GD-FTV / 2.4L 2GD-FTV", "Eje delantero 4x4 y 4x2"),
                        compat(hiace, 2019, 2024, "2.8L Turbo Diésel", "Delantero servicio pesado"),
                        compat(probox, 2002, 2024, "1.3L 2NZ / 1.5L 1NZ", "Delantero cerámico")
                )
        );

        Part p2 = createPartWithWebp(
                "ASN-FRN-0002", "43512-0K120",
                "Par de Discos de Freno Ventilados Delanteros 319mm",
                "Aleación de hierro gris alto carbono G3000 con recubrimiento anticorrosivo UV y balanceo electrónico.",
                catFrenos, brembo, bd("290.00"), bd("465.00"), bd("415.00"), 22, 6, "PAS-A1-EST-08", now.minus(58, ChronoUnit.DAYS),
                List.of(compat(hilux, 2016, 2024, "2.8L 1GD-FTV", "Diámetro 319mm - 6 pernos"))
        );

        Part p3 = createPartWithWebp(
                "ASN-FLT-0003", "90915-YZZD2",
                "Filtro de Aceite Sintético Heavy-Duty Válvula Anti-Drenaje",
                "Media filtrante de microfibra sintética de alta capacidad con retención de partículas desde 15 micras.",
                catFiltros, denso, bd("24.00"), bd("44.90"), bd("37.50"), 85, 20, "PAS-B2-EST-01", now.minus(55, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2012, 2024, "2.4L / 2.8L / 3.0L Diésel", "Rosca 3/4-16 UNF"),
                        compat(hiace, 2014, 2024, "2.8L / 3.0L Diésel", "Mantenimiento cada 10,000 km"),
                        compat(corolla, 2015, 2022, "1.8L 2ZR-FE", "Compatible versión gasolina"),
                        compat(probox, 2002, 2024, "1.3L 2NZ / 1.5L 1NZ-FE VVT-i", "Rosca M20 / 3/4-16 UNF"),
                        compat(frontier, 2008, 2024, "2.5L YD25DDTi / 2.4L KA24DE", "Rosca 3/4-16 UNF Spin-On")
                )
        );

        Part p4 = createPartWithWebp(
                "ASN-FLT-0004", "23390-0L070",
                "Elemento Filtro de Combustible Diésel Common-Rail",
                "Separador hidrofóbico de agua al 99.6% diseñado para proteger inyectores piezoeléctricos Euro V.",
                catFiltros, mann, bd("42.00"), bd("78.50"), bd("66.00"), 48, 12, "PAS-B2-EST-03", now.minus(52, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2016, 2024, "2.4L 2GD / 2.8L 1GD", "Cartucho primario"),
                        compat(frontier, 2017, 2024, "2.5L YD25DDTi", "Alta presión Common-Rail")
                )
        );

        Part p5 = createPartWithWebp(
                "ASN-TRN-0005", "31250-0K280",
                "Kit de Embrague Reforzado 3 Piezas (Plato, Disco y Collarín)",
                "Kit OEM japonés reforzado para torque elevado en minería y transporte de carga todo terreno.",
                catTransmision, aisin, bd("680.00"), bd("1090.00"), bd("960.00"), 14, 5, "PAS-C1-EST-02", now.minus(50, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2016, 2024, "2.8L 1GD-FTV 6MT", "Diámetro 275mm - 21 estrías"),
                        compat(l200, 2017, 2023, "2.4L DI-D MIVEC", "Versión 4x4 manual")
                )
        );

        Part p6 = createPartWithWebp(
                "ASN-SUS-0006", "48510-09W90",
                "Amortiguador Delantero a Gas Presurizado Excel-G",
                "Tecnología bitubo con gas nitrógeno a baja presión y vástago cromado de triple labio para caminos severos.",
                catSuspension, kyb, bd("185.00"), bd("315.00"), bd("278.00"), 5, 8, "PAS-D1-EST-05", now.minus(48, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2016, 2024, "2.4L / 2.8L 4x4", "Delantero izquierdo/derecho"),
                        compat(frontier, 2016, 2024, "2.5L Turbo Diésel", "Suspensión delantera reforzada")
                )
        );

        Part p7 = createPartWithWebp(
                "ASN-FRN-0007", "58101-D7A50",
                "Pastillas de Freno Delanteras Cerámicas SUV Coreanas",
                "Formulación silenciosa OE con chaflanes progresivos y ranura central de disipación térmica.",
                catFrenos, bosch, bd("98.00"), bd("169.00"), bd("145.00"), 31, 8, "PAS-A2-EST-02", now.minus(46, ChronoUnit.DAYS),
                List.of(
                        compat(tucson, 2016, 2023, "2.0L Nu MPi / 1.6T", "Eje delantero"),
                        compat(sportage, 2016, 2023, "2.0L MPI", "Eje delantero SUV")
                )
        );

        Part p8 = createPartWithWebp(
                "ASN-MTR-0008", "24312-2B000",
                "Kit de Faja de Distribución + Templador Hidráulico",
                "Correa HNBR reforzada con fibra de vidrio y rodamiento tensor de precisión para 100,000 km.",
                catMotor, gates, bd("215.00"), bd("359.00"), bd("315.00"), 4, 6, "PAS-E1-EST-01", now.minus(45, ChronoUnit.DAYS),
                List.of(
                        compat(accent, 2014, 2022, "1.4L / 1.6L Gamma", "Kit completo sincronización"),
                        compat(rio, 2015, 2022, "1.4L MPI", "Motor DOHC 16V"),
                        compat(h100, 2016, 2023, "2.5L CRDi", "Distribución flota comercial")
                )
        );

        Part p9 = createPartWithWebp(
                "ASN-ELC-0009", "90919-01253",
                "Juego x4 Bujías Laser Iridium Larga Duración",
                "Electrodo central de iridio soldado por láser de 0.6mm para encendido instantáneo y ahorro de combustible.",
                catElectrico, ngk, bd("112.00"), bd("189.00"), bd("164.00"), 27, 8, "PAS-F1-EST-04", now.minus(42, ChronoUnit.DAYS),
                List.of(
                        compat(corolla, 2014, 2024, "1.8L 2ZR-FE / 2.0L", "Pack de 4 unidades"),
                        compat(yaris, 2016, 2024, "1.5L 2NR-FE Dual VVT-i", "Pack de 4 unidades"),
                        compat(sentra, 2015, 2023, "1.8L MRA8DE", "Encendido directo"),
                        compat(probox, 2002, 2024, "1.5L 1NZ-FE / 1.3L 2NZ-FE", "Pack de 4 unidades")
                )
        );

        Part p10 = createPartWithWebp(
                "ASN-ELC-0010", "27060-0L190",
                "Alternador Trifásico 12V 120A Regulador Integrado",
                "Alternador OEM de alto amperaje con puente rectificador reforzado y polea desacopladora OAP.",
                catElectrico, denso, bd("590.00"), bd("945.00"), bd("840.00"), 3, 5, "PAS-F2-EST-01", now.minus(40, ChronoUnit.DAYS),
                List.of(
                        compat(hilux, 2016, 2024, "2.8L 1GD-FTV", "12V 120 Amperios"),
                        compat(amarok, 2016, 2023, "2.0L BiTDI", "Con polea libre")
                )
        );

        Part p11 = createPartWithWebp(
                "ASN-MTR-0011", "16100-09471",
                "Bomba de Agua Centrífuga de Aluminio Fundido con Empaque",
                "Impulsor metálico balanceado y sello mecánico de carburo de silicio libre de fugas.",
                catMotor, aisin, bd("155.00"), bd("265.00"), bd("232.00"), 19, 6, "PAS-E1-EST-06", now.minus(38, ChronoUnit.DAYS),
                List.of(
                        compat(corolla, 2014, 2023, "1.8L 2ZR-FE", "Incluye junta metálica"),
                        compat(yaris, 2015, 2023, "1.5L 1NZ/2NR", "Enfriamiento original"),
                        compat(probox, 2002, 2024, "1.5L 1NZ / 1.3L 2NZ", "Bomba de agua original")
                )
        );

        // Stagnant / Low-Rotation Parts (0 sales, older createdAt -> immobilized capital report)
        Part p12 = createPartWithWebp(
                "ASN-TRN-0012", "03L-141-015P",
                "Volante Bimasa Amortiguador Torsional BiTDI",
                "Volante bimasa de acero forjado para absorción de vibraciones torsionales en transmisiones de 6 marchas.",
                catTransmision, bosch, bd("1150.00"), bd("1790.00"), bd("1580.00"), 9, 2, "PAS-C2-EST-09", now.minus(84, ChronoUnit.DAYS),
                List.of(compat(amarok, 2015, 2022, "2.0L BiTDI 180HP", "Caja mecánica ZF"))
        );

        Part p13 = createPartWithWebp(
                "ASN-ELC-0013", "39210-2E400",
                "Sensor de Oxígeno Banda Ancha Lambda Pre-Catalizador",
                "Sonda lambda planar de circonio de 5 cables con calefactor cerámico de respuesta rápida.",
                catElectrico, bosch, bd("240.00"), bd("389.00"), bd("342.00"), 15, 4, "PAS-F2-EST-07", now.minus(76, ChronoUnit.DAYS),
                List.of(
                        compat(tucson, 2016, 2021, "2.0L Nu MPi", "Banco 1 Sensor 1"),
                        compat(sportage, 2017, 2021, "2.0L MPI", "Conector original 5 pines")
                )
        );

        Part p14 = createPartWithWebp(
                "ASN-SUS-0014", "54500-4KH0A",
                "Trapecio Inferior de Suspensión Forjado con Rótula",
                "Brazo oscilante delantero derecho con bujes hidráulicos vulcanizados y rótula sellada de alta carga.",
                catSuspension, kyb, bd("275.00"), bd("440.00"), bd("390.00"), 11, 3, "PAS-D2-EST-04", now.minus(69, ChronoUnit.DAYS),
                List.of(
                        compat(frontier, 2016, 2024, "2.5L YD25 4x4", "Lado derecho inferior"),
                        compat(l200, 2017, 2023, "2.4L Turbo Diésel", "Suspensión independiente")
                )
        );

        Part p15 = createPartWithWebp(
                "ASN-ACC-0015", "FRAN-ALG-5060",
                "Franela Automotriz Clásica 100% Algodón Extra Suave 50x60cm (Pack x2)",
                "Franela automotriz de algodón peinado extra suave para secado y pulido de carrocería sin rayar.",
                catAccesorios, threeM, bd("8.00"), bd("15.00"), bd("12.00"), 85, 10, "PAS-H3-EST-01", now.minus(30, ChronoUnit.DAYS),
                List.of()
        );

        Part p16 = createPartWithWebp(
                "ASN-ACC-0016", "U1P-10155",
                "Ambientador de Auto Colgante Little Trees Pinito (Aroma Black Ice)",
                "Aroma premium duradero para habitáculo automotriz, neutralizador de olores.",
                catAccesorios, littleTrees, bd("4.00"), bd("8.50"), bd("6.50"), 150, 20, "PAS-H3-EST-02", now.minus(30, ChronoUnit.DAYS),
                List.of()
        );

        // 7. Seed 13 Realistic Orders across all lifecycle stages & salespeople
        // Delivered fleet orders driving Executive Analytics (Salesperson Ranking & High Rotation)
        seedOrder(
                "ASN-2026-0001", clienteFlota, ventas1, null, motorizado, sedeCentral,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. República de Panamá 3420, San Isidro, Lima", "Puerta 2 de Taller de Flota",
                -12.0972, -77.0218, 3214.60, bd("14.82"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TRANSFERENCIA",
                now.minus(18, ChronoUnit.DAYS),
                List.of(new SeedLine(p5, 10, true), new SeedLine(p1, 16, true), new SeedLine(p3, 30, true))
        );

        seedOrder(
                "ASN-2026-0002", clientePacifico, ventas1, null, motorizado, sedeCentral,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Argentina 2840, Cercado de Lima", "Almacén Central Nave B",
                -12.0468, -77.0625, 5392.15, bd("18.09"),
                "FACTURA", "20547819203", "Consorcio Logístico Pacífico SAC", "TRANSFERENCIA",
                now.minus(14, ChronoUnit.DAYS),
                List.of(new SeedLine(p2, 14, true), new SeedLine(p10, 8, true), new SeedLine(p4, 24, true))
        );

        seedOrder(
                "ASN-2026-0003", clienteTaller, ventas1, null, motorizado, sedeCentral,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Aviación 2915, San Borja, Lima", "Taller Automotriz San Borja",
                -12.1014, -77.0012, 4098.30, bd("16.15"),
                "FACTURA", "20601948271", "Automotriz San Borja EIRL", "TARJETA",
                now.minus(9, ChronoUnit.DAYS),
                List.of(new SeedLine(p6, 12, true), new SeedLine(p7, 15, true), new SeedLine(p9, 10, true))
        );

        seedOrder(
                "ASN-2026-0004", clientePacifico, ventas2, null, motorizado, sucursalNorte,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Tomás Valle 1420, Independencia, Lima", "Patio de Maniobras Norte",
                -12.0065, -77.0618, 1952.40, bd("12.73"),
                "FACTURA", "20547819203", "Consorcio Logístico Pacífico SAC", "TRANSFERENCIA",
                now.minus(16, ChronoUnit.DAYS),
                List.of(new SeedLine(p5, 9, true), new SeedLine(p2, 10, true), new SeedLine(p3, 25, true))
        );

        seedOrder(
                "ASN-2026-0005", clienteFlota, ventas2, null, motorizado, sedeCentral,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Nicolás Arriola 1850, La Victoria, Lima", "Base de Mantenimiento Arriola",
                -12.0752, -77.0110, 1084.20, bd("11.63"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TRANSFERENCIA",
                now.minus(7, ChronoUnit.DAYS),
                List.of(new SeedLine(p8, 14, true), new SeedLine(p11, 12, true), new SeedLine(p1, 10, true))
        );

        seedOrder(
                "ASN-2026-0006", clienteTaller, ventas3, null, motorizado, sedeCentral,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Canadá 1690, La Victoria, Lima", "Área de Recepción Técnica",
                -12.0835, -77.0124, 1782.10, bd("12.67"),
                "FACTURA", "20601948271", "Automotriz San Borja EIRL", "TARJETA",
                now.minus(12, ChronoUnit.DAYS),
                List.of(new SeedLine(p1, 14, true), new SeedLine(p7, 16, true), new SeedLine(p9, 14, true))
        );

        seedOrder(
                "ASN-2026-0007", clienteFlota, ventas3, null, motorizado, sucursalNorte,
                OrderStatus.ENTREGADO, "DELIVERY",
                "Av. Carlos Izaguirre 940, Los Olivos, Lima", "Sucursal Operativa Norte",
                -11.9958, -77.0662, 701.85, bd("10.98"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TRANSFERENCIA",
                now.minus(5, ChronoUnit.DAYS),
                List.of(new SeedLine(p5, 5, true), new SeedLine(p4, 18, true), new SeedLine(p11, 8, true))
        );

        seedOrder(
                "ASN-2026-0008", clienteTaller, ventas2, null, null, sedeCentral,
                OrderStatus.ENTREGADO, "PICKUP",
                "Recojo en tienda: Av. Sta. Ana 441, Lima 15011", "Mostrador Santa Anita",
                null, null, null, bd("0.00"),
                "FACTURA", "20601948271", "Automotriz San Borja EIRL", "YAPE_PLIN",
                now.minus(3, ChronoUnit.DAYS),
                List.of(new SeedLine(p6, 6, true), new SeedLine(p3, 15, true))
        );

        // Active Warehouse & Motorizado Live Pipeline Orders
        seedOrder(
                "ASN-2026-0009", clienteTaller, ventas1, null, null, sedeCentral,
                OrderStatus.CONFIRMADO, "DELIVERY",
                "Av. San Luis 2140, San Borja, Lima", "Frente al parque industrial",
                -12.0942, -76.9985, 3572.90, bd("15.36"),
                "FACTURA", "20601948271", "Automotriz San Borja EIRL", "TARJETA",
                now.minus(5, ChronoUnit.HOURS),
                List.of(new SeedLine(p1, 3, false), new SeedLine(p3, 6, false), new SeedLine(p4, 4, false))
        );

        seedOrder(
                "ASN-2026-0010", clientePacifico, ventas2, null, null, sedeCentral,
                OrderStatus.EN_PREPARACION, "DELIVERY",
                "Av. Colonial 1920, Cercado de Lima", "Ingreso por Jr. Aguarico",
                -12.0491, -77.0532, 4376.50, bd("16.56"),
                "FACTURA", "20547819203", "Consorcio Logístico Pacífico SAC", "TRANSFERENCIA",
                now.minus(3, ChronoUnit.HOURS),
                List.of(new SeedLine(p2, 2, true), new SeedLine(p5, 1, false))
        );

        seedOrder(
                "ASN-2026-0011", clienteFlota, ventas1, null, motorizado, sedeCentral,
                OrderStatus.LISTO_PARA_DESPACHO, "DELIVERY",
                "Av. Javier Prado Este 2450, San Borja, Lima", "Torre Empresarial Piso 1 - Recepción Flota",
                -12.0886, -77.0015, 2879.40, bd("14.32"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TRANSFERENCIA",
                now.minus(2, ChronoUnit.HOURS),
                List.of(new SeedLine(p1, 2, true), new SeedLine(p3, 4, true))
        );

        seedOrder(
                "ASN-2026-0012", clienteFlota, ventas1, null, motorizado, sedeCentral,
                OrderStatus.EN_RUTA, "DELIVERY",
                "Av. Arequipa 3180, San Isidro, Lima", "Recepción Taller Corporativo",
                -12.0954, -77.0326, 3375.80, bd("15.06"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TARJETA",
                now.minus(75, ChronoUnit.MINUTES),
                List.of(new SeedLine(p7, 2, true), new SeedLine(p9, 2, true), new SeedLine(p11, 1, true))
        );

        seedOrder(
                "ASN-2026-0013", clienteFlota, ventas3, null, null, sucursalNorte,
                OrderStatus.CONFIRMADO, "DELIVERY",
                "Av. Universitaria 4520, Los Olivos, Lima", "Almacén Auxiliar Norte",
                -11.9845, -77.0782, 1112.30, bd("11.56"),
                "FACTURA", "20608912345", "Flotas Andinas SAC", "TRANSFERENCIA",
                now.minus(35, ChronoUnit.MINUTES),
                List.of(new SeedLine(p4, 4, false), new SeedLine(p8, 2, false))
        );

        log.info("Datos iniciales cargados exitosamente: {} usuarios, {} sucursales, {} repuestos con imágenes WebP, {} pedidos.",
                userRepository.count(), branchRepository.count(), partRepository.count(), orderRepository.count());
    }

    private record CompatSpec(VehicleModel model, int yearStart, int yearEnd, String engineSpec, String notes) {
    }

    private record SeedLine(Part part, int qty, boolean picked) {
    }

    private CompatSpec compat(VehicleModel model, int yearStart, int yearEnd, String engineSpec, String notes) {
        return new CompatSpec(model, yearStart, yearEnd, engineSpec, notes);
    }

    private Role ensureRole(RoleName name, String description) {
        return roleRepository.findByName(name)
                .orElseGet(() -> roleRepository.save(new Role(name, description)));
    }

    private Category ensureCategory(String code, String name, String description) {
        return categoryRepository.findByCodeIgnoreCase(code)
                .orElseGet(() -> categoryRepository.save(new Category(code, name, description)));
    }

    private ManufacturerBrand ensureBrand(String name, String country) {
        return brandRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> brandRepository.save(new ManufacturerBrand(name, country)));
    }

    private VehicleMake ensureMake(String name) {
        return makeRepository.findByNameIgnoreCase(name)
                .orElseGet(() -> makeRepository.save(new VehicleMake(name)));
    }

    private VehicleModel ensureModel(VehicleMake make, String name, String type) {
        return modelRepository.findByMakeIdAndNameIgnoreCase(make.getId(), name)
                .orElseGet(() -> modelRepository.save(new VehicleModel(make, name, type)));
    }

    private AppUser createUser(
            String fullName,
            String email,
            String passwordHash,
            String phone,
            String docType,
            String docNumber,
            Role role
    ) {
        AppUser u = new AppUser();
        u.setFullName(fullName);
        u.setEmail(email);
        u.setPasswordHash(passwordHash);
        u.setPhone(phone);
        u.setDocumentType(docType);
        u.setDocumentNumber(docNumber);
        u.setActive(true);
        u.getRoles().add(role);
        return userRepository.save(u);
    }

    private Branch createBranch(
            String code,
            String name,
            String address,
            String phone,
            double lat,
            double lng,
            double radiusMeters,
            BigDecimal baseFee,
            BigDecimal perKmFee
    ) {
        Branch b = new Branch();
        b.setCode(code);
        b.setName(name);
        b.setAddress(address);
        b.setPhone(phone);
        b.setLocation(geospatialCoverageService.createWgs84Point(lng, lat));
        b.setCoverageRadiusMeters(radiusMeters);
        b.setBaseDeliveryFee(baseFee);
        b.setPerKmFee(perKmFee);
        b.setActive(true);
        return branchRepository.save(b);
    }

    private Part createPartWithWebp(
            String sku,
            String oemCode,
            String name,
            String description,
            Category category,
            ManufacturerBrand brand,
            BigDecimal purchasePrice,
            BigDecimal salePrice,
            BigDecimal wholesalePrice,
            int stock,
            int minStock,
            String warehouseLocation,
            Instant createdAt,
            List<CompatSpec> compatSpecs
    ) {
        Part p = new Part();
        p.setSku(sku);
        p.setOemCode(oemCode);
        p.setName(name);
        p.setTechnicalDescription(description);
        p.setCategory(category);
        p.setManufacturerBrand(brand);
        p.setPurchasePrice(purchasePrice);
        p.setSalePrice(salePrice);
        p.setWholesalePrice(wholesalePrice);
        p.setStockQuantity(stock);
        p.setMinStockLevel(minStock);
        p.setWarehouseLocation(warehouseLocation);
        p.setActive(true);
        p.setCreatedAt(createdAt);
        p.setUpdatedAt(createdAt);

        for (CompatSpec cs : compatSpecs) {
            PartCompatibility pc = new PartCompatibility();
            pc.setPart(p);
            pc.setVehicleModel(cs.model());
            pc.setYearStart(cs.yearStart());
            pc.setYearEnd(cs.yearEnd());
            pc.setEngineSpec(cs.engineSpec());
            pc.setNotes(cs.notes());
            p.getCompatibilities().add(pc);
        }

        // Generate crisp WebP studio product illustration and store in bucket/uploads
        ImageOptimizationService.OptimizedImage webp = imageOptimizationService.generateAutomotivePartIllustration(
                sku, oemCode, name, brand.getName(), category.getCode()
        );
        StorageService.StoredObject stored = storageService.store(
                "parts",
                sku.toLowerCase(),
                webp.bytes(),
                webp.mimeType(),
                webp.extension()
        );

        PartImage img = new PartImage();
        img.setPart(p);
        img.setObjectKey(stored.objectKey());
        img.setImageUrl(stored.publicUrl());
        img.setMimeType(stored.mimeType());
        img.setFileSizeBytes(stored.sizeBytes());
        img.setPrimary(true);
        img.setDisplayOrder(0);
        p.getImages().add(img);

        return partRepository.save(p);
    }

    private void seedOrder(
            String orderNumber,
            AppUser customer,
            AppUser salesperson,
            AppUser warehouseOperator,
            AppUser driver,
            Branch branch,
            OrderStatus finalStatus,
            String deliveryType,
            String address,
            String reference,
            Double lat,
            Double lng,
            Double distanceMeters,
            BigDecimal deliveryFee,
            String invoiceType,
            String taxId,
            String businessName,
            String paymentMethod,
            Instant createdAt,
            List<SeedLine> lines
    ) {
        CustomerOrder o = new CustomerOrder();
        o.setOrderNumber(orderNumber);
        o.setCustomer(customer);
        o.setSalesperson(salesperson);
        o.setWarehouseOperator(warehouseOperator);
        o.setAssignedDriver(driver);
        o.setBranch(branch);
        o.setStatus(finalStatus);
        o.setDeliveryType(deliveryType);
        o.setDeliveryAddress(address);
        o.setDeliveryReference(reference);
        if (lat != null && lng != null) {
            o.setDeliveryLocation(geospatialCoverageService.createWgs84Point(lng, lat));
        }
        o.setCalculatedDistanceMeters(distanceMeters);
        o.setInvoiceType(invoiceType);
        o.setCustomerTaxId(taxId);
        o.setCustomerBusinessName(businessName);
        o.setRecipientName(customer.getFullName());
        o.setRecipientPhone(customer.getPhone());
        o.setPaymentMethod(paymentMethod);
        o.setCreatedAt(createdAt);
        o.setUpdatedAt(createdAt);

        BigDecimal subtotal = BigDecimal.ZERO;
        for (SeedLine line : lines) {
            OrderItem item = new OrderItem();
            item.setOrder(o);
            item.setPart(line.part());
            item.setQuantity(line.qty());
            item.setUnitPurchaseCost(line.part().getPurchasePrice());
            item.setUnitSalePrice(line.part().getSalePrice());
            item.setPicked(line.picked());
            o.getItems().add(item);

            BigDecimal lineSub = line.part().getSalePrice().multiply(BigDecimal.valueOf(line.qty()));
            subtotal = subtotal.add(lineSub);
        }

        subtotal = subtotal.setScale(2, RoundingMode.HALF_UP);
        BigDecimal tax = subtotal.multiply(IGV).setScale(2, RoundingMode.HALF_UP);
        BigDecimal total = subtotal.add(tax).add(deliveryFee).setScale(2, RoundingMode.HALF_UP);

        o.setSubtotal(subtotal);
        o.setTaxAmount(tax);
        o.setDeliveryFee(deliveryFee);
        o.setTotalAmount(total);

        // Build chronological audit history
        o.getStatusHistory().add(new OrderStatusHistory(
                o, null, OrderStatus.CONFIRMADO, customer,
                "Pedido confirmado con validación geoespacial aprobada.", createdAt
        ));

        if (finalStatus != OrderStatus.CONFIRMADO) {
            Instant tPrep = createdAt.plus(15, ChronoUnit.MINUTES);
            o.getStatusHistory().add(new OrderStatusHistory(
                    o, OrderStatus.CONFIRMADO, OrderStatus.EN_PREPARACION, warehouseOperator,
                    "Picking iniciado en almacén " + branch.getCode() + ".", tPrep
            ));

            if (finalStatus == OrderStatus.LISTO_PARA_DESPACHO
                    || finalStatus == OrderStatus.EN_RUTA
                    || finalStatus == OrderStatus.ENTREGADO) {
                Instant tReady = createdAt.plus(35, ChronoUnit.MINUTES);
                o.setWarehouseNotes("Embalaje verificado con código OEM y guía de remisión.");
                o.getStatusHistory().add(new OrderStatusHistory(
                        o, OrderStatus.EN_PREPARACION, OrderStatus.LISTO_PARA_DESPACHO, warehouseOperator,
                        "Pedido embalado al 100% y listo para despacho.", tReady
                ));
            }

            if ((finalStatus == OrderStatus.EN_RUTA || finalStatus == OrderStatus.ENTREGADO)
                    && "DELIVERY".equals(deliveryType)) {
                Instant tRoute = createdAt.plus(50, ChronoUnit.MINUTES);
                o.getStatusHistory().add(new OrderStatusHistory(
                        o, OrderStatus.LISTO_PARA_DESPACHO, OrderStatus.EN_RUTA, driver,
                        "Motorizado en ruta GPS hacia la dirección del cliente.", tRoute
                ));
            }

            if (finalStatus == OrderStatus.ENTREGADO) {
                Instant tDeliv = createdAt.plus(85, ChronoUnit.MINUTES);
                o.setUpdatedAt(tDeliv);
                AppUser effectiveDriver = driver != null ? driver : warehouseOperator;
                o.getStatusHistory().add(new OrderStatusHistory(
                        o, "DELIVERY".equals(deliveryType) ? OrderStatus.EN_RUTA : OrderStatus.LISTO_PARA_DESPACHO,
                        OrderStatus.ENTREGADO, effectiveDriver,
                        "Entregado conforme con comprobante de recepción registrado.", tDeliv
                ));

                if (effectiveDriver != null) {
                    DeliveryProof dp = new DeliveryProof();
                    dp.setOrder(o);
                    dp.setDriver(effectiveDriver);
                    dp.setReceiverName("Jefe de Recepción - " + businessName);
                    dp.setReceiverDocument(taxId);
                    dp.setDeliveryNotes("Guía de remisión electrónica firmada y sellada conforme.");
                    if (o.getDeliveryLocation() != null) {
                        dp.setCapturedLocation(o.getDeliveryLocation());
                    }
                    dp.setDeliveredAt(tDeliv);
                    o.setDeliveryProof(dp);
                }
            }
        }

        orderRepository.save(o);
    }

    private BigDecimal bd(String val) {
        return new BigDecimal(val);
    }

    private void ensureLocalSeedImagesExist() {
        if (!"local".equalsIgnoreCase(storageType)) {
            return;
        }
        Path root = Paths.get(localBaseDir).toAbsolutePath().normalize();
        for (Part p : partRepository.findAll()) {
            for (PartImage img : p.getImages()) {
                if (img.getObjectKey() != null && img.getObjectKey().startsWith("parts/asn-")) {
                    Path target = root.resolve(img.getObjectKey()).normalize();
                    if (target.startsWith(root) && !Files.exists(target)) {
                        try {
                            Files.createDirectories(target.getParent());
                            ImageOptimizationService.OptimizedImage webp =
                                    imageOptimizationService.generateAutomotivePartIllustration(
                                            p.getSku(),
                                            p.getOemCode(),
                                            p.getName(),
                                            p.getManufacturerBrand().getName(),
                                            p.getCategory().getCode()
                                    );
                            Files.write(target, webp.bytes());
                        } catch (IOException e) {
                            log.warn("No se pudo regenerar imagen semilla {}: {}", img.getObjectKey(), e.getMessage());
                        }
                    }
                }
            }
        }
    }
}
