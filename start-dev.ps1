# ==============================================================================
# Script de Inicio Rápido Local (Sin Docker) - Repuestos Automotrices Asunción
# Ejecuta Backend Spring Boot 3 (Java 21, perfil dev) + Frontend Angular (4200)
# ==============================================================================

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not $env:JAVA_HOME -and (Test-Path "C:\Program Files\Java\jdk-21")) {
    $env:JAVA_HOME = "C:\Program Files\Java\jdk-21"
}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  REPUESTOS AUTOMOTRICES ASUNCION - ERP & E-COMMERCE PLATFORM   " -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "JAVA_HOME : $env:JAVA_HOME" -ForegroundColor Gray
Write-Host ""

Write-Host "[1/2] Iniciando Backend Spring Boot 3 (Perfil: dev) en http://localhost:8080 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "`$env:JAVA_HOME='$env:JAVA_HOME'; Set-Location '$RootDir\backend'; .\mvnw.cmd spring-boot:run"

Write-Host "[2/2] Iniciando Frontend Angular + Tailwind CSS en http://localhost:4200 ..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootDir\frontend'; npm start"

Write-Host ""
Write-Host "Servicios lanzados en ventanas independientes:" -ForegroundColor Green
Write-Host "  -> Portal Web & ERP : http://localhost:4200"
Write-Host "  -> API REST Base    : http://localhost:8080/api/v1"
Write-Host "  -> Swagger OpenAPI  : http://localhost:8080/swagger-ui.html"
Write-Host ""
Write-Host "Credenciales Demo RBAC (Password para todos: Asuncion2026!):" -ForegroundColor Cyan
Write-Host "  - ADMIN      : admin@asuncion.pe"
Write-Host "  - VENDEDOR   : ventas1@asuncion.pe"
Write-Host "  - ALMACENERO : almacen@asuncion.pe"
Write-Host "  - MOTORIZADO : motorizado@asuncion.pe"
Write-Host "  - CLIENTE    : cliente@empresa.pe"
