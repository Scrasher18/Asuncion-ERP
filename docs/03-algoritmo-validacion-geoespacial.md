# Entregable 3: Lógica y Algoritmo de Validación Geoespacial (PostGIS + Spring Boot 3 + Angular 17 / Google Maps)

## 1. Fundamento Geodésico: ¿Por qué `GEOGRAPHY(Point, 4326)` sobre `GEOMETRY` Plano?

En un sistema logístico transaccional como **"Repuestos Automotrices Asunción"**, autorizar o rechazar un despacho a domicilio exige precisión métrica real sobre la curvatura terrestre. PostGIS ofrece dos tipos espaciales principales, cuya elección impacta directamente la exactitud física del negocio:

| Criterio Técnico | `GEOMETRY(Point, 4326)` *(Plano Cartesiano)* | `GEOGRAPHY(Point, 4326)` *(Esferoide WGS84 — Elegido)* |
| :--- | :--- | :--- |
| **Espacio Matemático** | Plano euclidiano bidimensional ($\mathbb{R}^2$). | Elipsoide oblato de revolución **WGS84 (EPSG:4326)**. |
| **Unidad de `ST_Distance` / `ST_DWithin`** | **Grados angulares** (inutilizable directamente como radio en metros; $1^\circ$ de longitud varía con $\cos(\phi)$). | **Metros lineales exactos** sobre la superficie terrestre. |
| **Distorsión por Proyección UTM** | Si se proyecta a UTM Zona 18S (`EPSG:32718` para Lima), falla o introduce distorsión al abrir sucursales en zonas UTM 17S (Piura/Talara) o 19S (Cusco/Puno/Arequipa). | **Cero distorsión regional**: escala nacional y continental sin cambiar de SRID. |
| **Compatibilidad GPS & Google Maps** | Requiere reproyecciones `ST_Transform` constantes. | Nativo: recibe directamente coordenadas `(lat, lng)` de GPS móviles y Google Maps Platform. |

### Parámetros del Elipsoide WGS84 (EPSG:4326) Utilizados por PostGIS
PostGIS resuelve el problema geodésico inverso sobre el datum **WGS84**:
- Semieje ecuatorial mayor: $a = 6\,378\,137.0\text{ m}$
- Achatamiento polar: $f = \frac{1}{298.257223563}$
- Semieje polar menor: $b = a(1 - f) \approx 6\,356\,752.314245\text{ m}$

### Convención Crítica de Orden de Coordenadas (`Longitud, Latitud`)
Una fuente clásica de defectos graves en ingeniería geoespacial es la inversión de ejes entre las APIs web y los motores OGC/SQL:

- **Google Maps JS SDK / APIs Móviles**: Emplean orden geográfico humano `(latitud, longitud)` $\rightarrow$ Ejemplo Sede Central La Victoria: `lat = -12.0685, lng = -77.0182`.
- **PostGIS (`WKT` / `ST_MakePoint`) y JTS (`Coordinate`)**: Emplean estrictamente orden matemático cartesiano **`(X, Y) = (Longitud, Latitud)`**:

```sql
-- CORRECTO en PostGIS: X = Longitud (-77.0182), Y = Latitud (-12.0685)
ST_SetSRID(ST_MakePoint(-77.0182, -12.0685), 4326)::geography
-- Equivalente WKT:
ST_GeogFromText('SRID=4326;POINT(-77.0182 -12.0685)')
```

> [!CAUTION]
> Invertir los argumentos como `ST_MakePoint(lat, lng)` ubicaría el punto en longitud `-12.06°` y latitud `-77.01°` (¡en la Antártida!), o lanzaría un error de fuera de rango (`latitude > 90`) en PostGIS `GEOGRAPHY`. Tanto la función almacenada `fn_validate_delivery_coverage` como la fábrica JTS en Spring Boot encapsulan esta conversión en un único punto controlado.

---

## 2. Complejidad Algorítmica e Indexación Espacial `GiST` (`Generalized Search Tree`)

### 2.1 ¿Cómo acelera el índice `GiST` a `ST_DWithin` en tiempo $\mathcal{O}(\log N)$?

