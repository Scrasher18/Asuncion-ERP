-- =========================================================================================
-- PROYECTO: Sistema Empresarial ERP & E-Commerce "Repuestos Automotrices Asunción"
-- ARCHIVO: 02_seed_asuncion.sql
-- DESCRIPCIÓN: Datos semilla realistas para el mercado automotriz peruano/latinoamericano.
--              Totalmente compatible con 01_schema_3fn_postgis.sql (PostgreSQL 16 + PostGIS 3.4).
--              Nota: El hash BCrypt de demostración corresponde a la clave 'password'.
-- =========================================================================================

BEGIN;

-- 1. ROLES RBAC
INSERT INTO roles (name, description) VALUES
    ('ADMIN',       'Administrador General ERP: acceso total a catálogo, precios, sucursales, usuarios y analítica ejecutiva.'),
    ('VENDEDOR',    'Ejecutivo Comercial: gestión de cotizaciones, pedidos B2C/B2B, atención a clientes y seguimiento de cuotas.'),
    ('ALMACENERO',  'Operario de Almacén: control de picking físico, embalaje y transición de pedidos a LISTO_PARA_DESPACHO.'),
    ('MOTORIZADO',  'Repartidor Logístico (PWA): navegación GPS de entregas, captura de evidencia WebP y cierre en ENTREGADO.'),
    ('CLIENTE',     'Comprador B2C / Flota B2B: navegación de catálogo compatible, checkout geoespacial y consulta de pedidos.')
ON CONFLICT (name) DO NOTHING;

-- 2. USUARIOS DEMO (Contraseña BCrypt estándar Spring Security: 'password')
INSERT INTO users (full_name, email, password_hash, phone, document_type, document_number, active) VALUES
    ('Carlos Mendoza Asunción',         'admin@asuncion.pe',               '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 999112233', 'DNI', '42851930', TRUE),
    ('Lucía Paredes Quispe',            'vendedor1@asuncion.pe',           '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 987441122', 'DNI', '46192045', TRUE),
    ('Diego Salazar Huamán',            'vendedor2@asuncion.pe',           '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 986332211', 'DNI', '47920318', TRUE),
    ('Valeria Ríos Cáceres',            'vendedor3@asuncion.pe',           '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 984550192', 'DNI', '71204958', TRUE),
    ('Jorge Chávez Rojas',              'almacen@asuncion.pe',             '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 991220344', 'DNI', '43819204', TRUE),
    ('Miguel Ángel Flores',             'motorizado@asuncion.pe',          '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 993887766', 'DNI', '70491823', TRUE),
    ('Roberto Vargas Sánchez',          'cliente@asuncion.pe',             '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 995601234', 'DNI', '45109283', TRUE),
    ('Automotriz Los Andes S.A.C.',     'compras@tallereslosandes.pe',     '$2a$10$dXJ3SW6G7P50lGmMkkmwe.20cQQubK3.HZWzG3YB1tlRy.fqvM/BG', '+51 998712345', 'RUC', '20608451239', TRUE)
ON CONFLICT (email) DO NOTHING;

-- 3. VINCULACIÓN USUARIOS <-> ROLES
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'ADMIN' WHERE u.email = 'admin@asuncion.pe'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'VENDEDOR' WHERE u.email IN ('vendedor1@asuncion.pe', 'vendedor2@asuncion.pe', 'vendedor3@asuncion.pe')
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'ALMACENERO' WHERE u.email = 'almacen@asuncion.pe'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'MOTORIZADO' WHERE u.email = 'motorizado@asuncion.pe'
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u JOIN roles r ON r.name = 'CLIENTE' WHERE u.email IN ('cliente@asuncion.pe', 'compras@tallereslosandes.pe')
ON CONFLICT DO NOTHING;

-- 4. CUOTAS MENSUALES DE VENTA (Periodo actual dinámico para analítica inmediata en dashboard)
INSERT INTO sales_quotas (salesperson_id, period_year, period_month, target_amount)
SELECT u.id, EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT, 15000.00
FROM users u WHERE u.email = 'vendedor1@asuncion.pe'
ON CONFLICT (salesperson_id, period_year, period_month) DO NOTHING;

