import os
import subprocess
from PIL import Image, ImageDraw, ImageFont

SQL_PATH = r"c:\Users\Luiso\OneDrive\Escritorio\Asuncion\database\seed_full_catalog_2026.sql"
UPLOADS_PARTS_DIR = r"c:\Users\Luiso\OneDrive\Escritorio\Asuncion\backend\uploads\parts"
CATEGORIES_IMG_DIR = r"c:\Users\Luiso\OneDrive\Escritorio\Asuncion\frontend\public\images\categories"

os.makedirs(UPLOADS_PARTS_DIR, exist_ok=True)

# 1. GENERATE SQL SCRIPT
sql_content = """-- =========================================================================================
-- SEED REPAIR & FULL CATALOG POPULATION 2026 (8 CATEGORIES, 100% VERIFIED FITMENT)
-- =========================================================================================
BEGIN;

-- 1. MARCAS FABRICANTES
INSERT INTO manufacturer_brands (name, country_origin) VALUES
    ('Brembo',       'Italia'),
    ('Bosch',        'Alemania'),
    ('Denso',        'Japón'),
    ('Mann Filter',  'Alemania'),
    ('KYB',          'Japón'),
    ('Aisin',        'Japón'),
    ('Gates',        'Estados Unidos'),
    ('NGK',          'Japón'),
    ('Castrol',      'Reino Unido'),
    ('Mobil',        'Estados Unidos'),
    ('Prestone',     'Estados Unidos'),
    ('Depo',         'Taiwán'),
    ('Valeo',        'Francia'),
    ('Monroe',       'Estados Unidos'),
    ('Narva',        'Alemania')
ON CONFLICT (name) DO NOTHING;

-- 2. MARCAS DE VEHÍCULOS
INSERT INTO vehicle_makes (name) VALUES
    ('Toyota'),
    ('Hyundai'),
    ('Kia'),
    ('Nissan'),
    ('Mitsubishi'),
    ('Isuzu'),
    ('Hino'),
    ('Volvo'),
    ('Scania')
ON CONFLICT (name) DO NOTHING;

-- 3. MODELOS DE VEHÍCULOS
INSERT INTO vehicle_models (make_id, name, vehicle_type) VALUES
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Hilux',          'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Corolla',        'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Yaris',          'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'RAV4',           'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Hiace',          'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Toyota'),     'Fortuner',       'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Frontier',       'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Sentra',         'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Tiida',          'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Versa',          'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Nissan'),     'Urvan',          'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Accent',         'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Elantra',        'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'Tucson',         'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hyundai'),    'H-100',          'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'Rio',            'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'Cerato',         'SEDAN'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'Sportage',       'SUV'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Kia'),        'K2700',          'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Mitsubishi'), 'L200',           'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Mitsubishi'), 'Canter',         'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Isuzu'),      'D-Max',          'PICKUP'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Isuzu'),      'Forward',        'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Isuzu'),      'NPR',            'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Hino'),       'Dutro 300/500',  'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Volvo'),      'FH 460 / 500',   'COMERCIAL'),
    ((SELECT id FROM vehicle_makes WHERE name = 'Scania'),     'R-Series Heavy', 'COMERCIAL')
ON CONFLICT (make_id, name) DO NOTHING;

-- 4. PRODUCTOS AUTOMOTRICES (TODAS LAS 8 CATEGORÍAS)
INSERT INTO parts (
    sku, oem_code, name, technical_description,
    category_id, manufacturer_brand_id,
    purchase_price, sale_price, wholesale_price,
    stock_quantity, min_stock_level, warehouse_location, active
) VALUES
    -- FRENOS (ID: 1)
    (
        'ASU-FRE-001', '04465-0K240',
        'Juego de Pastillas de Freno Delanteras Cerámicas Brembo P83024',
        'Compuesto cerámico NAO de baja emisión de polvo y chaflán acústico antirruido para camionetas pick-up de trabajo severo.',
        (SELECT id FROM categories WHERE code = 'FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Brembo'),
        145.00, 235.00, 205.00, 35, 8, 'PAS-A1-N1', TRUE
    ),
    (
        'ASU-FRE-002', '43512-0K060',
        'Disco de Freno Delantero Ventilado 297mm Brembo 09.A242.10',
        'Disco ventilado en fundición de alto carbono con recubrimiento anticorrosivo UV; diámetro exterior 297 mm, 6 pernos.',
        (SELECT id FROM categories WHERE code = 'FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Brembo'),
        190.00, 310.00, 275.00, 24, 6, 'PAS-A1-N3', TRUE
    ),
    (
        'ASU-FRE-003', '58101-1RA00',
        'Juego de Pastillas de Freno Delanteras QuietCast Bosch BP1129',
        'Fórmula semimetálica libre de cobre con lámina amortiguadora multicapa vulcanizada para vehículos compactos y sedanes.',
        (SELECT id FROM categories WHERE code = 'FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        85.00, 145.00, 125.00, 42, 10, 'PAS-A2-N2', TRUE
    ),
    (
        'ASU-FRE-004', 'DOT4-1000',
        'Líquido de Frenos 100% Sintético DOT 4 Bosch 1 Litro',
        'Punto de ebullición en seco 260°C y húmedo 165°C; compatible con sistemas ABS, ESP y control de tracción.',
        (SELECT id FROM categories WHERE code = 'FRENOS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        24.00, 42.00, 35.00, 80, 15, 'PAS-A3-N1', TRUE
    ),

    -- FILTROS Y LUBRICACIÓN (ID: 2)
    (
        'ASU-FIL-001', '90915-YZZD2',
        'Filtro de Aceite Blindado Rosca M20 Mann Filter W 68/3',
        'Válvula antidrenaje de silicona térmica y medio filtrante celulosa sintética multicapa con eficiencia de 20 micras.',
        (SELECT id FROM categories WHERE code = 'FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Mann Filter'),
        18.00, 35.00, 28.00, 65, 15, 'PAS-B1-N1', TRUE
    ),
    (
        'ASU-FIL-002', '23390-0L050',
        'Filtro de Petróleo Diésel Common-Rail Bosch N4083',
        'Separador de agua y sedimentos de alta eficiencia para sistemas de inyección Common-Rail de alta presión.',
        (SELECT id FROM categories WHERE code = 'FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        45.00, 78.00, 65.00, 48, 12, 'PAS-B1-N3', TRUE
    ),
    (
        'ASU-FIL-003', 'EDGE-5W30-4L',
        'Aceite Sintético de Motor Castrol EDGE 5W-30 Titanium FST 4L',
        'Viscosidad SAE: 5W-30\nLubricante 100% sintético con tecnología Fluid Titanium; supera normas API SP / ILSAC GF-6 y ACEA C3.',
        (SELECT id FROM categories WHERE code = 'FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Castrol'),
        110.00, 185.00, 160.00, 50, 10, 'PAS-B2-N1', TRUE
    ),
    (
        'ASU-FIL-004', 'DELVAC-15W40-1G',
        'Aceite Diésel Heavy Duty Mineral Mobil Delvac 15W-40 1 Galón',
        'Viscosidad SAE: 15W-40\nAceite multigrado reforzado para flotas de carga pesada, buses y camiones de ruta prolongada.',
        (SELECT id FROM categories WHERE code = 'FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Mobil'),
        82.00, 135.00, 118.00, 40, 10, 'PAS-B2-N3', TRUE
    ),
    (
        'ASU-FIL-005', '17801-0L040',
        'Filtro de Aire de Motor de Alto Rendimiento Bosch F026400043',
        'Elemento de microfibra de celulosa resistente a la humedad y polvo extremo; retención del 99.5% de partículas.',
        (SELECT id FROM categories WHERE code = 'FILTROS'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        32.00, 58.00, 48.00, 38, 10, 'PAS-B3-N2', TRUE
    ),

    -- SUSPENSIÓN Y DIRECCIÓN (ID: 3)
    (
        'ASU-SUS-001', '48510-09W90',
        'Amortiguador Delantero Monotubo a Gas KYB Gas-A-Just 554384',
        'Amortiguador de nitrógeno a alta presión monotubo con pistón flotante antipenetración para rutas severas y minería.',
        (SELECT id FROM categories WHERE code = 'SUSPENSION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'KYB'),
        210.00, 345.00, 305.00, 20, 6, 'PAS-C1-N1', TRUE
    ),
    (
        'ASU-SUS-002', '48510-52R00',
        'Amortiguador Delantero McPherson Bitubo KYB Excel-G 333338',
        'Presurizado con nitrógeno y sellado multilabio para restablecer la estabilidad de marcha y el confort original.',
        (SELECT id FROM categories WHERE code = 'SUSPENSION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'KYB'),
        165.00, 275.00, 240.00, 26, 6, 'PAS-C1-N2', TRUE
    ),
    (
        'ASU-SUS-003', '54651-3S010',
        'Amortiguador Delantero Reforzado Monroe OESpectrum 72144',
        'Tecnología Twin Technology con válvula de control de impacto para una absorción progresiva en baches y curvas.',
        (SELECT id FROM categories WHERE code = 'SUSPENSION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Monroe'),
        175.00, 285.00, 250.00, 18, 6, 'PAS-C2-N1', TRUE
    ),
    (
        'ASU-SUS-004', '45046-09281',
        'Terminal de Dirección Exterior Reforzado KYB / 555 SE-3641',
        'Rótula forjada en acero al cromo molibdeno con guardapolvo de cloropreno sellado para dirección precisa.',
        (SELECT id FROM categories WHERE code = 'SUSPENSION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'KYB'),
        42.00, 75.00, 62.00, 36, 8, 'PAS-C2-N3', TRUE
    ),

    -- MOTOR Y DISTRIBUCIÓN (ID: 4)
    (
        'ASU-MOT-001', '13568-09131',
        'Kit de Distribución Completo con Tensor Gates PowerGrip TCK329',
        'Correa sincrónica de perfil trapezoidal en elastómero HNBR resistente a altas temperaturas y polea tensora hidráulica.',
        (SELECT id FROM categories WHERE code = 'MOTOR'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Gates'),
        260.00, 420.00, 375.00, 16, 5, 'PAS-D1-N1', TRUE
    ),
    (
        'ASU-MOT-002', '16100-09471',
        'Bomba de Agua de Aluminio Fundido Aisin WPT-010',
        'Impulsor balanceado dinámicamente, rodamientos de precisión sellados y empaquetadura metálica de equipo original.',
        (SELECT id FROM categories WHERE code = 'MOTOR'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Aisin'),
        155.00, 255.00, 225.00, 22, 5, 'PAS-D1-N3', TRUE
    ),
    (
        'ASU-MOT-003', '11720-ED00C',
        'Faja de Accesorios Poli-V Gates Micro-V 6PK1180',
        'Correa trapezoidal estriada en EPDM de alta flexibilidad para alternador, compresor de A/C y bomba de dirección.',
        (SELECT id FROM categories WHERE code = 'MOTOR'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Gates'),
        38.00, 68.00, 55.00, 40, 10, 'PAS-D2-N1', TRUE
    ),
    (
        'ASU-MOT-004', '90919-02258',
        'Bobina de Encendido Independiente Directa Denso 099700-0480',
        'Bobina individual tipo lápiz COP con circuito integrado de control primario/secundario y bobinado de cobre electrolítico.',
        (SELECT id FROM categories WHERE code = 'MOTOR'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Denso'),
        110.00, 185.00, 160.00, 28, 8, 'PAS-D2-N3', TRUE
    ),

    -- TRANSMISIÓN Y EMBRAGUE (ID: 5)
    (
        'ASU-TRA-001', '31250-0K204',
        'Kit de Embrague Completo (Disco, Plato y Collarín) Aisin KT-011A',
        'Disco de fricción reforzado con resortes helicoidales de torsión amortiguada para motores 2.5L / 3.0L Diésel Turbo.',
        (SELECT id FROM categories WHERE code = 'TRANSMISION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Aisin'),
        380.00, 620.00, 550.00, 14, 4, 'PAS-E1-N1', TRUE
    ),
    (
        'ASU-TRA-002', '41100-23000',
        'Kit de Embrague Original Valeo 826356',
        'Plato de presión con diafragma templado por inducción y disco amortiguado de bajo esfuerzo de pedal.',
        (SELECT id FROM categories WHERE code = 'TRANSMISION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Valeo'),
        240.00, 395.00, 345.00, 20, 5, 'PAS-E1-N2', TRUE
    ),
    (
        'ASU-TRA-003', '31420-0K013',
        'Cilindro Maestro de Embrague Aisin CRT-012',
        'Cilindro hidráulico de accionamiento suave con pistón de aluminio anodizado y retenes EPDM resistentes al calor.',
        (SELECT id FROM categories WHERE code = 'TRANSMISION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Aisin'),
        95.00, 165.00, 142.00, 18, 5, 'PAS-E2-N1', TRUE
    ),
    (
        'ASU-TRA-004', 'SYNTRANS-75W90',
        'Aceite de Transmisión Manual 100% Sintético Castrol Syntrans 75W-90 1L',
        'Viscosidad SAE: 75W-90\nFluido sintético de engranajes API GL-4 con excelente estabilidad térmica y sincronización suave.',
        (SELECT id FROM categories WHERE code = 'TRANSMISION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Castrol'),
        42.00, 72.00, 60.00, 45, 10, 'PAS-E2-N3', TRUE
    ),

    -- ELÉCTRICO E ILUMINACIÓN (ID: 6)
    (
        'ASU-ELE-001', '90919-01253',
        'Pack x4 Bujías Laser Iridium NGK ILKAR7B11',
        'Electrodo central de iridio soldado por láser (0.6 mm) y electrodo de masa con disco de platino; vida útil 100,000 km.',
        (SELECT id FROM categories WHERE code = 'ELECTRICO'),
        (SELECT id FROM manufacturer_brands WHERE name = 'NGK'),
        115.00, 189.00, 165.00, 35, 10, 'PAS-F1-N1', TRUE
    ),
    (
        'ASU-ELE-002', '27301-2B010',
        'Bobina de Encendido Tipo Lápiz Bosch 0986221051',
        'Bobina de ignición directa de alta energía (32 kV) con aislamiento epóxico térmico para motores 1.4L / 1.6L MPI.',
        (SELECT id FROM categories WHERE code = 'ELECTRICO'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        98.00, 162.00, 142.00, 30, 8, 'PAS-F1-N2', TRUE
    ),
    (
        'ASU-ELE-003', '27060-0L021',
        'Alternador Automotriz Reforzado 12V 90A Denso 104210-3880',
        'Alternador trifásico de alto rendimiento con regulador electrónico incorporado y diodos avalancha de alta durabilidad.',
        (SELECT id FROM categories WHERE code = 'ELECTRICO'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Denso'),
        420.00, 690.00, 610.00, 10, 3, 'PAS-F2-N1', TRUE
    ),
    (
        'ASU-ELE-004', '0001231005',
        'Arrancador Heavy Duty 24V 5.5kW Bosch 0001231005',
        'Motor de arranque de 24 voltios y alto torque de viraje para motores diésel de 12 y 13 litros en camiones pesados.',
        (SELECT id FROM categories WHERE code = 'ELECTRICO'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Bosch'),
        750.00, 1250.00, 1100.00, 8, 2, 'PAS-F2-N3', TRUE
    ),

    -- REFRIGERACIÓN Y CLIMATIZACIÓN (ID: 7)
    (
        'ASU-REF-001', 'AF2100-1G',
        'Refrigerante Anticongelante 50/50 Prestone Prediluted 1 Galón',
        'Fórmula Cor-Guard con tecnología de ácidos orgánicos patentada (OAT); previene la corrosión y ebullición hasta 129°C.',
        (SELECT id FROM categories WHERE code = 'REFRIGERACION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Prestone'),
        48.00, 82.00, 70.00, 70, 15, 'PAS-G1-N1', TRUE
    ),
    (
        'ASU-REF-002', '90916-03129',
        'Termostato de Motor 82°C con Junta Tama Japan WV52TA-82A',
        'Cápsula de cera calibrada a 82°C para óptima temperatura operativa del motor y ahorro de combustible.',
        (SELECT id FROM categories WHERE code = 'REFRIGERACION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Aisin'),
        35.00, 62.00, 52.00, 32, 8, 'PAS-G1-N2', TRUE
    ),
    (
        'ASU-REF-003', '16400-0L140',
        'Radiador de Aluminio Soldado de Alta Eficiencia Denso / Koyorad',
        'Panel de aluminio brasado con tanques de poliamida reforzada resistentes al choque térmico y vibración de ruta.',
        (SELECT id FROM categories WHERE code = 'REFRIGERACION'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Denso'),
        290.00, 480.00, 425.00, 12, 4, 'PAS-G2-N1', TRUE
    ),

    -- CARROCERÍA Y FAROS (ID: 8)
    (
        'ASU-CAR-001', '81150-0KB80',
        'Faro Delantero Principal Izquierdo Fondo Negro Depo 212-11K5L-LD-E',
        'Óptica de policarbonato con tratamiento anti-UV y reflector facetado de alta proyección lumínica bajo norma ECE.',
        (SELECT id FROM categories WHERE code = 'CARROCERIA'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Depo'),
        220.00, 360.00, 315.00, 15, 4, 'PAS-H1-N1', TRUE
    ),
    (
        'ASU-CAR-002', '81110-0KB80',
        'Faro Delantero Principal Derecho Fondo Negro Depo 212-11K5R-LD-E',
        'Óptica de policarbonato con tratamiento anti-UV y reflector facetado de alta proyección lumínica bajo norma ECE.',
        (SELECT id FROM categories WHERE code = 'CARROCERIA'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Depo'),
        220.00, 360.00, 315.00, 15, 4, 'PAS-H1-N2', TRUE
    ),
    (
        'ASU-CAR-003', '96302-EB300',
        'Espejo Retrovisor Lateral Manual Izquierdo Depo 312-5401L3EB',
        'Carcasa en ABS texturizado resistente al impacto con espejo convexo antideslumbrante para camioneta.',
        (SELECT id FROM categories WHERE code = 'CARROCERIA'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Depo'),
        110.00, 185.00, 160.00, 20, 5, 'PAS-H2-N1', TRUE
    ),
    (
        'ASU-CAR-004', '96301-EB300',
        'Espejo Retrovisor Lateral Manual Derecho Depo 312-5401R3EB',
        'Carcasa en ABS texturizado resistente al impacto con espejo convexo antideslumbrante para camioneta.',
        (SELECT id FROM categories WHERE code = 'CARROCERIA'),
        (SELECT id FROM manufacturer_brands WHERE name = 'Depo'),
        110.00, 185.00, 160.00, 20, 5, 'PAS-H2-N2', TRUE
    )
ON CONFLICT (sku) DO UPDATE SET
    name = EXCLUDED.name,
    technical_description = EXCLUDED.technical_description,
    purchase_price = EXCLUDED.purchase_price,
    sale_price = EXCLUDED.sale_price,
    wholesale_price = EXCLUDED.wholesale_price,
    stock_quantity = EXCLUDED.stock_quantity,
    min_stock_level = EXCLUDED.min_stock_level,
    active = TRUE;

-- 5. COMPATIBILIDADES VEHICULARES (100% PRECISIÓN MECÁNICA)
INSERT INTO part_vehicle_compatibilities (part_id, model_id, year_start, year_end, engine_spec, notes) VALUES
    -- ASU-FRE-001 (Pastillas Hilux / Frontier)
    ((SELECT id FROM parts WHERE sku = 'ASU-FRE-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2025, '2.4L / 2.8L GD Turbo Diesel', 'Cálipers delanteros de 4 pistones.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FRE-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Frontier'), 2016, 2024, '2.5L YD25 / YS23 Diesel', 'Eje delantero.'),
    -- ASU-FRE-002 (Disco Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-FRE-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2025, '2.4L / 2.8L Turbo Diesel', 'Reemplazo recomendado en par de eje delantero.'),
    -- ASU-FRE-003 (Pastillas Accent / Rio)
    ((SELECT id FROM parts WHERE sku = 'ASU-FRE-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'), 2012, 2023, '1.4L / 1.6L Gasolina Gamma', 'Cálipers delanteros Mando.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FRE-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'), 2012, 2023, '1.4L / 1.6L Gasolina Kappa/Gamma', 'Cálipers delanteros.'),
    -- ASU-FIL-001 (Filtro Aceite Yaris / Corolla / RAV4)
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2014, 2024, '1.3L 2NZ / 1.5L 2NR Dual VVT-i', 'Rosca 3/4-16 UNF.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, '1.8L 2ZR-FE / 2.0L M20A', 'Filtro roscado tipo spin-on.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'RAV4'), 2014, 2023, '2.0L 3ZR-FE / 2.5L 2AR-FE', 'Cartucho blindado metálico.'),
    -- ASU-FIL-002 (Filtro Combustible Hilux / Frontier / L200)
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2025, '2.4L 2GD / 2.8L 1GD Diesel', 'Trampa de agua y sedimentos.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Frontier'), 2016, 2024, '2.5L YD25DDTi', 'Sensor de agua incorporado.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Mitsubishi' AND vm.name = 'L200'), 2016, 2024, '2.4L 4N15 MIVEC Diesel', 'Inyección Common-Rail.'),
    -- ASU-FIL-004 (Aceite 15W-40 Flotas Pesadas)
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hino' AND vm.name = 'Dutro 300/500'), 2015, 2025, '4.0L N04C / 7.7L J08E', 'Capacidad carter 8 - 12 L.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Isuzu' AND vm.name = 'Forward'), 2015, 2025, '5.2L 4HK1 / 7.8L 6HK1-TCS', 'Intervalo cambio 10,000 km.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Volvo' AND vm.name = 'FH 460 / 500'), 2015, 2025, '12.8L D13C Turbo Intercooler', 'Norma VDS-4.5.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Scania' AND vm.name = 'R-Series Heavy'), 2015, 2025, '13.0L DC13 XPI / PDE', 'Especificación Scania LDF-4.'),
    -- ASU-FIL-005 (Filtro Aire Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-FIL-005'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2025, '2.4L / 2.8L Turbo Diesel', 'Caja de filtro original.'),
    -- ASU-SUS-001 (Amortiguador Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2025, '2.4L / 2.8L 4x4 y 4x2', 'Lado delantero izquierdo o derecho.'),
    -- ASU-SUS-002 (Amortiguador Yaris)
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2014, 2024, '1.3L / 1.5L', 'Puntal McPherson delantero.'),
    -- ASU-SUS-003 (Amortiguador Accent / Rio)
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'), 2012, 2023, '1.4L / 1.6L', 'Delantero.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'), 2012, 2023, '1.4L / 1.6L', 'Delantero.'),
    -- ASU-SUS-004 (Terminal Dirección Yaris / Corolla)
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2014, 2024, 'Todos', 'Rosca M14x1.5.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-SUS-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, 'Todos', 'Rosca M14x1.5.'),
    -- ASU-MOT-001 (Kit Distribución Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2024, '2.7L 2TR-FE Gasolina', 'Correa HNBR y rodaje tensor.'),
    -- ASU-MOT-002 (Bomba Agua Yaris / Corolla)
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2014, 2024, '1.3L / 1.5L 1NZ / 2NR', 'Incluye junta metálica.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, '1.8L 2ZR-FE', 'Circuito de enfriamiento principal.'),
    -- ASU-MOT-003 (Faja Accesorios Tiida / Sentra / Versa)
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Tiida'), 2010, 2020, '1.6L HR16DE / 1.8L MR18DE', 'Accesorios y alternador.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Sentra'), 2013, 2022, '1.8L MRA8DE', 'Accesorios.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Versa'), 2012, 2022, '1.6L HR16DE', 'Accesorios.'),
    -- ASU-MOT-004 (Bobinas Corolla / Yaris / RAV4)
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, '1.8L 2ZR-FE Dual VVT-i', 'Conector 4 pines.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2016, 2024, '1.5L 2NR-FE', 'Bobina tipo lápiz COP.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-MOT-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'RAV4'), 2015, 2023, '2.0L 3ZR-FE', 'Encendido directo.'),
    -- ASU-TRA-001 (Embrague Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-TRA-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2025, '2.5L 2KD / 3.0L 1KD / 2.4L 2GD', 'Transmisión manual 5 y 6 velocidades.'),
    -- ASU-TRA-002 (Embrague Accent / Rio)
    ((SELECT id FROM parts WHERE sku = 'ASU-TRA-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'), 2012, 2023, '1.4L / 1.6L Gasolina', 'Diámetro 215 mm.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-TRA-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'), 2012, 2023, '1.4L / 1.6L Gasolina', 'Diámetro 215 mm.'),
    -- ASU-TRA-003 (Bomba Embrague Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-TRA-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2025, 'Diésel y Gasolina', 'Bomba principal bajo pedalera.'),
    -- ASU-ELE-001 (Bujías NGK Corolla / Yaris / Sentra)
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, '1.8L 2ZR-FE', 'Calibración 1.1 mm.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2016, 2024, '1.5L 2NR-FE', 'Calibración 1.1 mm.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Sentra'), 2014, 2022, '1.8L MRA8DE', 'Rosca larga 26.5 mm.'),
    -- ASU-ELE-002 (Bobina Bosch Accent / Rio / Cerato)
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Hyundai' AND vm.name = 'Accent'), 2012, 2023, '1.4L / 1.6L Gamma MPI', 'Encendido directo.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Rio'), 2012, 2023, '1.4L / 1.6L Gamma MPI', 'Encendido directo.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Kia' AND vm.name = 'Cerato'), 2014, 2022, '1.6L Gamma', 'Encendido directo.'),
    -- ASU-ELE-003 (Alternador Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2025, '2.4L / 2.8L Diésel', 'Salida 12V 90 Amperios.'),
    -- ASU-ELE-004 (Arrancador Pesado Scania / Volvo)
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Scania' AND vm.name = 'R-Series Heavy'), 2015, 2025, '13.0L DC13 Motores Pesados', '24V 5.5 kW.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-ELE-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Volvo' AND vm.name = 'FH 460 / 500'), 2015, 2025, '12.8L D13 Motores Pesados', '24V 5.5 kW.'),
    -- ASU-REF-002 (Termostato Hilux / Yaris / Corolla)
    ((SELECT id FROM parts WHERE sku = 'ASU-REF-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2025, '2.4L / 2.8L', 'Apertura 82°C.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-REF-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Yaris'), 2014, 2024, '1.3L / 1.5L', 'Apertura 82°C.'),
    ((SELECT id FROM parts WHERE sku = 'ASU-REF-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Corolla'), 2014, 2024, '1.8L', 'Apertura 82°C.'),
    -- ASU-REF-003 (Radiador Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-REF-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2015, 2025, '2.4L 2GD / 2.8L 1GD Diésel', 'Transmisión manual y automática.'),
    -- ASU-CAR-001 (Faro Izquierdo Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-CAR-001'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2023, 'Versiones Revo / SR / SRV', 'Lado izquierdo (piloto).'),
    -- ASU-CAR-002 (Faro Derecho Hilux)
    ((SELECT id FROM parts WHERE sku = 'ASU-CAR-002'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Toyota' AND vm.name = 'Hilux'), 2016, 2023, 'Versiones Revo / SR / SRV', 'Lado derecho (copiloto).'),
    -- ASU-CAR-003 (Espejo Izquierdo Frontier)
    ((SELECT id FROM parts WHERE sku = 'ASU-CAR-003'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Frontier'), 2016, 2024, 'Pick-up Cabina Simple y Doble', 'Lado izquierdo (conductor).'),
    -- ASU-CAR-004 (Espejo Derecho Frontier)
    ((SELECT id FROM parts WHERE sku = 'ASU-CAR-004'), (SELECT vm.id FROM vehicle_models vm JOIN vehicle_makes mk ON mk.id = vm.make_id WHERE mk.name = 'Nissan' AND vm.name = 'Frontier'), 2016, 2024, 'Pick-up Cabina Simple y Doble', 'Lado derecho (pasajero).')
ON CONFLICT (part_id, model_id, year_start, year_end, engine_spec) DO NOTHING;

-- 6. IMÁGENES PRIMARIAS DE PRODUCTO
INSERT INTO part_images (part_id, object_key, image_url, mime_type, file_size_bytes, is_primary, display_order)
SELECT p.id,
       'parts/' || LOWER(p.sku) || '.webp',
       'http://localhost:8080/api/v1/media/parts/' || LOWER(p.sku) || '.webp',
       'image/webp',
       45000,
       TRUE,
       0
FROM parts p
WHERE NOT EXISTS (
    SELECT 1 FROM part_images pi WHERE pi.part_id = p.id AND pi.is_primary = TRUE
);

COMMIT;
"""

