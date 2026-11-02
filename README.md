# Repuestos Automotrices Asunción — Plataforma ERP, E-Commerce B2C/B2B & Logística Geoespacial

Sistema empresarial desacoplado, modularizado y **Cloud-Ready** diseñado para la cadena de repuestos automotrices **"Asunción"**, integrando gestión avanzada de autopartes (OEM/SKU/Compatibilidad Vehicular N:M), analítica ejecutiva, comercio electrónico B2C/B2B con asistente Chatbot híbrido, validación geoespacial estricta de cobertura de entrega con **PostGIS + Google Maps Platform**, módulo operativo de **Almacén (Picking)** y **PWA para Motorizados** con captura fotográfica de comprobante de entrega en formato **WebP**.

---

## Mapa de Entregables y Estructura del Repositorio

```text
Asuncion/
├── docs/
│   ├── 01-arquitectura-cloud-ready.md         # [Entregable 1] Diagramas C4/Secuencia, RBAC y portabilidad AWS/GCP/Azure
│   └── 03-algoritmo-validacion-geoespacial.md # [Entregable 3] Lógica matemática/espacial PostGIS ST_DWithin + Angular Maps
├── database/
│   ├── 01_schema_3fn_postgis.sql              # [Entregable 2] DDL PostgreSQL 16 + PostGIS en 3FN, índices GiST, vistas y funciones
│   └── 02_seed_asuncion.sql                   # Datos semilla empresariales georreferenciados para PostgreSQL/PostGIS
├── backend/                                   # [Entregable 4A] API REST Spring Boot 3.4 (Java 21, JWT, Hibernate Spatial, WebP, S3)
│   ├── mvnw.cmd / pom.xml / Dockerfile
│   └── src/main/java/com/asuncion/erp/
├── frontend/                                  # [Entregable 4B] SPA/PWA Angular 21 (Standalone + Signals) + Tailwind CSS
│   ├── package.json / Dockerfile / nginx.conf
│   └── src/app/
├── k8s/                                       # Manifiestos Kubernetes (Namespace, ConfigMap, Deployments, HPA, Ingress)
├── docker-compose.yml                         # Orquestación completa: PostgreSQL 16/PostGIS + MinIO S3 + Backend + Frontend
├── start-dev.ps1                              # Lanzador rápido en 1 clic para Windows (sin necesidad de Docker local)
└── .env.example                               # Plantilla de variables de entorno para despliegue Cloud / Docker
```

---

## Stack Tecnológico

| Capa | Tecnología |
| :--- | :--- |
| **Backend** | Java 21 LTS, Spring Boot 3.4.3, Spring Security 6 (JWT Stateless), Spring Data JPA + Hibernate Spatial 6 (JTS `Point` SRID 4326), SpringDoc OpenAPI / Swagger |
| **Frontend** | Angular 21 (Angular 17+ Standalone Components, Signals, Lazy Routing, Functional Guards/Interceptors), PWA Manifest |
| **UI & Estilos** | Tailwind CSS v4 — Diseño industrial automotriz responsivo y mobile-first |
| **Base de Datos** | PostgreSQL 16 + PostGIS 3.4 en Tercera Forma Normal (3FN) con índices espaciales `GiST` (`dev`: H2 Spatial en memoria para prueba local instantánea) |
| **Multimedia** | Procesamiento y compresión automática a **WebP** (`webp-imageio`) + AWS SDK v2 S3 / **MinIO** (`dev`: bucket local servido en `/api/v1/media/**`) |
| **Mapas & IA** | Google Maps Platform API (Maps JS, Places, Geometry) + Mapa Táctico Georreferenciado WGS84 sin llave + Conector híbrido BD / Google Gemini API |

---

## Guía de Ejecución

### Opción A: Ejecución Local Inmediata en Windows (Sin Docker — Perfil `dev`)

El proyecto incluye un perfil `dev` predeterminado que levanta la base de datos espacial en memoria con datos semilla realistas, genera ilustraciones técnicas en formato `.webp` para todos los repuestos y activa el mapa georreferenciado interactivo incluso antes de configurar una API Key de Google Maps.

