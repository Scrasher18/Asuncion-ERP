# Repuestos Automotrices Asunción · Frontend Cloud-Ready (Angular 21 + Signals + Tailwind CSS)

Interfaz web empresarial para **Repuestos Automotrices Asunción**, desarrollada con **Angular 21 (Standalone Components & Signals)**, **Tailwind CSS v4**, **Google Maps Platform API** (modo dual con fallback táctico georreferenciado WGS84 de Lima Metropolitana) y soporte **PWA** para repartidores motorizados.

## Módulos Implementados

1. **Portal E-Commerce B2C / B2B (`/`, `/part/:id`, `/checkout`, `/track`, `/my-orders`)**:
   - Selector multivariable de compatibilidad vehicular (**Marca → Modelo → Año → Categoría**) y buscador predictivo por código **OEM**, **SKU** o descripción.
   - Ficha técnica de repuesto con galería HD, **lupa interactiva de coordenadas (`mousemove` zoom 2.4x)** y matriz de compatibilidad N:M.
   - Carrito reactivo con Signals, precios minoristas B2C y tarifa mayorista B2B, emisión de **Boleta (DNI)** o **Factura (RUC)** y validación geoespacial en vivo contra **PostGIS**.
   - **Chatbot Técnico Híbrido** flotante con chips de respuesta rápida, tarjetas de repuestos sugeridos y rastreo inline de pedidos.

2. **Entregables Críticos Reutilizables (`src/app/shared/components/`)**:
   - `PartImageUploaderComponent`: Zona drag-and-drop multi-imagen con previsualización instantánea en cliente, reordenamiento arrastrable, estimación de optimización **WebP** hacia Object Storage (S3/MinIO) y selección de **Imagen Principal**.
   - `CoverageMapComponent`: Motor dual que carga dinámicamente **Google Maps JavaScript API (`places`, `geometry`)** con `google.maps.Circle` paramétrico y marcador arrastrable cuando se configura una API Key (en `environment.ts` o desde el botón integrado **"Configurar Google Maps API Key"**), e incluye un **Mapa Táctico Georreferenciado WGS84 de Lima Metropolitana** sin requerir llave para pruebas locales instantáneas.

3. **Core ERP & Dashboard Ejecutivo (`/admin`)**:
   - KPIs ejecutivos, **Ranking Dinámico de Vendedores** con barras de cumplimiento de cuota, reporte comparativo de **Alta Rotación vs. Inventario Estancado**, gestor técnico de repuestos OEM/WebP y configurador paramétrico del radio de cobertura geoespacial por sucursal.

4. **Operaciones de Almacén (`/warehouse`) y App Motorizado PWA (`/delivery`)**:
   - Checklist interactivo de picking por ubicación física de anaquel (`PAS-A1-EST-04`) y asignación de repartidor.
   - Interfaz móvil PWA con apertura de ruta GPS en Google Maps, transición a `EN_RUTA` y captura fotográfica de comprobante de entrega + coordenadas GPS.

## Ejecución Local

```bash
npm install
npm start
# Abre http://localhost:4200 (conecta contra http://localhost:8080/api/v1)
```

## Compilación de Producción y Docker

```bash
npm run build
docker build -t asuncion-frontend:latest .
```