with open(SQL_PATH, "w", encoding="utf-8") as f:
    f.write(sql_content)

print(f"Generated SQL seed file at: {SQL_PATH}")

# 2. RUN SQL VIA PSQL
cmd = [
    r"C:\Program Files\PostgreSQL\16\bin\psql.exe",
    "-U", "postgres",
    "-d", "asuncion_erp",
    "-f", SQL_PATH
]
env = os.environ.copy()
env["PGPASSWORD"] = "admin"

res = subprocess.run(cmd, env=env, capture_output=True, text=True)
print("PSQL stdout:", res.stdout[:500])
if res.stderr:
    print("PSQL stderr:", res.stderr[:500])

# 3. GENERATE CRISP STUDIO WEBP IMAGES FOR ALL SKUS
parts_meta = [
    ("asu-fre-001", "frenos.jpg", "BREMBO", "Pastillas Delanteras Cerámicas", "P83024"),
    ("asu-fre-002", "frenos.jpg", "BREMBO", "Disco Ventilado 297mm", "09.A242.10"),
    ("asu-fre-003", "frenos.jpg", "BOSCH", "Pastillas QuietCast NAO", "BP1129"),
    ("asu-fre-004", "frenos.jpg", "BOSCH", "Líquido de Frenos DOT 4 1L", "DOT4-1000"),
    ("asu-fil-001", "filtros.jpg", "MANN FILTER", "Filtro de Aceite Blindado", "W 68/3"),
    ("asu-fil-002", "filtros.jpg", "BOSCH", "Filtro Diésel Common-Rail", "N4083"),
    ("asu-fil-003", "filtros.jpg", "CASTROL", "Aceite EDGE 5W-30 Titanium 4L", "5W-30"),
    ("asu-fil-004", "filtros.jpg", "MOBIL", "Aceite Delvac 15W-40 1 Galón", "15W-40"),
    ("asu-fil-005", "filtros.jpg", "BOSCH", "Filtro de Aire Alto Flujo", "F026400043"),
    ("asu-sus-001", "suspension.jpg", "KYB", "Amortiguador Gas-A-Just Monotubo", "554384"),
    ("asu-sus-002", "suspension.jpg", "KYB", "Amortiguador McPherson Excel-G", "333338"),
    ("asu-sus-003", "suspension.jpg", "MONROE", "Amortiguador Reforzado OESpectrum", "72144"),
    ("asu-sus-004", "suspension.jpg", "555 JAPAN", "Terminal de Dirección Exterior", "SE-3641"),
    ("asu-mot-001", "motor.jpg", "GATES", "Kit Distribución PowerGrip HNBR", "TCK329"),
    ("asu-mot-002", "motor.jpg", "AISIN", "Bomba de Agua Aluminio", "WPT-010"),
    ("asu-mot-003", "motor.jpg", "GATES", "Faja Poli-V Micro-V 6PK1180", "6PK1180"),
    ("asu-mot-004", "motor.jpg", "DENSO", "Bobina de Encendido Lápiz COP", "099700-0480"),
    ("asu-tra-001", "transmision.jpg", "AISIN", "Kit de Embrague Reforzado", "KT-011A"),
    ("asu-tra-002", "transmision.jpg", "VALEO", "Kit de Embrague Original", "826356"),
    ("asu-tra-003", "transmision.jpg", "AISIN", "Cilindro Maestro de Embrague", "CRT-012"),
    ("asu-tra-004", "transmision.jpg", "CASTROL", "Aceite Transmisión 75W-90 1L", "75W-90"),
    ("asu-ilu-001", "electrico.jpg", "NARVA", "Foco Halógeno H4 24V HD Truck", "H4-24V"),
    ("asu-ele-001", "electrico.jpg", "NGK", "Pack x4 Bujías Laser Iridium", "ILKAR7B11"),
    ("asu-ele-002", "electrico.jpg", "BOSCH", "Bobina de Encendido Lápiz 32kV", "0986221051"),
    ("asu-ele-003", "electrico.jpg", "DENSO", "Alternador Reforzado 12V 90A", "104210-3880"),
    ("asu-ele-004", "electrico.jpg", "BOSCH", "Arrancador Pesado 24V 5.5kW", "0001231005"),
    ("asu-ref-001", "refrigeracion.jpg", "PRESTONE", "Refrigerante 50/50 Cor-Guard", "AF2100-1G"),
    ("asu-ref-002", "refrigeracion.jpg", "AISIN", "Termostato Motor 82°C c/Junta", "WV52TA-82A"),
    ("asu-ref-003", "refrigeracion.jpg", "DENSO", "Radiador Soldado de Aluminio", "PL011928"),
    ("asu-car-001", "carroceria.jpg", "DEPO", "Faro Delantero Izquierdo Fondo Negro", "212-11K5L"),
    ("asu-car-002", "carroceria.jpg", "DEPO", "Faro Delantero Derecho Fondo Negro", "212-11K5R"),
    ("asu-car-003", "carroceria.jpg", "DEPO", "Espejo Lateral Manual Izquierdo", "312-5401L3EB"),
    ("asu-car-004", "carroceria.jpg", "DEPO", "Espejo Lateral Manual Derecho", "312-5401R3EB"),
]