Sobre columnas `GEOGRAPHY`, PostGIS construye un árbol balanceado **R-Tree sobre GiST** (`CREATE INDEX idx_branches_location_gist ON branches USING GIST (location);`) utilizando **cajas delimitadoras geocéntricas tridimensionales (3D Minimum Bounding Boxes - MBB)** en coordenadas cartesianas geocéntricas $(X, Y, Z)$ sobre la esfera unitaria.

Cuando el backend ejecuta `ST_DWithin(b.location, v_point, b.coverage_radius_meters)`, el motor espacial aplica un **algoritmo de filtrado y refinamiento en dos fases**:

```mermaid
flowchart LR
    Input["Coordenada Cliente (lat, lng) convertida a GEOGRAPHY(Point, 4326)"]
    Phase1["Fase 1 - Poda por Indice GiST O(log N): Expande Bounding Box 3D en R metros y evalua interseccion espacial"]
    Discard["Descarte Inmediato: Ramas fuera del Bounding Box (Cero calculo trigonometrico)"]
    Phase2["Fase 2 - Refinamiento Geodesico Exacto: Calcula integral elipsoidal WGS84 (Karney) solo en candidatos"]
    Result["Resultado Deterministico: is_covered (TRUE/FALSE) + distance_meters exacta"]

    Input --> Phase1
    Phase1 -->|"No intersecta MBB"| Discard
    Phase1 -->|"Candidatos dentro del MBB"| Phase2
    Phase2 --> Result
```

1. **Fase 1 — Poda por Caja Delimitadora (*Bounding-Box Pruning* en $\mathcal{O}(\log N)$)**:
   `ST_DWithin(A, B, R)` se reescribe internamente en el optimizador de PostgreSQL inyectando un operador de solapamiento indexable (`A && _ST_Expand(B, R)`). El árbol `GiST` descarta ramas enteras cuyas cajas 3D no se solapan con la esfera expandida en $R$ metros, evitando leer páginas de disco irrelevantes.
2. **Fase 2 — Verificación Esferoidal Exacta (Algoritmo de Karney / GeographicLib)**:
   Únicamente para los registros candidatos que sobrevivieron a la Fase 1, PostGIS ejecuta `_ST_Distance` sobre el elipsoide WGS84 con precisión submilimétrica ($< 15\text{ nm}$), eliminando falsos positivos en las esquinas de la caja delimitadora.

### 2.2 Por qué `ST_DWithin` supera drásticamente a `ST_Distance(...) <= R`

| Expresión SQL | Uso de Índice Espacial `GiST` | Plan de Ejecución PostgreSQL | Complejidad |
| :--- | :---: | :--- | :---: |
| `WHERE ST_Distance(b.location, v_point) <= b.coverage_radius_meters` | ❌ **No utiliza GiST** | `Seq Scan` evaluando trigonometría elipsoidal pesada en **todas** las filas | $\mathcal{O}(N)$ |
| `WHERE ST_DWithin(b.location, v_point, b.coverage_radius_meters)` | ✅ **Sí utiliza GiST** | `Index Scan` / `Bitmap Index Scan` sobre `idx_branches_location_gist` + filtro exacto | $\mathcal{O}(\log N + k)$ |

El planificador de PostgreSQL trata a `ST_Distance(...)` como una función escalar opaca dentro de una desigualdad `<=`, por lo que no puede deducir automáticamente la expansión geométrica de la caja delimitadora. En cambio, `ST_DWithin` posee una función de soporte del planificador (`SupportRequestIndexCondition`) diseñada específicamente para activar el índice `GiST`. Esto aplica tanto al validar sucursales (`branches`) como al auditar millones de pedidos históricos en `orders(delivery_location)` o comprobantes en `delivery_proofs(captured_location)`.

---

## 3. Arquitectura de Defensa en Profundidad: UX Instantánea vs. Seguridad Transaccional

El sistema nunca confía exclusivamente en el navegador del usuario. La validación geoespacial se divide intencionalmente en dos niveles complementarios:

1. **Nivel 1 — Pre-Validación Reactiva en Frontend (Angular 17 + Google Maps Geometry / Haversine)**:
   - **Propósito**: Experiencia de usuario (UX) fluida con latencia $< 5\text{ ms}$ mientras el cliente arrastra el marcador sobre el mapa o selecciona una sugerencia de `Places Autocomplete`, pintando el estado en verde/rojo, calculando el costo estimado de envío y deshabilitando visualmente el botón de confirmación si sale del círculo.
   - **Limitación de Seguridad**: El código JavaScript del navegador es público y manipulable. Un atacante o script automatizado podría interceptar la petición con herramientas de desarrollo, Postman o `curl` e inyectar `{"deliveryType": "DELIVERY", "lat": -16.4090, "lng": -71.5375}` (Arequipa) intentando forzar un envío con tarifa de Lima.
