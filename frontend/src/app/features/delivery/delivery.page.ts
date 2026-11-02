import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { DriverStatus, Order } from '../../core/models/api.models';
import { LiveTrackingResponse } from '../../core/models/telemetry.models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { ToastService } from '../../core/services/toast.service';
import { LiveDriverMapComponent } from '../../shared/components/live-driver-map/live-driver-map.component';

@Component({
  selector: 'app-delivery-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LiveDriverMapComponent],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] text-gray-900 pb-24 lg:pb-14">
      <!-- Clean Mobile-First Courier Header -->
      <div class="border-b border-gray-200 bg-white px-4 py-4 sm:py-5 shadow-2xs">
        <div class="mx-auto max-w-3xl space-y-3">
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <img
                src="/images/icons/repartidor.png"
                alt="Repartidor"
                width="44"
                height="44"
                loading="lazy"
                class="h-11 w-11 object-contain rounded-xl border border-orange-100 bg-orange-50/50 p-1 shadow-2xs"
              />
              <div class="space-y-0.5">
                <div class="flex items-center gap-2">
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-semibold text-orange-700">
                    Panel Motorizado PWA
                  </span>
                  <span
                    [class]="myDriverStatusBadgeClass()"
                    class="rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                  >
                    {{ formatDriverStatus(myDriverStatus()) }}
                  </span>
                </div>
                <h1 class="text-base sm:text-lg font-bold text-gray-900">
                  {{ auth.currentUser()?.fullName }}
                </h1>
              </div>
            </div>

            <button
              type="button"
              (click)="loadDeliveryOrders()"
              class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-orange-300 hover:text-orange-700 transition cursor-pointer"
            >
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>Actualizar</span>
            </button>
          </div>

          <!-- Driver Status Controls -->
          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
            <div class="flex items-center justify-between text-xs">
              <span class="font-semibold text-gray-700">Mi estado de disponibilidad actual:</span>
              <span class="text-[11px] text-gray-500">
                Evita que te asignen pedidos si estás en plena entrega o retornando.
              </span>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                [disabled]="isUpdatingStatus()"
                (click)="setOperationalStatus('DISPONIBLE')"
                [class]="
                  myDriverStatus() === 'DISPONIBLE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                "
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs text-center transition cursor-pointer disabled:opacity-50"
              >
                <img src="/images/icons/disponible.png" alt="Disponible" width="16" height="16" loading="lazy" class="h-4 w-4 object-contain shrink-0" />
                <span>Disponible en tienda</span>
              </button>
              <button
                type="button"
                [disabled]="isUpdatingStatus()"
                (click)="setOperationalStatus('RETORNANDO')"
                [class]="
                  myDriverStatus() === 'RETORNANDO'
                    ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold ring-2 ring-amber-500/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                "
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs text-center transition cursor-pointer disabled:opacity-50"
              >
                <img src="/images/icons/en_ruta.png" alt="Retornando" width="16" height="16" loading="lazy" class="h-4 w-4 object-contain shrink-0" />
                <span>Retornando a tienda</span>
              </button>
              <button
                type="button"
                [disabled]="isUpdatingStatus()"
                (click)="setOperationalStatus('FUERA_DE_TURNO')"
                [class]="
                  myDriverStatus() === 'FUERA_DE_TURNO'
                    ? 'border-gray-500 bg-gray-100 text-gray-900 font-bold ring-2 ring-gray-400/20'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                "
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs text-center transition cursor-pointer disabled:opacity-50"
              >
                <img src="/images/icons/bloquear.png" alt="Fuera de turno" width="16" height="16" loading="lazy" class="h-4 w-4 object-contain shrink-0" />
                <span>Fuera de turno</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div class="mx-auto max-w-3xl px-4 pt-5 space-y-4">
        @if (isLoading()) {
          <div class="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
            Actualizando tus entregas...
          </div>
        } @else if (orders().length === 0) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-2xs">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
            <h2 class="text-base font-bold text-gray-900">No tienes entregas pendientes</h2>
            <p class="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
              Cuando el equipo de almacén termine de preparar un pedido para reparto, aparecerá aquí automáticamente.
            </p>
          </div>
        } @else {
          @for (ord of orders(); track ord.id) {
            <article class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
              <!-- Card Top -->
              <div class="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm font-bold text-gray-900">{{ ord.orderNumber }}</span>
                  @if (ord.distanceMeters || ord.calculatedDistanceMeters) {
                    <span class="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-[11px] font-medium text-gray-600">
                      {{ ((ord.distanceMeters ?? ord.calculatedDistanceMeters ?? 0) / 1000) | number: '1.2-2' }} km
                    </span>
                  }
                </div>
                <span
                  [class]="statusPillClass(ord.status)"
                  class="rounded-full border px-3 py-0.5 text-xs font-semibold"
                >
                  {{ formatStatus(ord.status) }}
                </span>
              </div>

              <!-- Destination & Recipient Info -->
              <div class="p-4 sm:p-5 space-y-3.5 text-xs">
                <div class="flex items-start justify-between gap-3">
                  <div class="space-y-0.5">
                    <span class="text-[11px] font-medium text-gray-500">Destinatario</span>
                    <p class="text-base font-bold text-gray-900">
                      {{ ord.recipientName || ord.customerName }}
                    </p>
                    @if (ord.customerBusinessName) {
                      <p class="text-xs font-medium text-gray-600">
                        {{ ord.customerBusinessName }} · <span class="font-mono">RUC {{ ord.customerTaxId }}</span>
                      </p>
                    }
                  </div>

                  @if (ord.recipientPhone) {
                    <a
                      [href]="'tel:' + ord.recipientPhone"
                      class="shrink-0 inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                    >
                      <svg class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                      </svg>
                      <span>Llamar</span>
                    </a>
                  }
                </div>

                <div class="rounded-xl border border-orange-200/80 bg-orange-50/40 p-3.5 space-y-1">
                  <span class="text-[11px] font-semibold text-orange-700">Dirección de entrega</span>
                  <p class="text-sm font-semibold text-gray-900">{{ ord.deliveryAddress }}</p>
                  @if (ord.deliveryReference) {
                    <p class="text-xs text-gray-600">Referencia: {{ ord.deliveryReference }}</p>
                  }
                  @if (ord.deliveryLatitude && ord.deliveryLongitude) {
                    <p class="font-mono text-[10px] text-gray-400">
                      Ubicación: {{ ord.deliveryLatitude }}, {{ ord.deliveryLongitude }}
                    </p>
                  }
                </div>

                <!-- Package Summary -->
                <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 pt-0.5">
                  <span>Contenido: <strong class="font-semibold text-gray-900">{{ ord.items.length }} {{ ord.items.length === 1 ? 'repuesto' : 'repuestos' }}</strong></span>
                  <span>
                    {{ ord.invoiceType === 'FACTURA' ? 'Factura' : 'Boleta' }}:
                    <strong class="font-bold text-gray-900">
                      S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                    </strong>
                  </span>
                </div>

                <!-- Driver Real-Time Navigation Map -->
                @if (ord.status === 'EN_RUTA') {
                  <div class="space-y-2 pt-2">
                    <div class="flex items-center justify-between text-xs px-1">
                      <span class="font-bold text-gray-900 flex items-center gap-1.5">
                        <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>Mi mapa de navegación GPS en vivo</span>
                      </span>
                      @if (isBroadcastingGps(ord.id)) {
                        <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <span class="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-ping"></span>
                          <span>GPS Satelital Activo</span>
                        </span>
                      }
                    </div>

                    @if (orderTelemetries()[ord.orderNumber]; as tel) {
                      <app-live-driver-map [telemetry]="tel"></app-live-driver-map>
                    }
                  </div>
                }

                <!-- Large Thumb-Friendly Mobile Action Buttons -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  <a
                    [href]="buildGoogleMapsRouteUrl(ord)"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="min-h-[48px] flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 px-4 text-xs font-semibold text-gray-800 shadow-2xs hover:border-orange-300 hover:bg-orange-50/40 hover:text-orange-700 transition"
                  >
                    <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                    </svg>
                    <span>Abrir ruta en Google Maps</span>
                  </a>

                  @if (ord.status === 'LISTO_PARA_DESPACHO') {
                    <button
                      type="button"
                      [disabled]="busyId() === ord.id"
                      (click)="startOrderRoute(ord)"
                      class="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 px-4 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                      <span>Iniciar ruta de entrega</span>
                    </button>
                  } @else if (ord.status === 'EN_RUTA') {
                    <!-- Live GPS Telemetry Broadcast Panel -->
                    <div class="rounded-xl border border-orange-200 bg-orange-50/70 p-3 space-y-2 text-xs sm:col-span-2">
                      <div class="flex items-center justify-between gap-2">
                        <span class="inline-flex items-center gap-1.5 font-bold text-gray-900">
                          <span class="relative flex h-2 w-2">
                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75"></span>
                            <span class="relative inline-flex rounded-full h-2 w-2 bg-orange-600"></span>
                          </span>
                          <span>Transmisión GPS Satelital en Tiempo Real</span>
                        </span>
                        <span class="text-[11px] font-semibold text-orange-800">
                          {{ isBroadcastingGps(ord.id) ? 'Transmitiendo satélite' : 'Pausado' }}
                        </span>
                      </div>

                      <button
                        type="button"
                        (click)="toggleGpsBroadcast(ord)"
                        [class]="isBroadcastingGps(ord.id) ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-orange-600 hover:bg-orange-700 text-white'"
                        class="w-full min-h-[42px] flex items-center justify-center gap-2 rounded-xl font-bold shadow-2xs transition cursor-pointer"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <span>{{ isBroadcastingGps(ord.id) ? 'Pausar transmisión GPS' : 'Activar transmisión GPS en Vivo' }}</span>
                      </button>

                      @if (driverCurrentCoords()[ord.id]; as coords) {
                        <div class="rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 text-[11px] text-emerald-800 flex items-center justify-between">
                          <span class="font-mono font-semibold">Coords en vivo: {{ coords.latitude | number: '1.4-4' }}, {{ coords.longitude | number: '1.4-4' }}</span>
                          <span class="font-mono text-[10px] text-emerald-700">Precisión: ±{{ coords.accuracy | number: '1.0-0' }}m</span>
                        </div>
                      }
                    </div>

                    <button
                      type="button"
                      (click)="openCompletionModal(ord)"
                      class="min-h-[48px] sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                    >
                      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Confirmar entrega</span>
                    </button>
                  }
                </div>
              </div>
            </article>
          }
        }
      </div>

      <!-- Proof of Delivery Capture Modal -->
      @if (completingOrder(); as target) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs p-4 flex items-center justify-center">
          <div class="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            <div class="border-b border-gray-200 bg-white px-5 py-4 flex items-center justify-between">
              <div>
                <span class="font-mono text-[11px] font-semibold text-orange-600">
                  {{ target.orderNumber }}
                </span>
                <h3 class="text-base font-bold text-gray-900">Confirmar entrega al cliente</h3>
              </div>
              <button
                type="button"
                (click)="closeCompletionModal()"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Cerrar ventana"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form (ngSubmit)="submitDeliveryCompletion()" class="p-5 space-y-4 text-xs">
              <!-- Camera / File Upload -->
              <div>
                <label class="block font-medium text-gray-700 mb-1.5">
                  Fotografía de entrega o guía firmada
                </label>
                <div
                  (click)="cameraInput.click()"
                  class="cursor-pointer rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/70 p-5 text-center hover:border-orange-500 hover:bg-orange-50/25 transition"
                >
                  <input
                    #cameraInput
                    type="file"
                    accept="image/*"
                    capture="environment"
                    (change)="onEvidenceFileSelected($event)"
                    class="hidden"
                  />
                  @if (evidencePreviewUrl()) {
                    <img
                      [src]="evidencePreviewUrl()"
                      alt="Vista previa de constancia"
                      class="mx-auto max-h-44 rounded-lg border border-gray-200 object-cover"
                    />
                    <p class="mt-2 text-xs text-orange-600 font-semibold">
                      Toca aquí para tomar otra fotografía
                    </p>
                  } @else {
                    <div class="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                    </div>
                    <p class="font-semibold text-gray-900">Tomar foto con cámara o subir imagen</p>
                    <p class="mt-0.5 text-[11px] text-gray-500">Se adjuntará automáticamente como constancia del pedido</p>
                  }
                </div>
              </div>

              <!-- DNI del receptor right above Nombre de quien recibe -->
              <div class="space-y-3">
                <div>
                  <label class="block font-medium text-gray-700 mb-1">
                    DNI del receptor (8 dígitos) *
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      name="receiverDoc"
                      [(ngModel)]="receiverDocument"
                      (ngModelChange)="onReceiverDocChange($event)"
                      maxlength="11"
                      inputmode="numeric"
                      required
                      placeholder="Ingresa los 8 dígitos del DNI"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-9 py-2 font-mono text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                    @if (isLookingUpReceiver()) {
                      <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        <svg class="h-4 w-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                          <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                        </svg>
                      </span>
                    }
                  </div>
                </div>

                <div>
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <label class="block font-medium text-gray-700">Nombre de quien recibe *</label>
                    @if (receiverDocVerified()) {
                      <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <svg class="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span>Verificado</span>
                      </span>
                    }
                  </div>
                  <input
                    type="text"
                    name="receiverName"
                    [(ngModel)]="receiverName"
                    required
                    placeholder="Nombre completo del receptor"
                    [class]="
                      receiverDocVerified()
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-gray-200 bg-white'
                    "
                    class="w-full min-h-[44px] rounded-xl border px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition"
                  />
                </div>
              </div>

              <!-- Location Coordinates -->
              <div class="rounded-xl border border-gray-200 bg-gray-50 p-3 flex items-center justify-between gap-2">
                <div>
                  <span class="block text-[11px] font-medium text-gray-500">
                    Ubicación de entrega
                  </span>
                  <span class="font-mono text-xs font-medium text-gray-800">
                    {{ capturedLat() ?? '—' }}, {{ capturedLng() ?? '—' }}
                  </span>
                </div>
                <button
                  type="button"
                  (click)="captureDeviceGps(target)"
                  class="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                >
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>Actualizar ubicación</span>
                </button>
              </div>

              <div>
                <label class="block font-medium text-gray-700 mb-1">Observaciones</label>
                <input
                  type="text"
                  name="notes"
                  [(ngModel)]="deliveryNotes"
                  placeholder="Entregado conforme en recepción"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <div class="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  (click)="closeCompletionModal()"
                  class="min-h-[44px] rounded-xl border border-gray-200 bg-white py-2.5 font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="submittingProof() || !receiverName.trim() || !receiverDocument.trim()"
                  class="min-h-[44px] rounded-xl bg-orange-600 py-2.5 font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {{ submittingProof() ? 'Guardando...' : 'Finalizar entrega' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }
    </div>
  `,
})
export class DeliveryPageComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly lookupService = inject(LookupService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<Order[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly busyId = signal<number | null>(null);

  readonly myDriverStatus = signal<DriverStatus>('DISPONIBLE');
  readonly isUpdatingStatus = signal<boolean>(false);

  readonly completingOrder = signal<Order | null>(null);
  readonly submittingProof = signal<boolean>(false);
  readonly evidencePreviewUrl = signal<string>('');
  readonly capturedLat = signal<number | null>(null);
  readonly capturedLng = signal<number | null>(null);
  readonly isLookingUpReceiver = signal<boolean>(false);
  readonly receiverDocVerified = signal<boolean>(false);
  private lastLookedUpReceiverDoc = '';

  readonly activeGpsWatches = signal<Record<number, number>>({});
  readonly orderTelemetries = signal<Record<string, LiveTrackingResponse>>({});
  readonly driverCurrentCoords = signal<Record<number, { latitude: number; longitude: number; accuracy: number }>>({});

  evidenceFile: File | null = null;
  receiverName = '';
  receiverDocument = '';
  deliveryNotes = 'Entregado conforme en dirección indicada.';

  ngOnInit(): void {
    this.loadDeliveryOrders();
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'LISTO_PARA_DESPACHO':
        return 'Listo para recoger';
      case 'EN_RUTA':
        return 'En camino';
      case 'ENTREGADO':
        return 'Entregado';
      default:
        return status;
    }
  }

  statusPillClass(status: string): string {
    switch (status) {
      case 'EN_RUTA':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'ENTREGADO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  formatDriverStatus(status: DriverStatus): string {
    switch (status) {
      case 'DISPONIBLE':
        return 'Disponible';
      case 'EN_RUTA':
        return 'En ruta';
      case 'RETORNANDO':
        return 'Retornando';
      case 'FUERA_DE_TURNO':
        return 'Fuera de servicio';
      default:
        return status;
    }
  }

  myDriverStatusBadgeClass(): string {
    switch (this.myDriverStatus()) {
      case 'DISPONIBLE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
      case 'EN_RUTA':
        return 'bg-orange-50 text-orange-700 border-orange-300 animate-pulse';
      case 'RETORNANDO':
        return 'bg-amber-50 text-amber-700 border-amber-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-300';
    }
  }

  setOperationalStatus(newStatus: DriverStatus): void {
    this.isUpdatingStatus.set(true);
    this.ordersService
      .updateMyStatus(newStatus)
      .pipe(finalize(() => this.isUpdatingStatus.set(false)))
      .subscribe({
        next: (res) => {
          this.myDriverStatus.set(res.status || newStatus);
          this.toast.success(
            'Estado actualizado',
            `Tu disponibilidad cambió a: ${this.formatDriverStatus(newStatus)}.`
          );
        },
        error: (err) => {
          this.toast.error(
            'Error al actualizar estado',
            err?.error?.message || 'No se pudo cambiar tu estado operativo.'
          );
        },
      });
  }

  loadDeliveryOrders(): void {
    this.isLoading.set(true);
    this.ordersService
      .getDeliveryOrders()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (list) => {
          this.orders.set(list);
          const hasInRoute = list.some((o) => o.status === 'EN_RUTA');
          if (hasInRoute) {
            this.myDriverStatus.set('EN_RUTA');
          }
          list.forEach((ord) => {
            if (ord.status === 'EN_RUTA') {
              this.loadOrderTelemetry(ord);
              if (!this.activeGpsWatches()[ord.id]) {
                this.toggleGpsBroadcast(ord);
              }
            }
          });
        },
        error: () => this.orders.set([]),
      });
  }

  loadOrderTelemetry(ord: Order): void {
    this.telemetryService.getOrderLiveTelemetry(ord.orderNumber).subscribe({
      next: (telemetry) => {
        if (telemetry) {
          this.orderTelemetries.update((prev) => ({
            ...prev,
            [ord.orderNumber]: telemetry,
          }));
        }
      },
      error: () => {},
    });
  }

  buildGoogleMapsRouteUrl(order: Order): string {
    const originLat = order.branchLatitude ?? -12.0685;
    const originLng = order.branchLongitude ?? -77.0282;
    if (order.deliveryLatitude && order.deliveryLongitude) {
      return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${order.deliveryLatitude},${order.deliveryLongitude}&travelmode=driving`;
    }
    const dest = encodeURIComponent(order.deliveryAddress || 'Lima, Peru');
    return `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${dest}&travelmode=driving`;
  }

  startOrderRoute(order: Order): void {
    this.busyId.set(order.id);
    this.ordersService
      .startRoute(order.id)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (updated) => {
          this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
          this.myDriverStatus.set('EN_RUTA');
          this.loadOrderTelemetry(updated);
          this.toggleGpsBroadcast(updated);
          this.toast.success('Ruta iniciada', `El pedido ${updated.orderNumber} está en camino y el GPS está activo.`);
        },
        error: (err) =>
          this.toast.error('No se pudo iniciar la ruta', err?.error?.message || 'Inténtalo nuevamente.'),
      });
  }

  openCompletionModal(order: Order): void {
    this.completingOrder.set(order);
    this.receiverName = order.recipientName || order.customerName || '';
    this.receiverDocument = '';
    this.receiverDocVerified.set(false);
    this.lastLookedUpReceiverDoc = '';
    this.deliveryNotes = 'Entregado conforme al destinatario.';
    this.capturedLat.set(order.deliveryLatitude ?? -12.0931);
    this.capturedLng.set(order.deliveryLongitude ?? -77.0265);
    this.clearPreview();
  }

  onReceiverDocChange(rawValue: string): void {
    const digits = (rawValue || '').replace(/\D/g, '');
    if (digits !== rawValue) {
      this.receiverDocument = digits;
    }

    if (digits.length !== 8 && digits.length !== 11) {
      this.receiverDocVerified.set(false);
      if (digits.length < 8) {
        this.lastLookedUpReceiverDoc = '';
      }
      return;
    }

    if (digits === this.lastLookedUpReceiverDoc) {
      return;
    }
    this.lastLookedUpReceiverDoc = digits;
    this.isLookingUpReceiver.set(true);

    this.lookupService
      .lookupDocument(digits)
      .pipe(finalize(() => this.isLookingUpReceiver.set(false)))
      .subscribe({
        next: (res) => {
          const resolvedName = (res.fullName || res.businessName || '').trim();
          if (res.found && resolvedName) {
            this.receiverName = resolvedName;
            this.receiverDocVerified.set(true);
          } else {
            this.receiverDocVerified.set(false);
          }
        },
        error: () => {
          this.receiverDocVerified.set(false);
        },
      });
  }

  closeCompletionModal(): void {
    this.completingOrder.set(null);
    this.clearPreview();
  }

  onEvidenceFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.clearPreview();
    this.evidenceFile = file;
    this.evidencePreviewUrl.set(URL.createObjectURL(file));
  }

  captureDeviceGps(order: Order): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          this.capturedLat.set(Number(pos.coords.latitude.toFixed(6)));
          this.capturedLng.set(Number(pos.coords.longitude.toFixed(6)));
          this.toast.success('Ubicación actualizada', 'Se registraron las coordenadas actuales.');
        },
        () => {
          this.capturedLat.set(order.deliveryLatitude ?? -12.0931);
          this.capturedLng.set(order.deliveryLongitude ?? -77.0265);
          this.toast.info('Ubicación del pedido', 'Usando las coordenadas registradas en el pedido.');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    }
  }

  submitDeliveryCompletion(): void {
    const order = this.completingOrder();
    if (!order) return;

    const finalizeSubmit = (fileToUpload: File) => {
      this.submittingProof.set(true);
      this.ordersService
        .completeDelivery(order.id, {
          evidenceImage: fileToUpload,
          receiverName: this.receiverName.trim(),
          receiverDocument: this.receiverDocument.trim(),
          deliveryNotes: this.deliveryNotes.trim(),
          capturedLatitude: this.capturedLat(),
          capturedLongitude: this.capturedLng(),
        })
        .pipe(finalize(() => this.submittingProof.set(false)))
        .subscribe({
          next: (updated) => {
            this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
            this.myDriverStatus.set('RETORNANDO');
            this.toast.success(
              `Pedido ${updated.orderNumber} entregado`,
              'Se registró la constancia de recepción correctamente. Tu estado cambió a: Retornando.'
            );
            this.closeCompletionModal();
          },
          error: (err) =>
            this.toast.error(
              'Error al confirmar entrega',
              err?.error?.message || 'Revisa los datos ingresados.'
            ),
        });
    };

    if (this.evidenceFile) {
      finalizeSubmit(this.evidenceFile);
    } else {
      this.generateDigitalSignedReceiptFile(order.orderNumber).then((autoFile) =>
        finalizeSubmit(autoFile)
      );
    }
  }

  private generateDigitalSignedReceiptFile(orderNumber: string): Promise<File> {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 400;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, 640, 400);
        ctx.fillStyle = '#EA580C';
        ctx.fillRect(0, 0, 640, 12);
        ctx.strokeStyle = '#E5E7EB';
        ctx.lineWidth = 2;
        ctx.strokeRect(20, 28, 600, 352);
        ctx.fillStyle = '#EA580C';
        ctx.font = 'bold 20px sans-serif';
        ctx.fillText('REPUESTOS ASUNCIÓN · CONSTANCIA DE ENTREGA', 44, 72);
        ctx.fillStyle = '#111827';
        ctx.font = 'bold 19px monospace';
        ctx.fillText(`PEDIDO: ${orderNumber}`, 44, 124);
        ctx.fillStyle = '#374151';
        ctx.font = '16px sans-serif';
        ctx.fillText(`Recibido por: ${this.receiverName}`, 44, 170);
        ctx.fillText(`Documento: ${this.receiverDocument}`, 44, 204);
        ctx.fillText(`Ubicación: ${this.capturedLat()}, ${this.capturedLng()}`, 44, 238);
        ctx.fillStyle = '#047857';
        ctx.font = 'bold 16px sans-serif';
        ctx.fillText(`Entrega conforme · ${new Date().toLocaleString()}`, 44, 312);
      }
      canvas.toBlob((blob) => {
        const b = blob || new Blob(['proof'], { type: 'image/png' });
        resolve(new File([b], `constancia-${orderNumber}.png`, { type: 'image/png' }));
      }, 'image/png');
    });
  }

  isBroadcastingGps(orderId: number): boolean {
    return Boolean(this.activeGpsWatches()[orderId]);
  }

  toggleGpsBroadcast(ord: Order): void {
    const currentWatch = this.activeGpsWatches()[ord.id];
    if (currentWatch) {
      if ('geolocation' in navigator) {
        navigator.geolocation.clearWatch(currentWatch);
      }
      const updatedWatches = { ...this.activeGpsWatches() };
      delete updatedWatches[ord.id];
      this.activeGpsWatches.set(updatedWatches);

      const updatedCoords = { ...this.driverCurrentCoords() };
      delete updatedCoords[ord.id];
      this.driverCurrentCoords.set(updatedCoords);

      this.toast.info('GPS en pausa', `Transmisión satelital pausada para el pedido ${ord.orderNumber}.`);
      return;
    }

    if (!('geolocation' in navigator)) {
      this.toast.error('GPS no disponible', 'Tu dispositivo o navegador no soporta geolocalización satelital.');
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const speedKmh = Number(((pos.coords.speed ?? 0) * 3.6).toFixed(1));
        const headingDegrees = Number((pos.coords.heading ?? 0).toFixed(1));
        const accuracyMeters = Number(pos.coords.accuracy.toFixed(1));

        // Actualizar coordenadas en vivo del repartidor en pantalla
        this.driverCurrentCoords.update((prev) => ({
          ...prev,
          [ord.id]: { latitude: lat, longitude: lng, accuracy: accuracyMeters },
        }));

        // Enviar ping satelital real al backend con orderId y orderNumber
        this.telemetryService
          .sendDriverPing({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            latitude: lat,
            longitude: lng,
            speedKmh,
            headingDegrees,
            accuracyMeters,
            status: 'EN_RUTA',
          })
          .subscribe({
            error: () => {},
          });

        // Actualizar el mapa satelital local del repartidor de inmediato
        this.updateLocalTelemetry(ord, lat, lng, speedKmh, headingDegrees);
      },
      (err) => {
        this.toast.error('Error GPS', `No se pudo obtener señal satelital: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    this.activeGpsWatches.set({
      ...this.activeGpsWatches(),
      [ord.id]: watchId,
    });

    this.toast.success(
      'GPS Activo',
      `Transmitiendo ubicación satelital en tiempo real para ${ord.orderNumber}.`
    );
  }

  private updateLocalTelemetry(
    ord: Order,
    curLat: number,
    curLng: number,
    speedKmh: number,
    headingDegrees: number
  ): void {
    const destLat = ord.deliveryLatitude ?? curLat + 0.015;
    const destLng = ord.deliveryLongitude ?? curLng + 0.015;
    const distMeters = this.calculateDistanceMeters(curLat, curLng, destLat, destLng);
    const etaMin = Math.max(1, Math.round((distMeters / 1000) / (Math.max(speedKmh, 20) / 60)));

    const currentTel = this.orderTelemetries()[ord.orderNumber];
    const updatedTelemetry: LiveTrackingResponse = {
      orderId: ord.id,
      orderNumber: ord.orderNumber,
      orderStatus: 'EN_RUTA',
      status: 'EN_RUTA',
      driverId: ord.assignedDriverId ?? 1,
      driverName: ord.assignedDriverName || this.auth.currentUser()?.fullName || 'Repartidor Motorizado Asunción',
      driverPhone: this.auth.currentUser()?.phone || '',
      currentLatitude: curLat,
      currentLongitude: curLng,
      destinationLatitude: destLat,
      destinationLongitude: destLng,
      destinationAddress: ord.deliveryAddress || 'Destino cliente',
      originLatitude: ord.branchLatitude ?? -12.0685,
      originLongitude: ord.branchLongitude ?? -77.0282,
      branchName: ord.branchName || 'Tienda Asunción',
      speedKmh,
      headingDegrees,
      distanceRemainingMeters: distMeters,
      etaMinutes: etaMin,
      statusMessage: `Repartidor en camino · Velocidad: ${speedKmh} km/h`,
      isLive: true,
      lastPingAt: new Date().toISOString(),
      routeHistory: currentTel?.routeHistory
        ? [...currentTel.routeHistory, { latitude: curLat, longitude: curLng, timestamp: new Date().toISOString(), speedKmh, headingDegrees }]
        : [{ latitude: curLat, longitude: curLng, timestamp: new Date().toISOString(), speedKmh, headingDegrees }],
      noSqlEngine: 'MongoDB NoSQL Engine',
      noSqlCollection: 'driver_telemetry',
    };

    this.orderTelemetries.update((prev) => ({
      ...prev,
      [ord.orderNumber]: updatedTelemetry,
    }));
  }

  private calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  private clearAllGpsWatches(): void {
    if ('geolocation' in navigator) {
      for (const watchId of Object.values(this.activeGpsWatches())) {
        navigator.geolocation.clearWatch(watchId);
      }
    }
    this.activeGpsWatches.set({});
    this.driverCurrentCoords.set({});
  }

  private clearPreview(): void {
    if (this.evidencePreviewUrl()) {
      URL.revokeObjectURL(this.evidencePreviewUrl());
      this.evidencePreviewUrl.set('');
    }
    this.evidenceFile = null;
  }

  ngOnDestroy(): void {
    this.clearAllGpsWatches();
    this.clearPreview();
  }
}
