package com.asuncion.erp.config;

import com.asuncion.erp.domain.entity.Category;
import com.asuncion.erp.repository.CategoryRepository;
import com.asuncion.erp.service.CatalogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
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

    private final JdbcTemplate jdbcTemplate;
    private final CategoryRepository categoryRepository;

    public DatabaseSchemaPatcher(JdbcTemplate jdbcTemplate, CategoryRepository categoryRepository) {
        this.jdbcTemplate = jdbcTemplate;
        this.categoryRepository = categoryRepository;
    }

    @Override
    public void run(String... args) {
        // Ensure parts.oem_code and parts.warehouse_location accept NULL on pre-existing PostgreSQL tables
        try {
            jdbcTemplate.execute("ALTER TABLE parts ALTER COLUMN oem_code DROP NOT NULL");
        } catch (Exception e) {
            log.debug("Verificación nullable en parts.oem_code completada ({})", e.getMessage());
        }

        // Ensure orders table has payment status and reference columns if not present
        try {
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30) DEFAULT 'PENDIENTE'");
            jdbcTemplate.execute("ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(150)");
        } catch (Exception e) {
            log.debug("Columnas de pago en orders verificadas ({})", e.getMessage());
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
                SELECT p.id, vm.id, 2002, 2024, '1.3L 2NZ / 1.5L 1NZ-FE VVT-i', 'Compatible certificado para Toyota Probox'
                FROM parts p
                CROSS JOIN vehicle_models vm
                JOIN vehicle_makes mk ON mk.id = vm.make_id
                WHERE LOWER(mk.name) = 'toyota' AND LOWER(vm.name) = 'probox'
                AND (
                    LOWER(p.sku) IN ('asu-fil-001', 'asu-fil-003', 'asu-ele-001', 'asu-mot-002', 'asu-fil-005', 'asu-fre-001', 'asn-flt-0003', 'asn-frn-0001', 'asn-elc-0009', 'asn-mtr-0011')
                    OR LOWER(p.oem_code) IN ('90915-yzzd2', 'edge-5w30-4l', '90919-01253', '16100-09471', '04465-0k240')
                )
                AND NOT EXISTS (
                    SELECT 1 FROM part_vehicle_compatibilities pvc
                    WHERE pvc.part_id = p.id AND pvc.model_id = vm.id
                )
            """);
        } catch (Exception e) {
            log.debug("Verificación Toyota Probox completada: {}", e.getMessage());
        }
    }
}