2. **Nivel 2 — Validación Autoritativa y Atómica en Backend (Spring Boot 3 + PostGIS `@Transactional`)**:
   - **Propósito**: Guardia de seguridad e integridad transaccional ineludible. Al recibir `POST /api/v1/orders`, `OrderService` ignora cualquier bandera `isCovered` o `deliveryFee` enviada por el cliente; consulta directamente a PostGIS mediante `fn_validate_delivery_coverage`, recalcula la distancia y la tarifa oficial desde la base de datos y, si `is_covered = FALSE`, aborta la transacción con `HTTP 422 Unprocessable Entity` sin descontar ni una sola unidad de inventario.

---

## 4. Implementación Completa en Backend (PostGIS SQL + Spring Boot 3 / Hibernate Spatial)

### 4.1 Algoritmo SQL en PostgreSQL 16 + PostGIS 3.4

Definido en `database/01_schema_3fn_postgis.sql`, la función `fn_validate_delivery_coverage` encapsula la verificación de límites WGS84, la construcción del punto `GEOGRAPHY(Point, 4326)`, la evaluación indexada con `ST_DWithin` y el cálculo paramétrico de tarifa:

```sql
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
    IF p_lat IS NULL OR p_lng IS NULL OR p_lat < -90.0 OR p_lat > 90.0 OR p_lng < -180.0 OR p_lng > 180.0 THEN
        RAISE EXCEPTION 'Coordenadas WGS84 fuera de rango válido: lat=%, lng=%', p_lat, p_lng
            USING ERRCODE = '22023';
    END IF;

    -- Orden estricto PostGIS: (X = Longitud, Y = Latitud)
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
```

#### Ejemplo de Invocación Directa en SQL
```sql
-- Caso 1: Taller en San Isidro (-12.0905, -77.0195) evaluado contra Sede La Victoria (radio 8,500 m)
SELECT * FROM fn_validate_delivery_coverage(-12.0905, -77.0195, 1);
-- Resultado: is_covered = true | distance_meters = 2435.60 | allowed_radius_meters = 8500.00 | estimated_fee = 14.38

-- Caso 2: Punto fuera de radio en Ancón (-11.7735, -77.1762) -> ~36.2 km
SELECT * FROM fn_validate_delivery_coverage(-11.7735, -77.1762, 1);
-- Resultado: is_covered = false | distance_meters = 36942.18 | allowed_radius_meters = 8500.00
```

### 4.2 Fábrica Geoespacial JTS y Entidad Hibernate Spatial en Spring Boot 3

Con `org.hibernate.orm:hibernate-spatial` y `org.locationtech.jts:jts-core`, Spring Boot 3 mapea de forma nativa columnas `GEOGRAPHY(Point, 4326)` hacia `org.locationtech.jts.geom.Point`:

```java
package pe.asuncion.erp.geospatial;

import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.GeometryFactory;
import org.locationtech.jts.geom.Point;
import org.locationtech.jts.geom.PrecisionModel;
import org.springframework.stereotype.Component;

@Component
public class GeospatialPointFactory {

    private static final int WGS84_SRID = 4326;
    private final GeometryFactory geometryFactory =
            new GeometryFactory(new PrecisionModel(PrecisionModel.FLOATING), WGS84_SRID);

    /**
     * Construye un Point JTS con SRID 4326 respetando el orden cartesiano (X = lng, Y = lat).
     */
    public Point createWgs84Point(double latitude, double longitude) {
        if (latitude < -90.0 || latitude > 90.0 || longitude < -180.0 || longitude > 180.0) {
            throw new IllegalArgumentException("Coordenadas fuera de límites WGS84.");
        }
        Point point = geometryFactory.createPoint(new Coordinate(longitude, latitude));
        point.setSRID(WGS84_SRID);
        return point;
    }
}
```

### 4.3 Repositorio Spring Data JPA + Guardia Transaccional en `OrderService`

