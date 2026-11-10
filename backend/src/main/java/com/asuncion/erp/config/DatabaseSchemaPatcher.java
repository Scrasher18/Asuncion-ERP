package com.asuncion.erp.config;

import com.asuncion.erp.domain.entity.Category;
import com.asuncion.erp.repository.CategoryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Lazy;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Order(10)
public class DatabaseSchemaPatcher implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DatabaseSchemaPatcher.class);

    private record CategorySpec(String code, String matchToken, String name, String description) {
    }

    private static final List<CategorySpec> STANDARD_CATEGORIES = List.of(
            new CategorySpec("FRENOS", "fren", "Sistema de Frenos",
                    "Pastillas cerámicas, discos ventilados, zapatas y bombas hidráulicas"),
            new CategorySpec("FILTROS", "filtr", "Filtros y Lubricación",
                    "Filtros de aceite, aire, combustible, cabina y lubricantes sintéticos/semisintéticos"),
            new CategorySpec("SUSPENSION", "susp", "Suspensión y Dirección",
                    "Amortiguadores a gas, trapecios, rótulas, terminales y rodajes de rueda"),
            new CategorySpec("MOTOR", "motor", "Motor y Distribución",
                    "Kits de distribución, fajas acanaladas, empaquetaduras y componentes internos"),
            new CategorySpec("TRANSMISION", "transm", "Embrague y Transmisión",
                    "Kits de embrague (plato, disco y collarín), bombas de embrague y transmisión"),
            new CategorySpec("ELECTRICO", "elec", "Sistema Eléctrico e Iluminación",
                    "Focos halógenos/LED Narva, bujías, bobinas, baterías 12V, alternadores y sensores"),
            new CategorySpec("REFRIGERACION", "refrig", "Refrigeración y Climatización",
                    "Bombas de agua, radiadores de aluminio, termostatos y refrigerantes anticorrosivos"),
            new CategorySpec("CARROCERIA", "carroc", "Carrocería y Faros Exteriores",
                    "Faros delanteros y posteriores, neblineros, espejos retrovisores, parachoques y plumillas")
    );

    private final boolean asyncWarmup;
    private final JdbcTemplate jdbcTemplate;
    private final CategoryRepository categoryRepository;

    public DatabaseSchemaPatcher(
            @Value("${app.startup.async-warmup:false}") boolean asyncWarmup,
            @Lazy JdbcTemplate jdbcTemplate,
            @Lazy CategoryRepository categoryRepository
    ) {
        this.asyncWarmup = asyncWarmup;
        this.jdbcTemplate = jdbcTemplate;
        this.categoryRepository = categoryRepository;
    }

    @Override
    public void run(String... args) {
        executePatch();
    }

    public void executePatch() {
        // Ensure parts.oem_code and parts.warehouse_location accept NULL on pre-existing PostgreSQL tables
        try {
            jdbcTemplate.execute("ALTER TABLE parts ALTER COLUMN oem_code DROP NOT NULL");
        } catch (Exception e) {
            log.debug("Verificación nullable en parts.oem_code completada ({})", e.getMessage());
        }

        // Allow store pickup confirmations in delivery_proofs without requiring a delivery driver
        try {
            jdbcTemplate.execute("ALTER TABLE delivery_proofs ALTER COLUMN driver_id DROP NOT NULL");
        } catch (Exception e) {
            log.debug("Verificación nullable en delivery_proofs.driver_id completada ({})", e.getMessage());
        }

        // Ensure orders table has payment status, reference columns, and delivery security code if not present
        try {
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDIENTE'");
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(150)");
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_security_code VARCHAR(10)");
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS proximity_alert_sent BOOLEAN DEFAULT FALSE");

            // Update chk_orders_status to permit 'RESERVADO' status used by online checkout and stock reservations
            jdbcTemplate.execute("ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_status");
            jdbcTemplate.execute("""
                ALTER TABLE orders ADD CONSTRAINT chk_orders_status CHECK (status IN (
                    'RESERVADO',
                    'PENDIENTE',
                    'CONFIRMADO',
                    'EN_PREPARACION',
                    'LISTO_PARA_DESPACHO',
                    'EN_RUTA',
                    'ENTREGADO',
                    'CANCELADO'
                ))
            """);

            // Update chk_history_new_status to permit 'RESERVADO' in status history
            jdbcTemplate.execute("ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS chk_history_new_status");
            jdbcTemplate.execute("""
                ALTER TABLE order_status_history ADD CONSTRAINT chk_history_new_status CHECK (new_status IN (
                    'RESERVADO',
                    'PENDIENTE',
                    'CONFIRMADO',
                    'EN_PREPARACION',
                    'LISTO_PARA_DESPACHO',
                    'EN_RUTA',
                    'ENTREGADO',
                    'CANCELADO'
                ))
            """);
        } catch (Exception e) {
            log.debug("Columnas de pago, seguridad y restricciones de estado en orders verificadas ({})", e.getMessage());
        }

        // Ensure system_payment_config default row exists
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS system_payment_config (
                    id BIGINT PRIMARY KEY DEFAULT 1,
                    culqi_enabled BOOLEAN DEFAULT TRUE,
                    culqi_public_key VARCHAR(150),
                    culqi_secret_key VARCHAR(150),
                    pagoefectivo_enabled BOOLEAN DEFAULT FALSE,
                    pagoefectivo_service_id VARCHAR(100),
                    pagoefectivo_secret_key VARCHAR(150),
                    niubiz_enabled BOOLEAN DEFAULT FALSE,
                    niubiz_merchant_id VARCHAR(100),
                    niubiz_user VARCHAR(100),
                    niubiz_password VARCHAR(100),
                    environment VARCHAR(20) DEFAULT 'SANDBOX',
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """);
            jdbcTemplate.execute("""
                INSERT INTO system_payment_config (id, culqi_enabled, culqi_public_key, culqi_secret_key, pagoefectivo_enabled, pagoefectivo_service_id, pagoefectivo_secret_key, environment)
                VALUES (1, FALSE, '', '', FALSE, '', '', 'SANDBOX')
                ON CONFLICT (id) DO NOTHING
            """);
        } catch (Exception e) {
            log.debug("Verificación system_payment_config completada ({})", e.getMessage());
        }

        try {
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS driver_status VARCHAR(30) DEFAULT 'DISPONIBLE'");
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_code VARCHAR(30)");
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number VARCHAR(30)");
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS vehicle_plate VARCHAR(20)");

            jdbcTemplate.execute("UPDATE users SET employee_code = 'ADM-001' WHERE email = 'admin@asuncion.pe' AND employee_code IS NULL");
            jdbcTemplate.execute("UPDATE users SET employee_code = 'VEN-001' WHERE email = 'ventas1@asuncion.pe' AND employee_code IS NULL");
            jdbcTemplate.execute("UPDATE users SET employee_code = 'VEN-002' WHERE email = 'ventas2@asuncion.pe' AND employee_code IS NULL");
            jdbcTemplate.execute("UPDATE users SET employee_code = 'VEN-003' WHERE email = 'ventas3@asuncion.pe' AND employee_code IS NULL");
            jdbcTemplate.execute("UPDATE users SET employee_code = 'MOT-001', license_number = 'Q48201937', vehicle_plate = '5432-1A' WHERE email = 'motorizado@asuncion.pe' AND employee_code IS NULL");
        } catch (Exception e) {
            log.debug("Verificación users employee/driver columns completada ({})", e.getMessage());
        }

        // Idempotently ensure all 8 automotive categories exist and heal any corrupted accents
        try {
            List<Category> existing = categoryRepository.findAll();
            for (CategorySpec spec : STANDARD_CATEGORIES) {
                Category found = existing.stream()
                        .filter(c -> spec.code().equalsIgnoreCase(c.getCode())
                                || ("CAT-" + spec.code()).equalsIgnoreCase(c.getCode())
                                || (c.getCode() != null && c.getCode().toUpperCase().contains(spec.code()))
                                || (c.getName() != null && spec.name().equalsIgnoreCase(c.getName())))
                        .findFirst()
                        .orElse(null);
                if (found != null) {
                    if (found.getName() != null && (found.getName().contains("?") || !spec.name().equals(found.getName()))) {
                        found.setName(spec.name());
                        found.setDescription(spec.description());
                        categoryRepository.save(found);
                        log.info("Categoría corregida automáticamente con codificación UTF-8: {} -> {}", spec.code(), spec.name());
                    }
                } else {
                    categoryRepository.save(new Category(spec.code(), spec.name(), spec.description()));
                    log.info("Categoría automotriz registrada automáticamente: {} ({})", spec.code(), spec.name());
                }
            }
        } catch (Exception e) {
            log.warn("No se pudo verificar catálogo base de categorías: {}", e.getMessage());
        }

        // Idempotently ensure Toyota Probox exists in vehicle_models and has certified compatibilities
        try {
            jdbcTemplate.execute("""
                INSERT INTO vehicle_models (make_id, name, vehicle_type)
                SELECT id, 'Probox', 'COMERCIAL'
                FROM vehicle_makes
                WHERE LOWER(name) = 'toyota'
                AND NOT EXISTS (
                    SELECT 1 FROM vehicle_models vm
                    JOIN vehicle_makes mk ON mk.id = vm.make_id
                    WHERE LOWER(mk.name) = 'toyota' AND LOWER(vm.name) = 'probox'
                )
            """);

            jdbcTemplate.execute("""
                INSERT INTO part_vehicle_compatibilities (part_id, model_id, year_start, year_end, engine_spec, notes)
                SELECT p.id, vm.id, 2008, 2024, '1.3L 2NZ / 1.5L 1NZ-FE VVT-i', 'Compatible certificado para Toyota Probox'
                FROM parts p
                CROSS JOIN vehicle_models vm
                JOIN vehicle_makes mk ON mk.id = vm.make_id
                WHERE LOWER(mk.name) = 'toyota' AND LOWER(vm.name) = 'probox'
                AND LOWER(p.sku) IN ('asu-fil-001', 'asu-ele-001', 'asu-fre-003', 'asu-fil-005', 'asn-flt-0003', 'asn-frn-0001', 'asn-elc-0009', 'asn-mtr-0011')
                AND NOT EXISTS (
                    SELECT 1 FROM part_vehicle_compatibilities pvc
                    WHERE pvc.part_id = p.id AND pvc.model_id = vm.id
                )
            """);
        } catch (Exception e) {
            log.debug("Verificación Toyota Probox completada: {}", e.getMessage());
        }

        // Ensure system_mail_config relies strictly on Render MAIL_APP_PASSWORD env var and official sender
        try {
            jdbcTemplate.execute("""
                UPDATE system_mail_config
                SET username = 'luisoscarperez322@gmail.com',
                    password = NULL,
                    admin_notification_email = CASE
                        WHEN admin_notification_email IS NULL OR admin_notification_email = '' OR admin_notification_email = 'scrasher322@gmail.com'
                        THEN 'luisoscarperez322@gmail.com'
                        ELSE admin_notification_email
                    END,
                    enabled = TRUE
                WHERE id = 1
            """);
        } catch (Exception e) {
            log.debug("Verificación system_mail_config completada: {}", e.getMessage());
        }

        // Ensure part_promotions table exists for cloud-synced Offers & Automotive Combos
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS part_promotions (
                    sku VARCHAR(50) PRIMARY KEY,
                    part_id BIGINT,
                    part_name VARCHAR(200) NOT NULL,
                    category_name VARCHAR(120),
                    original_price NUMERIC(12,2) NOT NULL,
                    purchase_price NUMERIC(12,2) NOT NULL,
                    promo_price NUMERIC(12,2) NOT NULL,
                    discount_percentage INT NOT NULL,
                    badge_label VARCHAR(60) NOT NULL,
                    promo_type VARCHAR(30) NOT NULL,
                    combo_complement_sku VARCHAR(50),
                    combo_complement_name VARCHAR(200),
                    combo_complement_price NUMERIC(12,2),
                    combo_complement_promo_price NUMERIC(12,2),
                    combo_total_promo_price NUMERIC(12,2),
                    units_quota INT NOT NULL DEFAULT 8,
                    units_sold_in_promo INT NOT NULL DEFAULT 0,
                    active BOOLEAN NOT NULL DEFAULT TRUE,
                    start_date VARCHAR(30),
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """);
        } catch (Exception e) {
            log.debug("Verificación tabla part_promotions completada: {}", e.getMessage());
        }

        // Ensure driver_reviews table exists for persistent cross-device ratings
        try {
            jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS driver_reviews (
                    id BIGSERIAL PRIMARY KEY,
                    order_number VARCHAR(50) NOT NULL UNIQUE,
                    driver_name VARCHAR(150) NOT NULL,
                    driver_email VARCHAR(150),
                    customer_name VARCHAR(150) NOT NULL,
                    stars INTEGER NOT NULL,
                    tags TEXT,
                    customer_comment TEXT,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                )
            """);
            jdbcTemplate.execute("CREATE INDEX IF NOT EXISTS idx_driver_reviews_driver ON driver_reviews(driver_name)");
        } catch (Exception e) {
            log.debug("Verificación tabla driver_reviews completada: {}", e.getMessage());
        }
    }
}