INSERT INTO sales_quotas (salesperson_id, period_year, period_month, target_amount)
SELECT u.id, EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT, 12000.00
FROM users u WHERE u.email = 'vendedor2@asuncion.pe'
ON CONFLICT (salesperson_id, period_year, period_month) DO NOTHING;

INSERT INTO sales_quotas (salesperson_id, period_year, period_month, target_amount)
SELECT u.id, EXTRACT(YEAR FROM CURRENT_DATE)::SMALLINT, EXTRACT(MONTH FROM CURRENT_DATE)::SMALLINT, 10000.00
FROM users u WHERE u.email = 'vendedor3@asuncion.pe'
ON CONFLICT (salesperson_id, period_year, period_month) DO NOTHING;

-- 5. SUCURSALES CON COORDENADAS ESFEROIDALES WGS84 (POINT(Longitud Latitud))
INSERT INTO branches (code, name, address, phone, location, coverage_radius_meters, base_delivery_fee, per_km_fee, active) VALUES
    (
        'SUC-LAVICTORIA',
        'Repuestos Asunción - Sede Central La Victoria',
        'Av. Iquitos 845, La Victoria, Lima',
        '(01) 423-8910',
        ST_GeogFromText('SRID=4326;POINT(-77.0182 -12.0685)'),
        8500.00,
        10.00,
        1.80,
        TRUE
    ),
    (
        'SUC-SURQUILLO',
        'Repuestos Asunción - Sucursal Surquillo',
        'Av. Tomás Marsano 1420, Surquillo, Lima',
        '(01) 445-6720',
        ST_GeogFromText('SRID=4326;POINT(-77.0124 -12.1136)'),
        7000.00,
        12.00,
        2.00,
        TRUE
    )
ON CONFLICT (code) DO NOTHING;

-- 6. CATEGORÍAS AUTOMOTRICES
INSERT INTO categories (code, name, description, active) VALUES
    ('CAT-FRENOS',  'Sistema de Frenos',              'Pastillas cerámicas, discos ventilados, zapatas y componentes hidráulicos ABS.', TRUE),
    ('CAT-MOTOR',   'Motor y Distribución',           'Kits de faja/cadena de distribución, tensores, empaquetaduras y tren alternativo.', TRUE),
    ('CAT-SUSP',    'Suspensión y Dirección',         'Amortiguadores presurizados a gas, trapecios, rótulas y terminales de dirección.', TRUE),
    ('CAT-FILTROS', 'Filtros y Lubricación',          'Filtros de aceite, aire de motor, combustible diésel Common-Rail y cabina.', TRUE),
    ('CAT-ELEC',    'Encendido y Sistema Eléctrico',  'Bujías de iridio/platino, bobinas de encendido, sensores y bombas eléctricas.', TRUE),
    ('CAT-REFRIG',  'Refrigeración y Climatización',  'Bombas de agua, termostatos, radiadores y electroventiladores.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 7. MARCAS FABRICANTES DE REPUESTOS (3FN)
INSERT INTO manufacturer_brands (name, country_origin) VALUES
    ('Bosch',   'Alemania'),
    ('Brembo',  'Italia'),
    ('Denso',   'Japón'),
    ('KYB',     'Japón'),
    ('NGK',     'Japón'),
    ('Gates',   'Estados Unidos')
ON CONFLICT (name) DO NOTHING;

-- 8. MARCAS DE VEHÍCULOS (3FN)
INSERT INTO vehicle_makes (name) VALUES
    ('Toyota'),
    ('Hyundai'),
    ('Kia'),
    ('Nissan'),
    ('Volkswagen'),
    ('Chevrolet')
ON CONFLICT (name) DO NOTHING;

-- 9. MODELOS DE VEHÍCULOS (3FN)
INSERT INTO vehicle_models (make_id, name, vehicle_type) VALUES
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Hilux',    'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Corolla',  'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Yaris',    'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'RAV4',     'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Tucson',   'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Accent',   'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Elantra',  'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'Rio',      'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'Sportage', 'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Frontier', 'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Sentra',   'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Volkswagen'), 'Amarok',   'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Volkswagen'), 'Gol',      'HATCHBACK'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Chevrolet'),  'Onix',     'SEDAN')
ON CONFLICT (make_id, name) DO NOTHING;