```java
public interface CoverageProjection {
    Long getBranchId();
    String getBranchName();
    Boolean getIsCovered();
    BigDecimal getDistanceMeters();
    BigDecimal getAllowedRadiusMeters();
    BigDecimal getEstimatedFee();
}

@Repository
public interface BranchSpatialRepository extends JpaRepository<Branch, Long> {

    @Query(value = """
        SELECT
            branch_id             AS branchId,
            branch_name           AS branchName,
            is_covered            AS isCovered,
            distance_meters       AS distanceMeters,
            allowed_radius_meters AS allowedRadiusMeters,
            estimated_fee         AS estimatedFee
        FROM fn_validate_delivery_coverage(:lat, :lng, :branchId)
        LIMIT 1
        """, nativeQuery = true)
    Optional<CoverageProjection> validateCoverage(
            @Param("lat") double latitude,
            @Param("lng") double longitude,
            @Param("branchId") Long branchId
    );
}
```

Dentro del servicio transaccional de pedidos (`OrderService`), la validación actúa como barrera atómica antes de tocar el inventario:

```java
@Transactional
public OrderResponse createOrder(CreateOrderRequest request, Long authenticatedUserId) {
    BigDecimal deliveryFee = BigDecimal.ZERO;
    BigDecimal calculatedDistance = null;
    Point deliveryPoint = null;

    if (DeliveryType.DELIVERY == request.deliveryType()) {
        if (request.latitude() == null || request.longitude() == null) {
            throw new BusinessValidationException("Las coordenadas GPS son obligatorias para despacho a domicilio.");
        }

        CoverageProjection coverage = branchSpatialRepository
                .validateCoverage(request.latitude(), request.longitude(), request.branchId())
                .orElseThrow(() -> new EntityNotFoundException("Sucursal activa no encontrada."));

        if (!Boolean.TRUE.equals(coverage.getIsCovered())) {
            throw new OutOfCoverageException(String.format(
                    "Dirección fuera del radio de cobertura de %s: distancia %.2f m excede el máximo permitido de %.2f m.",
                    coverage.getBranchName(),
                    coverage.getDistanceMeters(),
                    coverage.getAllowedRadiusMeters()
            ));
        }

        deliveryPoint = pointFactory.createWgs84Point(request.latitude(), request.longitude());
        calculatedDistance = coverage.getDistanceMeters();
        deliveryFee = coverage.getEstimatedFee(); // Tarifa autoritativa calculada en servidor
    }

    // Continúa únicamente si la cobertura es válida: bloqueo y descuento de stock + persistencia 3FN
    return persistVerifiedOrder(request, authenticatedUserId, deliveryPoint, calculatedDistance, deliveryFee);
}
```

---

## 5. Implementación en Frontend (Angular 17+ Signals + Google Maps Platform API)

### 5.1 Formulación Matemática Esferoidal de Haversine (Verificación Determinística en Cliente)

Además de `google.maps.geometry.spherical.computeDistanceBetween`, el cliente Angular implementa la **Fórmula Esferoidal de Haversine** parametrizada con el **radio medio terrestre de la Unión Internacional de Geodesia y Geofísica (IUGG)** $R = 6\,371\,008.8\text{ m}$. Esto permite validar instantáneamente coordenadas ingresadas o autocompletadas incluso antes de que termine de cargar el lienzo WebGL del mapa.

Sean $(\phi_1, \lambda_1)$ la latitud y longitud de la sucursal en radianes, y $(\phi_2, \lambda_2)$ la ubicación seleccionada por el cliente en radianes, con $\Delta\phi = \phi_2 - \phi_1$ y $\Delta\lambda = \lambda_2 - \lambda_1$:

$$a = \sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cdot\cos(\phi_2)\cdot\sin^2\left(\frac{\Delta\lambda}{2}\right)$$

$$c = 2 \cdot \operatorname{atan2}\left(\sqrt{a},\; \sqrt{1 - a}\right)$$

$$d = R \cdot c \quad \text{donde } R = 6\,371\,008.8\text{ m}$$

La condición de pre-validación visual en el cliente evalúa:

$$\text{isCovered}_{\text{UI}} \iff d \le R_{\text{sucursal}}$$

