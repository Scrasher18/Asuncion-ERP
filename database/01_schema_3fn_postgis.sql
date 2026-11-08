-- =========================================================================================
-- PROYECTO: Sistema Empresarial ERP & E-Commerce "Repuestos Automotrices Asunción"
-- MOTOR DE BASE DE DATOS: PostgreSQL 16 + Extensión Espacial PostGIS 3.4
-- ARCHIVO: 01_schema_3fn_postgis.sql
-- DESCRIPCIÓN: Esquema relacional-geoespacial de grado productivo estrictamente
--              normalizado en Tercera Forma Normal (3FN), con índices espaciales GiST,
--              índices léxicos GIN (pg_trgm), funciones geodésicas y vistas analíticas.
-- =========================================================================================
--
-- JUSTIFICACIÓN FORMAL DE NORMALIZACIÓN (1FN, 2FN Y 3FN):
--
-- 1. Primera Forma Normal (1FN - Atomicidad y eliminación de grupos repetitivos):
--    - Todos los dominios de atributos son estrictamente atómicos e indivisibles.
--    - Se eliminaron arreglos y columnas repetitivas (`imagen_1`, `imagen_2`, `modelo_compatible_1`):
--      * Las múltiples imágenes por repuesto se desacoplan en la entidad `part_images`.
--      * La compatibilidad vehicular multivariable (N:M con rangos de años y motorización)
--        se modela en la tabla asociativa `part_vehicle_compatibilities`.
--      * La asignación múltiple de perfiles de seguridad se modela en `user_roles`.
--
-- 2. Segunda Forma Normal (2FN - Dependencia funcional completa respecto a la PK):
--    - Toda tabla posee una clave primaria simple (`id BIGSERIAL`) o compuesta (`user_roles`),
--      garantizando que ningún atributo no clave dependa parcialmente de un subconjunto de una
--      clave candidata compuesta.
--    - En `part_vehicle_compatibilities`, atributos específicos del vínculo como `year_start`,
--      `year_end`, `engine_spec` y `notes` dependen de la combinación completa del repuesto y
--      el modelo vehicular, nunca de uno solo de ellos.
--
-- 3. Tercera Forma Normal (3FN - Ausencia total de dependencias transitivas A -> B -> C):
--    - Separación `vehicle_makes` -> `vehicle_models`: La marca del fabricante vehicular
--      (Toyota, Hyundai, Kia) no reside dentro de `vehicle_models` ni dentro de `parts`,
--      eliminando anomalías de actualización y redundancia.
--    - Separación `categories` y `manufacturer_brands` -> `parts`: El país de origen de la
--      marca aftermarket (ej. Bosch -> Alemania, Denso -> Japón) depende exclusivamente de
--      `manufacturer_brands`, no del repuesto (`parts`).
--    - Desacoplamiento Multimedia Cloud-Ready (`part_images` y `delivery_proofs`):
--      Los binarios multimedia (WebP) se almacenan en Object Storage (AWS S3 / MinIO); la base
--      de datos persiste únicamente metadatos normalizados (`object_key`, `image_url`, `mime_type`).
--    - Integridad Contable vs. Métricas Derivadas:
--      * En `order_items` (`unit_purchase_cost`, `unit_sale_price`) y `orders` (`subtotal`,
--        `tax_amount`, `delivery_fee`, `total_amount`, `calculated_distance_meters`), los montos
--        representan instantáneas históricas inmutables (snapshots fiscales al momento `t` de la
--        transacción comercial), de modo que futuras variaciones en el catálogo (`parts.sale_price`)
--        o tarifas de sucursal (`branches.base_delivery_fee`) jamás corrompan comprobantes emitidos.
--      * Todas las métricas agregadas (ranking de vendedores, porcentaje de cumplimiento de cuota,
--        rotación de inventario, capital inmovilizado) no se almacenan redundantemente en tablas,
--        sino que se proyectan dinámicamente mediante las vistas analíticas `vw_salesperson_ranking`
--        y `vw_inventory_rotation`.
-- =========================================================================================

BEGIN;

-- 1. EXTENSIONES REQUERIDAS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. FUNCIÓN Y TRIGGERS DE AUDITORÍA TEMPORAL (updated_at)
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- =========================================================================================
-- MÓDULO 1: SEGURIDAD, IDENTIDAD, RBAC Y METAS COMERCIALES
-- =========================================================================================