-- 10. CATÁLOGO DE REPUESTOS AUTOMOTRICES (12 Ítems con códigos OEM reales)
INSERT INTO parts (
    sku, oem_code, name, technical_description,
    category_id, manufacturer_brand_id,
    purchase_price, sale_price, wholesale_price,
    stock_quantity, min_stock_level, warehouse_location, active
) VALUES
    (
        'ASU-FRE-001', '04465-0K240',
        'Juego de Pastillas de Freno Delanteras Cerámicas Brembo',
        'Compuesto cerámico NAO de baja emisión de polvo y chaflán acústico antirruido para camionetas pick-up de trabajo pesado.',
        (SELECT id FROM categories WHERE code = 'CAT-FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Brembo'),
        145.00, 235.00, 205.00, 38, 10, 'PAS-A1-N2', TRUE
    ),
    (
        'ASU-FRE-002', '43512-0K060',
        'Disco de Freno Ventilado Delantero 297mm Brembo UV Coated',
        'Disco ventilado en fundición de alto carbono con recubrimiento anticorrosivo UV; diámetro exterior 297 mm, 6 pernos.',
        (SELECT id FROM categories WHERE code = 'CAT-FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Brembo'),
        190.00, 310.00, 275.00, 22, 8, 'PAS-A1-N4', TRUE
    ),
    (
        'ASU-FIL-001', '90915-YZZD2',
        'Filtro de Aceite Blindado de Alto Flujo Denso First Time Fit',
        'Válvula antidrenaje de silicona térmica y sello tórico prelubricado; eficiencia de retención de 20 micras al 99%.',
        (SELECT id FROM categories WHERE code = 'CAT-FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Denso'),
        22.00, 42.00, 35.00, 95, 25, 'PAS-B2-N1', TRUE
    ),
    (
        'ASU-FIL-002', '17801-0L040',
        'Filtro de Aire de Motor Microfibra Sintética Bosch',
        'Elemento filtrante plisado impregnado en resina fenólica resistente a humedad y polvo fino para motores turbodiésel.',
        (SELECT id FROM categories WHERE code = 'CAT-FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        38.00, 68.00, 58.00, 48, 15, 'PAS-B2-N3', TRUE
    ),
    (
        'ASU-ELE-001', '90919-01253',
        'Pack x4 Bujías Laser Iridium NGK ILKAR7B11',
        'Electrodo central de iridio soldado por láser (0.6 mm) y electrodo de masa con disco de platino; vida útil 100,000 km.',
        (SELECT id FROM categories WHERE code = 'CAT-ELEC'),
        (SELECT id FROM manufacturer_brands WHERE name = 'NGK'),
        115.00, 189.00, 165.00, 30, 10, 'PAS-C1-N1', TRUE
    ),
    (
        'ASU-ELE-002', '27301-2B010',
        'Bobina de Encendido Independiente Tipo Lápiz Bosch',
        'Bobina de ignición directa de alta energía (32 kV) con aislamiento epóxico térmico para motores 1.4L / 1.6L MPI.',
        (SELECT id FROM categories WHERE code = 'CAT-ELEC'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        98.00, 162.00, 142.00, 4, 6, 'PAS-C1-N3', TRUE
    ),
    (
        'ASU-SUS-001', '48510-09W90',
        'Amortiguador Delantero Monotubo Gas-A-Just KYB',
        'Amortiguador de nitrógeno a alta presión con pistón flotante que elimina la cavitación en rutas afirmadas y carga severa.',
        (SELECT id FROM categories WHERE code = 'CAT-SUSP'),
        (SELECT id FROM manufacturer_brands WHERE name = 'KYB'),
        210.00, 345.00, 305.00, 16, 6, 'PAS-D3-N1', TRUE
    ),
    (
        'ASU-SUS-002', '54651-3S010',
        'Amortiguador Delantero McPherson Excel-G KYB',
        'Estructura bitubo presurizada con vástago cromado duro y válvula calibrada para restablecer la estabilidad original.',
        (SELECT id FROM categories WHERE code = 'CAT-SUSP'),
        (SELECT id FROM manufacturer_brands WHERE name = 'KYB'),
        185.00, 298.00, 265.00, 14, 6, 'PAS-D3-N2', TRUE
    ),
    (
        'ASU-MOT-001', '13568-09131',
        'Kit de Faja de Distribución PowerGrip HNBR Gates',
        'Correa sincrónica en elastómero HNBR con cuerdas de fibra de vidrio y polea tensora hidráulica de equipo original.',
        (SELECT id FROM categories WHERE code = 'CAT-MOTOR'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Gates'),
        260.00, 420.00, 375.00, 12, 5, 'PAS-E1-N2', TRUE
    ),
    (
        'ASU-REF-001', '16100-09471',
        'Bomba de Agua Centrífuga de Aluminio Gates',
        'Impulsor balanceado dinámicamente, sello mecánico de carburo de silicio y empaquetadura metálica incluida.',
        (SELECT id FROM categories WHERE code = 'CAT-REFRIG'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Gates'),
        155.00, 255.00, 225.00, 5, 5, 'PAS-E2-N1', TRUE
    ),
    (
        'ASU-ELE-003', '23220-0C050',
        'Módulo Bomba Eléctrica de Combustible Sumergible Denso',
        'Turbina silenciosa de flujo constante (4.2 bar) con prefiltro malla de nylon incluido.',
        (SELECT id FROM categories WHERE code = 'CAT-ELEC'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Denso'),
        240.00, 390.00, 345.00, 11, 4, 'PAS-C2-N4', TRUE
    ),
    (
        'ASU-FRE-003', '58101-1RA00',
        'Juego de Pastillas de Freno Delanteras QuietCast Bosch',
        'Fórmula semimetálica libre de cobre con lámina amortiguadora multicapa moldeada de fábrica.',
        (SELECT id FROM categories WHERE code = 'CAT-FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        85.00, 145.00, 125.00, 24, 8, 'PAS-A2-N1', TRUE
    )
ON CONFLICT (sku) DO NOTHING;

-- 11. METADATOS MULTIMEDIA WEBP EN OBJECT STORAGE (S3 / MinIO)
INSERT INTO part_images (part_id, object_key, image_url, mime_type, file_size_bytes, is_primary, display_order)
SELECT p.id,
       'parts/' || LOWER(p.sku) || '/main.webp',
       '/uploads/parts/' || LOWER(p.sku) || '.webp',
       'image/webp',
       68420,
       TRUE,
       1
FROM parts p
WHERE NOT EXISTS (
    SELECT 1 FROM part_images pi WHERE pi.part_id = p.id AND pi.is_primary = TRUE
);

INSERT INTO part_images (part_id, object_key, image_url, mime_type, file_size_bytes, is_primary, display_order)
SELECT p.id,
       'parts/' || LOWER(p.sku) || '/detail-angle.webp',
       '/uploads/parts/' || LOWER(p.sku) || '.webp',
       'image/webp',
       54110,
       FALSE,
       2
FROM parts p
WHERE p.sku IN ('ASU-FRE-001', 'ASU-FRE-002', 'ASU-SUS-001', 'ASU-MOT-001')
  AND NOT EXISTS (
      SELECT 1 FROM part_images pi WHERE pi.part_id = p.id AND pi.display_order = 2
  );

-- 12. MATRIZ DE COMPATIBILIDAD VEHICULAR MULTIVARIABLE (N:M)
INSERT INTO part_vehicle_compatibilities (part_id, model_id, year_start, year_end, engine_spec, notes) VALUES
    -- ASU-FRE-001 (Pastillas Brembo Hilux / Amarok / Frontier)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FRE-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'),
        2016, 2025, '2.8L 1GD-FTV / 2.4L 2GD-FTV Turbo Diesel', 'Aplica versiones 4x4 SR, SRV y SRX.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FRE-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Frontier'),
        2017, 2024, '2.5L YD25DDTi Diesel', 'Sistema cálipers de doble pistón.'
    ),
    -- ASU-FRE-002 (Disco Brembo Hilux)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FRE-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'),
        2016, 2025, '2.8L 1GD-FTV Turbo Diesel', 'Se recomienda reemplazo por par de eje delantero.'
    ),
    -- ASU-FIL-001 (Filtro Aceite Denso)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FIL-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'),
        2015, 2025, '2.4L / 2.8L GD Series', 'Cambio cada 5,000 - 7,500 km.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FIL-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'RAV4'),
        2014, 2022, '2.0L 3ZR-FE / 2.5L 2AR-FE', 'Rosca 3/4-16 UNF.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FIL-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Volkswagen' AND vm.name = 'Amarok'),
        2016, 2023, '2.0L BiTDI', 'Compatible con carcasa metálica estándar.'
    ),
    -- ASU-FIL-002 (Filtro Aire Bosch)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FIL-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'),
        2016, 2025, '2.4L / 2.8L Turbo Diesel', 'Con prefiltro para zonas mineras y polvo severo.'
    ),
    -- ASU-ELE-001 (Bujías NGK Iridium)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'),
        2014, 2024, '1.8L 2ZR-FE Dual VVT-i', 'Juego completo de 4 unidades.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'),
        2016, 2024, '1.5L 2NR-FE Dual VVT-i', 'Calibración de fábrica 1.1 mm.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Sentra'),
        2015, 2023, '1.8L MRA8DE / 2.0L MR20DD', 'Alto rendimiento en GLP/GNV y gasolina.'
    ),
    -- ASU-ELE-002 (Bobina Bosch Hyundai / Kia)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'),
        2012, 2023, '1.4L Kappa / 1.6L Gamma MPI', 'Conector de 2 pines.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'),
        2012, 2023, '1.4L / 1.6L MPI', 'Reemplazo directo OEM.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Elantra'),
        2013, 2021, '1.6L Gamma', 'Soporta conversión bicombustible.'
    ),
    -- ASU-SUS-001 (Amortiguador KYB Hilux)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-SUS-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'),
        2016, 2025, '2.4L / 2.8L 4x4', 'Eje delantero ambos lados.'
    ),
    -- ASU-SUS-002 (Amortiguador KYB Tucson / Sportage)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-SUS-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Tucson'),
        2016, 2022, '2.0L Nu MPI', 'Posición delantera izquierda.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-SUS-002'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Sportage'),
        2016, 2022, '2.0L MPI', 'Suspensión independiente McPherson.'
    ),
    -- ASU-MOT-001 (Kit Distribución Gates)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-MOT-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Volkswagen' AND vm.name = 'Gol'),
        2014, 2022, '1.6L MSI 8V', 'Incluye correa reforzada y rodillo tensor.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-MOT-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Chevrolet' AND vm.name = 'Onix'),
        2017, 2023, '1.4L SPE/4', 'Intervalo recomendado 60,000 km.'
    ),
    -- ASU-REF-001 (Bomba de Agua Gates)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-REF-001'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'),
        2014, 2022, '1.8L 2ZR-FE', 'Incluye junta metálica vulcanizada.'
    ),
    -- ASU-ELE-003 (Bomba Combustible Denso)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-ELE-003'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'),
        2015, 2023, '1.3L 1NR-FE / 1.5L 2NR-FE', 'Módulo sumergible en tanque.'
    ),
    -- ASU-FRE-003 (Pastillas Bosch Accent / Rio)
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FRE-003'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'),
        2013, 2023, '1.4L / 1.6L', 'Incluye seguros antirruido en acero inoxidable.'
    ),
    (
        (SELECT id FROM parts WHERE sku = 'ASU-FRE-003'),
        (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'),
        2013, 2023, '1.4L / 1.6L', 'Disco delantero ventilado 256 mm.'
    )
ON CONFLICT (part_id, model_id, year_start, year_end, engine_spec) DO NOTHING;

-- 13. PEDIDOS TRANSACCIONALES DEMO (Cobertura validada en Lima + Estados Logísticos)

-- Pedido 1: ENTREGADO (B2B Factura - San Isidro, a ~3.15 km de Sede La Victoria)
INSERT INTO orders (
    order_number, customer_id, salesperson_id, warehouse_operator_id, driver_id, branch_id,
    status, delivery_type, delivery_address, delivery_reference, delivery_location,
    calculated_distance_meters, invoice_type, customer_tax_id, customer_business_name,
    recipient_name, recipient_phone, payment_method,
    subtotal, tax_amount, delivery_fee, total_amount, warehouse_notes, notes, created_at
) VALUES (
    'ORD-2026-0001',
    (SELECT id FROM users WHERE email = 'compras@tallereslosandes.pe'),
    (SELECT id FROM users WHERE email = 'vendedor1@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'almacen@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'motorizado@asuncion.pe'),
    (SELECT id FROM branches WHERE code = 'SUC-LAVICTORIA'),
    'ENTREGADO', 'DELIVERY',
    'Av. Javier Prado Este 1140, San Isidro, Lima',
    'Frente a bahía de recepción del taller mecánico corporativo',
    ST_GeogFromText('SRID=4326;POINT(-77.0195 -12.0905)'),
    2435.60, 'FACTURA', '20608451239', 'Automotriz Los Andes S.A.C.',
    'Ing. Marco Antonio Vera', '+51 998712345', 'TRANSFERENCIA_BANCARIA',
    2186.44, 393.56, 14.38, 2594.38,
    'Embalaje reforzado con zuncho plástico para discos y pastillas Brembo.',
    'Flota minera Toyota Hilux - Despacho prioritario mañana.',
    NOW() - INTERVAL '4 days'
) ON CONFLICT (order_number) DO NOTHING;

-- Pedido 2: ENTREGADO (B2C Boleta - Miraflores, a ~2.10 km de Sucursal Surquillo)
INSERT INTO orders (
    order_number, customer_id, salesperson_id, warehouse_operator_id, driver_id, branch_id,
    status, delivery_type, delivery_address, delivery_reference, delivery_location,
    calculated_distance_meters, invoice_type, customer_tax_id, customer_business_name,
    recipient_name, recipient_phone, payment_method,
    subtotal, tax_amount, delivery_fee, total_amount, warehouse_notes, notes, created_at
) VALUES (
    'ORD-2026-0002',
    (SELECT id FROM users WHERE email = 'cliente@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'vendedor2@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'almacen@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'motorizado@asuncion.pe'),
    (SELECT id FROM branches WHERE code = 'SUC-SURQUILLO'),
    'ENTREGADO', 'DELIVERY',
    'Av. Benavides 1950, Miraflores, Lima',
    'Recepción edificio empresarial piso 1',
    ST_GeogFromText('SRID=4326;POINT(-77.0188 -12.1268)'),
    1625.40, 'BOLETA', '45109283', NULL,
    'Roberto Vargas Sánchez', '+51 995601234', 'TARJETA_CREDITO',
    658.47, 118.53, 15.25, 792.25,
    'Picking verificado al 100%.',
    'Llamar 5 minutos antes de llegar.',
    NOW() - INTERVAL '2 days'
) ON CONFLICT (order_number) DO NOTHING;

-- Pedido 3: EN_RUTA (Asignado a Motorizado - San Borja)
INSERT INTO orders (
    order_number, customer_id, salesperson_id, warehouse_operator_id, driver_id, branch_id,
    status, delivery_type, delivery_address, delivery_reference, delivery_location,
    calculated_distance_meters, invoice_type, customer_tax_id, customer_business_name,
    recipient_name, recipient_phone, payment_method,
    subtotal, tax_amount, delivery_fee, total_amount, warehouse_notes, notes, created_at
) VALUES (
    'ORD-2026-0003',
    (SELECT id FROM users WHERE email = 'compras@tallereslosandes.pe'),
    (SELECT id FROM users WHERE email = 'vendedor1@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'almacen@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'motorizado@asuncion.pe'),
    (SELECT id FROM branches WHERE code = 'SUC-LAVICTORIA'),
    'EN_RUTA', 'DELIVERY',
    'Av. Aviación 2840, San Borja, Lima',
    'Puerta lateral de repuestos',
    ST_GeogFromText('SRID=4326;POINT(-77.0012 -12.0985)'),
    3820.15, 'FACTURA', '20608451239', 'Automotriz Los Andes S.A.C.',
    'Luis Alberto Huerta', '+51 998712345', 'YAPE_EMPRESAS',
    1169.49, 210.51, 16.88, 1396.88,
    'Caja sellada #14 entregada al motorizado.',
    'Entregar guía de remisión física junto con factura.',
    NOW() - INTERVAL '5 hours'
) ON CONFLICT (order_number) DO NOTHING;

-- Pedido 4: LISTO_PARA_DESPACHO (Listo en almacén esperando salida de motorizado - Lince)
INSERT INTO orders (
    order_number, customer_id, salesperson_id, warehouse_operator_id, driver_id, branch_id,
    status, delivery_type, delivery_address, delivery_reference, delivery_location,
    calculated_distance_meters, invoice_type, customer_tax_id, customer_business_name,
    recipient_name, recipient_phone, payment_method,
    subtotal, tax_amount, delivery_fee, total_amount, warehouse_notes, notes, created_at
) VALUES (
    'ORD-2026-0004',
    (SELECT id FROM users WHERE email = 'cliente@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'vendedor3@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'almacen@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'motorizado@asuncion.pe'),
    (SELECT id FROM branches WHERE code = 'SUC-LAVICTORIA'),
    'LISTO_PARA_DESPACHO', 'DELIVERY',
    'Av. Arenales 2150, Lince, Lima',
    'A dos cuadras del Parque Mariscal Castilla',
    ST_GeogFromText('SRID=4326;POINT(-77.0365 -12.0852)'),
    2720.80, 'BOLETA', '45109283', NULL,
    'Roberto Vargas Sánchez', '+51 995601234', 'TARJETA_DEBITO',
    419.49, 75.51, 14.90, 509.90,
    'Picking completado en bahía de despacho B-02.',
    'Entrega turno tarde.',
    NOW() - INTERVAL '2 hours'
) ON CONFLICT (order_number) DO NOTHING;

-- Pedido 5: EN_PREPARACION (Operario de almacén ejecutando picking - Surco)
INSERT INTO orders (
    order_number, customer_id, salesperson_id, warehouse_operator_id, driver_id, branch_id,
    status, delivery_type, delivery_address, delivery_reference, delivery_location,
    calculated_distance_meters, invoice_type, customer_tax_id, customer_business_name,
    recipient_name, recipient_phone, payment_method,
    subtotal, tax_amount, delivery_fee, total_amount, warehouse_notes, notes, created_at
) VALUES (
    'ORD-2026-0005',
    (SELECT id FROM users WHERE email = 'compras@tallereslosandes.pe'),
    (SELECT id FROM users WHERE email = 'vendedor2@asuncion.pe'),
    (SELECT id FROM users WHERE email = 'almacen@asuncion.pe'),
    NULL,
    (SELECT id FROM branches WHERE code = 'SUC-SURQUILLO'),
    'EN_PREPARACION', 'DELIVERY',
    'Av. Caminos del Inca 1320, Santiago de Surco, Lima',
    'Centro Automotriz Surco - Box 3',
    ST_GeogFromText('SRID=4326;POINT(-76.9895 -12.1215)'),
    2640.00, 'FACTURA', '20608451239', 'Automotriz Los Andes S.A.C.',
    'Pedro Pablo Quispe', '+51 998712345', 'TRANSFERENCIA_BANCARIA',
    826.27, 148.73, 17.28, 992.28,
    'En proceso de verificación de códigos OEM.',
    'Confirmar serie del kit Gates antes de embalar.',
    NOW() - INTERVAL '1 hour'
) ON CONFLICT (order_number) DO NOTHING;

-- 14. DETALLE DE LÍNEAS DE PEDIDOS (order_items)
-- Ítems ORD-2026-0001 (Total productos = S/ 2,580.00 -> subtotal 2186.44 + IGV 393.56)
INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 4, 145.00, 235.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0001' AND p.sku = 'ASU-FRE-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 4, 190.00, 310.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0001' AND p.sku = 'ASU-FRE-002'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 10, 22.00, 40.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0001' AND p.sku = 'ASU-FIL-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

-- Ítems ORD-2026-0002 (Total productos = S/ 777.00)
INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 2, 185.00, 294.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0002' AND p.sku = 'ASU-SUS-002'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 1, 115.00, 189.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0002' AND p.sku = 'ASU-ELE-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

-- Ítems ORD-2026-0003 (Total productos = S/ 1,380.00)
INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 4, 210.00, 345.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0003' AND p.sku = 'ASU-SUS-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

-- Ítems ORD-2026-0004 (Total productos = S/ 495.00)
INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 3, 38.00, 68.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0004' AND p.sku = 'ASU-FIL-002'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 2, 85.00, 145.50, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0004' AND p.sku = 'ASU-FRE-003'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

-- Ítems ORD-2026-0005 (Total productos = S/ 975.00 - En proceso de picking)
INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 1, 260.00, 420.00, TRUE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0005' AND p.sku = 'ASU-MOT-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 1, 155.00, 255.00, FALSE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0005' AND p.sku = 'ASU-REF-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

INSERT INTO order_items (order_id, part_id, quantity, unit_purchase_cost, unit_sale_price, picked)
SELECT o.id, p.id, 10, 22.00, 30.00, FALSE
FROM orders o, parts p WHERE o.order_number = 'ORD-2026-0005' AND p.sku = 'ASU-FIL-001'
  AND NOT EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.part_id = p.id);

-- 15. HISTORIAL DE ESTADOS Y COMPROBANTES DE ENTREGA (Proof of Delivery)
INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by_user_id, comment, changed_at)
SELECT o.id, NULL, 'CONFIRMADO', o.customer_id, 'Pedido autorizado tras validación geoespacial PostGIS ST_DWithin.', o.created_at
FROM orders o
WHERE NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.new_status = 'CONFIRMADO');

INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by_user_id, comment, changed_at)
SELECT o.id, 'CONFIRMADO', 'LISTO_PARA_DESPACHO', o.warehouse_operator_id, 'Picking verificado y embalaje etiquetado en almacén.', o.created_at + INTERVAL '35 minutes'
FROM orders o
WHERE o.status IN ('LISTO_PARA_DESPACHO', 'EN_RUTA', 'ENTREGADO')
  AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.new_status = 'LISTO_PARA_DESPACHO');

INSERT INTO order_status_history (order_id, previous_status, new_status, changed_by_user_id, comment, changed_at)
SELECT o.id, 'LISTO_PARA_DESPACHO', 'ENTREGADO', o.driver_id, 'Entregado conforme con evidencia fotográfica WebP georreferenciada.', o.created_at + INTERVAL '2 hours'
FROM orders o
WHERE o.status = 'ENTREGADO'
  AND NOT EXISTS (SELECT 1 FROM order_status_history h WHERE h.order_id = o.id AND h.new_status = 'ENTREGADO');

INSERT INTO delivery_proofs (
    order_id, driver_id, evidence_object_key, evidence_image_url,
    receiver_name, receiver_document, captured_location, delivery_notes, delivered_at
)
SELECT
    o.id,
    o.driver_id,
    'deliveries/ord-2026-0001/pod-evidence.webp',
    '/images/banners/banner-delivery.jpg',
    'Ing. Marco Antonio Vera',
    '41298345',
    ST_GeogFromText('SRID=4326;POINT(-77.0195 -12.0905)'),
    'Recibido con sello de almacén de Automotriz Los Andes S.A.C.',
    o.created_at + INTERVAL '2 hours'
FROM orders o
WHERE o.order_number = 'ORD-2026-0001'
ON CONFLICT (order_id) DO NOTHING;

INSERT INTO delivery_proofs (
    order_id, driver_id, evidence_object_key, evidence_image_url,
    receiver_name, receiver_document, captured_location, delivery_notes, delivered_at
)
SELECT
    o.id,
    o.driver_id,
    'deliveries/ord-2026-0002/pod-evidence.webp',
    '/images/banners/banner-delivery.jpg',
    'Roberto Vargas Sánchez',
    '45109283',
    ST_GeogFromText('SRID=4326;POINT(-77.0188 -12.1268)'),
    'Entregado personalmente al titular en recepción.',
    o.created_at + INTERVAL '95 minutes'
FROM orders o
WHERE o.order_number = 'ORD-2026-0002'
ON CONFLICT (order_id) DO NOTHING;

COMMIT;