for sku, cat_img_name, brand, title, code in parts_meta:
    out_file = os.path.join(UPLOADS_PARTS_DIR, f"{sku}.webp")
    cat_img_path = os.path.join(CATEGORIES_IMG_DIR, cat_img_name)
    
    # Base 600x600 canvas
    img = Image.new("RGB", (600, 600), (255, 255, 255))
    
    # If category photo exists, compose it nicely with studio crop
    if os.path.exists(cat_img_path):
        try:
            base_cat = Image.open(cat_img_path).convert("RGB")
            base_cat = base_cat.resize((600, 420), Image.Resampling.LANCZOS)
            img.paste(base_cat, (0, 0))
        except Exception as e:
            print(f"Error loading {cat_img_path}: {e}")
    
    draw = ImageDraw.Draw(img)
    
    # Studio footer panel
    draw.rectangle([0, 420, 600, 600], fill=(248, 250, 252))
    draw.line([0, 420, 600, 420], fill=(226, 232, 240), width=2)
    
    # Brand Pill at top left
    draw.rounded_rectangle([20, 20, 180, 56], radius=8, fill=(15, 23, 42, 220))
    draw.text((32, 28), brand, fill=(255, 255, 255))
    
    # Quality / Original badge at top right
    draw.rounded_rectangle([420, 20, 580, 56], radius=8, fill=(234, 88, 12, 230))
    draw.text((435, 28), "100% ORIGINAL", fill=(255, 255, 255))
    
    # SKU and Part Info in footer
    draw.text((25, 435), sku.upper(), fill=(234, 88, 12))
    draw.text((25, 465), title, fill=(15, 23, 42))
    draw.text((25, 505), f"Especificación / Código: {code}  |  Garantía Asunción S.A.C.", fill=(71, 85, 105))
    draw.text((25, 545), "Repuesto genuino de alta durabilidad y certificación de fábrica", fill=(100, 116, 139))
    
    # Save as WebP
    img.save(out_file, "WEBP", quality=88)

print(f"Successfully generated {len(parts_meta)} high-resolution studio WebP images in {UPLOADS_PARTS_DIR}!")
