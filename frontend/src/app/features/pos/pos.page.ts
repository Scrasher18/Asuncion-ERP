import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Branch, Category, Order, Part } from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { LogisticsService } from '../../core/services/logistics.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] text-gray-900 pb-16">
      <!-- Dedicated POS / Caja Header with Direct Switch Back to ERP -->
      <div class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-5">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 text-xs font-bold text-orange-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-orange-600"></span>
                  Terminal de Caja & Facturación Directa
                </span>
                <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700">
                  Cajero(a): {{ auth.currentUser()?.fullName || 'Asesor Comercial' }}
                </span>
                <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                  Stock Sincronizado en Tiempo Real
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
                Punto de Venta en Tienda (Caja)
              </h1>
              <p class="text-xs sm:text-sm text-gray-500">
                Emisión rápida de Boletas y Facturas en mostrador con descuento automático de inventario y protección de reservas online.
              </p>
            </div>

            <!-- Navigation Switcher to go back and forth between ERP and Caja -->
            <div class="flex flex-wrap items-center gap-2.5">
              <a
                routerLink="/admin"
                class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-gray-700 shadow-2xs hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-700 transition"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                </svg>
                <span>Volver al Centro de Control ERP</span>
              </a>

              <button
                type="button"
                (click)="refreshPosData()"
                class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs sm:text-sm font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer"
              >
                <svg class="h-4 w-4" [class.animate-spin]="loadingParts()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                <span>Sincronizar Stock</span>
              </button>
            </div>
          </div>

          <!-- Quick Caja KPIs -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
            <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 flex items-center justify-between">
              <div>
                <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Comprobantes Emitidos en Caja</span>
                <span class="font-mono text-xl font-extrabold text-gray-900 mt-0.5 block">{{ counterOrders().length }}</span>
              </div>
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 border border-orange-200 text-orange-600 font-bold">
                🧾
              </span>
            </div>

            <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 flex items-center justify-between">
              <div>
                <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Recaudado en Caja</span>
                <span class="font-mono text-xl font-extrabold text-emerald-700 mt-0.5 block">
                  S/ {{ totalCounterRevenue() | number: '1.2-2' }}
                </span>
              </div>
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold">
                S/
              </span>
            </div>

            <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 flex items-center justify-between">
              <div>
                <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Repuestos Disponibles en Almacén</span>
                <span class="font-mono text-xl font-extrabold text-gray-900 mt-0.5 block">{{ parts().length }}</span>
              </div>
              <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-gray-700 font-bold">
                📦
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Main POS Workspace Grid -->
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-8">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <!-- LEFT COLUMN (7 cols): PRODUCT SEARCH & LIVE INVENTORY GRID -->
          <div class="lg:col-span-7 space-y-4">
            <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-2xs space-y-4">
              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 class="text-sm sm:text-base font-extrabold text-gray-900">
                    1. Selección de Repuestos en Almacén
                  </h2>
                  <p class="text-xs text-gray-500">
                    Haz clic en cualquier repuesto para agregarlo al ticket de caja. Llevando 4+ unidades se aplica tarifa mayorista.
                  </p>
                </div>
              </div>

              <!-- Search Input -->
              <div class="relative">
                <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  [(ngModel)]="searchQuery"
                  placeholder="Buscar por nombre del repuesto, código SKU, código OEM o marca..."
                  class="min-h-[44px] w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-4 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <!-- Category Pills -->
              @if (categories().length > 0) {
                <div class="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    (click)="selectedCategoryName.set(null)"
                    [class]="
                      selectedCategoryName() === null
                        ? 'border-orange-600 bg-orange-600 text-white font-bold'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium'
                    "
                    class="shrink-0 rounded-xl border px-3 py-1.5 text-xs transition cursor-pointer"
                  >
                    Todos ({{ parts().length }})
                  </button>
                  @for (cat of categories(); track cat.id) {
                    <button
                      type="button"
                      (click)="selectedCategoryName.set(cat.name)"
                      [class]="
                        selectedCategoryName() === cat.name
                          ? 'border-orange-600 bg-orange-600 text-white font-bold'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium'
                      "
                      class="shrink-0 rounded-xl border px-3 py-1.5 text-xs transition cursor-pointer"
                    >
                      {{ cat.name }}
                    </button>
                  }
                </div>
              }

              <!-- Parts Grid -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
                @for (part of filteredParts(); track part.id) {
                  <div
                    class="group rounded-xl border border-gray-200 bg-white p-3.5 hover:border-orange-300 hover:shadow-xs transition flex flex-col justify-between gap-3"
                  >
                    <div class="flex items-start gap-3">
                      <img
                        [src]="resolveImg(part)"
                        [alt]="part.name"
                        class="h-14 w-16 rounded-lg border border-gray-200 object-cover bg-gray-50 shrink-0"
                      />
                      <div class="min-w-0 flex-1">
                        <span class="block text-[10px] font-bold uppercase tracking-wider text-orange-600 truncate">
                          {{ part.manufacturerBrand || 'Genérico' }} · {{ part.categoryName }}
                        </span>
                        <h3 class="text-xs font-extrabold text-gray-900 line-clamp-2 leading-snug mt-0.5">
                          {{ part.name }}
                        </h3>
                        <div class="flex flex-wrap items-center gap-1.5 mt-1 font-mono text-[10px] text-gray-500">
                          <span class="font-semibold text-gray-700">{{ part.sku }}</span>
                          @if (part.oemCode) {
                            <span>· OEM {{ part.oemCode }}</span>
                          }
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center justify-between gap-2 pt-2.5 border-t border-gray-100">
                      <div>
                        <div class="flex items-baseline gap-1.5">
                          <span class="font-mono text-sm font-extrabold text-gray-900">
                            S/ {{ part.salePrice | number: '1.2-2' }}
                          </span>
                          @if (part.wholesalePrice) {
                            <span class="font-mono text-[10px] font-bold text-emerald-700">
                              May(4+): S/ {{ part.wholesalePrice | number: '1.2-2' }}
                            </span>
                          }
                        </div>

                        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span
                            [class]="
                              (part.availableStock ?? part.stockQuantity) <= 0
                                ? 'text-red-600 font-bold'
                                : (part.availableStock ?? part.stockQuantity) <= 5
                                  ? 'text-orange-600 font-bold'
                                  : 'text-emerald-700 font-semibold'
                            "
                            class="text-[11px]"
                          >
                            Disp: {{ part.availableStock ?? part.stockQuantity }} und.
                          </span>
                          @if ((part.reservedQuantity ?? 0) > 0) {
                            <span class="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                              ⏳ {{ part.reservedQuantity }} reservado web
                            </span>
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        [disabled]="(part.availableStock ?? part.stockQuantity) <= 0"
                        (click)="addToTicket(part)"
                        class="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer"
                      >
                        <span>+ Agregar</span>
                      </button>
                    </div>
                  </div>
                } @empty {
                  <div class="col-span-full py-12 text-center text-xs text-gray-500">
                    No se encontraron repuestos con el criterio de búsqueda.
                  </div>
                }
              </div>
            </div>
          </div>

          <!-- RIGHT COLUMN (5 cols): ACTIVE CAJA TICKET & CUSTOMER BILLING -->
          <div class="lg:col-span-5 space-y-4 lg:sticky lg:top-20">
            <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-5">
              <!-- Ticket Header -->
              <div class="flex items-center justify-between border-b border-gray-100 pb-3.5">
                <div>
                  <h2 class="text-base font-extrabold text-gray-900">
                    2. Ticket de Venta en Caja ({{ totalTicketUnits() }} und.)
                  </h2>
                  <p class="text-xs text-gray-500">
                    Verificación inmediata de stock y cálculo de IGV (18%).
                  </p>
                </div>
                @if (ticketItems().length > 0) {
                  <button
                    type="button"
                    (click)="clearTicket()"
                    class="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
                  >
                    Vaciar caja
                  </button>
                }
              </div>

              <!-- Ticket Items List -->
              @if (ticketItems().length === 0) {
                <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-8 text-center space-y-1.5">
                  <p class="text-xs font-bold text-gray-700">El ticket de caja está vacío</p>
                  <p class="text-[11px] text-gray-500">
                    Selecciona los repuestos en el panel izquierdo para registrar la venta en tienda.
                  </p>
                </div>
              } @else {
                <div class="divide-y divide-gray-100 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/40">
                  @for (item of ticketItems(); track item.part.id) {
                    <div class="p-3 flex items-center justify-between gap-2.5 text-xs bg-white">
                      <div class="min-w-0 flex-1">
                        <p class="font-bold text-gray-900 truncate">{{ item.part.name }}</p>
                        <div class="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span class="font-mono text-[11px] text-gray-500">
                            {{ item.part.sku }} · S/ {{ getEffectiveUnitPrice(item) | number: '1.2-2' }} c/u
                          </span>
                          @if (item.quantity >= 4 && item.part.wholesalePrice) {
                            <span class="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700">
                              Mayorista 4+
                            </span>
                          }
                        </div>
                      </div>

                      <div class="flex items-center gap-1.5">
                        <button
                          type="button"
                          (click)="updateItemQty(item.part.id, item.quantity - 1)"
                          class="h-7 w-7 rounded-lg border border-gray-200 bg-gray-50 font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
                        >
                          −
                        </button>
                        <span class="w-7 text-center font-mono font-extrabold text-gray-900">{{ item.quantity }}</span>
                        <button
                          type="button"
                          [disabled]="item.quantity >= (item.part.availableStock ?? item.part.stockQuantity)"
                          (click)="updateItemQty(item.part.id, item.quantity + 1)"
                          class="h-7 w-7 rounded-lg border border-gray-200 bg-gray-50 font-bold text-gray-700 hover:bg-gray-100 disabled:opacity-40 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div class="w-20 text-right font-mono font-extrabold text-gray-900">
                        S/ {{ (getEffectiveUnitPrice(item) * item.quantity) | number: '1.2-2' }}
                      </div>
                    </div>
                  }
                </div>
              }

              <!-- Customer & Document Section -->
              <div class="space-y-3.5 pt-2 border-t border-gray-100">
                <h3 class="text-xs font-extrabold uppercase tracking-wider text-gray-700">
                  3. Comprobante Fiscal y Cliente
                </h3>

                <!-- Boleta / Factura Switch -->
                <div class="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    (click)="setInvoiceType('BOLETA')"
                    [class]="
                      invoiceType === 'BOLETA'
                        ? 'border-orange-600 bg-orange-50 text-orange-700 font-bold shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium'
                    "
                    class="rounded-xl border py-2.5 text-xs transition cursor-pointer"
                  >
                    Boleta de Venta (DNI)
                  </button>
                  <button
                    type="button"
                    (click)="setInvoiceType('FACTURA')"
                    [class]="
                      invoiceType === 'FACTURA'
                        ? 'border-orange-600 bg-orange-50 text-orange-700 font-bold shadow-2xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 font-medium'
                    "
                    class="rounded-xl border py-2.5 text-xs transition cursor-pointer"
                  >
                    Factura Electrónica (RUC)
                  </button>
                </div>

                <!-- DNI / RUC Lookup -->
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    {{ invoiceType === 'FACTURA' ? 'Número de RUC (11 dígitos) *' : 'DNI del Cliente (8 dígitos)' }}
                  </label>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="customerDoc"
                      [attr.maxlength]="invoiceType === 'FACTURA' ? 11 : 8"
                      [placeholder]="invoiceType === 'FACTURA' ? 'Ej: 20608899114' : 'Ej: 71156519'"
                      class="flex-1 min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-gray-900 focus:border-orange-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      [disabled]="lookingUpDoc()"
                      (click)="lookupCustomerDoc()"
                      class="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer shrink-0"
                    >
                      {{ lookingUpDoc() ? 'Consultando...' : 'Consultar RENIEC/SUNAT' }}
                    </button>
                  </div>
                </div>

                <!-- Customer Name / Business Name -->
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    {{ invoiceType === 'FACTURA' ? 'Razón Social *' : 'Nombre del Cliente *' }}
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="customerName"
                    placeholder="Nombre completo o razón social"
                    class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                <!-- Payment Method & Cash Received -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Medio de Cobro en Caja</label>
                    <select
                      [(ngModel)]="paymentMethod"
                      class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:border-orange-600 focus:outline-none"
                    >
                      <option value="MOSTRADOR_EFECTIVO">💵 Efectivo en Caja</option>
                      <option value="MOSTRADOR_YAPE_PLIN">📱 Yape / Plin en Tienda</option>
                      <option value="MOSTRADOR_POS_TARJETA">💳 POS Físico (Tarjeta)</option>
                    </select>
                  </div>

                  @if (paymentMethod === 'MOSTRADOR_EFECTIVO') {
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Efectivo Recibido (S/)</label>
                      <input
                        type="number"
                        step="0.10"
                        [(ngModel)]="cashReceived"
                        placeholder="0.00"
                        class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs font-bold text-gray-900 focus:border-orange-600 focus:outline-none"
                      />
                    </div>
                  } @else {
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">Celular (Opcional)</label>
                      <input
                        type="text"
                        [(ngModel)]="customerPhone"
                        placeholder="987654321"
                        class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                      />
                    </div>
                  }
                </div>
              </div>

              <!-- Totals & Cash Change Summary -->
              <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-xs">
                <div class="flex justify-between text-gray-600">
                  <span>Subtotal repuestos:</span>
                  <span class="font-mono font-semibold">S/ {{ ticketSubtotal() | number: '1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-gray-600">
                  <span>IGV (18%):</span>
                  <span class="font-mono font-semibold">S/ {{ ticketIgv() | number: '1.2-2' }}</span>
                </div>
                <div class="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Total a Cobrar:</span>
                  <span class="font-mono text-orange-600">S/ {{ ticketTotal() | number: '1.2-2' }}</span>
                </div>

                @if (paymentMethod === 'MOSTRADOR_EFECTIVO' && cashReceived && cashReceived > ticketTotal()) {
                  <div class="flex justify-between text-xs font-bold text-emerald-700 pt-1">
                    <span>Vuelto a entregar al cliente:</span>
                    <span class="font-mono">S/ {{ (cashReceived - ticketTotal()) | number: '1.2-2' }}</span>
                  </div>
                }
              </div>

              <!-- Submit Sale CTA -->
              <button
                type="button"
                [disabled]="ticketItems().length === 0 || submitting()"
                (click)="submitCounterSale()"
                class="w-full min-h-[48px] rounded-xl bg-orange-600 py-3 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-orange-700 active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer"
              >
                {{ submitting() ? 'Procesando cobro y descontando stock...' : '✓ Cobrar en Caja y Emitir Comprobante PDF' }}
              </button>
            </div>
          </div>
        </div>

        <!-- BOTTOM SECTION: HISTORIAL DE VENTAS REALIZADAS EN CAJA -->
        <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
          <div class="border-b border-gray-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 class="text-base font-bold text-gray-900">
                Historial de Ventas en Caja ({{ counterOrders().length }})
              </h2>
              <p class="text-xs text-gray-500">
                Registro exclusivo de ventas en tienda física (no genera alertas en la campana de pedidos online).
              </p>
            </div>
          </div>

          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200 text-xs">
              <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                <tr>
                  <th class="px-4 py-3">N.° Ticket / Fecha</th>
                  <th class="px-4 py-3">Cliente / Documento</th>
                  <th class="px-4 py-3">Comprobante</th>
                  <th class="px-4 py-3">Medio de Pago</th>
                  <th class="px-4 py-3 text-right">Total Cobrado</th>
                  <th class="px-4 py-3 text-right">Comprobante PDF</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                @for (ord of counterOrders(); track ord.id) {
                  <tr class="hover:bg-gray-50/70 transition">
                    <td class="px-4 py-3.5 font-mono font-bold text-gray-900">
                      {{ ord.orderNumber }}
                      <span class="block font-sans font-normal text-[11px] text-gray-500">
                        {{ ord.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5">
                      <p class="font-semibold text-gray-900">{{ ord.recipientName || ord.customerName }}</p>
                      <span class="font-mono text-[11px] text-gray-500">
                        {{ ord.customerTaxId || 'Sin documento' }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5">
                      <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2.5 py-0.5 text-[11px] font-bold text-gray-700">
                        {{ ord.invoiceType }}
                      </span>
                    </td>
                    <td class="px-4 py-3.5 font-medium text-gray-700">
                      {{ formatPosPaymentMethod(ord.paymentMethod) }}
                    </td>
                    <td class="px-4 py-3.5 text-right font-mono font-extrabold text-gray-900">
                      S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                    </td>
                    <td class="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        (click)="downloadReceipt(ord)"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer"
                      >
                        <span>Descargar PDF</span>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="6" class="px-4 py-10 text-center text-gray-500">
                      Aún no se han registrado ventas en caja en esta sesión.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class PosPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly ordersService = inject(OrdersService);
  private readonly logisticsService = inject(LogisticsService);
  private readonly lookupService = inject(LookupService);
  private readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  readonly parts = signal<Part[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly allOrders = signal<Order[]>([]);
  readonly loadingParts = signal<boolean>(false);

  searchQuery = '';
  readonly selectedCategoryName = signal<string | null>(null);

  readonly ticketItems = signal<{ part: Part; quantity: number }[]>([]);
  invoiceType: 'BOLETA' | 'FACTURA' = 'BOLETA';
  customerDoc = '';
  customerName = 'Cliente en Caja';
  customerPhone = '';
  paymentMethod = 'MOSTRADOR_EFECTIVO';
  cashReceived: number | null = null;

  readonly lookingUpDoc = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);

  readonly filteredParts = computed<Part[]>(() => {
    const q = this.searchQuery.trim().toLowerCase();
    const cat = this.selectedCategoryName();
    return this.parts().filter((p) => {
      if (cat && p.categoryName !== cat) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku || '').toLowerCase().includes(q) ||
        (p.oemCode || '').toLowerCase().includes(q) ||
        (p.manufacturerBrand || '').toLowerCase().includes(q)
      );
    });
  });

  readonly totalTicketUnits = computed<number>(() =>
    this.ticketItems().reduce((acc, i) => acc + i.quantity, 0)
  );

  readonly ticketSubtotal = computed<number>(() =>
    this.ticketItems().reduce((acc, i) => acc + this.getEffectiveUnitPrice(i) * i.quantity, 0)
  );

  readonly ticketIgv = computed<number>(() => this.ticketSubtotal() * 0.18);
  readonly ticketTotal = computed<number>(() => this.ticketSubtotal() + this.ticketIgv());

  readonly counterOrders = computed<Order[]>(() =>
    this.allOrders().filter((o) => this.isCounterOrder(o))
  );

  readonly totalCounterRevenue = computed<number>(() =>
    this.counterOrders().reduce((acc, o) => acc + (o.totalAmount ?? o.total ?? o.subtotal ?? 0), 0)
  );

  ngOnInit(): void {
    this.refreshPosData();
    this.catalogService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
    });
    this.logisticsService.getBranches().subscribe({
      next: (brs) => this.branches.set(brs),
    });
  }

  refreshPosData(): void {
    this.loadingParts.set(true);
    this.catalogService
      .getAdminParts(false)
      .pipe(finalize(() => this.loadingParts.set(false)))
      .subscribe({
        next: (list) => this.parts.set(list),
      });

    this.ordersService.getAllOrders().subscribe({
      next: (ords) => this.allOrders.set(ords),
    });
  }

  private isCounterOrder(ord: Order): boolean {
    const pm = (ord.paymentMethod || '').toUpperCase();
    const notes = (ord.notes || '').toUpperCase();
    const addr = (ord.deliveryAddress || '').toUpperCase();
    const client = (ord.customerName || ord.recipientName || '').toUpperCase();
    const delType = (ord.deliveryType || '').toUpperCase();
    return (
      delType === 'MOSTRADOR' ||
      pm.startsWith('MOSTRADOR') ||
      notes.includes('MOSTRADOR') ||
      notes.includes('PRESENCIAL') ||
      addr.includes('MOSTRADOR') ||
      addr.includes('VENTA PRESENCIAL') ||
      client === 'CLIENTE DE MOSTRADOR' ||
      client === 'CLIENTE EN CAJA'
    );
  }

  getEffectiveUnitPrice(item: { part: Part; quantity: number }): number {
    if (
      item.quantity >= 4 &&
      item.part.wholesalePrice &&
      item.part.wholesalePrice > 0 &&
      item.part.wholesalePrice < item.part.salePrice
    ) {
      return item.part.wholesalePrice;
    }
    return item.part.salePrice;
  }

  addToTicket(part: Part): void {
    const maxAvail = part.availableStock ?? part.stockQuantity;
    if (maxAvail <= 0) {
      this.toast.warning('Sin stock disponible', 'Este repuesto está agotado o reservado online.');
      return;
    }
    const list = [...this.ticketItems()];
    const idx = list.findIndex((i) => i.part.id === part.id);
    if (idx >= 0) {
      if (list[idx].quantity >= maxAvail) {
        this.toast.warning('Stock máximo alcanzado', `Solo hay ${maxAvail} unidades disponibles.`);
        return;
      }
      list[idx] = { ...list[idx], quantity: list[idx].quantity + 1 };
    } else {
      list.push({ part, quantity: 1 });
    }
    this.ticketItems.set(list);
  }

  updateItemQty(partId: number, newQty: number): void {
    if (newQty <= 0) {
      this.ticketItems.set(this.ticketItems().filter((i) => i.part.id !== partId));
      return;
    }
    this.ticketItems.set(
      this.ticketItems().map((i) => {
        if (i.part.id === partId) {
          const maxAvail = i.part.availableStock ?? i.part.stockQuantity;
          return { ...i, quantity: Math.min(newQty, maxAvail) };
        }
        return i;
      })
    );
  }

  clearTicket(): void {
    this.ticketItems.set([]);
    this.cashReceived = null;
  }

  setInvoiceType(type: 'BOLETA' | 'FACTURA'): void {
    this.invoiceType = type;
    if (type === 'FACTURA' && this.customerName === 'Cliente en Caja') {
      this.customerName = '';
    } else if (type === 'BOLETA' && !this.customerName) {
      this.customerName = 'Cliente en Caja';
    }
  }

  lookupCustomerDoc(): void {
    const doc = (this.customerDoc || '').trim();
    if (!doc) {
      this.toast.info('Documento', 'Ingresa un número de DNI (8 dígitos) o RUC (11 dígitos).');
      return;
    }
    this.lookingUpDoc.set(true);
    this.lookupService
      .lookupDocument(doc)
      .pipe(finalize(() => this.lookingUpDoc.set(false)))
      .subscribe({
        next: (res) => {
          const name = (res.businessName || res.fullName || '').trim();
          if (res.found && name) {
            this.customerName = name;
            this.invoiceType = res.documentType === 'RUC' || doc.length === 11 ? 'FACTURA' : 'BOLETA';
            this.toast.success('Datos verificados', name);
          } else {
            this.toast.info('Ingreso manual', 'Escribe el nombre o razón social manualmente.');
          }
        },
        error: () => {
          this.toast.info('Ingreso manual', 'Escribe el nombre o razón social manualmente.');
        },
      });
  }

  submitCounterSale(): void {
    const items = this.ticketItems();
    if (items.length === 0) return;

    const cleanDoc = (this.customerDoc || '').trim();
    const cleanName = (this.customerName || '').trim() || 'Cliente en Caja';

    if (this.invoiceType === 'FACTURA' && cleanDoc.length !== 11) {
      this.toast.warning('RUC requerido', 'Para emitir Factura Electrónica ingresa un RUC válido de 11 dígitos.');
      return;
    }

    this.submitting.set(true);
    this.ordersService
      .createOrder({
        deliveryType: 'MOSTRADOR',
        branchId: this.branches()[0]?.id ?? 1,
        recipientName: cleanName,
        recipientPhone: (this.customerPhone || '').trim() || '999999999',
        invoiceType: this.invoiceType,
        customerTaxId: cleanDoc || '00000000',
        customerBusinessName: cleanName,
        paymentMethod: this.paymentMethod,
        notes: 'Venta directa en Caja',
        items: items.map((i) => ({ partId: i.part.id, quantity: i.quantity })),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (createdOrder) => {
          this.toast.success(
            'Venta en Caja Registrada',
            `Comprobante #${createdOrder.orderNumber} emitido y stock actualizado.`
          );
          this.clearTicket();
          this.customerDoc = '';
          this.customerName = 'Cliente en Caja';
          this.customerPhone = '';
          this.refreshPosData();
          this.pdfInvoiceService.generateInvoicePdf(createdOrder, true);
        },
        error: (err) => {
          this.toast.error(
            'Error al procesar cobro',
            err?.error?.message || 'Verifica el stock disponible e inténtalo de nuevo.'
          );
          this.refreshPosData();
        },
      });
  }

  downloadReceipt(ord: Order): void {
    this.pdfInvoiceService.generateInvoicePdf(ord, true);
  }

  formatPosPaymentMethod(method?: string): string {
    switch (method) {
      case 'MOSTRADOR_EFECTIVO':
        return 'Efectivo en Caja';
      case 'MOSTRADOR_YAPE_PLIN':
        return 'Yape / Plin';
      case 'MOSTRADOR_POS_TARJETA':
        return 'POS Tarjeta';
      default:
        return (method || 'Caja').replace(/^MOSTRADOR_/, '').replace(/_/g, ' ');
    }
  }

  resolveImg(part: Part): string {
    return this.apiConfig.resolveMediaUrl(part.primaryImageUrl, part.categoryName, part.name);
  }
}