**1. Inicio automático en un solo comando (PowerShell):**
```powershell
.\start-dev.ps1
```

**O inicio manual en dos terminales:**
```powershell
# Terminal 1 - Backend Spring Boot 3 (Puerto 8080)
cd backend
.\mvnw.cmd spring-boot:run

# Terminal 2 - Frontend Angular + Tailwind CSS (Puerto 4200)
cd frontend
npm start
```

- **Aplicación Web & ERP**: http://localhost:4200
- **API REST Base**: http://localhost:8080/api/v1
- **Documentación Swagger / OpenAPI**: http://localhost:8080/swagger-ui.html

---

### Opción B: Despliegue Completo con Docker Compose (PostgreSQL 16/PostGIS + MinIO S3)

```bash
cp .env.example .env
docker compose up --build -d
```

Servicios levantados automáticamente:
- **Frontend Angular (Nginx Reverse Proxy)**: http://localhost
- **Backend Spring Boot 3 (Perfil `docker`)**: http://localhost:8080/swagger-ui.html
- **Consola MinIO Object Storage (`asuncion-media`)**: http://localhost:9001 (`minioadmin` / `AsuncionMinio2026!`)
- **PostgreSQL 16 + PostGIS 3.4**: `localhost:5432` (inicializado con `01_schema_3fn_postgis.sql` + `02_seed_asuncion.sql`)

---

## Credenciales Demo RBAC (5 Roles Granulares)

En la pantalla `/login` dispones de **botones de acceso rápido en 1 clic** para evaluar cada módulo según su rol. Contraseña común para todas las cuentas semilla: **`Asuncion2026!`**

| Rol | Correo Electrónico | Usuario / Perfil | Módulo Principal |
| :--- | :--- | :--- | :--- |
| **`ADMIN`** | `admin@asuncion.pe` | Carlos Mendoza | Panel ERP completo, Dashboard Ejecutivo, Repuestos WebP, Radio PostGIS |
| **`VENDEDOR`** | `ventas1@asuncion.pe` | Lucía Paredes | Gestión comercial, catálogo técnico, ranking y cumplimiento de cuotas |
| **`ALMACENERO`** | `almacen@asuncion.pe` | Roberto Huamán | Tablero de Picking por ubicación de estantería (`/warehouse`) |
| **`MOTORIZADO`** | `motorizado@asuncion.pe` | Miguel Ángel Soto | App PWA de reparto con ruta GPS y captura de evidencia WebP (`/delivery`) |
| **`CLIENTE`** | `cliente@empresa.pe` | Martín Torres (B2B) | Catálogo con filtro vehicular, zoom HD, checkout geoespacial y tracking |

---

## Configuración Opcional de APIs Externas

1. **Google Maps Platform API Key**:
   - Haz clic en el botón **"API Key Google Maps"** directamente sobre el componente de mapa en `/checkout` o `/admin` para guardarla dinámicamente, o configúrala en `frontend/src/environments/environment.ts`.
   - Al ingresarla, el componente carga automáticamente `Maps JavaScript API`, `Places Autocomplete` y `Geometry Library` renderizando `google.maps.Circle` en tiempo real. Sin API Key, funciona de inmediato con el **Mapa Táctico Georreferenciado WGS84 de Lima**.
2. **Google Gemini API Key (Chatbot Híbrido)**:
   - Define la variable de entorno `GEMINI_API_KEY` al iniciar el backend para enriquecer con IA generativa (RAG) las respuestas transaccionales obtenidas en vivo desde el inventario y los pedidos.

---

## Ejecución de Pruebas Automatizadas

```powershell
# Pruebas de integración Backend (JWT/RBAC, Cobertura Geoespacial HTTP 422, Flujo Logístico WebP, Chatbot y Analítica)
cd backend
.\mvnw.cmd test

# Compilación de producción Frontend (Verificación estricta de TypeScript, Signals y Tailwind CSS)
cd frontend
npm run build
```
