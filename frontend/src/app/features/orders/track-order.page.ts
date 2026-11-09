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
import { SoundService } from '../../core/services/sound.service';
import { ToastService } from '../../core/services/toast.service';
import { LiveDriverMapComponent } from '../../shared/components/live-driver-map/live-driver-map.component';

const ORDER_STAGES = [
  { key: 'CONFIRMADO', label: 'Confirmado', desc: 'Verificado en sistema' },
  { key: 'EN_PREPARACION', label: 'En preparación', desc: 'Picking en almacén' },
  { key: 'LISTO_PARA_DESPACHO', label: 'Listo para envío', desc: 'Embalado y asignado' },
  { key: 'EN_RUTA', label: 'En camino', desc: 'Unidad en tránsito' },
  { key: 'ENTREGADO', label: 'Entregado', desc: 'Recepción conforme' },
];

@Component({
  selector: 'app-track-order-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LiveDriverMapComponent],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pt-6 pb-24 lg:pb-16 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-5xl space-y-6 animate-fadeIn">
        <!-- Search & Lookup Hero Card -->
        <div class="relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
          <div class="h-1.5 w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>
          <div class="p-6 sm:p-8 space-y-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>Centro de Rastreo y Trazabilidad de Pedidos</span>
              </div>

              <div class="flex items-center gap-3">
                @if (auth.isAuthenticated()) {
                  <a
                    routerLink="/my-orders"
                    class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                  >
                    <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                    </svg>
                    <span>Ver mis pedidos</span>
                  </a>
                }
                <a routerLink="/" class="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-orange-600 transition">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                  </svg>
                  <span>Volver al catálogo</span>
                </a>
              </div>
            </div>

            <div class="space-y-1.5">
              <h1 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-950">
                Seguimiento de tu pedido
              </h1>
              <p class="text-xs sm:text-sm text-gray-600 max-w-2xl leading-relaxed">
                Ingresa tu código de orden para consultar el avance en almacén, el recorrido en vivo mientras está en ruta, tu comprobante electrónico PDF y el acta de entrega.
              </p>
            </div>

            <form (ngSubmit)="searchOrder()" class="flex flex-col sm:flex-row gap-3 pt-1">
              <div class="relative flex-1">
                <svg class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                <input
                  type="text"
                  [(ngModel)]="orderNumberQuery"
                  name="orderNumber"
                  placeholder="Ej: ASU-2026-0001 o código correlativo..."
                  class="w-full min-h-[48px] rounded-xl border border-gray-200 bg-gray-50/70 pl-11 pr-4 py-2.5 font-mono text-base sm:text-sm font-semibold text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none transition"
                />
              </div>
              <button
                type="submit"
                [disabled]="isLoading() || !orderNumberQuery.trim()"
                class="min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-6 py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs hover:bg-orange-700 active:scale-[0.99] disabled:opacity-50 transition cursor-pointer"
              >
                @if (isLoading()) {
                  <svg class="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                    <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                  </svg>
                  <span>Consultando...</span>
                } @else {
                  <span>Consultar estado</span>
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                }
              </button>
            </form>
          </div>
        </div>

        @if (emailSentNotice()) {
          <div class="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 flex items-start gap-3.5 shadow-2xs animate-fadeIn">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
            </div>
            <div class="flex-1 text-xs">
              <p class="font-bold text-emerald-950">
                Confirmación enviada a tu correo electrónico
              </p>
              <p class="mt-0.5 text-emerald-800 leading-relaxed">
                Hemos enviado el resumen detallado de tu compra y te notificaremos automáticamente cada cambio de estado hasta su recepción.
              </p>
            </div>
            <button
              type="button"
              (click)="emailSentNotice.set(false)"
              class="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-100 transition"
              aria-label="Cerrar aviso"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        }

        @if (errorMsg()) {
          <div class="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-center gap-3 text-xs font-semibold text-red-700 shadow-2xs">
            <svg class="h-5 w-5 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{{ errorMsg() }}</span>
          </div>
        }

        @if (order(); as ord) {
          <!-- Main Order Progress & Executive Summary Card -->
          <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-7 shadow-xs space-y-6 animate-fadeIn">
            <!-- Header Row -->
            <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Orden de Compra</span>
                  @if (ord.createdAt) {
                    <span class="text-[11px] text-gray-400">• {{ ord.createdAt | date: 'dd/MM/yyyy HH:mm' }}</span>
                  }
                </div>
                <div class="flex flex-wrap items-center gap-2.5">
                  <h2 class="font-mono text-xl sm:text-2xl font-black text-gray-950 tracking-tight">{{ ord.orderNumber }}</h2>
                  <span [class]="statusBadgeClass(ord.status)" class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold">
                    <span
                      [class]="
                        ord.status === 'ENTREGADO'
                          ? 'bg-emerald-500'
                          : ord.status === 'CANCELADO'
                            ? 'bg-red-500'
                            : 'bg-orange-500 animate-pulse'
                      "
                      class="h-2 w-2 rounded-full"
                    ></span>
                    <span>{{ formatStatus(ord.status) }}</span>
                  </span>
                </div>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  <span>{{ ord.invoiceType === 'FACTURA' ? '📄 Factura Electrónica' : '🧾 Boleta de Venta' }}</span>
                  <span class="text-gray-300">|</span>
                  <span>{{ ord.deliveryType === 'PICKUP' ? '🏬 Recojo en tienda' : '🛵 Envío a domicilio' }}</span>
                </span>

                <button
                  type="button"
                  (click)="downloadBoletaPdf(ord)"
                  class="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3.5 py-1.5 text-xs font-bold text-orange-700 shadow-2xs hover:bg-orange-600 hover:text-white hover:border-orange-600 transition cursor-pointer"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <span>Descargar {{ ord.invoiceType === 'FACTURA' ? 'Factura' : 'Boleta' }} PDF</span>
                </button>
              </div>
            </div>

            <!-- Delivery Security PIN Card for Client Protection -->
            @if (ord.deliveryType === 'DELIVERY' && ord.status !== 'CANCELADO') {
              <div class="rounded-2xl border-2 border-orange-500 bg-linear-to-r from-orange-50 via-amber-50 to-orange-50 p-4 sm:p-5 shadow-xs">
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div class="space-y-1.5">
                    <div class="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-2.5 py-0.5 text-[11px] font-extrabold text-white uppercase tracking-wider">
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                      </svg>
                      <span>Medida de Protección Antifraude</span>
                    </div>
                    <h3 class="text-sm sm:text-base font-black text-gray-900">
                      Código Único de Seguridad para la Entrega
                    </h3>
                    <p class="text-xs text-gray-600 max-w-xl leading-relaxed">
                      @if (ord.status === 'ENTREGADO') {
                        Entrega finalizada y verificada conforme con tu código de seguridad.
                      } @else {
                        Por tu seguridad, <strong>muestra o dicta este PIN de 4 dígitos al repartidor</strong> al momento de recibir tus repuestos. El repartidor debe ingresarlo para finalizar la entrega.
                      }
                    </p>
                  </div>

                  <div class="flex items-center gap-3 bg-white px-5 py-3 rounded-2xl border-2 border-orange-300 shadow-sm shrink-0 self-start sm:self-center">
                    <div class="text-center">
                      <span class="block text-[10px] font-extrabold uppercase tracking-widest text-orange-600">PIN DE ENTREGA</span>
                      <span class="font-mono text-3xl font-black text-gray-950 tracking-widest">{{ ord.deliverySecurityCode || '----' }}</span>
                    </div>
                  </div>
                </div>
              </div>
            }

            <!-- 5-Stage Visual Stepper -->
            <div class="space-y-2">
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                @for (st of stages; track st.key; let idx = $index) {
                  <div
                    [class]="
                      idx <= currentStageIndex(ord.status)
                        ? ord.status === 'ENTREGADO'
                          ? 'border-emerald-200 bg-emerald-50/70 text-emerald-950 shadow-2xs'
                          : 'border-orange-200 bg-orange-50/70 text-gray-900 shadow-2xs'
                        : 'border-gray-200/80 bg-gray-50/60 text-gray-400'
                    "
                    class="relative rounded-xl border p-3.5 text-center space-y-1 transition-all duration-200"
                  >
                    <div
                      [class]="
                        idx <= currentStageIndex(ord.status)
                          ? ord.status === 'ENTREGADO'
                            ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/15'
                            : idx === currentStageIndex(ord.status)
                              ? 'bg-orange-600 text-white ring-4 ring-orange-500/20'
                              : 'bg-orange-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      "
                      class="mx-auto flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition"
                    >
                      @if (idx < currentStageIndex(ord.status) || ord.status === 'ENTREGADO') {
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      } @else {
                        {{ idx + 1 }}
                      }
                    </div>
                    <p class="text-xs font-bold pt-0.5">{{ st.label }}</p>
                    <p class="text-[10px] opacity-75 hidden sm:block">{{ st.desc }}</p>
                  </div>
                }
              </div>
            </div>

            <!-- 3-Column Metadata Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div class="rounded-xl bg-[#F8F9FA] p-4 border border-gray-200/80 space-y-1">
                <div class="flex items-center gap-1.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.614m-16.5 0a3.004 3.004 0 01-.621-4.72L4.318 3.44A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72m-13.5 8.65h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .415.336.75.75.75z" />
                  </svg>
                  <span>Almacén de origen</span>
                </div>
                <span class="block font-bold text-gray-900 text-sm">{{ ord.branchName || 'Sede Central Santa Anita' }}</span>
                @if (ord.distanceMeters || ord.calculatedDistanceMeters) {
                  <span class="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                    <span>Distancia calculada: {{ ((ord.distanceMeters ?? ord.calculatedDistanceMeters ?? 0) / 1000) | number: '1.2-2' }} km</span>
                  </span>
                } @else {
                  <span class="block text-[11px] text-gray-500">Av. Sta. Ana 441, Santa Anita - Lima</span>
                }
              </div>

              <div class="rounded-xl bg-[#F8F9FA] p-4 border border-gray-200/80 space-y-1">
                <div class="flex items-center gap-1.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>Destinatario y entrega</span>
                </div>
                <span class="block font-bold text-gray-900 text-sm">{{ ord.recipientName || ord.customerName || 'Cliente Titular' }}</span>
                <span class="block text-gray-600 line-clamp-2">{{ ord.deliveryAddress || 'Recojo presencial en mostrador' }}</span>
              </div>

              <div class="rounded-xl bg-[#F8F9FA] p-4 border border-gray-200/80 space-y-1">
                <div class="flex items-center gap-1.5 text-gray-500 font-semibold uppercase tracking-wider text-[10px]">
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  <span>Importe total (Inc. IGV)</span>
                </div>
                <span class="block text-xl font-black tracking-tight tabular-nums text-gray-950">
                  S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                </span>
                <span class="block text-[11px] text-gray-500 tabular-nums">
                  Costo de envío: S/ {{ ord.deliveryFee | number: '1.2-2' }}
                </span>
              </div>
            </div>
          </div>

          <!-- ======================================================================= -->
          <!-- INFORMACIÓN DE RECOJO EN TIENDA & PLAZO DE 48H -->
          <!-- ======================================================================= -->
          @if (ord.deliveryType === 'PICKUP' && ord.status !== 'ENTREGADO' && ord.status !== 'CANCELADO') {
            <div class="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs space-y-3">
              <div class="flex items-center gap-3 flex-wrap justify-between">
                <div class="flex items-center gap-2.5">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                    <img src="/images/icons/local.png" alt="Recojo" class="h-6 w-6 object-contain" />
                  </div>
                  <div>
                    <h4 class="text-sm font-extrabold text-emerald-950">Modalidad: Recojo en Tienda Mostrador</h4>
                    <p class="text-xs text-emerald-800">{{ ord.branchName || 'Sede Central Santa Anita' }} — Av. Sta. Ana 441 (Frente a Tecsup)</p>
                  </div>
                </div>
                <span class="rounded-full bg-emerald-200/70 text-emerald-900 px-3 py-1 text-xs font-bold">
                  Sede Central Activa
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                <div class="rounded-xl bg-white p-3 border border-emerald-200 shadow-2xs space-y-1">
                  <span class="block font-bold text-gray-900 flex items-center gap-1">
                    <span>⏰</span> Horario de Atención en Tienda:
                  </span>
                  <span class="text-gray-600 block">Lunes a Sábado de 08:00 a.m. a 08:00 p.m.</span>
                  <span class="text-[11px] text-gray-500 block">Acércate a mostrador con tu código de pedido: <strong>#{{ ord.orderNumber }}</strong></span>
                </div>

                <div class="rounded-xl bg-white p-3 border border-emerald-200 shadow-2xs space-y-1">
                  <span class="block font-bold text-gray-900 flex items-center gap-1">
                    <span>⏳</span> Plazo Máximo de Retiro:
                  </span>
                  <span class="text-gray-600 block">Plazo de <strong>48 horas hábiles</strong> desde la compra.</span>
                  <span class="text-[11px] text-amber-700 font-semibold block">Vencido el plazo, el sistema cancela el pedido y restituye los repuestos al inventario disponible.</span>
                </div>
              </div>
            </div>
          }

          <!-- ======================================================================= -->
          <!-- REAL-TIME GPS MAP: ONLY DISPLAYED WHILE ORDER IS ACTIVE (NOT COMPLETED) -->
          <!-- ======================================================================= -->
          @if (ord.status !== 'ENTREGADO' && ord.status !== 'CANCELADO' && (liveTelemetry() || ord.status === 'EN_RUTA' || ord.deliveryType === 'DELIVERY')) {
            <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4 animate-fadeIn">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2.5">
                  <span class="relative flex h-3 w-3">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-3 w-3 bg-orange-600"></span>
                  </span>
                  <div>
                    <h3 class="text-sm font-bold text-gray-900">
                      Monitoreo satelital del despacho en tiempo real
                    </h3>
                    <p class="text-[11px] text-gray-500">
                      Seguimiento GPS en vivo desde nuestro almacén hasta tu punto de entrega.
                    </p>
                  </div>
                </div>
                @if (liveTelemetry()?.isLive || ord.status === 'EN_RUTA') {
                  <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    <span class="relative flex h-2 w-2">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    <span>Señal GPS Activa</span>
                  </span>
                }
              </div>

              <app-live-driver-map [telemetry]="liveTelemetry()"></app-live-driver-map>
            </div>
          }

          <!-- ======================================================================= -->
          <!-- COMPLETED ORDER SUMMARY & PROOF OF DELIVERY (NO MAP NEEDED)             -->
          <!-- ======================================================================= -->
          @if (ord.status === 'ENTREGADO') {
            <div class="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-white to-white p-6 shadow-xs space-y-5 animate-fadeIn">
              <div class="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-100 pb-4">
                <div class="flex items-center gap-3.5">
                  <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
                    <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <span class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                      Entrega finalizada
                    </span>
                    <h3 class="mt-0.5 text-base sm:text-lg font-extrabold text-gray-950">
                      ¡Tu pedido fue entregado satisfactoriamente!
                    </h3>
                    <p class="text-xs text-gray-600">
                      El ciclo de despacho ha concluido. A continuación puedes revisar el acta de recepción y calificar la atención.
                    </p>
                  </div>
                </div>

                @if (ord.deliveryProof?.deliveredAt || ord.deliveryProof?.createdAt) {
                  <div class="rounded-xl border border-emerald-200 bg-white px-3.5 py-2 text-right">
                    <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Fecha de recepción</span>
                    <span class="font-mono text-xs font-bold text-emerald-800">
                      {{ (ord.deliveryProof?.deliveredAt || ord.deliveryProof?.createdAt) | date: 'dd/MM/yyyy HH:mm' }}
                    </span>
                  </div>
                }
              </div>

              @if (ord.deliveryProof; as proof) {
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                  @if (proof.evidenceImageUrl || proof.imageUrl) {
                    <div class="sm:col-span-5">
                      <img
                        [src]="resolveMedia(proof.evidenceImageUrl || proof.imageUrl)"
                        alt="Fotografía de entrega"
                        class="max-h-56 w-full rounded-xl border border-emerald-200 object-cover bg-white shadow-2xs"
                      />
                    </div>
                  }
                  <div [class]="(proof.evidenceImageUrl || proof.imageUrl) ? 'sm:col-span-7' : 'sm:col-span-12'" class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div class="rounded-xl border border-gray-200 bg-white p-3.5">
                      <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Recibido por</span>
                      <span class="mt-1 block font-bold text-gray-900 text-sm">{{ proof.receiverName || ord.recipientName || 'Cliente Titular' }}</span>
                      @if (proof.receiverDocument) {
                        <span class="mt-0.5 block font-mono text-[11px] text-gray-500">Doc. Identidad: {{ proof.receiverDocument }}</span>
                      }
                    </div>

                    <div class="rounded-xl border border-gray-200 bg-white p-3.5">
                      <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Unidad de reparto</span>
                      <span class="mt-1 block font-bold text-gray-900 text-sm">{{ ord.assignedDriverName || proof.driverName || 'Despacho Oficial Asunción' }}</span>
                      <span class="mt-0.5 block text-[11px] text-emerald-700 font-medium">✓ Verificación presencial completada</span>
                    </div>

                    @if (proof.deliveryNotes || proof.notes) {
                      <div class="sm:col-span-2 rounded-xl border border-gray-200 bg-white p-3.5">
                        <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Observaciones de recepción</span>
                        <p class="mt-1 text-gray-700">{{ proof.deliveryNotes || proof.notes }}</p>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>

            }

          <!-- Ordered Spare Parts & Status History Grid -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div class="lg:col-span-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                <div class="flex items-center gap-2">
                  <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600 font-bold text-xs">
                    📦
                  </span>
                  <h3 class="text-sm font-bold text-gray-900">
                    Detalle de repuestos solicitados
                  </h3>
                </div>
                <span class="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-bold text-gray-700">
                  {{ ord.items.length }} {{ ord.items.length === 1 ? 'ítem' : 'ítems' }}
                </span>
              </div>

              <div class="divide-y divide-gray-100">
                @for (item of ord.items; track item.id) {
                  <div class="py-3.5 flex items-center justify-between gap-4 text-xs">
                    <div class="min-w-0 space-y-1">
                      <p class="font-bold text-gray-900 text-xs sm:text-sm">{{ item.partName || item.name }}</p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        @if (item.partOemCode || item.oemCode) {
                          <span class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600">
                            OEM {{ item.partOemCode || item.oemCode }}
                          </span>
                        }
                        @if (item.partSku || item.sku) {
                          <span class="font-mono text-[10px] text-gray-400">
                            SKU {{ item.partSku || item.sku }}
                          </span>
                        }
                        @if (item.picked || ord.status === 'ENTREGADO') {
                          <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                            <span>Verificado en almacén</span>
                          </span>
                        }
                      </div>
                    </div>
                    <div class="text-right shrink-0 space-y-0.5">
                      <span class="block font-bold text-sm tabular-nums text-gray-900">
                        S/ {{ (item.quantity * item.unitPrice) | number: '1.2-2' }}
                      </span>
                      <span class="block text-[11px] tabular-nums text-gray-500">
                        {{ item.quantity }} und. × S/ {{ item.unitPrice | number: '1.2-2' }}
                      </span>
                    </div>
                  </div>
                }
              </div>
            </div>

            <div class="lg:col-span-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
              <div class="flex items-center justify-between border-b border-gray-100 pb-3">
                <div class="flex items-center gap-2">
                  <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                  <h3 class="text-sm font-bold text-gray-900">
                    Bitácora de actualizaciones
                  </h3>
                </div>
              </div>

              @if (!ord.statusHistory || ord.statusHistory.length === 0) {
                <p class="text-xs text-gray-500 py-4">Pedido registrado y validado en el sistema.</p>
              } @else {
                <ol class="relative border-l-2 border-orange-200 ml-3 space-y-5 pl-5 pt-1">
                  @for (h of ord.statusHistory; track $index) {
                    <li class="relative text-xs">
                      <span
                        [class]="
                          (h.newStatus || h.status) === 'ENTREGADO'
                            ? 'bg-emerald-600 ring-emerald-100'
                            : 'bg-orange-600 ring-orange-100'
                        "
                        class="absolute -left-[27px] top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-4"
                      ></span>
                      <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="font-bold text-gray-900">{{ formatStatus(h.newStatus || h.status) }}</span>
                        <span class="font-mono text-[10px] text-gray-400 tabular-nums">
                          {{ (h.changedAt || h.createdAt || h.timestamp) | date: 'dd/MM/yyyy HH:mm' }}
                        </span>
                      </div>
                      @if (h.comments || h.comment || h.notes) {
                        <p class="text-gray-600 mt-1 leading-relaxed">{{ h.comments || h.comment || h.notes }}</p>
                      }
                      @if (h.changedByName || h.changedBy) {
                        <span class="inline-block mt-1 text-[10px] text-gray-400 font-medium">Responsable: {{ h.changedByName || h.changedBy }}</span>
                      }
                    </li>
                  }
                </ol>
              }
            </div>
          </div>
        }

              </div>

      <!-- Full-Screen Driver Rating Pop-up Modal -->
        @if (showRatingModal() && !auth.hasAnyRole(['ADMIN', 'VENDEDOR', 'MOTORIZADO']) && order(); as ord) {
          <div class="fixed inset-0 z-[9999] overflow-y-auto flex items-center justify-center p-4 bg-gray-950/80 backdrop-blur-md animate-fadeIn">
            <!-- Click backdrop to dismiss -->
            <div class="absolute inset-0" (click)="dismissRatingModal()"></div>

            <div class="relative w-full max-w-md my-auto rounded-3xl border border-amber-200 bg-white p-6 sm:p-7 shadow-2xl z-10 space-y-5 animate-scaleUp">
              <!-- Close (X) button -->
              <button
                type="button"
                (click)="dismissRatingModal()"
                class="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              <!-- Header -->
              <div class="text-center space-y-2 pt-2">
                <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-amber-500 text-white shadow-md shadow-amber-500/25 text-2xl">
                  🛵
                </div>
                <h3 class="text-lg font-black text-gray-900 tracking-tight">¡Pedido Entregado con Éxito!</h3>
                <p class="text-xs text-gray-500 max-w-xs mx-auto">
                  ¿Cómo calificarías la atención de tu repartidor <strong class="text-gray-800">{{ ord.assignedDriverName || ord.deliveryProof?.driverName || 'Miguel Ángel Flores' }}</strong>?
                </p>
              </div>

              <!-- Star Rating -->
              <div class="flex flex-col items-center justify-center py-2 space-y-2">
                <div class="flex items-center gap-2">
                  @for (star of [1, 2, 3, 4, 5]; track star) {
                    <button
                      type="button"
                      (click)="selectedStars.set(star)"
                      class="text-3xl transition-transform hover:scale-125 active:scale-95 cursor-pointer focus:outline-none"
                      [class.text-amber-400]="star <= selectedStars()"
                      [class.text-gray-200]="star > selectedStars()"
                    >
                      ★
                    </button>
                  }
                </div>
                <span class="rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-xs font-bold text-amber-900">
                  {{ selectedStars() }} de 5 estrellas
                </span>
              </div>

              <!-- Compliment Tags -->
              <div class="space-y-2">
                <label class="block text-xs font-bold text-gray-700">¿Qué destacarías de la entrega?</label>
                <div class="flex flex-wrap gap-1.5 justify-center">
                  @for (tag of availableRatingTags; track tag) {
                    <button
                      type="button"
                      (click)="toggleRatingTag(tag)"
                      [class]="selectedRatingTags().includes(tag) ? 'bg-amber-500 text-white border-amber-500 shadow-2xs' : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-amber-300'"
                      class="rounded-xl border px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                    >
                      {{ tag }}
                    </button>
                  }
                </div>
              </div>

              <!-- Comment Textarea -->
              <div class="space-y-1.5">
                <label class="block text-xs font-bold text-gray-700">Comentario para el repartidor (opcional)</label>
                <textarea
                  [(ngModel)]="ratingComment"
                  rows="2"
                  placeholder="Ej: Llegó muy rápido y con el repuesto debidamente sellado..."
                  class="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:bg-white focus:outline-none transition resize-none"
                ></textarea>
              </div>

              <!-- Action Buttons -->
              <div class="space-y-2 pt-1">
                <button
                  type="button"
                  (click)="submitDriverRating(ord)"
                  class="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-sm shadow-md shadow-orange-500/20 transition cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>Enviar Calificación</span>
                  <span>→</span>
                </button>

                <button
                  type="button"
                  (click)="dismissRatingModal()"
                  class="w-full py-2 text-xs font-medium text-gray-400 hover:text-gray-600 transition cursor-pointer"
                >
                  Omitir por ahora
                </button>
              </div>
            </div>
          </div>
        }
    </div>
  `,
})
export class TrackOrderPageComponent implements OnInit, OnDestroy {
  readonly driverRatingService = inject(DriverRatingService);
  readonly soundService = inject(SoundService);

  readonly selectedStars = signal<number>(5);
  readonly selectedRatingTags = signal<string[]>(['Muy puntual', 'Amable']);
  ratingComment = '';
  readonly availableRatingTags = ['Muy puntual', 'Amable', 'Repuesto sellado', 'Llegó rápido', 'Excelente servicio'];
  readonly showRatingModal = signal(false);
  private dismissedModalOrders = new Set<string>();

  openRatingModal(): void {
    if (this.auth.hasAnyRole(['ADMIN', 'VENDEDOR', 'MOTORIZADO'])) return;
    const ord = this.order();
    if (!ord) return;
    const existing = this.driverRatingService.getRatingByOrder(ord.orderNumber);
    if (existing) {
      this.selectedStars.set(existing.stars);
      this.selectedRatingTags.set([...existing.tags]);
      this.ratingComment = existing.comment || '';
    } else {
      this.selectedStars.set(5);
      this.selectedRatingTags.set(['Muy puntual', 'Amable']);
      this.ratingComment = '';
    }
    if (typeof document !== 'undefined') { document.body.style.overflow = 'hidden'; }
    this.soundService.playNotificationChime();
    this.showRatingModal.set(true);
  }

  dismissRatingModal(): void {
    if (this.auth.hasAnyRole(['ADMIN', 'VENDEDOR', 'MOTORIZADO'])) return;
    const ord = this.order();
    if (ord) {
      this.dismissedModalOrders.add(ord.orderNumber);
    }
    if (typeof document !== 'undefined') { document.body.style.overflow = ''; }
    this.showRatingModal.set(false);
  }

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
    this.showRatingModal.set(false);
    this.soundService.playSuccessChime();
    this.toast.success('¡Gracias por tu opinión!', 'Tu calificación ha sido registrada para el repartidor.');
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
    if (typeof document !== 'undefined') { document.body.style.overflow = ''; }
    this.stopPolling();
    this.disconnectSse();
  }

  formatStatus(status?: string): string {
    if (!status) return 'Actualización del pedido';
    switch (status) {
      case 'RESERVADO':
        return 'Stock reservado';
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
      case 'RESERVADO':
        return 'bg-amber-50 text-amber-800 border-amber-200';
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
      .pipe(
        finalize(() => {
          if (!isSilent) this.isLoading.set(false);
        })
      )
      .subscribe({
        next: (ord) => {
          this.handleOrderUpdate(ord, isSilent);
          if (ord.status === 'ENTREGADO' || ord.status === 'CANCELADO') {
            this.liveTelemetry.set(null);
            this.stopPolling();
            this.disconnectSse();
          } else if (!isSilent) {
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

    if (current === 'ENTREGADO' || current === 'CANCELADO') {
      this.liveTelemetry.set(null);
      this.stopPolling();
      this.disconnectSse();

      const isStaff = this.auth.hasAnyRole(['ADMIN', 'VENDEDOR', 'MOTORIZADO']);
      if (!isStaff && current === 'ENTREGADO' && !this.driverRatingService.hasRated(ord.orderNumber) && !this.dismissedModalOrders.has(ord.orderNumber)) {
        setTimeout(() => {
          this.openRatingModal();
        }, 500);
      }
    }

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
        this.liveTelemetry.set(null);
        this.stopPolling();
        this.disconnectSse();
        return;
      }
      this.searchOrder(true);
      // Silently refresh order details to catch status changes in real time
      this.searchOrder(true);
      this.telemetryService.getOrderLiveTelemetry(orderNumber).subscribe({
        next: (telemetry: LiveTrackingResponse) => {
          if (telemetry && this.order()?.status !== 'ENTREGADO' && this.order()?.status !== 'CANCELADO') {
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
    if (this.order()?.status === 'ENTREGADO' || this.order()?.status === 'CANCELADO') {
      return;
    }

    this.telemetryService.getOrderLiveTelemetry(orderNumber).subscribe({
      next: (telemetry: LiveTrackingResponse) => {
        const telStatus = telemetry?.orderStatus || telemetry?.status;
        if (telStatus === 'ENTREGADO' || telStatus === 'CANCELADO') {
          this.liveTelemetry.set(null);
          this.searchOrder(true);
          return;
        }
        this.liveTelemetry.set(telemetry);
        if (telStatus && this.order() && telStatus !== this.order()!.status) {
          this.searchOrder(true);
        }
      },
      error: () => {},
    });

    this.disconnectSse();
    this.sseSub = this.telemetryService.streamOrderTracking(orderNumber).subscribe({
      next: (telemetry: LiveTrackingResponse) => {
        const telStatus = telemetry?.orderStatus || telemetry?.status;
        if (telStatus === 'ENTREGADO' || telStatus === 'CANCELADO') {
          this.liveTelemetry.set(null);
          this.searchOrder(true);
          return;
        }
        this.liveTelemetry.set(telemetry);
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
