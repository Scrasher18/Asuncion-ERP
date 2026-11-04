import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Subscription } from 'rxjs';
import { Order } from '../../core/models/api.models';
import { LiveTrackingResponse } from '../../core/models/telemetry.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import { OrdersService } from '../../core/services/orders.service';
import { TelemetryService } from '../../core/services/telemetry.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import { DriverRatingService } from '../../core/services/driver-rating.service';
import { ToastService } from '../../core/services/toast.service';
import { LiveDriverMapComponent } from '../../shared/components/live-driver-map/live-driver-map.component';

const ORDER_STAGES = [
  { key: 'CONFIRMADO', label: 'Confirmado' },
  { key: 'EN_PREPARACION', label: 'En preparación' },
  { key: 'LISTO_PARA_DESPACHO', label: 'Listo para envío' },
  { key: 'EN_RUTA', label: 'En camino' },
  { key: 'ENTREGADO', label: 'Entregado' },
];

@Component({
  selector: 'app-track-order-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LiveDriverMapComponent],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pt-6 pb-24 lg:pb-14 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-5xl space-y-6">
        <!-- Search Card -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
              <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>Consulta de estado</span>
            </span>
            <a routerLink="/" class="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-orange-600 transition">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
              </svg>
              <span>Volver al catálogo</span>
            </a>
          </div>

          <div class="space-y-1">
            <h1 class="text-2xl font-bold tracking-tight text-gray-900">Seguimiento de pedido</h1>
            <p class="text-xs sm:text-sm text-gray-600">
              Ingresa el número correlativo asignado a tu compra para consultar en vivo la preparación, el reparto satelital y la constancia de entrega.
            </p>
          </div>

          <form (ngSubmit)="searchOrder()" class="flex flex-col sm:flex-row gap-2.5">
            <input
              type="text"
              [(ngModel)]="orderNumberQuery"
              name="orderNumber"
              placeholder="Ingresa tu número de orden..."
              class="flex-1 min-h-[46px] rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-2.5 font-mono text-base sm:text-sm text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
            />
            <button
              type="submit"
              [disabled]="isLoading() || !orderNumberQuery.trim()"
              class="min-h-[46px] rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition"
            >
              {{ isLoading() ? 'Consultando...' : 'Consultar pedido' }}
            </button>
          </form>
        </div>

        @if (emailSentNotice()) {
          <div class="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-start gap-3">
            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div class="flex-1 text-xs">
              <p class="font-semibold text-emerald-900">
                Confirmación enviada por correo electrónico
              </p>
              <p class="mt-0.5 text-emerald-800">
                Enviamos el detalle de tu compra y las actualizaciones de despacho a tu dirección de correo registrada.
              </p>
            </div>
            <button
              type="button"
              (click)="emailSentNotice.set(false)"
              class="rounded-md p-1 text-emerald-600 hover:bg-emerald-100"
              aria-label="Cerrar aviso"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        }

        @if (errorMsg()) {
          <div class="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-700">
            {{ errorMsg() }}
          </div>
        }

        @if (order(); as ord) {
          <!-- Visual 5-Stage Progress Stepper -->
          <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
              <div>
                <span class="text-xs font-medium text-gray-500">Número de pedido</span>
                <h2 class="font-mono text-xl font-bold text-gray-900">{{ ord.orderNumber }}</h2>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {{ ord.invoiceType === 'FACTURA' ? 'Factura' : 'Boleta' }} ·
                  {{ ord.deliveryType === 'PICKUP' ? 'Recojo en tienda' : 'Envío a domicilio' }}
                </span>
                <span [class]="statusBadgeClass(ord.status)" class="rounded-full border px-3 py-1 text-xs font-semibold">
                  {{ formatStatus(ord.status) }}
                </span>
              </div>
            </div>

            <!-- Stepper -->
            <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              @for (st of stages; track st.key; let idx = $index) {
                <div
                  [class]="
                    idx <= currentStageIndex(ord.status)
                      ? ord.status === 'ENTREGADO'
                        ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                        : 'border-orange-200 bg-orange-50/60 text-gray-900'
                      : 'border-gray-200 bg-gray-50/70 text-gray-400'
                  "
                  class="rounded-xl border p-3 text-center space-y-1.5 transition"
                >
                  <div
                    [class]="
                      idx <= currentStageIndex(ord.status)
                        ? ord.status === 'ENTREGADO'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-orange-600 text-white'
                        : 'bg-gray-200 text-gray-500'
                    "
                    class="mx-auto flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                  >
                    @if (idx <= currentStageIndex(ord.status)) {
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    } @else {
                      {{ idx + 1 }}
                    }
                  </div>
                  <p class="text-xs font-semibold">{{ st.label }}</p>
                </div>
              }
            </div>

            <!-- Metadata Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 text-xs">
              <div class="rounded-xl bg-gray-50/80 p-3.5 border border-gray-200/70">
                <span class="block text-gray-500 font-medium">Tienda de origen</span>
                <span class="mt-1 block font-semibold text-gray-900">{{ ord.branchName || 'Tienda Central Asunción' }}</span>
                @if (ord.distanceMeters || ord.calculatedDistanceMeters) {
                  <span class="mt-0.5 block text-[11px] font-medium text-emerald-700">
                    Distancia de ruta: {{ ((ord.distanceMeters ?? ord.calculatedDistanceMeters ?? 0) / 1000) | number: '1.2-2' }} km
                  </span>
                }
              </div>

              <div class="rounded-xl bg-gray-50/80 p-3.5 border border-gray-200/70">
                <span class="block text-gray-500 font-medium">Destinatario y dirección</span>
                <span class="mt-1 block font-semibold text-gray-900">{{ ord.recipientName || ord.customerName || 'Cliente' }}</span>
                <span class="text-gray-600">{{ ord.deliveryAddress || 'Recojo en tienda' }}</span>
              </div>

              <div class="rounded-xl bg-gray-50/80 p-3.5 border border-gray-200/70">
                <span class="block text-gray-500 font-medium">Importe total</span>
                <span class="mt-1 block text-lg font-bold tracking-tight text-gray-900">
                  S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                </span>
                <span class="text-gray-500">Envío: S/ {{ ord.deliveryFee | number: '1.2-2' }}</span>
              </div>
            </div>

            <!-- Action Bar: Download PDF & Support -->
            <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="downloadBoletaPdf(ord)"
                  class="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-bold text-orange-700 shadow-2xs hover:bg-orange-100 hover:border-orange-400 transition cursor-pointer"
                >
                  <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>Descargar {{ ord.invoiceType === 'FACTURA' ? 'Factura' : 'Boleta' }} PDF</span>
                </button>
              </div>

              <span class="text-[11px] text-gray-500">
                Comprobante oficial válido para garantía y control tributario
              </span>
            </div>
          </div>

          <!-- Live Motorized Driver Real-Time GPS Tracking Map -->
          @if (liveTelemetry() || ord.status === 'EN_RUTA' || ord.deliveryType === 'DELIVERY') {
            <div class="space-y-3 pt-1">
              <div class="flex flex-wrap items-center justify-between gap-2 px-1">
                <div class="flex items-center gap-2">
                  <span class="relative flex h-2.5 w-2.5">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-600"></span>
                  </span>
                  <h3 class="text-sm font-bold text-gray-900">
                    Rastreo satelital en tiempo real del repartidor
                  </h3>
                </div>
                @if (liveTelemetry()?.isLive || ord.status === 'EN_RUTA') {
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Rastreo GPS en tiempo real</span>
                  </span>
                }
              </div>

              <app-live-driver-map [telemetry]="liveTelemetry()"></app-live-driver-map>
            </div>
          }

          <!-- Customer Courier Rating Card (when ENTREGADO) -->
          @if (ord.status === 'ENTREGADO') {
            <div class="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-6 space-y-4 shadow-xs">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                  <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 text-xl font-bold shadow-2xs">
                    ⭐
                  </span>
                  <div>
                    <h3 class="text-base font-bold text-gray-950">Califica la atención de tu repartidor</h3>
                    <p class="text-xs text-gray-600">
                      Repartidor: <strong class="text-gray-900">{{ ord.assignedDriverName || ord.deliveryProof?.driverName || 'Miguel Ángel Flores' }}</strong> • Tu opinión nos ayuda a mantener el mejor servicio.
                    </p>
                  </div>
                </div>
                @if (driverRatingService.hasRated(ord.orderNumber)) {
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-100/70 px-3 py-1 text-xs font-bold text-emerald-800">
                    <span>✓</span>
                    <span>¡Entrega calificada!</span>
                  </span>
                }
              </div>

              @if (!driverRatingService.hasRated(ord.orderNumber)) {
                <div class="space-y-3 pt-1">
                  <!-- Star Selector -->
                  <div class="flex items-center gap-2">
                    <span class="text-xs font-bold text-gray-800">Puntuación:</span>
                    <div class="flex items-center gap-1">
                      @for (star of [1, 2, 3, 4, 5]; track star) {
                        <button
                          type="button"
                          (click)="selectedStars.set(star)"
                          class="text-2xl transition hover:scale-125 cursor-pointer focus:outline-none"
                          [class.text-amber-400]="star <= selectedStars()"
                          [class.text-gray-300]="star > selectedStars()"
                        >
                          ★
                        </button>
                      }
                    </div>
                    <span class="text-xs font-bold text-amber-900 ml-2">
                      {{ selectedStars() }} de 5 estrellas
                    </span>
                  </div>

                  <!-- Quick Tag Pills -->
                  <div class="space-y-1.5">
                    <span class="text-[11px] font-semibold text-gray-600 block">¿Qué destacarías de la entrega?</span>
                    <div class="flex flex-wrap gap-2">
                      @for (tag of availableRatingTags; track tag) {
                        <button
                          type="button"
                          (click)="toggleRatingTag(tag)"
                          [class]="selectedRatingTags().includes(tag) ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'"
                          class="rounded-lg border px-2.5 py-1 text-xs font-medium transition cursor-pointer"
                        >
                          {{ tag }}
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Optional Comment -->
                  <div>
                    <input
                      type="text"
                      [(ngModel)]="ratingComment"
                      placeholder="Escribe un comentario sobre la entrega (opcional)..."
                      class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:outline-none"
                    />
                  </div>

                  <div class="flex justify-end pt-1">
                    <button
                      type="button"
                      (click)="submitDriverRating(ord)"
                      class="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition cursor-pointer"
                    >
                      Enviar Calificación ⭐
                    </button>
                  </div>
                </div>
              }
            </div>
          }

          <!-- Photographic Proof of Delivery (when ENTREGADO) -->
          @if (ord.deliveryProof; as proof) {
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Constancia de entrega</span>
                  </span>
                  <h3 class="mt-1 text-base font-bold text-gray-900">
                    Pedido entregado satisfactoriamente
                  </h3>
                </div>
                @if (proof.deliveredAt || proof.createdAt) {
                  <span class="font-mono text-xs text-gray-600">
                    {{ (proof.deliveredAt || proof.createdAt) | date: 'dd/MM/yyyy HH:mm' }}
                  </span>
                }
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                @if (proof.evidenceImageUrl || proof.imageUrl) {
                  <img
                    [src]="resolveMedia(proof.evidenceImageUrl || proof.imageUrl)"
                    alt="Fotografía de entrega"
                    class="max-h-56 w-full rounded-xl border border-emerald-200 object-cover bg-white shadow-2xs"
                  />
                }
                <div class="space-y-2 text-xs text-gray-700">
                  <p><strong class="text-gray-900">Recibido por:</strong> {{ proof.receiverName }}</p>
                  @if (proof.receiverDocument) {
                    <p><strong class="text-gray-900">Documento:</strong> <span class="font-mono">{{ proof.receiverDocument }}</span></p>
                  }
                  @if (proof.capturedLatitude && proof.capturedLongitude) {
                    <p>
                      <strong class="text-gray-900">Ubicación de entrega:</strong>
                      <span class="font-mono">{{ proof.capturedLatitude }}, {{ proof.capturedLongitude }}</span>
                    </p>
                  }
                  @if (proof.deliveryNotes || proof.notes) {
                    <p><strong class="text-gray-900">Observaciones:</strong> {{ proof.deliveryNotes || proof.notes }}</p>
                  }
                </div>
              </div>
            </div>
          }

          <!-- Ordered Spare Parts & Status History Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
              <h3 class="text-sm font-bold text-gray-900">
                Repuestos del pedido ({{ ord.items.length }})
              </h3>
              <div class="divide-y divide-gray-100">
                @for (item of ord.items; track item.id) {
                  <div class="py-3 flex items-center justify-between gap-3 text-xs">
                    <div class="min-w-0">
                      <p class="font-semibold text-gray-900">{{ item.partName || item.name }}</p>
                      <p class="font-mono text-[11px] text-gray-500">
                        @if (item.partOemCode || item.oemCode) {
                          OEM {{ item.partOemCode || item.oemCode }} ·
                        }
                        SKU {{ item.partSku || item.sku }}
                      </p>
                    </div>
                    <div class="text-right shrink-0">
                      <span class="block font-semibold text-gray-900">
                        {{ item.quantity }} x S/ {{ item.unitPrice | number: '1.2-2' }}
                      </span>
                      @if (item.picked) {
                        <span class="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span>Verificado en almacén</span>
                        </span>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="lg:col-span-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-3">
              <h3 class="text-sm font-bold text-gray-900">
                Historial de actualizaciones
              </h3>
              @if (!ord.statusHistory || ord.statusHistory.length === 0) {
                <p class="text-xs text-gray-500">Pedido registrado correctamente.</p>
              } @else {
                <ol class="relative border-l-2 border-orange-200 ml-3 space-y-4 pl-5">
                  @for (h of ord.statusHistory; track $index) {
                    <li class="relative text-xs">
                      <span class="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full bg-orange-600 border-2 border-white ring-2 ring-orange-100"></span>
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-bold text-gray-900">{{ formatStatus(h.newStatus || h.status) }}</span>
                        <span class="font-mono text-[10px] text-gray-400">
                          {{ (h.changedAt || h.createdAt || h.timestamp) | date: 'dd/MM/yyyy HH:mm' }}
                        </span>
                      </div>
                      @if (h.comments || h.comment || h.notes) {
                        <p class="text-gray-600 mt-1 leading-snug">{{ h.comments || h.comment || h.notes }}</p>
                      }
                      @if (h.changedByName || h.changedBy) {
                        <span class="inline-block mt-0.5 text-[10px] text-gray-400 font-medium">Por: {{ h.changedByName || h.changedBy }}</span>
                      }
                    </li>
                  }
                </ol>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class TrackOrderPageComponent implements OnInit, OnDestroy {
  readonly driverRatingService = inject(DriverRatingService);

  readonly selectedStars = signal<number>(5);
  readonly selectedRatingTags = signal<string[]>(['Muy puntual', 'Amable']);
  ratingComment = '';
  readonly availableRatingTags = ['Muy puntual', 'Amable', 'Repuesto sellado', 'Llegó rápido', 'Excelente servicio'];

  toggleRatingTag(tag: string): void {
    const current = this.selectedRatingTags();
    if (current.includes(tag)) {
      this.selectedRatingTags.set(current.filter((t) => t !== tag));
    } else {
      this.selectedRatingTags.set([...current, tag]);
    }
  }

  submitDriverRating(ord: Order): void {
    this.driverRatingService.submitRating({
      orderNumber: ord.orderNumber,
      driverName: ord.assignedDriverName || ord.deliveryProof?.driverName || 'Miguel Ángel Flores',
      driverEmail: 'motorizado@asuncion.pe',
      customerName: ord.recipientName || ord.customerName || 'Cliente Asunción',
      stars: this.selectedStars(),
      tags: this.selectedRatingTags(),
      comment: this.ratingComment.trim() || undefined,
    });
    this.ratingComment = '';
  }

  readonly auth = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly telemetryService = inject(TelemetryService);
  private readonly toast = inject(ToastService);
  readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly route = inject(ActivatedRoute);

  readonly stages = ORDER_STAGES;
  orderNumberQuery = '';
  readonly order = signal<Order | null>(null);
  readonly isLoading = signal(false);
  readonly errorMsg = signal('');
  readonly emailSentNotice = signal(false);
  readonly liveTelemetry = signal<LiveTrackingResponse | null>(null);

  private sseSub: Subscription | null = null;
  private pollTimer: any = null;
  private previousStatus: string | null = null;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const q = params.get('order');
      if (params.get('notified') === '1') {
        this.emailSentNotice.set(true);
      }
      if (q) {
        this.orderNumberQuery = q;
        this.searchOrder();
      }
    });
  }

  ngOnDestroy(): void {
    this.stopPolling();
    this.disconnectSse();
  }

  formatStatus(status?: string): string {
    if (!status) return 'Actualización del pedido';
    switch (status) {
      case 'PENDIENTE':
        return 'Pendiente de pago';
      case 'CONFIRMADO':
        return 'Pedido confirmado';
      case 'EN_PREPARACION':
        return 'En preparación';
      case 'LISTO_PARA_DESPACHO':
        return 'Listo para envío';
      case 'EN_RUTA':
        return 'En camino';
      case 'ENTREGADO':
        return 'Entregado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return status;
    }
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'ENTREGADO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADO':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'EN_PREPARACION':
      case 'LISTO_PARA_DESPACHO':
      case 'EN_RUTA':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }

  
  downloadBoletaPdf(ord: Order): void {
    this.pdfInvoiceService.generateInvoicePdf(ord, true);
    this.toast.success('Descargando comprobante', `Generando PDF oficial para el pedido #${ord.orderNumber}`);
  }

  searchOrder(isSilent = false): void {
    const code = this.orderNumberQuery.trim();
    if (!code) return;
    if (!isSilent) {
      this.errorMsg.set('');
      this.isLoading.set(true);
      this.disconnectSse();
    }

    this.ordersService
      .trackOrder(code)
      .pipe(finalize(() => {
        if (!isSilent) this.isLoading.set(false);
      }))
      .subscribe({
        next: (ord) => {
          this.handleOrderUpdate(ord, isSilent);
          if (!isSilent) {
            this.connectLiveTelemetry(ord.orderNumber);
            this.startPolling(ord.orderNumber);
          }
        },
        error: (err) => {
          if (!isSilent) {
            this.order.set(null);
            this.liveTelemetry.set(null);
            this.stopPolling();
            this.errorMsg.set(
              err?.error?.message || `No encontramos ningún pedido con el código "${code}".`
            );
          }
        },
      });
  }

  private handleOrderUpdate(ord: Order, isSilent = false): void {
    const prev = this.previousStatus;
    const current = ord.status;
    this.order.set(ord);

    if (prev && prev !== current && isSilent) {
      this.notifyStatusChange(current);
    }
    this.previousStatus = current;
  }

  private notifyStatusChange(status: string): void {
    switch (status) {
      case 'CONFIRMADO':
        this.toast.info('Pedido confirmado', 'Tu compra ha sido verificada y está en cola de almacén.');
        break;
      case 'EN_PREPARACION':
        this.toast.info('En preparación en almacén', 'El equipo técnico inició la preparación y embalado de repuestos.');
        break;
      case 'LISTO_PARA_DESPACHO':
        this.toast.info('Listo para despacho', 'Tus repuestos están embalados y asignados a salida.');
        break;
      case 'EN_RUTA':
        this.toast.info('¡Repartidor en camino!', 'La unidad motorizada está en ruta con seguimiento GPS satelital.');
        break;
      case 'ENTREGADO':
        this.toast.success('¡Pedido entregado con éxito!', 'Tu pedido ha sido recibido y concluido satisfactoriamente.');
        break;
      case 'CANCELADO':
        this.toast.warning('Pedido cancelado', 'El pedido ha sido marcado como cancelado.');
        break;
    }
  }

  private startPolling(orderNumber: string): void {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      const cur = this.order();
      if (!cur || cur.status === 'ENTREGADO' || cur.status === 'CANCELADO') {
        this.stopPolling();
        return;
      }
      this.searchOrder(true);
      this.telemetryService.getOrderLiveTelemetry(orderNumber).subscribe({
        next: (telemetry: LiveTrackingResponse) => {
          if (telemetry) {
            this.liveTelemetry.set(telemetry);
          }
        },
        error: () => {},
      });
    }, 4000);
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  connectLiveTelemetry(orderNumber: string): void {
    this.telemetryService.getOrderLiveTelemetry(orderNumber).subscribe({
      next: (telemetry: LiveTrackingResponse) => {
        this.liveTelemetry.set(telemetry);
        const telStatus = telemetry?.orderStatus || telemetry?.status;
        if (telStatus && this.order() && telStatus !== this.order()!.status) {
          this.searchOrder(true);
        }
      },
      error: () => {},
    });

    this.disconnectSse();
    this.sseSub = this.telemetryService.streamOrderTracking(orderNumber).subscribe({
      next: (telemetry: LiveTrackingResponse) => {
        this.liveTelemetry.set(telemetry);
        const telStatus = telemetry?.orderStatus || telemetry?.status;
        if (telStatus && this.order() && telStatus !== this.order()!.status) {
          this.searchOrder(true);
        }
      },
      error: () => {},
    });
  }

  private disconnectSse(): void {
    if (this.sseSub) {
      this.sseSub.unsubscribe();
      this.sseSub = null;
    }
  }

  currentStageIndex(status: string): number {
    const idx = ORDER_STAGES.findIndex((s) => s.key === status);
    return idx >= 0 ? idx : 0;
  }

  resolveMedia(url?: string): string {
    return this.apiConfig.resolveMediaUrl(url, 'ENTREGA', 'Asunción');
  }
}
