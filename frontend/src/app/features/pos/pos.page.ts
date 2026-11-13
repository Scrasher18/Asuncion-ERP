import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, retry, Subscription } from 'rxjs';
import { Branch, Category, Order, Part } from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ONLINE_ACTIVE_HOLDS_KEY,
  POS_ACTIVE_HOLDS_KEY,
} from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { LogisticsService } from '../../core/services/logistics.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import { ExcelExportService } from '../../core/services/excel-export.service';
import {
  BOLETA_DNI_REQUIRED_THRESHOLD,
  buildWhatsAppFacturaUrl,
  isAnonymousBillingName,
} from '../../core/constants/company-info.constant';
import { ToastService } from '../../core/services/toast.service';
import { SyncBusService } from '../../core/services/sync-bus.service';

const POS_SESSION_KEY = 'asuncion_pos_reservation_session_id';
const POS_TICKET_STORAGE_KEY = 'asuncion_pos_ticket_v1';
const POS_HOLD_TTL_MS = 15 * 60 * 1000;

@Component({
  selector: 'app-pos-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] text-gray-900 pb-16">
      <!-- Dedicated POS Header + Module Navigation Bar -->
      <div class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
          <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-5">
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 text-xs font-bold text-orange-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-orange-600"></span>
                  Facturación Directa en Tienda
                </span>
                <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-3 py-0.5 text-xs font-semibold text-gray-700">
                  Atendido por: {{ auth.currentUser()?.fullName || 'Asesor Comercial' }}
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold tracking-tight text-gray-900">
                Caja / Punto de Venta
              </h1>
              <p class="text-xs sm:text-sm text-gray-500">
                Emisión rápida de Boletas y Facturas con bloqueo inmediato de stock omnicanal (Tienda ↔ Web).
              </p>
            </div>
          </div>

          <!-- Barra de Navegación hacia los demás Módulos del ERP -->
          <nav class="-mb-px flex items-center gap-1.5 overflow-x-auto pb-2.5" aria-label="Módulos del sistema">
            <a
              routerLink="/admin"
              [queryParams]="{ tab: 'analytics' }"
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Resumen y ventas</span>
            </a>

            <a
              routerLink="/admin"
              [queryParams]="{ tab: 'parts' }"
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span>Inventario de repuestos</span>
              @if (parts().length > 0) {
                <span class="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700">
                  {{ parts().length }}
                </span>
              }
            </a>

            <a
              routerLink="/admin"
              [queryParams]="{ tab: 'orders' }"
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect width="6" height="4" x="9" y="3" rx="1" />
                <path d="M9 12h6" />
                <path d="M9 16h6" />
              </svg>
              <span>Pedidos y Despacho</span>
            </a>

            @if (auth.hasAnyRole(['ADMIN'])) {
              <a
                routerLink="/admin"
                [queryParams]="{ tab: 'branches' }"
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Zonas de reparto</span>
              </a>

              <a
                routerLink="/admin"
                [queryParams]="{ tab: 'notifications' }"
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>Correo y notificaciones</span>
              </a>

              <a
                routerLink="/admin"
                [queryParams]="{ tab: 'payments' }"
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Pasarelas y Pagos</span>
              </a>

              <a
                routerLink="/admin"
                [queryParams]="{ tab: 'users' }"
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Personal y Trabajadores</span>
              </a>
            }

            <a
              routerLink="/admin"
              [queryParams]="{ tab: 'claims' }"
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border border-transparent px-3 py-2 text-xs sm:text-[13px] font-medium text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 whitespace-nowrap transition"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <span>Reclamaciones</span>
            </a>
          </nav>
        </div>
      </div>

      <!-- Main POS Workspace Grid -->
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        <!-- Quick Summary KPIs -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div class="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between shadow-2xs">
            <div>
              <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Total Recaudado en Turno</span>
              <span class="font-mono text-xl font-extrabold text-emerald-700 mt-0.5 block">
                S/ {{ totalCounterRevenue() | number: '1.2-2' }}
              </span>
            </div>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 font-bold">
              S/
            </span>
          </div>

          <div class="rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between shadow-2xs">
            <div>
              <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Repuestos Disponibles en Catálogo</span>
              <span class="font-mono text-xl font-extrabold text-gray-900 mt-0.5 block">{{ parts().length }}</span>
            </div>
            <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 border border-gray-200 text-gray-700 font-bold">
              📦
            </span>
          </div>
        </div>

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
                    Haz clic en cualquier repuesto para agregarlo al ticket. Llevando 4+ unidades se aplica tarifa mayorista.
                  </p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"
                    title="El catálogo y el stock se actualizan automáticamente cada 15 segundos sin recargar la página"
                  >
                    <span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{{ lastCatalogSyncLabel() ? 'Sync ' + lastCatalogSyncLabel() : 'Auto-sync 15s' }}</span>
                  </span>
                  <button
                    type="button"
                    (click)="manualSilentCatalogSync()"
                    [disabled]="isSyncingCatalog()"
                    title="Sincronizar catálogo y stock ahora sin perder el ticket"
                    class="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition cursor-pointer"
                  >
                    <span>↻</span>
                    <span>{{ isSyncingCatalog() ? 'Sincronizando...' : 'Actualizar' }}</span>
                  </button>
                </div>
              </div>

              <!-- Physical store pricing banner: web promotions exclusive to web -->
              <div class="rounded-xl border border-blue-200 bg-blue-50/80 p-3 flex items-center gap-2.5 text-xs text-blue-950 font-medium">
                <span class="text-lg">🏪</span>
                <span><strong>Precios de Venta Presencial (Mostrador / Tienda Física):</strong> Rige tarifa estándar de mostrador o mayorista desde 4 und. Los combos automotrices y ofertas promocionales son exclusivos de la tienda web online.</span>
              </div>

              <!-- Search Input -->
              <div class="relative">
                <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchInput($event)"
                  (input)="onSearchInput($any($event.target).value)"
                  placeholder="Buscar por nombre del repuesto, código SKU, código OEM o marca..."
                  class="min-h-[44px] w-full rounded-xl border border-gray-200 bg-gray-50/60 pl-10 pr-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
                @if (searchQuery) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="absolute right-2.5 top-1/2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              <!-- Category Pills with visible horizontal scrollbar -->
              @if (categories().length > 0) {
                <div class="flex items-center gap-1.5 overflow-x-auto pb-2">
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
                              getRemainingPosStock(part) <= 0
                                ? 'text-red-600 font-bold'
                                : getRemainingPosStock(part) <= 5
                                  ? 'text-orange-600 font-bold'
                                  : 'text-emerald-700 font-semibold'
                            "
                            class="text-[11px]"
                          >
                            Disp: {{ getRemainingPosStock(part) }} und.
                          </span>
                          @if (getTicketQtyForPart(part.id) > 0) {
                            <span class="rounded-full bg-orange-50 border border-orange-200 px-1.5 py-0.2 text-[9px] font-bold text-orange-700">
                              🛒 {{ getTicketQtyForPart(part.id) }} en ticket
                            </span>
                          }
                          @if (getOnlineReservedForPart(part) > 0) {
                            <span class="rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.2 text-[9px] font-bold text-amber-800" title="Unidades en carritos web sin pagar. La venta en mostrador tiene prioridad de despacho físico.">
                              ⚡ {{ getOnlineReservedForPart(part) }} en carritos web (Prioridad mostrador)
                            </span>
                          }
                        </div>
                      </div>

                      <button
                        type="button"
                        [disabled]="getRemainingPosStock(part) <= 0"
                        (click)="addToTicket(part)"
                        class="inline-flex min-h-[36px] items-center gap-1 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer"
                      >
                        <span>{{ getRemainingPosStock(part) <= 0 ? 'Sin stock' : '+ Agregar' }}</span>
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
                    2. Ticket de Venta ({{ totalTicketUnits() }} und.)
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
                    Vaciar ticket
                  </button>
                }
              </div>

              <!-- Ticket Items List -->
              @if (ticketItems().length === 0) {
                <div class="rounded-xl border border-dashed border-gray-200 bg-gray-50/70 p-8 text-center space-y-1.5">
                  <p class="text-xs font-bold text-gray-700">El ticket está vacío</p>
                  <p class="text-[11px] text-gray-500">
                    Selecciona los repuestos en el panel izquierdo para registrar la venta.
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
                          [disabled]="getRemainingPosStock(item.part) <= 0"
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
                    Factura con RUC
                  </button>
                </div>

                <!-- DNI / RUC Lookup -->
                <div class="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2 text-[11px]"
                  [class]="requiresBoletaDni()
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : invoiceType === 'BOLETA'
                      ? 'border-blue-200 bg-blue-50/70 text-blue-900'
                      : 'border-gray-200 bg-gray-50 text-gray-700'">
                  @if (invoiceType === 'FACTURA') {
                    <span><strong>Factura (RUC):</strong> Desglosa Op. Gravada + 18% I.G.V. Requiere RUC 11 dígitos, Razón Social y Dirección Fiscal.</span>
                  } @else if (requiresBoletaDni()) {
                    <span><strong>Venta desde S/ {{ boletaDniThreshold }}:</strong> Por norma SUNAT es obligatorio ingresar DNI / C.E. y nombre completo.</span>
                  } @else {
                    <span><strong>Boleta menor a S/ {{ boletaDniThreshold }}:</strong> DNI opcional. Puedes emitir como <strong>Clientes Varios</strong>.</span>
                    <button
                      type="button"
                      (click)="setClientesVarios()"
                      class="rounded-lg border border-blue-300 bg-white px-2 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 cursor-pointer shrink-0"
                    >
                      Clientes Varios
                    </button>
                  }
                </div>

                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    {{
                      invoiceType === 'FACTURA'
                        ? 'Número de RUC (11 dígitos) *'
                        : requiresBoletaDni()
                          ? 'DNI / C.E. del Cliente (obligatorio >= S/ 700) *'
                          : 'DNI / C.E. (Opcional < S/ 700)'
                    }}
                  </label>
                  <div class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="customerDoc"
                      (ngModelChange)="onCustomerDocChange($event)"
                      [attr.maxlength]="invoiceType === 'FACTURA' ? 11 : 12"
                      [attr.inputmode]="invoiceType === 'FACTURA' ? 'numeric' : 'text'"
                      [placeholder]="invoiceType === 'FACTURA' ? 'Ej: 10414686867' : 'Ej: 71156519 (o C.E.)'"
                      class="flex-1 min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-xs font-semibold text-gray-900 focus:border-orange-600 focus:outline-none"
                    />
                    <button
                      type="button"
                      [disabled]="lookingUpDoc()"
                      (click)="lookupCustomerDoc()"
                      class="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer shrink-0"
                    >
                      {{ lookingUpDoc() ? 'Consultando...' : 'Consultar DNI / RUC' }}
                    </button>
                  </div>
                </div>

                <!-- Customer Name / Business Name -->
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1">
                    {{
                      invoiceType === 'FACTURA'
                        ? 'Razón Social *'
                        : requiresBoletaDni()
                          ? 'Nombres y Apellidos Completos *'
                          : 'Nombre del Cliente (o Clientes Varios)'
                    }}
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="customerName"
                    placeholder="Nombre completo, razón social o CLIENTES VARIOS"
                    class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                @if (invoiceType === 'FACTURA') {
                  <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Dirección Fiscal *</label>
                    <input
                      type="text"
                      [(ngModel)]="customerFiscalAddress"
                      placeholder="Dirección fiscal completa de la empresa"
                      class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                    />
                  </div>
                }

                <!-- Payment Method & Cash Received -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-gray-700 mb-1">Medio de Pago</label>
                    <select
                      [(ngModel)]="paymentMethod"
                      class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 focus:border-orange-600 focus:outline-none"
                    >
                      <option value="MOSTRADOR_EFECTIVO">💵 Efectivo</option>
                      <option value="MOSTRADOR_YAPE_PLIN">📱 Yape / Plin</option>
                      <option value="MOSTRADOR_POS_TARJETA">💳 Tarjeta (POS)</option>
                    </select>
                  </div>

                  @if (paymentMethod === 'MOSTRADOR_EFECTIVO') {
                    <div>
                      <div class="flex items-center justify-between mb-1">
                        <label class="block text-xs font-bold text-gray-700">Efectivo Recibido (S/)</label>
                        @if (ticketTotal() > 0) {
                          <span class="text-[10px] font-semibold text-gray-500 font-mono">
                            Mínimo: S/ {{ ticketTotal() | number: '1.2-2' }}
                          </span>
                        }
                      </div>
                      <input
                        type="text"
                        inputmode="decimal"
                        [value]="formattedCashReceived"
                        (input)="onCashReceivedInput($event)"
                        placeholder="0.00"
                        [class]="cashReceived !== null && ticketTotal() > 0 && cashReceived < ticketTotal() ? 'border-red-500 bg-red-50/50 text-red-900 ring-2 ring-red-500/20' : 'border-gray-200 bg-white text-gray-900 focus:border-orange-600'"
                        class="w-full min-h-[40px] rounded-xl border px-3 py-2 font-mono text-xs font-bold focus:outline-none transition"
                      />
                      <p class="text-[11px] text-gray-500 mt-1">
                        El monto ingresado debe ser igual o mayor al total a cobrar.
                      </p>
                      @if (cashReceived !== null && ticketTotal() > 0 && cashReceived < ticketTotal()) {
                        <div class="rounded-lg bg-red-50 border border-red-200 p-2 text-red-800 text-[11px] font-bold flex items-center gap-1.5 mt-1.5">
                          <span>⚠️ Monto menor al total: Faltan S/ {{ (ticketTotal() - cashReceived) | number: '1.2-2' }}</span>
                        </div>
                      }
                    </div>
                  }
                  @if (invoiceType === 'FACTURA' || paymentMethod !== 'MOSTRADOR_EFECTIVO') {
                    <div>
                      <label class="block text-xs font-bold text-gray-700 mb-1">
                        {{ invoiceType === 'FACTURA' ? 'WhatsApp del Cliente (para Factura SUNAT)' : 'Celular (Opcional)' }}
                      </label>
                      <input
                        type="text"
                        [(ngModel)]="customerPhone"
                        placeholder="Ej: 987654321"
                        maxlength="9"
                        class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                      />
                    </div>
                  }
                </div>
              </div>

              <!-- Totals & Cash Change Summary -->
              <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-xs">
                @if (invoiceType === 'FACTURA') {
                  <div class="flex justify-between text-gray-600">
                    <span>Op. Gravada (Subtotal sin IGV):</span>
                    <span class="font-mono font-semibold">S/ {{ ticketSubtotal() | number: '1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between text-gray-600">
                    <span>I.G.V. (18%):</span>
                    <span class="font-mono font-semibold">S/ {{ ticketIgv() | number: '1.2-2' }}</span>
                  </div>
                } @else {
                  <div class="flex justify-between text-gray-600">
                    <span>Subtotal (I.G.V. incluido):</span>
                    <span class="font-mono font-semibold">S/ {{ ticketTotal() | number: '1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between text-gray-500">
                    <span>I.G.V. (18% en Boleta):</span>
                    <span class="font-mono">Incluido (S/ 0.00 adicional)</span>
                  </div>
                }
                <div class="flex justify-between text-base font-extrabold text-gray-900 pt-2 border-t border-gray-200">
                  <span>Importe Total a Cobrar:</span>
                  <span class="font-mono text-orange-600">S/ {{ ticketTotal() | number: '1.2-2' }}</span>
                </div>

                @if (paymentMethod === 'MOSTRADOR_EFECTIVO' && cashReceived !== null && ticketTotal() > 0) {
                  @if (cashReceived > ticketTotal()) {
                    <div class="flex justify-between text-xs font-bold text-emerald-700 pt-1 border-t border-emerald-100">
                      <span>Vuelto a entregar al cliente:</span>
                      <span class="font-mono">S/ {{ (cashReceived - ticketTotal()) | number: '1.2-2' }}</span>
                    </div>
                  } @else if (cashReceived === ticketTotal()) {
                    <div class="flex justify-between text-xs font-bold text-gray-700 pt-1 border-t border-gray-200">
                      <span>Pago con monto exacto:</span>
                      <span class="font-mono text-gray-800">S/ 0.00 de vuelto</span>
                    </div>
                  } @else {
                    <div class="flex justify-between text-xs font-bold text-red-600 pt-1 border-t border-red-200">
                      <span>Monto insuficiente:</span>
                      <span class="font-mono">Faltan S/ {{ (ticketTotal() - cashReceived) | number: '1.2-2' }}</span>
                    </div>
                  }
                }
              </div>

              <!-- Submit Sale CTA -->
              <button
                type="button"
                [disabled]="ticketItems().length === 0 || submitting() || (paymentMethod === 'MOSTRADOR_EFECTIVO' && ticketTotal() > 0 && (cashReceived === null || cashReceived < ticketTotal()))"
                (click)="submitCounterSale()"
                class="w-full min-h-[48px] rounded-xl bg-orange-600 py-3 px-5 text-sm font-extrabold text-white shadow-sm hover:bg-orange-700 active:scale-[0.99] disabled:bg-gray-200 disabled:text-gray-400 transition cursor-pointer"
              >
                {{
                  submitting()
                    ? 'Procesando cobro y descontando stock...'
                    : invoiceType === 'FACTURA'
                      ? '✓ Registrar Venta y Emitir Proforma PDF'
                      : '✓ Registrar Venta y Emitir Boleta PDF'
                }}
              </button>

              @if (lastCounterFacturaOrder(); as lastFac) {
                <div class="rounded-xl border border-emerald-200 bg-emerald-50 p-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div>
                    <p class="font-bold text-emerald-950">Proforma #{{ lastFac.orderNumber }} lista</p>
                    <p class="text-[11px] text-emerald-800">Cuando generes la Factura en SUNAT, envíala por WhatsApp:</p>
                  </div>
                  <button
                    type="button"
                    (click)="openWhatsAppFactura(lastFac)"
                    class="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[11px] font-bold text-white shadow-2xs cursor-pointer"
                  >
                    <span>📲 Enviar Factura WA</span>
                  </button>
                </div>
              }
            </div>
          </div>
        </div>


      </div>
    </div>
  `,
})
export class PosPageComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly catalogService = inject(CatalogService);
  private readonly ordersService = inject(OrdersService);
  private readonly logisticsService = inject(LogisticsService);
  private readonly lookupService = inject(LookupService);
  private readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly excelExport = inject(ExcelExportService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);
  private readonly syncBus = inject(SyncBusService);
  readonly lastCounterFacturaOrder = signal<Order | null>(null);

  readonly parts = signal<Part[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly allOrders = signal<Order[]>([]);
  readonly loadingParts = signal<boolean>(false);
  readonly isSyncingCatalog = signal<boolean>(false);
  readonly lastCatalogSyncLabel = signal<string>('');

  searchQuery = '';
  readonly searchQuerySignal = signal<string>('');
  readonly selectedCategoryName = signal<string | null>(null);

  readonly posReservationSessionId = this.initOrLoadPosSessionId();
  readonly ticketItems = signal<{ part: Part; quantity: number }[]>(this.loadStoredPosTicket());
  readonly onlineHolds = signal<Record<number, number>>(this.loadOnlineHoldsMap());
  private autoSyncTimer: ReturnType<typeof setInterval> | null = null;
  private storageListener: ((e: StorageEvent) => void) | null = null;
  private syncBusSub: Subscription | null = null;
  private focusListener: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;

  readonly boletaDniThreshold = BOLETA_DNI_REQUIRED_THRESHOLD;
  invoiceType: 'BOLETA' | 'FACTURA' = 'BOLETA';
  customerDoc = '';
  customerName = 'CLIENTES VARIOS';
  customerFiscalAddress = '';
  customerPhone = '';
  paymentMethod = 'MOSTRADOR_EFECTIVO';
  formattedCashReceived: string = '';
  cashReceived: number | null = null;

  requiresBoletaDni(): boolean {
    return this.invoiceType === 'BOLETA' && this.ticketTotal() >= BOLETA_DNI_REQUIRED_THRESHOLD;
  }

  setClientesVarios(): void {
    if (this.requiresBoletaDni()) return;
    this.customerDoc = '';
    this.customerName = 'CLIENTES VARIOS';
  }

  onCustomerDocChange(raw: string): void {
    const clean =
      this.invoiceType === 'FACTURA'
        ? (raw || '').replace(/\D/g, '').slice(0, 11)
        : (raw || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    if (clean !== raw) {
      this.customerDoc = clean;
    }
  }

  onCashReceivedInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value || '';

    // Allow only digits and dot
    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    let intPart = parts[0] || '';
    let decPart = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : null;

    if (intPart.length > 1 && intPart.startsWith('0')) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }

    const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';

    if (decPart !== null) {
      this.formattedCashReceived = `${formattedInt || '0'}.${decPart}`;
    } else if (val.includes('.')) {
      this.formattedCashReceived = `${formattedInt || '0'}.`;
    } else {
      this.formattedCashReceived = formattedInt;
    }

    input.value = this.formattedCashReceived;

    if (!intPart && decPart === null) {
      this.cashReceived = null;
    this.formattedCashReceived = '';
    } else {
      const cleanNumber = `${intPart || '0'}.${decPart !== null ? decPart : '0'}`;
      const parsed = parseFloat(cleanNumber);
      this.cashReceived = isNaN(parsed) ? null : parsed;
    }
  }

  readonly lookingUpDoc = signal<boolean>(false);
  readonly submitting = signal<boolean>(false);

  private normalizeSearchText(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  onSearchInput(val: string): void {
    this.searchQuery = val ?? '';
    this.searchQuerySignal.set(this.searchQuery);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.searchQuerySignal.set('');
  }

  filteredParts(): Part[] {
    const rawQuery = this.searchQuerySignal() || this.searchQuery || '';
    const q = this.normalizeSearchText(rawQuery);
    const tokens = q ? q.split(/\s+/).filter(Boolean) : [];
    const cat = this.selectedCategoryName();

    return this.parts().filter((p) => {
      if (cat && p.categoryName !== cat) return false;
      if (tokens.length === 0) return true;
      const haystack = this.normalizeSearchText(
        `${p.name} ${p.sku || ''} ${p.oemCode || ''} ${p.manufacturerBrand || ''} ${p.categoryName || ''}`
      );
      return tokens.every((t) => haystack.includes(t));
    });
  }

  readonly totalTicketUnits = computed<number>(() =>
    this.ticketItems().reduce((acc, i) => acc + i.quantity, 0)
  );

  readonly ticketTotal = computed<number>(() =>
    Number(
      this.ticketItems()
        .reduce((acc, i) => acc + this.getEffectiveUnitPrice(i) * i.quantity, 0)
        .toFixed(2)
    )
  );

  // Prices include 18% IGV: Op. Gravada = Total / 1.18, IGV = Total - Op. Gravada
  readonly ticketSubtotal = computed<number>(() =>
    Number((this.ticketTotal() / 1.18).toFixed(2))
  );
  readonly ticketIgv = computed<number>(() =>
    Number((this.ticketTotal() - this.ticketSubtotal()).toFixed(2))
  );

  readonly counterOrders = computed<Order[]>(() =>
    this.allOrders().filter((o) => this.isCounterOrder(o))
  );

  readonly totalCounterRevenue = computed<number>(() =>
    this.counterOrders().reduce((acc, o) => acc + (o.totalAmount ?? o.total ?? o.subtotal ?? 0), 0)
  );

  ngOnInit(): void {
    this.hydrateCachedCatalogForPos();
    this.onlineHolds.set(this.loadOnlineHoldsMap());
    this.refreshPosData();
    this.syncPosTicketReservations();

    this.catalogService
      .getCategories()
      .pipe(retry({ count: 3, delay: 2000 }))
      .subscribe({
        next: (cats) => this.categories.set(cats),
        error: () => {},
      });
    this.logisticsService
      .getBranches()
      .pipe(retry({ count: 3, delay: 2000 }))
      .subscribe({
        next: (brs) => this.branches.set(brs),
        error: () => {},
      });

    if (typeof window !== 'undefined') {
      this.syncBusSub = this.syncBus.events$.subscribe((evt) => {
        if (
          evt.type === 'ONLINE_ORDER_COMPLETED' ||
          evt.type === 'ADMIN_STOCK_MUTATED' ||
          evt.type === 'CATALOG_REFRESH_REQUESTED'
        ) {
          this.onlineHolds.set(this.loadOnlineHoldsMap());
          this.silentRefreshParts();
        } else if (evt.type === 'RESERVATIONS_UPDATED') {
          this.onlineHolds.set(this.loadOnlineHoldsMap());
          this.reconcileTicketWithAvailableStock();
        }
      });

      this.focusListener = () => {
        this.onlineHolds.set(this.loadOnlineHoldsMap());
        this.reconcileTicketWithAvailableStock();
        this.silentRefreshParts();
        this.silentRefreshOrders();
      };
      window.addEventListener('focus', this.focusListener);

      this.visibilityListener = () => {
        if (document.visibilityState === 'visible') {
          this.onlineHolds.set(this.loadOnlineHoldsMap());
          this.reconcileTicketWithAvailableStock();
          this.silentRefreshParts();
          this.silentRefreshOrders();
        }
      };
      document.addEventListener('visibilitychange', this.visibilityListener);

      this.storageListener = (event: StorageEvent) => {
        if (event.key === ONLINE_ACTIVE_HOLDS_KEY || event.key === 'asuncion_cart_v1' || event.key === 'asuncion_sync_pulse') {
          this.onlineHolds.set(this.loadOnlineHoldsMap());
          this.reconcileTicketWithAvailableStock();
        }
      };
      window.addEventListener('storage', this.storageListener);

      this.autoSyncTimer = setInterval(() => {
        this.onlineHolds.set(this.loadOnlineHoldsMap());
        this.reconcileTicketWithAvailableStock();
        if (typeof document === 'undefined' || !document.hidden) {
          this.silentRefreshParts();
          this.silentRefreshOrders();
        }
      }, 15000);
    }
  }

  ngOnDestroy(): void {
    if (this.autoSyncTimer) {
      clearInterval(this.autoSyncTimer);
      this.autoSyncTimer = null;
    }
    if (this.syncBusSub) {
      this.syncBusSub.unsubscribe();
      this.syncBusSub = null;
    }
    if (typeof window !== 'undefined') {
      if (this.storageListener) {
        window.removeEventListener('storage', this.storageListener);
        this.storageListener = null;
      }
      if (this.focusListener) {
        window.removeEventListener('focus', this.focusListener);
        this.focusListener = null;
      }
      if (this.visibilityListener) {
        document.removeEventListener('visibilitychange', this.visibilityListener);
        this.visibilityListener = null;
      }
      // Release POS active holds so they don't block online catalog
      try {
        localStorage.removeItem(POS_ACTIVE_HOLDS_KEY);
      } catch {
        // ignore
      }
      this.syncBus.notifyReservationsUpdated([]);
      this.syncBus.notifyCatalogRefresh();
    }
  }

  private isRefreshingParts = false;
  private isRefreshingOrders = false;

  manualSilentCatalogSync(): void {
    this.onlineHolds.set(this.loadOnlineHoldsMap());
    this.silentRefreshParts(true);
    this.silentRefreshOrders();
  }

  private markCatalogSyncedNow(): void {
    const now = new Date();
    const label = now.toLocaleTimeString('es-PE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    this.lastCatalogSyncLabel.set(label);
  }

  private silentRefreshParts(showToastOnDone = false): void {
    if (this.isRefreshingParts) return;
    this.isRefreshingParts = true;
    this.isSyncingCatalog.set(true);
    this.catalogService.getAdminParts(false).subscribe({
      next: (list) => {
        this.isRefreshingParts = false;
        this.isSyncingCatalog.set(false);
        this.parts.set(list);
        this.reconcileTicketWithAvailableStock();
        this.markCatalogSyncedNow();
        if (showToastOnDone) {
          this.toast.success('Catálogo actualizado', `${list.length} repuestos sincronizados con stock real.`);
        }
      },
      error: () => {
        this.isRefreshingParts = false;
        this.isSyncingCatalog.set(false);
        if (showToastOnDone) {
          this.toast.warning('Sincronización pendiente', 'No se pudo consultar el servidor en este momento.');
        }
      },
    });
  }

  private silentRefreshOrders(): void {
    if (this.isRefreshingOrders) return;
    this.isRefreshingOrders = true;
    this.ordersService.getAllOrders().subscribe({
      next: (ords) => {
        this.isRefreshingOrders = false;
        this.allOrders.set(ords);
      },
      error: () => {
        this.isRefreshingOrders = false;
      },
    });
  }

  private hydrateCachedCatalogForPos(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('asuncion_catalog_snapshot_v7');
      if (!raw) return;
      const parsed = JSON.parse(raw) as { categories?: Category[]; parts?: Part[] };
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        this.categories.set(parsed.categories);
      }
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        this.parts.set(parsed.parts);
        this.loadingParts.set(false);
      }
    } catch {
      // Ignore cache error
    }
  }

  refreshPosData(): void {
    if (this.parts().length === 0) {
      this.loadingParts.set(true);
    }
    this.onlineHolds.set(this.loadOnlineHoldsMap());
    this.catalogService
      .getAdminParts(false)
      .pipe(
        retry({ count: 3, delay: 2500 }),
        finalize(() => this.loadingParts.set(false))
      )
      .subscribe({
        next: (list) => {
          this.parts.set(list);
          this.reconcileTicketWithAvailableStock();
          this.markCatalogSyncedNow();
        },
        error: () => {},
      });

    this.ordersService
      .getAllOrders()
      .pipe(retry({ count: 3, delay: 2500 }))
      .subscribe({
        next: (ords) => this.allOrders.set(ords),
        error: () => {},
      });
  }

  getTicketQtyForPart(partId: number): number {
    const found = this.ticketItems().find((i) => i.part.id === partId);
    return found ? found.quantity : 0;
  }

  getOnlineReservedForPart(part: Part): number {
    const posQty = this.getTicketQtyForPart(part.id);
    const backendTotalReserved = Math.max(0, part.reservedQuantity ?? 0);
    const backendOnlineReserved = Math.max(0, backendTotalReserved - posQty);
    const localOnlineQty = Math.max(0, this.onlineHolds()[part.id] ?? 0);
    return Math.max(backendOnlineReserved, localOnlineQty);
  }

  getMaxSellableInPos(part: Part): number {
    return Math.max(0, part.stockQuantity ?? 0);
  }

  getRemainingPosStock(part: Part): number {
    return Math.max(0, this.getMaxSellableInPos(part) - this.getTicketQtyForPart(part.id));
  }

  private reconcileTicketWithAvailableStock(): void {
    const currentTicket = this.ticketItems();
    if (currentTicket.length === 0) return;

    const partsMap = new Map(this.parts().map((p) => [p.id, p]));
    let modified = false;
    const nextTicket: { part: Part; quantity: number }[] = [];

    for (const item of currentTicket) {
      const latestPart = partsMap.get(item.part.id) ?? item.part;
      const maxAllowed = this.getMaxSellableInPos(latestPart);
      if (maxAllowed <= 0) {
        modified = true;
        this.toast.warning(
          'Sin existencias físicas',
          `«${latestPart.name}» se encuentra agotado físicamente en almacén y se retiró del ticket.`
        );
      } else if (item.quantity > maxAllowed) {
        modified = true;
        nextTicket.push({ part: latestPart, quantity: maxAllowed });
        this.toast.warning(
          'Cantidad ajustada por stock físico',
          `«${latestPart.name}» se ajustó a ${maxAllowed} und. disponibles en almacén.`
        );
      } else {
        nextTicket.push({ part: latestPart, quantity: item.quantity });
      }
    }

    if (modified) {
      this.ticketItems.set(nextTicket);
      this.syncPosTicketReservations();
    }
  }

  private syncPosTicketReservations(): void {
    const items = this.ticketItems();
    this.saveStoredPosTicket(items);
    this.savePosActiveHolds(items);

    const payload = items.map((i) => ({ partId: i.part.id, quantity: i.quantity }));
    this.catalogService.syncReservations(this.posReservationSessionId, payload).subscribe({
      error: () => {},
    });
  }

  private initOrLoadPosSessionId(): string {
    if (typeof window === 'undefined') return 'pos-ssr-session';
    let existing = localStorage.getItem(POS_SESSION_KEY);
    if (!existing) {
      existing = 'pos-rsv-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
      localStorage.setItem(POS_SESSION_KEY, existing);
    }
    return existing;
  }

  private loadStoredPosTicket(): { part: Part; quantity: number }[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(POS_TICKET_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as { items: { part: Part; quantity: number }[]; expiresAt: number };
      if (!parsed || typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(POS_TICKET_STORAGE_KEY);
        localStorage.removeItem(POS_ACTIVE_HOLDS_KEY);
        return [];
      }
      return Array.isArray(parsed.items) ? parsed.items : [];
    } catch {
      return [];
    }
  }

  private saveStoredPosTicket(items: { part: Part; quantity: number }[]): void {
    if (typeof window === 'undefined') return;
    if (items.length === 0) {
      localStorage.removeItem(POS_TICKET_STORAGE_KEY);
      return;
    }
    localStorage.setItem(
      POS_TICKET_STORAGE_KEY,
      JSON.stringify({
        items,
        expiresAt: Date.now() + POS_HOLD_TTL_MS,
      })
    );
  }

  private savePosActiveHolds(items: { part: Part; quantity: number }[]): void {
    if (typeof window === 'undefined') return;
    if (items.length === 0) {
      localStorage.removeItem(POS_ACTIVE_HOLDS_KEY);
      this.syncBus.notifyReservationsUpdated([]);
      return;
    }
    const holds: Record<number, number> = {};
    for (const item of items) {
      holds[item.part.id] = item.quantity;
    }
    localStorage.setItem(
      POS_ACTIVE_HOLDS_KEY,
      JSON.stringify({
        holds,
        expiresAt: Date.now() + POS_HOLD_TTL_MS,
      })
    );
    this.syncBus.notifyReservationsUpdated(items.map((i) => i.part.id));
  }

  private loadOnlineHoldsMap(): Record<number, number> {
    if (typeof window === 'undefined') return {};
    const raw = localStorage.getItem(ONLINE_ACTIVE_HOLDS_KEY);
    if (!raw) return {};
    try {
      const parsed = JSON.parse(raw) as { holds: Record<number, number>; expiresAt: number };
      if (!parsed || typeof parsed.expiresAt !== 'number' || Date.now() > parsed.expiresAt) {
        localStorage.removeItem(ONLINE_ACTIVE_HOLDS_KEY);
        return {};
      }
      return parsed.holds || {};
    } catch {
      return {};
    }
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
    this.onlineHolds.set(this.loadOnlineHoldsMap());
    const maxAvail = this.getMaxSellableInPos(part);
    if (maxAvail <= 0) {
      this.toast.warning(
        'Sin stock disponible',
        'Este repuesto se encuentra agotado físicamente en almacén.'
      );
      return;
    }
    const list = [...this.ticketItems()];
    const idx = list.findIndex((i) => i.part.id === part.id);
    if (idx >= 0) {
      if (list[idx].quantity >= maxAvail) {
        this.toast.warning(
          'Stock máximo disponible',
          `Solo hay ${maxAvail} unidades disponibles para venta en tienda.`
        );
        return;
      }
      list[idx] = { ...list[idx], quantity: list[idx].quantity + 1 };
    } else {
      list.push({ part, quantity: 1 });
    }
    this.ticketItems.set(list);
    this.syncPosTicketReservations();
  }

  updateItemQty(partId: number, newQty: number): void {
    this.onlineHolds.set(this.loadOnlineHoldsMap());
    if (newQty <= 0) {
      this.ticketItems.set(this.ticketItems().filter((i) => i.part.id !== partId));
      this.syncPosTicketReservations();
      return;
    }
    this.ticketItems.set(
      this.ticketItems().map((i) => {
        if (i.part.id === partId) {
          const maxAvail = this.getMaxSellableInPos(i.part);
          return { ...i, quantity: Math.min(newQty, maxAvail) };
        }
        return i;
      })
    );
    this.syncPosTicketReservations();
  }

  clearTicket(): void {
    this.ticketItems.set([]);
    this.cashReceived = null;
    this.syncPosTicketReservations();
  }

  exportPosSalesToExcelForSunat(): void {
    const orders = this.counterOrders();
    if (!orders || orders.length === 0) {
      this.toast.info('Sin ventas de mostrador', 'Aún no hay comprobantes emitidos en este turno de caja.');
      return;
    }

    const count = this.excelExport.exportSunatSalesWorkbook(orders, {
      filenamePrefix: 'Ventas_Caja_POS_SUNAT',
      sheetName: 'Ventas Caja POS',
      includeOperationalColumns: true,
      isCounterSaleFn: (o) => this.isCounterOrder(o),
      formatPaymentMethodFn: (m) => this.formatPosPaymentMethod(m),
    });

    this.toast.success(
      'Excel (.xlsx) de Caja generado',
      `Se exportaron ${count} comprobantes con fórmulas automáticas de Base Imponible e I.G.V. (18%).`
    );
  }

  setInvoiceType(type: 'BOLETA' | 'FACTURA'): void {
    this.invoiceType = type;
    if (type === 'FACTURA' && isAnonymousBillingName(this.customerName)) {
      this.customerName = '';
    } else if (type === 'BOLETA' && !this.customerName.trim() && !this.requiresBoletaDni()) {
      this.customerName = 'CLIENTES VARIOS';
    }
  }

  lookupCustomerDoc(): void {
    const doc = (this.customerDoc || '').trim();
    const digits = doc.replace(/\D/g, '');
    if (this.invoiceType === 'FACTURA' && digits.length !== 11) {
      this.toast.info('RUC de 11 dígitos', 'Ingresa los 11 dígitos del RUC antes de consultar.');
      return;
    }
    if (this.invoiceType === 'BOLETA' && digits.length !== 8) {
      this.toast.info('DNI de 8 dígitos', 'Ingresa un DNI de 8 dígitos para consultar en RENIEC (o escribe el nombre manualmente).');
      return;
    }
    this.lookingUpDoc.set(true);
    this.lookupService
      .lookupDocument(digits)
      .pipe(finalize(() => this.lookingUpDoc.set(false)))
      .subscribe({
        next: (res) => {
          const name = (res.businessName || res.fullName || '').trim();
          if (this.invoiceType === 'FACTURA' && res.fiscalAddress?.trim()) {
            this.customerFiscalAddress = res.fiscalAddress.trim();
          }
          if (res.found && name) {
            this.customerName = name;
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
    const digitsOnly = cleanDoc.replace(/\D/g, '');
    const alphaNumDoc = cleanDoc.replace(/[^A-Za-z0-9]/g, '');

    if (this.invoiceType === 'BOLETA' && digitsOnly.length === 11 && cleanDoc === digitsOnly) {
      this.toast.warning(
        'Documento de 11 dígitos (RUC)',
        'Elegiste Boleta de Venta. Si deseas Proforma con Factura selecciona "Factura RUC" arriba, o ingresa un DNI/CE.'
      );
      return;
    }

    const rawName = (this.customerName || '').trim();
    if (this.invoiceType === 'FACTURA') {
      if (digitsOnly.length !== 11) {
        this.toast.warning('RUC requerido', 'Para emitir Factura Electrónica ingresa un RUC válido de 11 dígitos.');
        return;
      }
      if (!rawName || isAnonymousBillingName(rawName)) {
        this.toast.warning('Razón Social requerida', 'Ingresa la razón social exacta de la empresa.');
        return;
      }
      if (!this.customerFiscalAddress.trim()) {
        this.toast.warning('Dirección fiscal requerida', 'Ingresa la dirección fiscal de la empresa.');
        return;
      }
    } else if (this.ticketTotal() >= BOLETA_DNI_REQUIRED_THRESHOLD) {
      if (alphaNumDoc.length < 8 || /^0+$/.test(alphaNumDoc)) {
        this.toast.warning(
          'DNI / C.E. obligatorio >= S/ 700',
          'Por norma SUNAT, toda boleta desde S/ 700.00 requiere ingresar DNI (8 dígitos) o C.E./Pasaporte.'
        );
        return;
      }
      if (!rawName || isAnonymousBillingName(rawName)) {
        this.toast.warning(
          'Nombre completo obligatorio >= S/ 700',
          'Por norma SUNAT, no se puede emitir a Clientes Varios en boletas desde S/ 700.00.'
        );
        return;
      }
    }

    const finalDoc = /^0+$/.test(cleanDoc) ? '' : cleanDoc;
    const finalName =
      this.invoiceType === 'BOLETA' && isAnonymousBillingName(rawName)
        ? 'CLIENTES VARIOS'
        : rawName;

    if (this.paymentMethod === 'MOSTRADOR_EFECTIVO') {
      if (this.cashReceived === null || this.cashReceived < this.ticketTotal()) {
        this.toast.error(
          'Efectivo insuficiente',
          `El monto ingresado debe ser igual o mayor al total a cobrar (mínimo S/ ${this.ticketTotal().toFixed(2)}).`
        );
        return;
      }
    }

    this.submitting.set(true);
    this.ordersService
      .createOrder({
        deliveryType: 'MOSTRADOR',
        branchId: this.branches()[0]?.id ?? 1,
        recipientName: finalName,
        recipientPhone: (this.customerPhone || '').trim() || '999999999',
        invoiceType: this.invoiceType,
        customerTaxId: finalDoc,
        billingDocumentNumber: finalDoc,
        customerBusinessName: finalName,
        billingBusinessName: finalName,
        billingAddress:
          this.invoiceType === 'FACTURA' ? this.customerFiscalAddress.trim() : undefined,
        paymentMethod: this.paymentMethod,
        notes: 'Venta directa en Caja',
        salespersonId: this.auth.currentUser()?.id,
        reservationSessionId: this.posReservationSessionId,
        items: items.map((i) => ({ partId: i.part.id, quantity: i.quantity })),
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (createdOrder) => {
          const isFacturaDoc = createdOrder.invoiceType === 'FACTURA';
          this.lastCounterFacturaOrder.set(isFacturaDoc ? createdOrder : null);
          this.toast.success(
            isFacturaDoc ? 'Venta y Proforma Registradas' : 'Venta en Caja Registrada',
            isFacturaDoc
              ? `Proforma #${createdOrder.orderNumber} generada. Emite la Factura en SUNAT y envíala por WhatsApp.`
              : `Comprobante #${createdOrder.orderNumber} emitido y stock actualizado.`
          );
          this.syncBus.notifyPosSale(createdOrder.orderNumber, items.map((i) => i.part.id));
          this.clearTicket();
          this.customerDoc = '';
          this.customerName = 'CLIENTES VARIOS';
          this.customerFiscalAddress = '';
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

  openWhatsAppFactura(ord: Order): void {
    const url = buildWhatsAppFacturaUrl(ord);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  }

  downloadReceipt(ord: Order): void {
    this.pdfInvoiceService.generateInvoicePdf(ord, true);
  }

  formatPosPaymentMethod(method?: string): string {
    switch (method) {
      case 'MOSTRADOR_EFECTIVO':
        return 'Efectivo';
      case 'MOSTRADOR_YAPE_PLIN':
        return 'Yape / Plin';
      case 'MOSTRADOR_POS_TARJETA':
        return 'Tarjeta (POS)';
      default:
        return (method || 'Efectivo').replace(/^MOSTRADOR_/, '').replace(/_/g, ' ');
    }
  }

  resolveImg(part: Part): string {
    return this.apiConfig.resolveMediaUrl(part.primaryImageUrl, part.categoryName, part.name);
  }
}