-- Tabla 1: Catálogo maestro de roles granulares (RBAC)
CREATE TABLE IF NOT EXISTS roles (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(30) NOT NULL UNIQUE
                CONSTRAINT chk_roles_name
                CHECK (name IN ('ADMIN', 'VENDEDOR', 'ALMACENERO', 'MOTORIZADO', 'CLIENTE')),
    description VARCHAR(255) NOT NULL
);

COMMENT ON TABLE roles IS 'Catálogo normalizado de roles RBAC autorizados para JWT Stateless en Spring Security 6.';

-- Tabla 2: Usuarios del ecosistema (Empleados internos y Clientes B2C/B2B)
CREATE TABLE IF NOT EXISTS users (
    id              BIGSERIAL PRIMARY KEY,
    full_name       VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    phone           VARCHAR(30),
    document_type   VARCHAR(20)
                    CONSTRAINT chk_users_document_type
                    CHECK (document_type IS NULL OR document_type IN ('DNI', 'RUC', 'CE', 'PASAPORTE')),
    document_number VARCHAR(25),
    active          BOOLEAN NOT NULL DEFAULT TRUE,
    driver_status   VARCHAR(30) DEFAULT 'DISPONIBLE',
    employee_code   VARCHAR(30),
    license_number  VARCHAR(30),
    vehicle_plate   VARCHAR(20),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS 'Entidad maestra de usuarios (Administradores, Vendedores, Almaceneros, Motorizados y Clientes).';

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- Tabla 3: Asignación N:M entre Usuarios y Roles
CREATE TABLE IF NOT EXISTS user_roles (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id BIGINT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
    PRIMARY KEY (user_id, role_id)
);

COMMENT ON TABLE user_roles IS 'Tabla asociativa 3FN para asignación granular de múltiples roles por usuario.';

-- Tabla 4: Cuotas mensuales de venta asignadas a ejecutivos comerciales
CREATE TABLE IF NOT EXISTS sales_quotas (
    id             BIGSERIAL PRIMARY KEY,
    salesperson_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    period_year    SMALLINT NOT NULL
                   CONSTRAINT chk_sales_quotas_year CHECK (period_year BETWEEN 2020 AND 2100),
    period_month   SMALLINT NOT NULL
                   CONSTRAINT chk_sales_quotas_month CHECK (period_month BETWEEN 1 AND 12),
    target_amount  NUMERIC(12,2) NOT NULL
                   CONSTRAINT chk_sales_quotas_target_positive CHECK (target_amount > 0),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_salesperson_period UNIQUE (salesperson_id, period_year, period_month)
);

COMMENT ON TABLE sales_quotas IS 'Metas comerciales mensuales por vendedor para cálculo analítico de desempeño.';

-- =========================================================================================
-- MÓDULO 2: SUCURSALES Y PARÁMETROS GEOESPACIALES DE COBERTURA (POSTGIS)
-- =========================================================================================

-- Tabla 5: Sucursales con punto geodésico WGS84 (SRID 4326) y radio paramétrico en metros
CREATE TABLE IF NOT EXISTS branches (
    id                     BIGSERIAL PRIMARY KEY,
    code                   VARCHAR(20) NOT NULL UNIQUE,
    name                   VARCHAR(150) NOT NULL,
    address                VARCHAR(255) NOT NULL,
    phone                  VARCHAR(30),
    location               GEOGRAPHY(Point, 4326) NOT NULL,
    coverage_radius_meters NUMERIC(10,2) NOT NULL
                           CONSTRAINT chk_branches_radius_positive CHECK (coverage_radius_meters > 0),
    base_delivery_fee      NUMERIC(10,2) NOT NULL DEFAULT 0.00
                           CONSTRAINT chk_branches_base_fee_nonneg CHECK (base_delivery_fee >= 0),
    per_km_fee             NUMERIC(10,2) NOT NULL DEFAULT 0.00
                           CONSTRAINT chk_branches_km_fee_nonneg CHECK (per_km_fee >= 0),
    active                 BOOLEAN NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE branches IS 'Tiendas/almacenes de Repuestos Asunción con ubicación geodésica WGS84 y radio de despacho.';
COMMENT ON COLUMN branches.location IS 'Coordenada esferoidal WGS84 (SRID 4326) en orden POINT(longitud latitud).';

CREATE TRIGGER trg_branches_updated_at
BEFORE UPDATE ON branches
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- =========================================================================================
-- MÓDULO 3: CATÁLOGO AUTOMOTRIZ, TAXONOMÍA Y COMPATIBILIDAD MULTIVARIABLE (3FN)
-- =========================================================================================

-- Tabla 6: Categorías funcionales de autopartes
CREATE TABLE IF NOT EXISTS categories (
    id          BIGSERIAL PRIMARY KEY,
    code        VARCHAR(30) NOT NULL UNIQUE,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    active      BOOLEAN NOT NULL DEFAULT TRUE
);

COMMENT ON TABLE categories IS 'Clasificación técnica de sistemas automotrices (Frenos, Motor, Suspensión, Filtros, etc.).';

-- Tabla 7: Marcas fabricantes de repuestos OEM / Aftermarket (Normalización 3FN)
CREATE TABLE IF NOT EXISTS manufacturer_brands (
    id             BIGSERIAL PRIMARY KEY,
    name           VARCHAR(100) NOT NULL UNIQUE,
    country_origin VARCHAR(80)
);

COMMENT ON TABLE manufacturer_brands IS 'Fabricantes de autopartes (Bosch, Brembo, Denso, KYB, NGK, Gates) desacoplados en 3FN.';

-- Tabla 8: Marcas de vehículos (Normalización 3FN independiente de modelos)
CREATE TABLE IF NOT EXISTS vehicle_makes (
    id   BIGSERIAL PRIMARY KEY,
    name VARCHAR(80) NOT NULL UNIQUE
);

COMMENT ON TABLE vehicle_makes IS 'Marcas automotrices (Toyota, Hyundai, Kia, Nissan, Volkswagen, Chevrolet).';

-- Tabla 9: Modelos vehiculares vinculados a su marca fabricante
CREATE TABLE IF NOT EXISTS vehicle_models (
    id           BIGSERIAL PRIMARY KEY,
    make_id      BIGINT NOT NULL REFERENCES vehicle_makes(id) ON DELETE RESTRICT,
    name         VARCHAR(100) NOT NULL,
    vehicle_type VARCHAR(50) NOT NULL
                 CONSTRAINT chk_vehicle_models_type
                 CHECK (vehicle_type IN ('SEDAN', 'HATCHBACK', 'SUV', 'PICKUP', 'VAN', 'COMERCIAL', 'CROSSOVER')),
    CONSTRAINT uq_vehicle_make_model UNIQUE (make_id, name)
);

COMMENT ON TABLE vehicle_models IS 'Modelos vehiculares dependientes funcionalmente de vehicle_makes (elimina dependencia transitiva).';

-- Tabla 10: Maestro de Repuestos Automotrices
CREATE TABLE IF NOT EXISTS parts (
    id                    BIGSERIAL PRIMARY KEY,
    sku                   VARCHAR(50) NOT NULL UNIQUE,
    oem_code              VARCHAR(60),
    name                  VARCHAR(200) NOT NULL,
    technical_description TEXT,
    category_id           BIGINT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    manufacturer_brand_id BIGINT NOT NULL REFERENCES manufacturer_brands(id) ON DELETE RESTRICT,
    purchase_price        NUMERIC(12,2) NOT NULL
                          CONSTRAINT chk_parts_purchase_price_nonneg CHECK (purchase_price >= 0),
    sale_price            NUMERIC(12,2) NOT NULL
                          CONSTRAINT chk_parts_sale_ge_purchase CHECK (sale_price >= purchase_price),
    wholesale_price       NUMERIC(12,2) NOT NULL DEFAULT 0.00
                          CONSTRAINT chk_parts_wholesale_price_nonneg CHECK (wholesale_price >= 0),
    stock_quantity        INT NOT NULL DEFAULT 0
                          CONSTRAINT chk_parts_stock_nonneg CHECK (stock_quantity >= 0),
    min_stock_level       INT NOT NULL DEFAULT 5
                          CONSTRAINT chk_parts_min_stock_nonneg CHECK (min_stock_level >= 0),
    warehouse_location    VARCHAR(40),
    active                BOOLEAN NOT NULL DEFAULT TRUE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE parts IS 'Catálogo central ERP/E-commerce de repuestos con código OEM, SKU, control de márgenes y alertas de stock.';

CREATE TRIGGER trg_parts_updated_at
BEFORE UPDATE ON parts
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- Tabla 11: Galería multimedia desacoplada hacia Object Storage (AWS S3 / MinIO en formato WebP)
CREATE TABLE IF NOT EXISTS part_images (
    id              BIGSERIAL PRIMARY KEY,
    part_id         BIGINT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    object_key      VARCHAR(500) NOT NULL,
    image_url       VARCHAR(1000) NOT NULL,
    mime_type       VARCHAR(50) NOT NULL DEFAULT 'image/webp',
    file_size_bytes BIGINT
                    CONSTRAINT chk_part_images_size_nonneg CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0),
    is_primary      BOOLEAN NOT NULL DEFAULT FALSE,
    display_order   INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE part_images IS 'Referencias desacopladas a objetos multimedia optimizados (WebP) en buckets S3/MinIO.';

-- Índice Único Parcial: Garantiza atómicamente a lo sumo UNA imagen principal por repuesto
CREATE UNIQUE INDEX IF NOT EXISTS idx_part_single_primary_image
    ON part_images (part_id)
    WHERE is_primary = TRUE;

-- Tabla 12: Matriz N:M de Compatibilidad Vehicular Multivariable
CREATE TABLE IF NOT EXISTS part_vehicle_compatibilities (
    id          BIGSERIAL PRIMARY KEY,
    part_id     BIGINT NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
    model_id    BIGINT NOT NULL REFERENCES vehicle_models(id) ON DELETE RESTRICT,
    year_start  SMALLINT NOT NULL
                CONSTRAINT chk_compat_year_start CHECK (year_start BETWEEN 1950 AND 2100),
    year_end    SMALLINT NOT NULL
                CONSTRAINT chk_compat_year_end CHECK (year_end >= year_start AND year_end <= 2100),
    engine_spec VARCHAR(100),
    notes       VARCHAR(255),
    CONSTRAINT uq_part_vehicle_compatibility
        UNIQUE NULLS NOT DISTINCT (part_id, model_id, year_start, year_end, engine_spec)
);

COMMENT ON TABLE part_vehicle_compatibilities IS 'Relación N:M multivariable entre repuestos y modelos vehiculares por rango de años y motorización.';

-- =========================================================================================
-- MÓDULO 4: PEDIDOS, FLUJO LOGÍSTICO DE ALMACÉN Y DESPACHO GEORREFERENCIADO
-- =========================================================================================

-- Tabla 13: Cabecera transaccional de Pedidos E-Commerce / Mostrador
CREATE TABLE IF NOT EXISTS orders (
    id                         BIGSERIAL PRIMARY KEY,
    order_number               VARCHAR(30) NOT NULL UNIQUE,
    customer_id                BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    salesperson_id             BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    warehouse_operator_id      BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    driver_id                  BIGINT NULL REFERENCES users(id) ON DELETE SET NULL,
    branch_id                  BIGINT NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
    status                     VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE'
                               CONSTRAINT chk_orders_status
                               CHECK (status IN (
                                   'RESERVADO',
                                   'PENDIENTE',
                                   'CONFIRMADO',
                                   'EN_PREPARACION',
                                   'LISTO_PARA_DESPACHO',
                                   'EN_RUTA',
                                   'ENTREGADO',
                                   'CANCELADO'
                               )),
    delivery_type              VARCHAR(20) NOT NULL
                               CONSTRAINT chk_orders_delivery_type
                               CHECK (delivery_type IN ('DELIVERY', 'PICKUP')),
    delivery_address           TEXT,
    delivery_reference         VARCHAR(255),
    delivery_location          GEOGRAPHY(Point, 4326),
    calculated_distance_meters NUMERIC(10,2)
                               CONSTRAINT chk_orders_distance_nonneg
                               CHECK (calculated_distance_meters IS NULL OR calculated_distance_meters >= 0),
    invoice_type               VARCHAR(20)
                               CONSTRAINT chk_orders_invoice_type
                               CHECK (invoice_type IS NULL OR invoice_type IN ('BOLETA', 'FACTURA')),
    customer_tax_id            VARCHAR(20),
    customer_business_name     VARCHAR(200),
    recipient_name             VARCHAR(150),
    recipient_phone            VARCHAR(30),
    payment_method             VARCHAR(30),
    subtotal                   NUMERIC(12,2) NOT NULL
                               CONSTRAINT chk_orders_subtotal_nonneg CHECK (subtotal >= 0),
    tax_amount                 NUMERIC(12,2) NOT NULL
                               CONSTRAINT chk_orders_tax_nonneg CHECK (tax_amount >= 0),
    delivery_fee               NUMERIC(12,2) NOT NULL DEFAULT 0.00
                               CONSTRAINT chk_orders_delivery_fee_nonneg CHECK (delivery_fee >= 0),
    total_amount               NUMERIC(12,2) NOT NULL
                               CONSTRAINT chk_orders_total_nonneg CHECK (total_amount >= 0),
    warehouse_notes            TEXT,
    notes                      TEXT,
    created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE orders IS 'Cabecera de órdenes de venta con validación espacial de entrega y trazabilidad logística end-to-end.';

CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION fn_set_updated_at();

-- Tabla 14: Detalle de líneas de pedido con snapshot de costos/precios y control de picking
CREATE TABLE IF NOT EXISTS order_items (
    id                 BIGSERIAL PRIMARY KEY,
    order_id           BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    part_id            BIGINT NOT NULL REFERENCES parts(id) ON DELETE RESTRICT,
    quantity           INT NOT NULL
                       CONSTRAINT chk_order_items_qty_positive CHECK (quantity > 0),
    unit_purchase_cost NUMERIC(12,2) NOT NULL
                       CONSTRAINT chk_order_items_cost_nonneg CHECK (unit_purchase_cost >= 0),
    unit_sale_price    NUMERIC(12,2) NOT NULL
                       CONSTRAINT chk_order_items_price_nonneg CHECK (unit_sale_price >= 0),
    picked             BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE order_items IS 'Detalle transaccional de repuestos por pedido con precios históricos congelados y estado de picking.';

-- Tabla 15: Bitácora inmutable de transiciones de estado del pedido
CREATE TABLE IF NOT EXISTS order_status_history (
    id                 BIGSERIAL PRIMARY KEY,
    order_id           BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    previous_status    VARCHAR(30),
    new_status         VARCHAR(30) NOT NULL
                       CONSTRAINT chk_history_new_status
                       CHECK (new_status IN (
                           'RESERVADO',
                           'PENDIENTE',
                           'CONFIRMADO',
                           'EN_PREPARACION',
                           'LISTO_PARA_DESPACHO',
                           'EN_RUTA',
                           'ENTREGADO',
                           'CANCELADO'
                       )),
    changed_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    comment            TEXT,
    changed_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE order_status_history IS 'Auditoría cronológica de cambios de estado desde la creación hasta la entrega final.';

-- Tabla 16: Comprobante y evidencia georreferenciada de entrega (Proof of Delivery - Motorizado PWA)
CREATE TABLE IF NOT EXISTS delivery_proofs (
    id                  BIGSERIAL PRIMARY KEY,
    order_id            BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    driver_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    evidence_object_key VARCHAR(500),
    evidence_image_url  VARCHAR(1000),
    receiver_name       VARCHAR(150) NOT NULL,
    receiver_document   VARCHAR(30),
    captured_location   GEOGRAPHY(Point, 4326),
    delivery_notes      TEXT,
    delivered_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE delivery_proofs IS 'Evidencia fotográfica WebP en S3/MinIO y coordenada GPS real capturada al entregar el pedido.';

-- =========================================================================================
-- MÓDULO 5: ÍNDICES ESPACIALES GiST E ÍNDICES DE ALTO RENDIMIENTO (B-TREE / GIN TRIGRAM)
-- =========================================================================================

-- Índices Espaciales GiST (Generalized Search Tree) para búsquedas O(log N) con ST_DWithin
CREATE INDEX IF NOT EXISTS idx_branches_location_gist
    ON branches USING GIST (location);

CREATE INDEX IF NOT EXISTS idx_orders_delivery_location_gist
    ON orders USING GIST (delivery_location);

CREATE INDEX IF NOT EXISTS idx_delivery_proofs_location_gist
    ON delivery_proofs USING GIST (captured_location);

-- Índices B-Tree y Trigram (GIN) para buscador predictivo del catálogo automotriz
CREATE INDEX IF NOT EXISTS idx_parts_oem_code
    ON parts (oem_code);

CREATE INDEX IF NOT EXISTS idx_parts_oem_code_trgm
    ON parts USING GIN (oem_code gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parts_sku_trgm
    ON parts USING GIN (sku gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parts_name_trgm
    ON parts USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_parts_category_brand
    ON parts (category_id, manufacturer_brand_id)
    WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_part_images_part_order
    ON part_images (part_id, display_order);

-- Índices compuestos para filtrado instantáneo por Marca + Modelo + Año del vehículo
CREATE INDEX IF NOT EXISTS idx_compat_model_years
    ON part_vehicle_compatibilities (model_id, year_start, year_end);

CREATE INDEX IF NOT EXISTS idx_compat_part_id
    ON part_vehicle_compatibilities (part_id);

-- Índices operativos para tableros logísticos (Almacén, Motorizado) y analítica comercial
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
    ON orders (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created_at
    ON orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_salesperson_created_at
    ON orders (salesperson_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_driver_status
    ON orders (driver_id, status);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id
    ON order_items (order_id);

CREATE INDEX IF NOT EXISTS idx_order_items_part_id
    ON order_items (part_id);

-- =========================================================================================
-- MÓDULO 6: FUNCIÓN ALMACENADA DE VALIDACIÓN GEOESPACIAL ESTRICTA (POSTGIS)
-- =========================================================================================

CREATE OR REPLACE FUNCTION fn_validate_delivery_coverage(
    p_lat       DOUBLE PRECISION,
    p_lng       DOUBLE PRECISION,
    p_branch_id BIGINT DEFAULT NULL
)
RETURNS TABLE (
    branch_id             BIGINT,
    branch_name           VARCHAR(150),
    is_covered            BOOLEAN,
    distance_meters       NUMERIC(10,2),
    allowed_radius_meters NUMERIC(10,2),
    estimated_fee         NUMERIC(10,2)
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_point GEOGRAPHY(Point, 4326);
BEGIN
    -- Validación defensiva de límites geodésicos WGS84
    IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
        RAISE EXCEPTION 'Coordenadas WGS84 fuera de rango válido: lat=%, lng=%', p_lat, p_lng
            USING ERRCODE = '22023';
    END IF;

    -- IMPORTANTE: PostGIS construye puntos en orden cartesiano (X = Longitud, Y = Latitud)
    v_point := ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography;

    RETURN QUERY
    SELECT
        b.id AS branch_id,
        b.name AS branch_name,
        ST_DWithin(b.location, v_point, b.coverage_radius_meters::DOUBLE PRECISION) AS is_covered,
        ROUND(ST_Distance(b.location, v_point)::NUMERIC, 2) AS distance_meters,
        b.coverage_radius_meters AS allowed_radius_meters,
        ROUND(
            (b.base_delivery_fee + (ST_Distance(b.location, v_point) / 1000.0) * b.per_km_fee)::NUMERIC,
            2
        ) AS estimated_fee
    FROM branches b
    WHERE b.active = TRUE
      AND (p_branch_id IS NULL OR b.id = p_branch_id)
    ORDER BY
        ST_DWithin(b.location, v_point, b.coverage_radius_meters::DOUBLE PRECISION) DESC,
        ST_Distance(b.location, v_point) ASC;
END;
$$;

COMMENT ON FUNCTION fn_validate_delivery_coverage(DOUBLE PRECISION, DOUBLE PRECISION, BIGINT)
IS 'Evalúa cobertura geodésica exacta sobre el elipsoide WGS84 usando ST_DWithin (acelerado con índice GiST) y calcula tarifa estimada de envío.';

-- =========================================================================================
-- MÓDULO 7: VISTAS ANALÍTICAS EJECUTIVAS (DASHBOARD ERP)
-- =========================================================================================

-- Vista 1: Ranking Dinámico de Vendedores con Cumplimiento de Cuotas y DENSE_RANK()
CREATE OR REPLACE VIEW vw_salesperson_ranking AS
WITH current_period AS (
    SELECT
        EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT AS yr,
        EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT AS mo
),
sales_summary AS (
    SELECT
        u.id AS salesperson_id,
        u.full_name AS salesperson_name,
        u.email AS salesperson_email,
        cp.yr AS period_year,
        cp.mo AS period_month,
        COUNT(o.id) AS closed_transactions,
        COALESCE(SUM(o.total_amount), 0.00)::NUMERIC(12,2) AS total_sales_volume,
        COALESCE(sq.target_amount, 0.00)::NUMERIC(12,2) AS quota_target
    FROM users u
    INNER JOIN user_roles ur ON ur.user_id = u.id
    INNER JOIN roles r ON r.id = ur.role_id AND r.name = 'VENDEDOR'
    CROSS JOIN current_period cp
    LEFT JOIN sales_quotas sq
        ON sq.salesperson_id = u.id
       AND sq.period_year = cp.yr
       AND sq.period_month = cp.mo
    LEFT JOIN orders o
        ON o.salesperson_id = u.id
       AND o.status NOT IN ('CANCELADO', 'PENDIENTE')
       AND EXTRACT(YEAR FROM o.created_at)::SMALLINT = cp.yr
       AND EXTRACT(MONTH FROM o.created_at)::SMALLINT = cp.mo
    WHERE u.active = TRUE
    GROUP BY u.id, u.full_name, u.email, cp.yr, cp.mo, sq.target_amount
)
SELECT
    DENSE_RANK() OVER (ORDER BY s.total_sales_volume DESC, s.closed_transactions DESC) AS ranking_position,
    s.salesperson_id,
    s.salesperson_name,
    s.salesperson_email,
    s.period_year,
    s.period_month,
    s.closed_transactions,
    s.total_sales_volume,
    s.quota_target,
    CASE
        WHEN s.quota_target > 0 THEN ROUND((s.total_sales_volume / s.quota_target) * 100.0, 2)
        ELSE 0.00
    END AS achievement_percentage
FROM sales_summary s
ORDER BY ranking_position ASC, s.salesperson_name ASC;

COMMENT ON VIEW vw_salesperson_ranking
IS 'Ranking ejecutivo dinámico de vendedores según volumen de ventas, operaciones cerradas y porcentaje de meta alcanzada.';

-- Vista 2: Analítica de Rotación de Inventario y Capital Inmovilizado
CREATE OR REPLACE VIEW vw_inventory_rotation AS
WITH part_sales AS (
    SELECT
        p.id AS part_id,
        p.sku,
        p.oem_code,
        p.name AS part_name,
        c.name AS category_name,
        mb.name AS manufacturer_brand,
        p.stock_quantity,
        p.min_stock_level,
        p.purchase_price,
        p.sale_price,
        COALESCE(SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity ELSE 0 END), 0)::BIGINT AS units_sold,
        COUNT(DISTINCT o.id)::BIGINT AS orders_count,
        COALESCE(
            SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * oi.unit_sale_price ELSE 0 END),
            0.00
        )::NUMERIC(12,2) AS total_revenue,
        COALESCE(
            SUM(CASE WHEN o.id IS NOT NULL THEN oi.quantity * (oi.unit_sale_price - oi.unit_purchase_cost) ELSE 0 END),
            0.00
        )::NUMERIC(12,2) AS gross_profit,
        MAX(o.created_at) AS last_sale_at
    FROM parts p
    INNER JOIN categories c ON c.id = p.category_id
    INNER JOIN manufacturer_brands mb ON mb.id = p.manufacturer_brand_id
    LEFT JOIN order_items oi ON oi.part_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'CANCELADO'
    WHERE p.active = TRUE
    GROUP BY
        p.id, p.sku, p.oem_code, p.name, c.name, mb.name,
        p.stock_quantity, p.min_stock_level, p.purchase_price, p.sale_price
)
SELECT
    ps.part_id,
    ps.sku,
    ps.oem_code,
    ps.part_name,
    ps.category_name,
    ps.manufacturer_brand,
    ps.stock_quantity,
    ps.min_stock_level,
    (ps.stock_quantity <= ps.min_stock_level) AS low_stock_alert,
    ps.units_sold,
    ps.orders_count,
    ps.total_revenue,
    ps.gross_profit,
    ROUND((ps.stock_quantity * ps.purchase_price)::NUMERIC, 2) AS immobilized_capital,
    ps.last_sale_at,
    CASE
        WHEN ps.last_sale_at IS NOT NULL THEN EXTRACT(DAY FROM (NOW() - ps.last_sale_at))::INT
        ELSE NULL
    END AS days_since_last_sale,
    CASE
        WHEN ps.units_sold >= 10 THEN 'ALTA_ROTACION'
        WHEN ps.units_sold BETWEEN 4 AND 9 THEN 'ROTACION_MEDIA'
        WHEN ps.units_sold BETWEEN 1 AND 3 THEN 'BAJA_ROTACION'
        ELSE 'ESTANCADO_SIN_MOVIMIENTO'
    END AS rotation_classification
FROM part_sales ps
ORDER BY ps.units_sold DESC, immobilized_capital DESC;

COMMENT ON VIEW vw_inventory_rotation
IS 'Reporte analítico de rotación de repuestos (alta rotación vs. inventario estancado), utilidad bruta y capital inmovilizado.';

COMMIT;
