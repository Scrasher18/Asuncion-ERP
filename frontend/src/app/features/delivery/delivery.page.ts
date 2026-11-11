import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, interval, Subscription } from 'rxjs';
import { DriverStatus, Order } from '../../core/models/api.models';
import { LiveTrackingResponse } from '../../core/models/telemetry.models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService, StoreWalletConfig, DEFAULT_WALLET_CONFIG } from '../../core/services/payment.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { ToastService } from '../../core/services/toast.service';
import { SoundService } from '../../core/services/sound.service';
import { LiveDriverMapComponent } from '../../shared/components/live-driver-map/live-driver-map.component';

@Component({
  selector: 'app-delivery-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LiveDriverMapComponent],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] text-gray-900 pb-24 lg:pb-14">
      <!-- Clean Mobile-First Courier Header -->
      <div class="relative border-b border-gray-200 bg-white px-4 py-4 sm:py-5 shadow-2xs overflow-hidden">
        <div class="absolute inset-x-0 top-0 h-1 bg-linear-to-r from-orange-500 via-orange-600 to-amber-500"></div>
        <div class="mx-auto max-w-3xl space-y-3.5">
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
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-[11px] font-bold text-orange-700">
                    Logística & Despacho GPS
                  </span>
                  <span
                    [class]="myDriverStatusBadgeClass()"
                    class="rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide"
                  >
                    {{ formatDriverStatus(myDriverStatus()) }}
                  </span>
                </div>
                <h1 class="text-base sm:text-lg font-extrabold tracking-tight text-gray-900">
                  {{ auth.currentUser()?.fullName }}
                </h1>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="hidden sm:flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs">
                <span class="text-gray-500">Asignados:</span>
                <strong class="font-mono font-bold text-gray-900 tabular-nums">{{ displayOrders().length }}</strong>
              </div>
              <div class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 shadow-2xs">
                <span class="relative flex h-2 w-2">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Sincronizado en vivo</span>
              </div>
            </div>
          </div>

          <!-- Driver Status Controls -->
          <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3 space-y-2">
            @if (myDriverStatus() === 'RETORNANDO') {
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="text-base">🛵</span>
                  <div>
                    <p class="font-bold">Retornando a tienda en curso</p>
                    <p class="text-[11px] text-amber-800">
                      Al llegar a la sede pulsa "Disponible en tienda" o el sistema te pondrá en Disponible automáticamente.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="setOperationalStatus('DISPONIBLE')"
                  class="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700 transition cursor-pointer"
                >
                  Llegué a tienda
                </button>
              </div>
            }
            <div class="flex flex-wrap items-center justify-between gap-1 text-xs">
              <span class="font-bold text-gray-700">Estado operativo en turno:</span>
              <span class="text-[11px] text-gray-500">
                Sincronizado en vivo con el panel de despacho de tienda
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
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs text-center transition cursor-pointer disabled:opacity-50"
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
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs text-center transition cursor-pointer disabled:opacity-50"
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
                class="flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs text-center transition cursor-pointer disabled:opacity-50"
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
        } @else if (displayOrders().length === 0) {
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
          @for (ord of displayOrders(); track ord.id) {
            <article class="relative rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
              <div [class]="ord.status === 'EN_RUTA' ? 'bg-orange-600' : 'bg-amber-500'" class="h-1 w-full"></div>
              <!-- Card Top -->
              <div class="border-b border-gray-100 bg-gray-50/80 px-4 py-3 flex items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="font-mono text-sm font-extrabold text-gray-900">{{ ord.orderNumber }}</span>
                  @if (ord.distanceMeters || ord.calculatedDistanceMeters) {
                    <span class="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 tabular-nums">
                      {{ ((ord.distanceMeters ?? ord.calculatedDistanceMeters ?? 0) / 1000) | number: '1.2-2' }} km
                    </span>
                  }
                </div>
                <span
                  [class]="statusPillClass(ord.status)"
                  class="rounded-full border px-3 py-0.5 text-xs font-bold"
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

                <!-- Cash Payment / Collection Instruction Strip for Driver -->
                @if (ord.notes && ord.notes.includes('[PAGO')) {
                  <div class="rounded-xl border-2 border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 font-bold flex items-start gap-2.5 shadow-2xs">
                    <span class="text-base shrink-0">💵</span>
                    <div class="space-y-0.5">
                      <span class="block text-[10px] font-black uppercase tracking-wider text-amber-800">Instrucción de Cobro Presencial</span>
                      <p class="text-xs font-extrabold text-amber-950">{{ ord.notes }}</p>
                    </div>
                  </div>
                }

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

                  <button
                    type="button"
                    (click)="openQrCobroModal(ord)"
                    class="min-h-[48px] sm:col-span-2 inline-flex items-center justify-center gap-2 rounded-xl border border-purple-300 bg-purple-50/80 py-3 px-4 text-xs font-bold text-purple-900 shadow-2xs hover:bg-purple-100 transition cursor-pointer"
                  >
                    <img src="/images/icons/yape.jpg" alt="Yape" class="h-4 w-4 rounded object-contain" />
                    <img src="/images/icons/plin.png" alt="Plin" class="h-4 w-4 rounded object-contain" />
                    <span>Mostrar QR de Cobro (Yape / Plin)</span>
                  </button>

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
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        (click)="openCompletionModal(ord)"
                        class="min-h-[48px] flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 px-4 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Confirmar entrega</span>
                      </button>

                      <button
                        type="button"
                        (click)="openIncidentModal(ord)"
                        class="min-h-[48px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3.5 py-3 text-xs font-bold text-rose-700 hover:bg-rose-100 transition cursor-pointer"
                        title="Reportar que el cliente no recibió el pedido para reincorporar el stock"
                      >
                        <svg class="h-4 w-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                        </svg>
                        <span>No recibido</span>
                      </button>
                    </div>
                  }
                </div>
              </div>
            </article>
          }
        }
      </div>

      <!-- Proof of Delivery Capture Modal -->
      @if (completingOrder(); as target) {
        <div class="fixed inset-0 z-[9999] overflow-y-auto bg-gray-900/60 backdrop-blur-xs p-4 flex items-center justify-center" style="isolation: isolate;">
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

              <!-- Security PIN Input -->
              <div class="rounded-xl border-2 p-3.5 space-y-1.5"
                [class]="completionError() ? 'border-red-400 bg-red-50/40' : 'border-orange-200 bg-orange-50/50'">
                <label class="block font-bold text-gray-900 text-xs flex items-center justify-between">
                  <span class="flex items-center gap-1.5 text-orange-800">
                    <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    Código de Seguridad del Cliente (PIN de 4 dígitos) *
                  </span>
                  <span class="text-[10px] uppercase font-mono font-bold tracking-wider text-orange-600 bg-white px-2 py-0.5 rounded border border-orange-200">Obligatorio</span>
                </label>
                <input
                  type="text"
                  name="securityCode"
                  [(ngModel)]="securityCode"
                  (ngModelChange)="completionError.set('')"
                  maxlength="4"
                  pattern="[0-9]*"
                  inputmode="numeric"
                  required
                  placeholder="PIN de 4 dígitos (Ej: 1234)"
                  [class]="completionError() ? 'border-red-500 ring-2 ring-red-500/20' : 'border-orange-300'"
                  class="w-full min-h-[46px] rounded-xl border bg-white px-3.5 py-2 text-center font-mono text-xl font-black tracking-widest text-gray-900 placeholder-gray-300 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition"
                />
                <p class="text-[10.5px] text-gray-500 leading-tight">
                  Pide al cliente el PIN único que aparece en su pantalla de seguimiento para finalizar la entrega de forma segura.
                </p>
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

              @if (completionError()) {
                <div
                  role="alert"
                  class="rounded-xl border-2 border-red-400 bg-red-50 p-3 text-xs text-red-900 flex items-start gap-2.5 shadow-2xs"
                >
                  <svg class="h-4 w-4 text-red-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  <div class="space-y-0.5">
                    <div class="font-extrabold text-red-800">Código incorrecto o no válido</div>
                    <div class="font-medium text-red-700 leading-snug">{{ completionError() }}</div>
                  </div>
                </div>
              }

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
                  [disabled]="submittingProof() || !receiverName.trim() || !receiverDocument.trim() || (receiverDocument.trim().length !== 8 && receiverDocument.trim().length !== 11) || !securityCode || securityCode.trim().length !== 4" 
                  class="min-h-[44px] rounded-xl bg-orange-600 py-2.5 font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  {{ submittingProof() ? 'Guardando...' : 'Finalizar entrega' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- MODAL DE INCIDENCIA / ENTREGA NO REALIZADA -->
      @if (incidentOrder(); as incTarget) {
        <div class="fixed inset-0 z-[9999] overflow-y-auto bg-gray-900/60 backdrop-blur-xs p-4 flex items-center justify-center" style="isolation: isolate;">
          <div class="w-full max-w-md rounded-2xl border border-rose-200 bg-white shadow-2xl overflow-hidden">
            <div class="border-b border-rose-100 bg-rose-50/70 px-5 py-4 flex items-center justify-between">
              <div>
                <span class="font-mono text-[11px] font-bold text-rose-700">
                  INCIDENCIA · {{ incTarget.orderNumber }}
                </span>
                <h3 class="text-sm font-extrabold text-gray-900">
                  Reportar Entrega No Realizada
                </h3>
              </div>
              <button
                type="button"
                (click)="closeIncidentModal()"
                class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div class="p-5 space-y-4 text-xs">
              <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900 leading-relaxed">
                <strong>Reincorporación de Stock:</strong> Al registrar que el cliente no recibió o rechazó el pedido, los repuestos se restituirán de forma automática al stock disponible en el inventario del almacén central.
              </div>

              <div>
                <label class="block font-bold text-gray-700 mb-1">Motivo principal:</label>
                <select
                  [(ngModel)]="incidentReason"
                  class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:border-rose-600 focus:outline-none"
                >
                  <option value="Cliente rechazó el pedido en puerta">Cliente rechazó el pedido en puerta</option>
                  <option value="Cliente ausente (no atiende llamadas ni timbre)">Cliente ausente (no atiende llamadas ni timbre)</option>
                  <option value="Cliente no contaba con el dinero en efectivo acordado">Cliente no contaba con el dinero en efectivo acordado</option>
                  <option value="Dirección errónea o zona de alto riesgo inaccesible">Dirección errónea o zona inaccesible</option>
                </select>
              </div>

              <div>
                <label class="block font-bold text-gray-700 mb-1">Detalle u observaciones del motorizado:</label>
                <textarea
                  [(ngModel)]="incidentNotes"
                  rows="2"
                  placeholder="Detalla qué ocurrió al llegar a la dirección..."
                  class="w-full rounded-xl border border-gray-200 p-2.5 text-xs text-gray-900 focus:border-rose-600 focus:outline-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  (click)="closeIncidentModal()"
                  class="min-h-[44px] rounded-xl border border-gray-200 bg-white py-2.5 font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Regresar
                </button>
                <button
                  type="button"
                  [disabled]="submittingIncident()"
                  (click)="confirmDeliveryIncident()"
                  class="min-h-[44px] rounded-xl bg-rose-600 py-2.5 font-bold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {{ submittingIncident() ? 'Restituyendo stock...' : 'Confirmar no entrega' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      }

      <!-- MODAL DE COBRO CON QR (YAPE / PLIN) EN RUTA -->
      @if (qrCobroOrder(); as qrOrd) {
        <div class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fadeIn" style="isolation: isolate;">
          <div class="relative w-full max-w-sm rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 border border-gray-100">
            <!-- Header -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
                  <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                </span>
                <div>
                  <h3 class="text-sm font-bold text-gray-900">QR de Cobro al Cliente</h3>
                  <p class="text-[11px] text-gray-500">Pedido #{{ qrOrd.orderNumber }}</p>
                </div>
              </div>
              <button
                type="button"
                (click)="closeQrCobroModal()"
                class="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Total Amount Card -->
            <div class="rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white text-center shadow-xs">
              <span class="text-xs uppercase tracking-wider font-semibold opacity-90">Total a cobrar al cliente</span>
              <p class="text-3xl font-black tracking-tight mt-0.5">
                S/ {{ (qrOrd.totalAmount ?? qrOrd.total ?? 0) | number: '1.2-2' }}
              </p>
              <p class="text-[11px] opacity-90 truncate mt-0.5">{{ qrOrd.recipientName || qrOrd.customerName }}</p>
            </div>

            <!-- Tab Selector: Yape vs Plin -->
            <div class="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-xl">
              <button
                type="button"
                (click)="selectedQrTab.set('YAPE')"
                [class]="selectedQrTab() === 'YAPE' ? 'bg-purple-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900 font-medium'"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs transition cursor-pointer"
              >
                <img src="/images/icons/yape.jpg" alt="Yape" class="h-4 w-4 rounded object-contain" />
                <span>Yape QR</span>
              </button>
              <button
                type="button"
                (click)="selectedQrTab.set('PLIN')"
                [class]="selectedQrTab() === 'PLIN' ? 'bg-teal-600 text-white shadow-xs font-bold' : 'text-gray-600 hover:text-gray-900 font-medium'"
                class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs transition cursor-pointer"
              >
                <img src="/images/icons/plin.png" alt="Plin" class="h-4 w-4 rounded object-contain" />
                <span>Plin QR</span>
              </button>
            </div>

            <!-- QR Content Display -->
            @if (selectedQrTab() === 'YAPE') {
              <div class="flex flex-col items-center text-center space-y-3 p-3 rounded-2xl border border-purple-200 bg-purple-50/50">
                <div class="h-52 w-52 rounded-2xl border-2 border-purple-300 bg-white p-2.5 shadow-sm flex items-center justify-center">
                  <img
                    [src]="walletConfig().yapeQrImageUrl || '/images/qr/qr-yape-default.svg'"
                    alt="QR Yape Oficial"
                    class="h-full w-full object-contain rounded-xl"
                  />
                </div>
                <div>
                  <p class="text-xs font-bold text-purple-950">{{ walletConfig().yapeHolder || 'Repuestos Automotrices Asunción S.A.C.' }}</p>
                  <p class="font-mono text-sm font-black text-purple-800">Cel: {{ walletConfig().yapePhone || '922779157' }}</p>
                  <span class="inline-block mt-1 text-[10px] text-gray-500 font-medium">Escanea desde tu app Yape BCP</span>
                </div>
              </div>
            } @else {
              <div class="flex flex-col items-center text-center space-y-3 p-3 rounded-2xl border border-teal-200 bg-teal-50/50">
                <div class="h-52 w-52 rounded-2xl border-2 border-teal-300 bg-white p-2.5 shadow-sm flex items-center justify-center">
                  <img
                    [src]="walletConfig().plinQrImageUrl || '/images/qr/qr-plin-default.svg'"
                    alt="QR Plin Oficial"
                    class="h-full w-full object-contain rounded-xl"
                  />
                </div>
                <div>
                  <p class="text-xs font-bold text-teal-950">{{ walletConfig().plinHolder || 'Repuestos Automotrices Asunción S.A.C.' }}</p>
                  <p class="font-mono text-sm font-black text-teal-800">Cel: {{ walletConfig().plinPhone || '922779157' }}</p>
                  <span class="inline-block mt-1 text-[10px] text-gray-500 font-medium">Interbank · BBVA · Scotiabank</span>
                </div>
              </div>
            }

            <!-- Bottom Button -->
            <button
              type="button"
              (click)="closeQrCobroModal()"
              class="w-full min-h-[44px] rounded-xl bg-gray-900 py-2.5 text-xs font-bold text-white hover:bg-gray-800 transition cursor-pointer"
            >
              Cerrar y proceder con la entrega
            </button>
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
  readonly soundService = inject(SoundService);
  private previousPendingCount = -1;
  private readonly paymentService = inject(PaymentService);
  readonly walletConfig = signal<StoreWalletConfig>(DEFAULT_WALLET_CONFIG);
  readonly qrCobroOrder = signal<Order | null>(null);
  readonly selectedQrTab = signal<'YAPE' | 'PLIN'>('YAPE');

  readonly orders = signal<Order[]>([]);

  readonly activeInRouteOrder = computed(() => {
    return this.orders().find((o) => o.status === 'EN_RUTA') ?? null;
  });

  readonly displayOrders = computed(() => {
    const inRoute = this.activeInRouteOrder();
    if (inRoute) {
      // Focus solely on the active delivery currently in progress
      return [inRoute];
    }
    // Otherwise show only ready-for-dispatch orders (never show delivered or cancelled orders)
    return this.orders().filter((o) => o.status === 'LISTO_PARA_DESPACHO');
  });
  readonly isLoading = signal<boolean>(true);
  readonly busyId = signal<number | null>(null);

  readonly myDriverStatus = signal<DriverStatus>('DISPONIBLE');
  readonly isUpdatingStatus = signal<boolean>(false);

  readonly incidentOrder = signal<Order | null>(null);
  incidentReason = 'Cliente rechazó el pedido en puerta';
  incidentNotes = '';
  readonly submittingIncident = signal<boolean>(false);

  readonly completingOrder = signal<Order | null>(null);
  readonly submittingProof = signal<boolean>(false);
  readonly completionError = signal<string>('');
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
  securityCode = '';
  private pollSubscription?: Subscription;
  private autoReturnTimeout?: any;

  ngOnInit(): void {
    this.walletConfig.set(this.paymentService.getStoreWalletConfig());
    this.paymentService.fetchStoreWalletConfig().subscribe({
      next: (cfg) => this.walletConfig.set(cfg),
    });
    this.loadDeliveryOrders();
    // Auto-sync polling every 12 seconds when tab is visible
    this.pollSubscription = interval(12000).subscribe(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (!this.completingOrder() && !this.qrCobroOrder() && !this.isUpdatingStatus()) {
        this.loadDeliveryOrders(true);
      }
    });
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

  loadDeliveryOrders(silent: boolean = false): void {
    if (!silent) {
      this.isLoading.set(true);
    }
    this.ordersService
      .getDeliveryOrders()
      .pipe(finalize(() => {
        if (!silent) {
          this.isLoading.set(false);
        }
      }))
      .subscribe({
        next: (list) => {
          const prevCount = this.orders().length;
          const prevIds = new Set(this.orders().map((o) => o.id));
          const hasNew = list.some((o) => !prevIds.has(o.id));
          if (silent && prevCount > 0 && hasNew) {
            this.soundService.playOrderAlert();
            this.toast.info('¡Nuevo reparto asignado!', 'Se ha asignado un nuevo pedido para entrega.');
          }
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
          this.soundService.playSuccessChime();
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

  
  openQrCobroModal(ord: Order): void {
    this.walletConfig.set(this.paymentService.getStoreWalletConfig());
    this.paymentService.fetchStoreWalletConfig().subscribe({
      next: (cfg) => this.walletConfig.set(cfg),
    });
    if (ord.paymentMethod === 'PLIN') {
      this.selectedQrTab.set('PLIN');
    } else {
      this.selectedQrTab.set('YAPE');
    }
    this.qrCobroOrder.set(ord);
  }

  closeQrCobroModal(): void {
    this.qrCobroOrder.set(null);
  }

  openIncidentModal(order: Order): void {
    this.incidentOrder.set(order);
    this.incidentReason = 'Cliente rechazó el pedido en puerta';
    this.incidentNotes = '';
  }

  closeIncidentModal(): void {
    this.incidentOrder.set(null);
  }

  confirmDeliveryIncident(): void {
    const ord = this.incidentOrder();
    if (!ord) return;

    this.submittingIncident.set(true);
    const fullReason = `${this.incidentReason}${this.incidentNotes ? ' - ' + this.incidentNotes.trim() : ''}`;
    this.ordersService.failDelivery(ord.id, fullReason).subscribe({
      next: () => {
        this.submittingIncident.set(false);
        this.closeIncidentModal();
        this.toast.success(
          'Incidencia registrada y stock reincorporado',
          `El pedido #${ord.orderNumber} fue cancelado y las unidades regresaron al inventario disponible.`
        );
        this.loadDeliveryOrders();
      },
      error: (err: any) => {
        this.submittingIncident.set(false);
        this.toast.error('Error al registrar incidencia', err?.error?.message || 'No se pudo procesar la incidencia.');
      },
    });
  }

  openCompletionModal(order: Order): void {
    this.completingOrder.set(order);
    this.completionError.set('');
    this.securityCode = '';
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
    this.completionError.set('');
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
    this.completionError.set('');

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
          securityCode: this.securityCode.trim(),
        })
        .pipe(finalize(() => this.submittingProof.set(false)))
        .subscribe({
          next: (updated) => {
            this.completionError.set('');
            this.orders.update((list) => list.map((o) => (o.id === updated.id ? updated : o)));
            this.myDriverStatus.set('RETORNANDO');
            const dist = order.distanceMeters || order.calculatedDistanceMeters || 4000;
            const returnMins = Math.min(25, Math.max(3, Math.ceil((dist / 350) + 3)));
            if (this.autoReturnTimeout) clearTimeout(this.autoReturnTimeout);
            this.autoReturnTimeout = setTimeout(() => {
              if (this.myDriverStatus() === 'RETORNANDO') {
                this.setOperationalStatus('DISPONIBLE');
              }
            }, returnMins * 60 * 1000);
            this.toast.success(
              `Pedido ${updated.orderNumber} entregado con éxito`,
              `Código PIN verificado conforme. Tu estado cambió a: Retornando a tienda (máx. ${returnMins} min).`
            );
            this.closeCompletionModal();
          },
          error: (err) => {
            const msg = err?.error?.message || 'Código incorrecto o datos de entrega inválidos. Verifica con el cliente e intenta nuevamente.';
            this.completionError.set(msg);
            this.toast.error('Código de entrega incorrecto', msg);
          },
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
    if (this.pollSubscription) {
      this.pollSubscription.unsubscribe();
    }
    if (this.autoReturnTimeout) {
      clearTimeout(this.autoReturnTimeout);
    }
    this.clearAllGpsWatches();
    this.clearPreview();
  }
}