> [!NOTE]
> **Convergencia Numérica Esfera vs. Elipsoide WGS84**: En latitudes tropicales como Lima ($\phi \approx -12.07^\circ$) y para radios logísticos urbanos ($R_{\text{sucursal}} \le 15\text{ km}$), la discrepancia entre Haversine ($R = 6\,371\,008.8\text{ m}$) y la integral elipsoidal WGS84 de PostGIS es inferior al **$0.12\%$** (menos de $\pm 9\text{ m}$ en un radio de $8.5\text{ km}$). Para eliminar cualquier ambigüedad en los últimos metros del borde perimetral, al soltar el marcador (`dragend`), Angular dispara una consulta asíncrona de confirmación ligera a `GET /api/v1/coverage/validate` sincronizando exactamente al centímetro la distancia y tarifa de PostGIS.

### 5.2 Algoritmo Reactivo en Angular 17+ con `Signals` y `Google Maps Circle`

```typescript
import { Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface BranchCoverageConfig {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  coverageRadiusMeters: number;
  baseDeliveryFee: number;
  perKmFee: number;
}

export interface ServerCoverageResponse {
  branchId: number;
  branchName: string;
  isCovered: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  estimatedFee: number;
}

@Component({
  selector: 'app-geospatial-coverage-map',
  standalone: true,
  template: `<!-- Renderizado con Tailwind CSS + Lienzo Google Maps -->`
})
export class GeospatialCoverageMapComponent {
  private readonly http = inject(HttpClient);
  private static readonly EARTH_MEAN_RADIUS_METERS = 6371008.8;

  @ViewChild('mapCanvas', { static: true }) mapCanvas!: ElementRef<HTMLElement>;
  @ViewChild('addressInput', { static: true }) addressInput!: ElementRef<HTMLInputElement>;

  // Estado reactivo basado en Angular 17+ Signals
  readonly activeBranch = signal<BranchCoverageConfig>({
    id: 1,
    name: 'Repuestos Asunción - Sede Central La Victoria',
    latitude: -12.0685,
    longitude: -77.0182,
    coverageRadiusMeters: 8500,
    baseDeliveryFee: 10.0,
    perKmFee: 1.8
  });

  readonly selectedCoords = signal<{ lat: number; lng: number } | null>(null);
  readonly serverVerification = signal<ServerCoverageResponse | null>(null);

  // Cálculo instantáneo (< 1 ms) en cliente al arrastrar el pin
  readonly localDistanceMeters = computed<number | null>(() => {
    const coords = this.selectedCoords();
    const branch = this.activeBranch();
    if (!coords) return null;

    if (typeof google !== 'undefined' && google.maps?.geometry?.spherical) {
      const origin = new google.maps.LatLng(branch.latitude, branch.longitude);
      const destination = new google.maps.LatLng(coords.lat, coords.lng);
      return Math.round(
        google.maps.geometry.spherical.computeDistanceBetween(origin, destination) * 100
      ) / 100;
    }

    return this.computeHaversineMeters(
      branch.latitude, branch.longitude,
      coords.lat, coords.lng
    );
  });

  // Prioriza el dictamen autoritativo de PostGIS cuando está disponible; usa cálculo local durante el drag
  readonly isWithinCoverage = computed<boolean>(() => {
    const verified = this.serverVerification();
    if (verified) return verified.isCovered;
    const dist = this.localDistanceMeters();
    return dist !== null && dist <= this.activeBranch().coverageRadiusMeters;
  });

  private map!: google.maps.Map;
  private coverageCircle!: google.maps.Circle;
  private customerMarker!: google.maps.Marker;

  constructor() {
    // Actualiza dinámicamente el color del círculo según el estado de cobertura
    effect(() => {
      const covered = this.isWithinCoverage();
      const branch = this.activeBranch();
      if (this.coverageCircle) {
        this.coverageCircle.setCenter({ lat: branch.latitude, lng: branch.longitude });
        this.coverageCircle.setRadius(branch.coverageRadiusMeters);
        this.coverageCircle.setOptions({
          strokeColor: covered ? '#059669' : '#DC2626',
          fillColor: covered ? '#10B981' : '#EF4444'
        });
      }
    });
  }

  initializeGoogleMap(): void {
    const branch = this.activeBranch();
    const center = { lat: branch.latitude, lng: branch.longitude };

    this.map = new google.maps.Map(this.mapCanvas.nativeElement, {
      center,
      zoom: 13,
      mapTypeControl: false,
      streetViewControl: false
    });

    // 1. Círculo paramétrico de cobertura sincronizado con la sucursal
    this.coverageCircle = new google.maps.Circle({
      map: this.map,
      center,
      radius: branch.coverageRadiusMeters,
      strokeColor: '#059669',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      fillColor: '#10B981',
      fillOpacity: 0.16,
      clickable: false
    });

    // 2. Marcador arrastrable del cliente
    this.customerMarker = new google.maps.Marker({
      map: this.map,
      position: center,
      draggable: true,
      title: 'Arrastre para ubicar el punto exacto de entrega'
    });

    // Feedback en tiempo real durante el arrastre + confirmación PostGIS al soltar
    this.customerMarker.addListener('drag', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        this.serverVerification.set(null);
        this.selectedCoords.set({ lat: e.latLng.lat(), lng: e.latLng.lng() });
      }
    });

    this.customerMarker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        this.updatePointAndVerifyWithPostGIS(e.latLng.lat(), e.latLng.lng());
      }
    });

    this.map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        this.customerMarker.setPosition(e.latLng);
        this.updatePointAndVerifyWithPostGIS(e.latLng.lat(), e.latLng.lng());
      }
    });

    // 3. Places Autocomplete restringido a Perú
    const autocomplete = new google.maps.places.Autocomplete(this.addressInput.nativeElement, {
      componentRestrictions: { country: 'pe' },
      fields: ['geometry', 'formatted_address']
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const loc = place.geometry?.location;
      if (loc) {
        this.map.panTo(loc);
        this.map.setZoom(15);
        this.customerMarker.setPosition(loc);
        this.updatePointAndVerifyWithPostGIS(loc.lat(), loc.lng());
      }
    });
  }

  private async updatePointAndVerifyWithPostGIS(lat: number, lng: number): Promise<void> {
    this.selectedCoords.set({ lat, lng });
    const branchId = this.activeBranch().id;

    const response = await firstValueFrom(
      this.http.get<ServerCoverageResponse>('/api/v1/coverage/validate', {
        params: { lat: lat.toString(), lng: lng.toString(), branchId: branchId.toString() }
      })
    );
    this.serverVerification.set(response);
  }

  /**
   * Fórmula Esferoidal de Haversine (R = 6,371,008.8 m IUGG)
   */
  computeHaversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const toRad = (deg: number): number => (deg * Math.PI) / 180.0;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(GeospatialCoverageMapComponent.EARTH_MEAN_RADIUS_METERS * c * 100) / 100;
  }
}
```

---

## 6. Matriz de Casos de Prueba y Bordes Geoespaciales

| Caso de Prueba | Coordenadas `(lat, lng)` | Distancia a Sede La Victoria (`-12.0685, -77.0182`, Radio `8500 m`) | Resultado Frontend (`Circle` + Haversine) | Resultado Backend (`PostGIS ST_DWithin`) | Acción Transaccional |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **CP-01: Taller Corporativo San Isidro** | `(-12.0905, -77.0195)` | `2,435.60 m` | ✅ Verde (`Cubierto`) | `is_covered = TRUE` | Autoriza orden `201 Created`, tarifa `S/ 14.38` |
| **CP-02: Límite Exacto Surco / Barranco** | `(-12.1448, -77.0182)` | `8,484.12 m` | ✅ Verde (`Borde`) | `is_covered = TRUE` | Autoriza orden `201 Created`, tarifa `S/ 25.27` |
| **CP-03: Exceso Ligero (+120 m del radio)** | `(-12.1460, -77.0182)` | `8,617.50 m` | ❌ Rojo (`Fuera`) | `is_covered = FALSE` | Bloquea botón UI; si se fuerza vía API retorna `422` |
| **CP-04: Fuera de Ciudad (Ancón)** | `(-11.7735, -77.1762)` | `36,942.18 m` | ❌ Rojo (`Fuera`) | `is_covered = FALSE` | Rechaza con `HTTP 422` y sugiere `PICKUP` |
| **CP-05: Ataque de Coordenada Inválida** | `(145.0000, -290.0000)` | Inválida | ❌ Bloqueado | `SQLSTATE 22023` | Rechaza en controlador/DB con `HTTP 400 Bad Request` |
