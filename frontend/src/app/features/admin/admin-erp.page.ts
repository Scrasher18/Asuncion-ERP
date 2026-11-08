import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, retry } from 'rxjs';
import {
  AdminUserResponse,
  Branch,
  Category,
  CategorySalesMetric,
  CreateStaffUserRequest,
  DriverStatus,
  DriverSummary,
  ExecutiveDashboardResponse,
  MailConfigUpdateRequest,
  NotificationLogItem,
  Order,
  Part,
  PartAutocompleteSuggestion,
  PartCompatibilityInput,
  PartUpsertRequest,
  SalespersonMetric,
  SalesTimelinePoint,
  UpdateStaffUserRequest,
  VehicleMake,
  VehicleModel,
  VehicleModelSuggestion,
  WeekdaySalesMetric,
} from '../../core/models/api.models';
import { AdminUsersService } from '../../core/services/admin-users.service';
import { AnalyticsService } from '../../core/services/analytics.service';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import { CatalogService } from '../../core/services/catalog.service';
import { LogisticsService } from '../../core/services/logistics.service';
import { LookupService } from '../../core/services/lookup.service';
import { NotificationCenterService } from '../../core/services/notification-center.service';
import { NotificationAdminService } from '../../core/services/notification-admin.service';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService } from '../../core/services/payment.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import { PromotionService } from '../../core/services/promotion.service';
import {
  PaymentConfigUpdateRequest,
  PaymentTransactionDto,
} from '../../core/models/payment.models';
import { ToastService } from '../../core/services/toast.service';
import { SyncBusService } from '../../core/services/sync-bus.service';
import { ComplaintsService, ComplaintRecord } from '../../core/services/complaints.service';
import { DriverRatingService, DriverRatingStats, DriverRatingItem } from '../../core/services/driver-rating.service';
import { CoverageMapComponent } from '../../shared/components/coverage-map/coverage-map.component';
import {
  PartImageUploaderComponent,
  StagedUploadBundle,
} from '../../shared/components/part-image-uploader/part-image-uploader.component';
import { SalesChartComponent } from '../../shared/components/sales-chart/sales-chart.component';

type AdminTab = 'analytics' | 'parts' | 'branches' | 'orders' | 'notifications' | 'payments' | 'users' | 'claims';

interface CompatibilityDraftRow extends PartCompatibilityInput {
  makeNameLabel?: string;
  modelNameLabel?: string;
}

@Component({
  selector: 'app-admin-erp-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    PartImageUploaderComponent,
    CoverageMapComponent,
    SalesChartComponent,
  ],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pb-24 lg:pb-14">
      <!-- Top Workspace Header -->
      <div class="border-b border-gray-200 bg-white">
        <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <!-- Live Real-Time New Order Chime Alert Banner -->
        @if (newOrderBanner(); as banner) {
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-orange-500 bg-orange-50/90 p-4 shadow-md transition animate-pulse">
            <div class="flex items-center gap-3">
              <span class="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-600 text-white font-extrabold text-xl shadow-xs">
                🔔
              </span>
              <div>
                <p class="font-extrabold text-sm text-gray-950 flex items-center gap-2">
                  <span>¡NUEVO PEDIDO RECIBIDO EN TIEMPO REAL!</span>
                  <span class="rounded-full bg-orange-600 text-white text-[10px] px-2 py-0.5 font-bold uppercase tracking-wider">Alerta Tienda</span>
                </p>
                <p class="text-xs text-gray-700 font-medium mt-0.5">
                  Pedido <strong>{{ banner.orderNumber }}</strong> por <strong>S/ {{ banner.total | number: '1.2-2' }}</strong> — Cliente: <strong>{{ banner.customerName }}</strong>.
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="switchTab('orders'); dismissNewOrderBanner()"
                class="rounded-xl bg-orange-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition cursor-pointer"
              >
                Asignar Repartidor
              </button>
              <button
                type="button"
                (click)="dismissNewOrderBanner()"
                class="rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
              >
                Cerrar alerta ✕
              </button>
            </div>
          </div>
        }
          <div class="flex flex-wrap items-start justify-between gap-4 pb-5">
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-3 py-0.5 text-xs font-bold text-orange-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-orange-500"></span>
                  {{ auth.primaryRole() === 'VENDEDOR' ? 'Consola Comercial de Ventas y Almacén' : 'Dirección & Control ERP' }}
                </span>
                <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                  Perfil: {{ formatRole(auth.primaryRole()) }}
                </span>
                <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Almacén Santa Anita Activo
                </span>
              </div>
              <h1 class="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                {{ auth.primaryRole() === 'VENDEDOR' ? 'Panel Operativo de Ventas, Inventario y Despacho' : 'Centro de Control ERP & Administración' }}
              </h1>
              <p class="text-xs sm:text-sm text-gray-500">
                {{ auth.primaryRole() === 'VENDEDOR'
                  ? 'Gestiona pedidos entrantes, emite comprobantes PDF, asigna motorizados GPS y actualiza el stock de repuestos.'
                  : 'Supervisión integral de facturación, inventario, cobertura logística PostGIS, pasarelas de pago, personal y reclamos.' }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2">
              @if (pendingDispatchOrdersCount() > 0) {
                <button
                  type="button"
                  (click)="orderStatusFilter.set('PENDING'); switchTab('orders')"
                  class="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2 text-xs font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition cursor-pointer"
                >
                  <span class="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span>{{ pendingDispatchOrdersCount() }} por despachar</span>
                </button>
              }

              <button
                type="button"
                (click)="switchTab('parts'); openCreatePartModal()"
                class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-700 shadow-2xs hover:border-orange-300 hover:text-orange-700 transition cursor-pointer"
              >
                <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Nuevo repuesto</span>
              </button>

              <button
                type="button"
                (click)="switchTab('orders')"
                class="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-orange-200 bg-orange-50/90 px-3.5 py-2 text-xs font-bold text-orange-900 shadow-2xs hover:bg-orange-100 transition cursor-pointer"
                title="Ver pedidos y ventas activas"
              >
                <span class="flex h-2 w-2 rounded-full bg-orange-600 animate-pulse"></span>
                <span>{{ notifService.unreadCount() > 0 ? notifService.unreadCount() + ' novedades en vivo' : 'Ventas y Repartos al día' }}</span>
              </button>
            </div>
          </div>

          <!-- Horizontal Modern Tabs Navigation Bar -->
          <nav class="-mb-px flex items-center gap-1.5 overflow-x-auto pb-2.5" aria-label="Secciones de administración">
            <button
              type="button"
              (click)="switchTab('analytics')"
              [class]="
                activeTab() === 'analytics'
                  ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
              "
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              <span>Resumen y ventas</span>
            </button>

            <button
              type="button"
              (click)="switchTab('parts')"
              [class]="
                activeTab() === 'parts'
                  ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
              "
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
              </svg>
              <span>Inventario de repuestos</span>
              @if (adminParts().length > 0) {
                <span class="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-bold text-gray-700">
                  {{ adminParts().length }}
                </span>
              }
            </button>

            <button
              type="button"
              (click)="switchTab('orders')"
              [class]="
                activeTab() === 'orders'
                  ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
              "
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
                <rect width="6" height="4" x="9" y="3" rx="1" />
                <path d="M9 12h6" />
                <path d="M9 16h6" />
              </svg>
              <span>Pedidos y Despacho</span>
              @if (globalOrders().length > 0) {
                <span class="rounded-full bg-orange-100 px-2 py-0.5 font-mono text-[10px] font-bold text-orange-700">
                  {{ globalOrders().length }}
                </span>
              }
            </button>

            @if (auth.hasAnyRole(['ADMIN'])) {
              <button
                type="button"
                (click)="switchTab('branches')"
                [class]="
                  activeTab() === 'branches'
                    ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                    : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
                "
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span>Zonas de reparto</span>
              </button>

              <button
                type="button"
                (click)="switchTab('notifications')"
                [class]="
                  activeTab() === 'notifications'
                    ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                    : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
                "
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
                <span>Correo y notificaciones</span>
              </button>

              <button
                type="button"
                (click)="switchTab('payments')"
                [class]="
                  activeTab() === 'payments'
                    ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                    : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
                "
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
                <span>Pasarelas y Pagos</span>
              </button>

              <button
                type="button"
                (click)="switchTab('users')"
                [class]="
                  activeTab() === 'users'
                    ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                    : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
                "
                class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span>Personal y Trabajadores</span>
              </button>
            }

            <button
              type="button"
              (click)="switchTab('claims')"
              [class]="
                activeTab() === 'claims'
                  ? 'border-orange-600 text-orange-700 font-bold bg-orange-50/80 shadow-2xs'
                  : 'border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50/80 hover:text-gray-900 font-medium'
              "
              class="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-[13px] whitespace-nowrap transition cursor-pointer"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
              <span>Reclamaciones</span>
              @if (pendingClaimsCount() > 0) {
                <span class="rounded-full bg-red-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {{ pendingClaimsCount() }}
                </span>
              }
            </button>
          </nav>
        </div>
      </div>

      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        <!-- ========================================================================= -->
        <!-- TAB 1: ANALYTICS & SALES SUMMARY                                          -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'analytics') {
          <div class="space-y-6">
            <!-- Period Filter -->
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 class="text-base font-bold text-gray-900">
                  Indicadores comerciales y rotación
                </h2>
                <p class="text-xs text-gray-500">
                  Resultados consolidados de ventas confirmadas y disponibilidad en almacén.
                </p>
              </div>
              <div class="inline-flex rounded-xl border border-gray-200 bg-white p-1 shadow-2xs">
                @for (d of [7, 30, 90]; track d) {
                  <button
                    type="button"
                    (click)="loadAnalytics(d)"
                    [class]="
                      analyticsDays() === d
                        ? 'border border-orange-200 bg-orange-50 text-orange-700 font-semibold'
                        : 'border border-transparent text-gray-600 hover:text-gray-900 font-medium'
                    "
                    class="min-h-[36px] rounded-lg px-3 py-1.5 text-xs transition"
                  >
                    Últimos {{ d }} días
                  </button>
                }
              </div>
            </div>

            @if (loadingAnalytics()) {
              <div class="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500">
                Actualizando indicadores de ventas y rotación de inventario...
              </div>
            } @else if (dashboard(); as dash) {
              <!-- KPI Cards -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div class="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs overflow-hidden hover:border-orange-200 transition">
                  <div class="absolute inset-x-0 top-0 h-1 bg-orange-600"></div>
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Ventas totales</span>
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-orange-50 text-orange-600">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                  </div>
                  <p class="mt-2.5 text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
                    S/ {{ (dash.kpis.totalRevenue ?? dash.kpis.totalSales ?? 0) | number: '1.2-2' }}
                  </p>
                  <div class="mt-2 flex items-center gap-1.5">
                    <span class="inline-flex items-center rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Últimos {{ analyticsDays() }} días
                    </span>
                  </div>
                </div>

                <div class="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs overflow-hidden hover:border-emerald-200 transition">
                  <div class="absolute inset-x-0 top-0 h-1 bg-emerald-600"></div>
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Pedidos registrados</span>
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 bg-emerald-50 text-emerald-600">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                        <path d="M3 6h18" />
                        <path d="M16 10a4 4 0 0 1-8 0" />
                      </svg>
                    </span>
                  </div>
                  <p class="mt-2.5 text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
                    {{ dash.kpis.totalOrders ?? dash.kpis.completedOrders ?? 0 }}
                  </p>
                  <div class="mt-2 flex items-center justify-between text-xs">
                    <span class="text-gray-500">
                      Entregados: <strong class="font-bold text-emerald-700 tabular-nums">{{ dash.kpis.deliveredOrders ?? dash.kpis.completedOrders ?? 0 }}</strong>
                    </span>
                  </div>
                </div>

                <div class="relative rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs overflow-hidden hover:border-amber-200 transition">
                  <div class="absolute inset-x-0 top-0 h-1 bg-amber-500"></div>
                  <div class="flex items-center justify-between">
                    <span class="text-[11px] font-bold uppercase tracking-wider text-gray-500">Ticket promedio</span>
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-100 bg-amber-50 text-amber-600">
                      <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="20" height="14" x="2" y="5" rx="2" />
                        <line x1="2" y1="10" x2="22" y2="10" />
                      </svg>
                    </span>
                  </div>
                  <p class="mt-2.5 text-2xl font-extrabold tracking-tight tabular-nums text-gray-900">
                    S/ {{ (dash.kpis.averageTicket ?? 0) | number: '1.2-2' }}
                  </p>
                  <span class="mt-2 inline-block text-xs text-gray-500">
                    Boletas y facturas comerciales
                  </span>
                </div>

                <div class="rounded-2xl border-2 border-red-200 bg-linear-to-br from-red-50/80 via-white to-white p-5 shadow-2xs relative overflow-hidden group hover:border-red-300 transition">
                  <div class="absolute inset-x-0 top-0 h-1 bg-red-600"></div>
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span class="text-xs font-bold uppercase tracking-wider text-red-700">Stock Crítico</span>
                      @if ((dash.kpis.lowStockCount ?? dash.kpis.lowStockPartsCount ?? 0) > 0) {
                        <span class="relative flex h-2.5 w-2.5">
                          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                          <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-600"></span>
                        </span>
                      }
                    </div>
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 border border-red-200 shadow-2xs">
                      <img src="/images/icons/alarma.png" alt="Alerta Stock" class="h-5 w-5 object-contain" />
                    </span>
                  </div>
                  <p class="mt-2.5 text-2xl font-black tracking-tight tabular-nums text-red-950">
                    {{ dash.kpis.lowStockCount ?? dash.kpis.lowStockPartsCount ?? 0 }} repuestos
                  </p>
                  <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      (click)="openLowStockParts()"
                      class="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-2xs transition cursor-pointer"
                    >
                      <span>Ver repuestos (1 clic)</span>
                      <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14" />
                        <path d="m12 5 7 7-7 7" />
                      </svg>
                    </button>
                    <span class="text-[11px] font-semibold text-red-700">
                      ≤ mín. seguridad
                    </span>
                  </div>
                </div>
              </div>

              <!-- 1. Interactive Time-Series Sales Chart (Día / Semana / Año) -->
              <app-sales-chart
                [hourlySales]="computedHourlySales()"
                [weekdaySales]="computedWeekdaySales()"
                [dailySales]="dash.dailySales || []"
                [weeklySales]="dash.weeklySales || []"
                [monthlySales]="dash.monthlySales || []"
              ></app-sales-chart>

              <!-- 2. Operational & Fiscal Intelligence Breakdown Cards -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <!-- Delivery Method Distribution -->
                <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-gray-900">Modalidad de entrega</h3>
                      <p class="text-xs text-gray-500">Envío con motorizado vs. Recojo en mostrador</p>
                    </div>
                    <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <img src="/images/icons/casa.png" alt="Modalidad" class="h-5 w-5 object-contain" />
                    </span>
                  </div>

                  <div class="space-y-3 pt-1">
                    @for (item of dash.deliveryMethodDistribution || []; track item.key) {
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-medium text-gray-700">{{ item.label }}</span>
                          <span class="font-bold tabular-nums text-gray-900">{{ item.percentage | number: '1.0-1' }}%</span>
                        </div>
                        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            [class]="item.key === 'DELIVERY' ? 'bg-orange-600' : 'bg-emerald-600'"
                            class="h-full rounded-full transition-all duration-500"
                            [style.width.%]="item.percentage"
                          ></div>
                        </div>
                        <div class="flex justify-between text-[11px] text-gray-500">
                          <span>{{ item.count }} pedidos</span>
                          <span class="font-semibold text-gray-800">S/ {{ item.amount | number: '1.2-2' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- Invoice & Tax Distribution -->
                <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-gray-900">Comprobantes de pago</h3>
                      <p class="text-xs text-gray-500">Boletas (personas) vs. Facturas (empresas)</p>
                    </div>
                    <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z" />
                      </svg>
                    </span>
                  </div>

                  <div class="space-y-3 pt-1">
                    @for (item of dash.invoiceTypeDistribution || []; track item.key) {
                      <div class="space-y-1">
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-medium text-gray-700">{{ item.label }}</span>
                          <span class="font-bold tabular-nums text-gray-900">{{ item.percentage | number: '1.0-1' }}%</span>
                        </div>
                        <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                          <div
                            [class]="item.key === 'FACTURA' ? 'bg-blue-600' : 'bg-orange-500'"
                            class="h-full rounded-full transition-all duration-500"
                            [style.width.%]="item.percentage"
                          ></div>
                        </div>
                        <div class="flex justify-between text-[11px] text-gray-500">
                          <span>{{ item.count }} comprobantes</span>
                          <span class="font-semibold text-gray-800">S/ {{ item.amount | number: '1.2-2' }}</span>
                        </div>
                      </div>
                    }
                  </div>
                </div>

                <!-- Peak Weekday Sales Heat/Bar Mini Chart -->
                <div class="rounded-2xl border border-gray-200 bg-white p-5 shadow-2xs space-y-3">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-gray-900">Días de mayor venta</h3>
                      <p class="text-xs text-gray-500">Distribución de demanda por día de la semana</p>
                    </div>
                    <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                      </svg>
                    </span>
                  </div>

                  <div class="flex items-end justify-between gap-1.5 h-28 pt-4">
                    @for (w of dash.weekdaySales || []; track w.dayOfWeek) {
                      <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group relative">
                        <!-- Value Tooltip -->
                        <div class="absolute -top-7 hidden group-hover:flex items-center justify-center rounded bg-gray-900 px-1.5 py-0.5 text-[9px] font-bold text-white whitespace-nowrap shadow-xs z-10">
                          S/ {{ w.totalAmount | number: '1.0-0' }} ({{ w.ordersCount }} ped.)
                        </div>
                        <div class="w-full max-w-[26px] bg-gray-100 rounded-t-md h-full flex items-end overflow-hidden">
                          <div
                            [class]="w.sharePercent >= 20 ? 'bg-orange-600' : 'bg-orange-400'"
                            class="w-full rounded-t-md transition-all duration-500 group-hover:brightness-110"
                            [style.height.%]="Math.max(12, w.sharePercent * 2.8)"
                          ></div>
                        </div>
                        <span class="text-[10px] font-medium text-gray-500">
                          {{ w.dayName.substring(0, 2) }}
                        </span>
                      </div>
                    }
                  </div>
                </div>
              </div>

              <!-- Salesperson Ranking + Sales by Category -->
              <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <!-- Dynamic Salesperson Ranking -->
                <div class="lg:col-span-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                  <div class="flex items-center justify-between">
                    <div>
                      <h3 class="text-sm font-bold text-gray-900">
                        Desempeño del equipo de ventas
                      </h3>
                      <p class="text-xs text-gray-500">
                        Ventas cerradas y avance respecto a la meta mensual asignada.
                      </p>
                    </div>
                  </div>

                  @if (dash.salespersonRanking.length === 0) {
                    <p class="text-xs text-gray-500 py-4">Sin registros de ventas en el periodo seleccionado.</p>
                  } @else {
                    <div class="space-y-3">
                      @for (sp of dash.salespersonRanking; track $index; let idx = $index) {
                        <div class="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 space-y-2.5">
                          <div class="flex flex-wrap items-center justify-between gap-2">
                            <div class="flex items-center gap-3">
                              <span
                                [class]="
                                  idx === 0
                                    ? 'border-orange-200 bg-orange-50 text-orange-700'
                                    : 'border-gray-200 bg-white text-gray-700'
                                "
                                class="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums"
                              >
                                {{ idx + 1 }}
                              </span>
                              <div>
                                <p class="text-sm font-semibold text-gray-900">
                                  {{ sp.fullName || sp.salespersonName || sp.name }}
                                </p>
                                <p class="text-xs text-gray-500">
                                  {{ sp.closedTransactions ?? sp.transactionsCount ?? sp.ordersCount ?? 0 }} pedidos cerrados
                                </p>
                              </div>
                            </div>

                            <div class="text-right">
                              <span class="block text-sm font-bold tabular-nums text-gray-900">
                                S/ {{ (sp.totalSalesVolume ?? sp.totalSales ?? sp.totalRevenue ?? 0) | number: '1.2-2' }}
                              </span>
                              <span class="block text-xs tabular-nums text-gray-500">
                                Meta: S/ {{ (sp.monthlyQuota ?? sp.salesQuota ?? sp.quotaAmount ?? 15000) | number: '1.0-0' }}
                              </span>
                            </div>
                          </div>

                          <!-- Quota Progress Bar -->
                          <div class="space-y-1">
                            <div class="flex justify-between text-xs">
                              <span class="text-gray-500">Cumplimiento de meta</span>
                              <span
                                [class]="
                                  quotaPercent(sp) >= 100
                                    ? 'text-emerald-700 font-semibold'
                                    : 'text-orange-700 font-semibold'
                                "
                                class="tabular-nums"
                              >
                                {{ quotaPercent(sp) | number: '1.0-1' }}%
                              </span>
                            </div>
                            <div class="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                              <div
                                [class]="
                                  quotaPercent(sp) >= 100
                                    ? 'bg-emerald-500'
                                    : 'bg-orange-600'
                                "
                                class="h-full rounded-full transition-all duration-500"
                                [style.width.%]="Math.min(100, quotaPercent(sp))"
                              ></div>
                            </div>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>

                <!-- Category Breakdown -->
                <div class="lg:col-span-5 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 class="text-sm font-bold text-gray-900">
                      Ventas por categoría
                    </h3>
                    <p class="text-xs text-gray-500">Participación de ingresos por línea de repuesto.</p>
                  </div>

                  @if (dash.salesByCategory.length === 0) {
                    <p class="text-xs text-gray-500">Sin ventas registradas por categoría aún.</p>
                  } @else {
                    <div class="space-y-3.5">
                      @for (cat of dash.salesByCategory; track $index) {
                        <div class="space-y-1.5">
                          <div class="flex justify-between text-xs">
                            <span class="font-medium text-gray-700">{{ cat.categoryName || cat.name }}</span>
                            <span class="font-bold tabular-nums text-gray-900">
                              S/ {{ (cat.totalAmount ?? cat.totalRevenue ?? cat.revenue ?? 0) | number: '1.2-2' }}
                            </span>
                          </div>
                          <div class="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                            <div
                              class="h-full rounded-full bg-orange-500"
                              [style.width.%]="categoryPercent(cat, dash.salesByCategory)"
                            ></div>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>

              <!-- Rendimiento y Calificación de Repartidores Motorizados -->
              <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
                <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                  <div class="flex items-center gap-3">
                    <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200 text-lg">
                      ⭐
                    </span>
                    <div>
                      <h3 class="text-sm font-bold text-gray-900">
                        Calificación y Rendimiento de Repartidores Motorizados
                      </h3>
                      <p class="text-xs text-gray-500">
                        Evaluación continua del servicio de delivery otorgada por los clientes al recibir sus pedidos.
                      </p>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
                      <span>★</span>
                      @if (getDriverRatingStats('Miguel Ángel Flores').totalReviews > 0) {
                        <span>Promedio flota: {{ getDriverRatingStats('Miguel Ángel Flores').averageRating }} / 5.0 ({{ getDriverRatingStats('Miguel Ángel Flores').totalReviews }} eval.)</span>
                      } @else {
                        <span>Flota: Sin evaluaciones de clientes aún</span>
                      }
                    </span>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <!-- Motorizado Principal Card -->
                  <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2.5">
                        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                          MF
                        </div>
                        <div>
                          <h4 class="font-bold text-gray-900 text-xs">Miguel Ángel Flores</h4>
                          <span class="text-[11px] text-gray-500">Motorizado Asunción • Placa 4582-7B</span>
                        </div>
                      </div>
                      <span class="rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
                        Activo en ruta
                      </span>
                    </div>

                    <div class="flex items-center justify-between rounded-lg bg-white p-3 border border-gray-200/80">
                      <div>
                        <span class="text-[11px] text-gray-500 block">Puntuación</span>
                        <div class="flex items-center gap-1">
                          @if (getDriverRatingStats('Miguel Ángel Flores').totalReviews > 0) {
                            <span class="text-xl font-black text-amber-600">{{ getDriverRatingStats('Miguel Ángel Flores').averageRating }}</span>
                            <span class="text-amber-400 text-xs">{{ getDriverRatingStars(getDriverRatingStats('Miguel Ángel Flores').averageRating) }}</span>
                          } @else {
                            <span class="text-xs font-bold text-gray-400">Sin calificar</span>
                            <span class="text-gray-300 text-xs">☆☆☆☆☆</span>
                          }
                        </div>
                      </div>
                      <div class="text-right">
                        <span class="text-[11px] text-gray-500 block">Entregas evaluadas</span>
                        <span class="text-xs font-bold text-gray-900">
                          {{ getDriverRatingStats('Miguel Ángel Flores').totalReviews }} {{ getDriverRatingStats('Miguel Ángel Flores').totalReviews === 1 ? 'opinión real' : 'opiniones reales' }}
                        </span>
                      </div>
                    </div>

                    <div class="space-y-1">
                      <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block">Cualidades votadas por clientes</span>
                      @if (driverRatingService.getTopTagsForDriver('Miguel Ángel Flores').length > 0) {
                        <div class="flex flex-wrap gap-1">
                          @for (tag of driverRatingService.getTopTagsForDriver('Miguel Ángel Flores').slice(0, 4); track tag) {
                            <span class="rounded-md bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium text-gray-700">
                              ✓ {{ tag }}
                            </span>
                          }
                        </div>
                      } @else {
                        <p class="text-[11px] text-gray-400 italic">Sin cualidades evaluadas todavía</p>
                      }
                    </div>

                    <button
                      type="button"
                      (click)="openDriverRatingsModal('Miguel Ángel Flores')"
                      class="w-full rounded-lg bg-white border border-gray-300 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-orange-600 transition cursor-pointer"
                    >
                      Ver detalle de opiniones
                    </button>
                  </div>

                  <!-- Feed de Reseñas Reales de Clientes -->
                  <div class="md:col-span-2 rounded-xl border border-gray-200 bg-white p-4 space-y-2.5 flex flex-col justify-between">
                    <div>
                      <div class="flex items-center justify-between pb-2 border-b border-gray-100">
                        <span class="text-xs font-bold text-gray-900">Comentarios reales de clientes sobre el motorizado</span>
                        <span class="text-[11px] text-gray-500">Actualizado en tiempo real</span>
                      </div>
                      <div class="space-y-2 pt-2 max-h-48 overflow-y-auto pr-1">
                        @if (driverRatingService.getRatingsForDriver('Miguel Ángel Flores').length === 0) {
                          <div class="py-8 px-4 text-center text-gray-400 text-xs space-y-1.5">
                            <span class="text-2xl block">💬</span>
                            <p class="font-semibold text-gray-600">Aún no hay comentarios de clientes</p>
                            <p class="text-[11px] text-gray-400 max-w-sm mx-auto">
                              Cuando un cliente confirme la recepción de su pedido en la sección de seguimiento y escriba su opinión, se mostrará aquí de manera auténtica.
                            </p>
                          </div>
                        } @else {
                          @for (rev of driverRatingService.getRatingsForDriver('Miguel Ángel Flores').slice(0, 3); track rev.id) {
                            <div class="rounded-lg bg-gray-50 p-2.5 text-xs space-y-1 border border-gray-100">
                              <div class="flex items-center justify-between">
                                <span class="font-bold text-gray-900">{{ rev.customerName }}</span>
                                <div class="flex items-center gap-1.5">
                                  <span class="text-amber-500 font-bold text-xs">{{ '★'.repeat(rev.stars) }}{{ '☆'.repeat(5 - rev.stars) }}</span>
                                  <span class="text-[10px] text-gray-400 font-mono">{{ rev.orderNumber }}</span>
                                </div>
                              </div>
                              @if (rev.comment) {
                                <p class="text-gray-600 text-[11px] italic">"{{ rev.comment }}"</p>
                              }
                              @if (rev.tags.length > 0) {
                                <div class="flex flex-wrap gap-1 pt-0.5">
                                  @for (t of rev.tags; track t) {
                                    <span class="rounded-md bg-white border border-gray-200 px-1.5 py-0.5 text-[9px] text-gray-600">
                                      {{ t }}
                                    </span>
                                  }
                                </div>
                              }
                            </div>
                          }
                        }
                      </div>
                    </div>
                    <div class="pt-2 text-right">
                      <button
                        type="button"
                        (click)="openDriverRatingsModal('Miguel Ángel Flores')"
                        class="text-xs font-semibold text-orange-600 hover:text-orange-700 inline-flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver todas las calificaciones ({{ driverRatingService.getRatingsForDriver('Miguel Ángel Flores').length }})</span>
                        <span>→</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <!-- High-Rotation vs Low-Rotation Inventory Tables -->
              <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <!-- High Rotation / Más Vendidos -->
                <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
                  <div class="border-b border-gray-200 bg-white px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-50 text-emerald-600 font-bold text-xs">
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                          </svg>
                        </span>
                        <h3 class="text-sm font-bold text-gray-900">
                          Repuestos más vendidos (Alta rotación)
                        </h3>
                      </div>
                      <p class="text-xs text-gray-500 mt-0.5">Artículos de mayor salida para reposición y stock de seguridad.</p>
                    </div>
                    <span class="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
                      Top ventas
                    </span>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-xs">
                      <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                        <tr>
                          <th class="px-4 py-2.5"># / Repuesto</th>
                          <th class="px-4 py-2.5 text-right">Vendidos</th>
                          <th class="px-4 py-2.5 text-right">Ingresos</th>
                          <th class="px-4 py-2.5 text-right">Stock</th>
                          <th class="px-3 py-2.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        @for (item of dash.highRotationParts; track item.sku; let rIdx = $index) {
                          <tr class="hover:bg-gray-50/80 transition">
                            <td class="px-4 py-3">
                              <div class="flex items-start gap-2.5">
                                <span
                                  [class]="
                                    rIdx === 0
                                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                                      : rIdx === 1
                                      ? 'bg-gray-200 text-gray-700 border-gray-300'
                                      : rIdx === 2
                                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                                      : 'bg-gray-50 text-gray-600 border-gray-200'
                                  "
                                  class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold"
                                >
                                  {{ rIdx + 1 }}
                                </span>
                                <div class="min-w-0">
                                  <p class="font-semibold text-gray-900 truncate max-w-[180px] sm:max-w-[220px]">
                                    {{ item.name || item.partName }}
                                  </p>
                                  <span class="font-mono text-[11px] text-gray-500">
                                    @if (item.oemCode) {
                                      OEM {{ item.oemCode }} ·
                                    }
                                    {{ item.sku }}
                                  </span>
                                  <!-- Demand Relative Progress Bar -->
                                  <div class="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-gray-100">
                                    <div
                                      class="h-full rounded-full bg-emerald-500"
                                      [style.width.%]="((item.unitsSold ?? item.totalUnitsSold ?? 1) / maxRotationUnits(dash.highRotationParts)) * 100"
                                    ></div>
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3 text-right font-bold tabular-nums text-emerald-700">
                              {{ item.unitsSold ?? item.totalUnitsSold ?? 0 }} un.
                            </td>
                            <td class="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                              S/ {{ (item.revenueGenerated ?? item.revenue ?? item.totalRevenue ?? 0) | number: '1.2-2' }}
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums">
                              <span
                                [class]="
                                  (item.currentStock ?? item.stockQuantity ?? 0) <= (item.minStockLevel ?? 5)
                                    ? 'text-red-700 font-bold bg-red-50 px-1.5 py-0.5 rounded border border-red-200'
                                    : 'text-gray-700 font-medium'
                                "
                              >
                                {{ item.currentStock ?? item.stockQuantity ?? 0 }}
                              </span>
                            </td>
                            <td class="px-3 py-3 text-center">
                              <button
                                type="button"
                                (click)="inspectPartInInventory(item.sku)"
                                class="rounded-lg p-1 text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition"
                                title="Ver en almacén"
                              >
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>

                <!-- Low Rotation / Menos Vendidos o Estancados -->
                <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
                  <div class="border-b border-gray-200 bg-white px-5 py-4 flex items-center justify-between gap-3">
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="flex h-6 w-6 items-center justify-center rounded-md bg-orange-50 text-orange-600 font-bold text-xs">
                          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                          </svg>
                        </span>
                        <h3 class="text-sm font-bold text-gray-900">
                          Repuestos de menor rotación (Alerta stock)
                        </h3>
                      </div>
                      <p class="text-xs text-gray-500 mt-0.5">Inventario estancado sugerido para promociones o liquidación.</p>
                    </div>
                    <span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                      Riesgo capital
                    </span>
                  </div>
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-xs">
                      <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                        <tr>
                          <th class="px-4 py-2.5">Repuesto</th>
                          <th class="px-4 py-2.5 text-right">Capital retenido</th>
                          <th class="px-4 py-2.5 text-right">Stock</th>
                          <th class="px-4 py-2.5 text-center">Diagnóstico</th>
                          <th class="px-3 py-2.5 text-center">Acción</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        @for (item of dash.lowRotationParts; track item.sku) {
                          <tr class="hover:bg-gray-50/80 transition">
                            <td class="px-4 py-3">
                              <p class="font-semibold text-gray-900 truncate max-w-[170px] sm:max-w-[210px]">
                                {{ item.name || item.partName }}
                              </p>
                              <span class="font-mono text-[11px] text-gray-500">
                                @if (item.oemCode) {
                                  OEM {{ item.oemCode }} ·
                                }
                                {{ item.sku }}
                              </span>
                            </td>
                            <td class="px-4 py-3 text-right font-bold tabular-nums text-red-700">
                              S/ {{ (item.immobilizedCapital ?? 0) | number: '1.2-2' }}
                            </td>
                            <td class="px-4 py-3 text-right tabular-nums text-gray-700 font-semibold">
                              {{ item.currentStock ?? item.stockQuantity ?? 0 }} un.
                            </td>
                            <td class="px-4 py-3 text-center">
                              @if (promotionService.hasPromotion(item.sku)) {
                                <span class="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 animate-pulse">
                                  🏷️ En Oferta Web (-{{ promotionService.getPromotion(item.sku)?.discountPercentage }}%)
                                </span>
                              } @else if (item.rotationStatus === 'SIN_MOVIMIENTO') {
                                <span class="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">
                                  Sin movimiento
                                </span>
                              } @else if (item.rotationStatus === 'ROTACION_CRITICA') {
                                <span class="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                  Rotación crítica
                                </span>
                              } @else {
                                <span class="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-semibold text-gray-700">
                                  Baja salida ({{ item.daysSinceLastSale ?? 30 }}d)
                                </span>
                              }
                            </td>
                            <td class="px-3 py-3 text-center">
                              @if (promotionService.hasPromotion(item.sku)) {
                                <button
                                  type="button"
                                  (click)="openPromotionModal(item)"
                                  class="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800 hover:bg-emerald-600 hover:text-white transition shadow-2xs cursor-pointer"
                                  title="Oferta activa: Haz clic para ver o editar la promoción"
                                >
                                  ✓ Oferta Activa
                                </button>
                              } @else {
                                <button
                                  type="button"
                                  (click)="openPromotionModal(item)"
                                  class="rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-800 hover:bg-orange-600 hover:text-white transition shadow-2xs cursor-pointer"
                                  title="Crear oferta o combo para acelerar rotación"
                                >
                                  🏷️ Crear Oferta
                                </button>
                              }
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <!-- 4. Critical Stock Repositioning Alerter (Menor Stock en Almacén) -->
              <div class="rounded-2xl border-2 border-red-200 bg-white overflow-hidden shadow-2xs">
                <div class="border-b border-red-100 bg-linear-to-r from-red-50/90 via-red-50/40 to-white px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 border border-red-200 shadow-2xs">
                      <img src="/images/icons/alarma.png" alt="Alerta Stock" class="h-5 w-5 object-contain" />
                    </span>
                    <div>
                      <div class="flex items-center gap-2">
                        <h3 class="text-sm font-black text-gray-900">
                          Repuestos con Menor Stock (Reposición Urgente en Almacén)
                        </h3>
                        <span class="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-black text-white uppercase animate-pulse">
                          Alerta Roja
                        </span>
                      </div>
                      <p class="text-xs text-gray-500 mt-0.5">
                        Piezas que han alcanzado o perforado su nivel mínimo de seguridad. Requieren emitir orden de reposición inmediata a proveedores.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    (click)="openLowStockParts()"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 hover:border-red-300 transition shadow-2xs cursor-pointer"
                  >
                    <span>Ver en inventario completo</span>
                    <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </button>
                </div>

                <div class="overflow-x-auto">
                  <table class="min-w-full divide-y divide-gray-200 text-xs">
                    <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                      <tr>
                        <th class="px-4 py-2.5">Repuesto / Marca</th>
                        <th class="px-4 py-2.5">Código SKU / OEM</th>
                        <th class="px-4 py-2.5 text-right">Precio Venta</th>
                        <th class="px-4 py-2.5 text-center">Stock Actual / Mínimo</th>
                        <th class="px-4 py-2.5 text-center">Nivel de Riesgo</th>
                        <th class="px-3 py-2.5 text-center">Acción</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (p of criticalStockParts(); track p.id) {
                        <tr class="hover:bg-red-50/30 transition">
                          <td class="px-4 py-3">
                            <div class="flex items-center gap-3">
                              <img
                                [src]="resolvePartImg(p)"
                                [alt]="p.name"
                                (error)="onAdminPartImgError($event, p)"
                                class="h-10 w-12 rounded-lg border border-gray-200 object-cover bg-gray-50 shrink-0"
                              />
                              <div class="min-w-0">
                                <p class="font-bold text-gray-900 truncate max-w-[200px] sm:max-w-[280px]">
                                  {{ p.name }}
                                </p>
                                <p class="text-[11px] text-gray-500">
                                  {{ p.manufacturerBrand || 'Original' }} · {{ p.categoryName }}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td class="px-4 py-3 font-mono">
                            <span class="block font-semibold text-gray-900">{{ p.sku }}</span>
                            @if (p.oemCode) {
                              <span class="text-[11px] text-gray-500">OEM: {{ p.oemCode }}</span>
                            }
                          </td>
                          <td class="px-4 py-3 text-right tabular-nums font-semibold text-gray-900">
                            S/ {{ p.salePrice | number: '1.2-2' }}
                          </td>
                          <td class="px-4 py-3 text-center">
                            <div class="inline-flex flex-col items-center">
                              <span
                                [class]="
                                  p.stockQuantity === 0
                                    ? 'bg-red-600 text-white font-black'
                                    : 'bg-red-100 text-red-800 font-bold border border-red-300'
                                "
                                class="rounded-full px-2.5 py-0.5 text-xs tabular-nums"
                              >
                                {{ p.stockQuantity }} un.
                              </span>
                              <span class="text-[10px] text-gray-400 mt-0.5">
                                mín. seguridad: {{ p.minStockLevel ?? 5 }} un.
                              </span>
                            </div>
                          </td>
                          <td class="px-4 py-3 text-center">
                            @if (p.stockQuantity === 0) {
                              <span class="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2.5 py-0.5 text-[11px] font-black text-red-700">
                                <span class="h-1.5 w-1.5 rounded-full bg-red-600 animate-ping"></span>
                                AGOTADO (0 UND)
                              </span>
                            } @else if (p.stockQuantity === 1) {
                              <span class="inline-flex items-center gap-1 rounded-full bg-orange-100 border border-orange-300 px-2.5 py-0.5 text-[11px] font-black text-orange-800">
                                ⚠️ ÚLTIMA UNIDAD
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                BAJO STOCK ({{ p.stockQuantity }} UND)
                              </span>
                            }
                          </td>
                          <td class="px-3 py-3 text-center">
                            <button
                              type="button"
                              (click)="openEditPartModal(p)"
                              class="inline-flex items-center gap-1 rounded-lg bg-orange-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-orange-700 transition shadow-2xs cursor-pointer"
                              title="Reponer unidades en almacén"
                            >
                              <span>Reponer</span>
                              <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      } @empty {
                        <tr>
                          <td colspan="6" class="px-4 py-8 text-center text-gray-500">
                            <div class="flex flex-col items-center justify-center">
                              <span class="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 text-lg mb-2">
                                ✓
                              </span>
                              <p class="font-bold text-gray-800 text-xs">Inventario en niveles óptimos</p>
                              <p class="text-[11px] text-gray-500 mt-0.5">
                                Todos los repuestos se encuentran por encima de su nivel mínimo de seguridad.
                              </p>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            }
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 2: SPARE PARTS INVENTORY & PHOTO GALLERY                              -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'parts') {
          <div class="space-y-5">
            <!-- Toolbar -->
            <div class="rounded-2xl border border-gray-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div class="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
                <div class="relative w-full sm:w-80">
                  <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    [(ngModel)]="partSearchTerm"
                    placeholder="Buscar por nombre, marca o código..."
                    class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white pl-10 pr-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                </div>

                <label
                  [class]="lowStockOnlyFilter ? 'border-red-300 bg-red-50 text-red-800 font-bold ring-2 ring-red-200' : 'border-gray-200 bg-gray-50 text-gray-700 font-medium hover:bg-gray-100'"
                  class="inline-flex min-h-[42px] items-center gap-2 cursor-pointer rounded-xl border px-3.5 py-2 text-xs transition"
                >
                  <input
                    type="checkbox"
                    [(ngModel)]="lowStockOnlyFilter"
                    (ngModelChange)="loadAdminParts()"
                    class="h-4 w-4 rounded border-gray-300 accent-red-600"
                  />
                  <span>🚨 Solo stock bajo / crítico</span>
                  @if (lowStockOnlyFilter) {
                    <span class="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] text-white font-black">
                      ACTIVO
                    </span>
                  }
                </label>
              </div>

              <button
                type="button"
                (click)="openManualComboCreator()"
                class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-2.5 text-sm font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition cursor-pointer"
                title="Crear un Combo Automotriz manualmente para la web"
              >
                <span>📦 Crear Combo Automotriz</span>
              </button>
              <button
                type="button"
                (click)="openCreatePartModal()"
                class="inline-flex min-h-[42px] items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-orange-700 transition cursor-pointer"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14" />
                  <path d="M12 5v14" />
                </svg>
                <span>Nuevo repuesto</span>
              </button>
            </div>

            @if (lowStockOnlyFilter) {
              <div class="rounded-xl border border-red-200 bg-red-50/80 p-3.5 flex flex-wrap items-center justify-between gap-2 text-xs animate-in fade-in duration-150">
                <div class="flex items-center gap-2.5">
                  <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 border border-red-200 p-1 shadow-2xs shrink-0">
                    <img src="/images/icons/alarma.png" alt="Alerta Stock" class="h-4 w-4 object-contain" />
                  </span>
                  <div>
                    <span class="font-bold text-red-950">
                      Filtro de Stock Crítico Activo:
                    </span>
                    <span class="text-red-800 ml-1">
                      Mostrando únicamente piezas con existencia menor o igual al mínimo de seguridad ({{ adminParts().length }} repuestos detectados).
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="lowStockOnlyFilter = false; loadAdminParts()"
                  class="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-2xs cursor-pointer"
                >
                  Quitar filtro (Ver todos)
                </button>
              </div>
            }

            <!-- Parts Table (No Shelf/Warehouse Location Column) -->
            <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-xs">
                  <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                    <tr>
                      <th class="px-4 py-3">Repuesto</th>
                      <th class="px-4 py-3">Código SKU / OEM</th>
                      <th class="px-4 py-3 text-right">Costo / Venta</th>
                      <th class="px-4 py-3 text-center">Stock</th>
                      <th class="px-4 py-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100">
                    @for (p of filteredAdminParts(); track p.id) {
                      <tr class="hover:bg-gray-50/70 transition">
                        <td class="px-4 py-3.5">
                          <div class="flex items-center gap-3">
                            <img
                              [src]="resolvePartImg(p)"
                              [alt]="p.name"
                              (error)="onAdminPartImgError($event, p)"
                              class="h-11 w-14 rounded-lg border border-gray-200 object-cover bg-gray-50 shrink-0"
                            />
                            <div>
                              <p class="font-semibold text-gray-900">{{ p.name }}</p>
                              <p class="text-[11px] text-gray-500">
                                {{ p.manufacturerBrand || 'Genérico' }} · {{ p.categoryName }} ·
                                <span class="text-orange-700 font-medium">
                                  {{ p.compatibilities?.length || 0 }} vehículos
                                </span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td class="px-4 py-3.5 font-mono">
                          <span class="block font-semibold text-gray-900">{{ p.sku }}</span>
                          @if (p.oemCode) {
                            <span class="text-[11px] text-gray-500">OEM: {{ p.oemCode }}</span>
                          } @else {
                            <span class="font-sans text-[11px] text-gray-400">Sin código OEM</span>
                          }
                        </td>
                        <td class="px-4 py-3.5 text-right tabular-nums">
                          <span class="block text-[11px] text-gray-500">
                            Compra: S/ {{ (p.purchasePrice ?? 0) | number: '1.2-2' }}
                          </span>
                          <span class="font-bold text-gray-900">
                            Venta: S/ {{ p.salePrice | number: '1.2-2' }}
                          </span>
                        </td>
                        <td class="px-4 py-3.5 text-center">
                          <div class="inline-flex flex-col items-center gap-1">
                            <span
                              [class]="
                                p.stockQuantity <= (p.minStockLevel ?? 5)
                                  ? 'border-red-200 bg-red-50 text-red-700'
                                  : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              "
                              class="inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tabular-nums"
                            >
                              {{ p.stockQuantity }} / mín. {{ p.minStockLevel ?? 5 }}
                            </span>
                            @if ((p.reservedQuantity ?? 0) > 0) {
                              <span class="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                ⏳ {{ p.reservedQuantity }} en reserva (disp: {{ p.availableStock ?? (p.stockQuantity - (p.reservedQuantity ?? 0)) }})
                              </span>
                            }
                          </div>
                        </td>
                        <td class="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                          <button
                            type="button"
                            (click)="openPromotionModal(p)"
                            [class]="
                              promotionService.hasPromotion(p.sku)
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-600 hover:text-white'
                                : 'border-orange-200 bg-orange-50/70 text-orange-700 hover:bg-orange-600 hover:text-white'
                            "
                            class="inline-flex min-h-[34px] items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-bold transition cursor-pointer"
                            title="Crear o editar Oferta o Combo Automotriz"
                          >
                            <span>{{ promotionService.hasPromotion(p.sku) ? '✓ Oferta Activa' : '🏷️ Oferta / Combo' }}</span>
                          </button>
                          <button
                            type="button"
                            (click)="openEditPartModal(p)"
                            class="inline-flex min-h-[34px] items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                          >
                            Editar
                          </button>
                          @if (auth.hasAnyRole(['ADMIN'])) {
                            <button
                              type="button"
                              (click)="deletePart(p)"
                              class="inline-flex min-h-[34px] items-center rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                            >
                              Eliminar
                            </button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 3: DELIVERY ZONES & COVERAGE RADIUS                                   -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'branches') {
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <!-- Branch Configuration Card -->
            <div class="lg:col-span-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-2xs space-y-5">
              <div class="space-y-1">
                <span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                  Logística de envíos
                </span>
                <h2 class="text-base font-bold text-gray-900">
                  Configuración de zona de reparto
                </h2>
                <p class="text-xs text-gray-500">
                  Define la dirección de la tienda, el radio máximo de cobertura en kilómetros y las tarifas de envío a domicilio.
                </p>
              </div>

              @if (branchDraft) {
                <div class="space-y-4">

                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">Dirección de la tienda</label>
                    <input
                      type="text"
                      [(ngModel)]="branchDraft.address"
                      class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1.5">Latitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        [(ngModel)]="branchDraft.latitude"
                        readonly
                        class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-base sm:text-xs text-gray-600 cursor-not-allowed focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1.5">Longitud</label>
                      <input
                        type="number"
                        step="0.0001"
                        [(ngModel)]="branchDraft.longitude"
                        readonly
                        class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 font-mono text-base sm:text-xs text-gray-600 cursor-not-allowed focus:outline-none"
                      />
                    </div>
                  </div>
                  <p class="text-[11px] text-gray-500 flex items-center gap-1.5 mt-1">
                    <svg class="w-3.5 h-3.5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                    </svg>
                    <span>Sede Central fija (Av. Sta. Ana 441, Santa Anita). Coordenadas oficiales protegidas.</span>
                  </p>

                  <!-- Coverage Radius Slider -->
                  <div class="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-2.5">
                    <div class="flex items-center justify-between gap-2">
                      <label class="text-xs font-semibold text-gray-900">
                        Radio máximo de entrega
                      </label>
                      <span class="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold tabular-nums text-orange-700">
                        {{ (branchDraft.coverageRadiusMeters / 1000) | number: '1.1-2' }} km
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="25000"
                      step="500"
                      [(ngModel)]="branchDraft.coverageRadiusMeters"
                      (ngModelChange)="onManualCoordsChange()"
                      class="w-full accent-orange-600 cursor-pointer"
                    />
                    <div class="flex justify-between text-[11px] tabular-nums text-gray-500">
                      <span>1 km</span>
                      <span>10 km</span>
                      <span>25 km</span>
                    </div>
                  </div>

                  <div class="grid grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1.5">Tarifa base (S/)</label>
                      <input
                        type="number"
                        step="0.5"
                        [(ngModel)]="branchDraft.baseDeliveryFee"
                        class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm tabular-nums text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1.5">Recargo por km (S/)</label>
                      <input
                        type="number"
                        step="0.1"
                        [(ngModel)]="branchDraft.perKmFee"
                        class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm tabular-nums text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    [disabled]="savingBranch()"
                    (click)="saveBranchCoverage()"
                    class="min-h-[44px] w-full rounded-xl bg-orange-600 py-2.5 px-4 text-sm font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition"
                  >
                    {{ savingBranch() ? 'Guardando cambios...' : 'Guardar zona de reparto' }}
                  </button>
                </div>
              }
            </div>

            <!-- Live Interactive Coverage Map Preview -->
            <div class="lg:col-span-7">
              <app-coverage-map
                [branch]="branchDraft"
                [radiusOverrideMeters]="branchDraft?.coverageRadiusMeters ?? null"
                [initialLatitude]="branchDraft?.latitude"
                [initialLongitude]="branchDraft?.longitude"
                [adminMode]="true"
                (branchLocationChanged)="onBranchLocationChanged($event)"
              />
            </div>
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 4: ORDERS OVERVIEW                                                    -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'orders') {
          <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
            <div class="border-b border-gray-200 px-5 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h2 class="text-base font-bold text-gray-900">
                  Centro de Despacho y Pedidos ({{ filteredGlobalOrders().length }} de {{ globalOrders().length }})
                </h2>
                <p class="text-xs text-gray-500">Seguimiento operativo desde la confirmación del pago hasta la entrega verificada.</p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <!-- Status filter pills -->
                <div class="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50 p-1 text-xs">
                  <button
                    type="button"
                    (click)="orderStatusFilter.set('ALL')"
                    [class]="orderStatusFilter() === 'ALL' ? 'bg-white text-gray-900 font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900 font-medium'"
                    class="rounded-lg px-2.5 py-1.5 transition cursor-pointer"
                  >
                    Todos ({{ globalOrders().length }})
                  </button>
                  <button
                    type="button"
                    (click)="orderStatusFilter.set('PENDING')"
                    [class]="orderStatusFilter() === 'PENDING' ? 'bg-orange-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900 font-medium'"
                    class="rounded-lg px-2.5 py-1.5 transition cursor-pointer"
                  >
                    Por despachar ({{ pendingDispatchOrdersCount() }})
                  </button>
                  <button
                    type="button"
                    (click)="orderStatusFilter.set('EN_RUTA')"
                    [class]="orderStatusFilter() === 'EN_RUTA' ? 'bg-amber-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900 font-medium'"
                    class="rounded-lg px-2.5 py-1.5 transition cursor-pointer"
                  >
                    En ruta
                  </button>
                  <button
                    type="button"
                    (click)="orderStatusFilter.set('ENTREGADO')"
                    [class]="orderStatusFilter() === 'ENTREGADO' ? 'bg-emerald-600 text-white font-bold shadow-2xs' : 'text-gray-600 hover:text-gray-900 font-medium'"
                    class="rounded-lg px-2.5 py-1.5 transition cursor-pointer"
                  >
                    Entregados
                  </button>
                </div>

                <!-- Search input -->
                <div class="relative">
                  <input
                    type="search"
                    [(ngModel)]="orderSearchQuery"
                    placeholder="Buscar N.° pedido, cliente o RUC..."
                    class="min-h-[38px] w-56 rounded-xl border border-gray-200 bg-gray-50/70 pl-8 pr-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 focus:border-orange-500 focus:bg-white focus:outline-none"
                  />
                  <svg class="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                </div>

                <button
                  type="button"
                  (click)="exportOrdersToExcelForSunat()"
                  class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 text-xs font-bold shadow-xs transition cursor-pointer"
                  title="Exportar Registro de Ventas en formato Excel para declaración tributaria SUNAT"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                  <span>Exportar Excel para SUNAT</span>
                </button>

                <div class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 shadow-2xs">
                  <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Sincronizado en tiempo real</span>
                </div>
              </div>
            </div>

            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 text-xs">
                <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                  <tr>
                    <th class="px-4 py-3">N.° de pedido</th>
                    <th class="px-4 py-3">Cliente / Comprobante</th>
                    <th class="px-4 py-3">Modalidad</th>
                    <th class="px-4 py-3">Estado</th>
                    <th class="px-4 py-3">Repartidor</th>
                    <th class="px-4 py-3 text-right">Total</th>
                    <th class="px-4 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  @for (ord of filteredGlobalOrders(); track ord.id) {
                    <tr class="hover:bg-gray-50/70 transition">
                      <td class="px-4 py-3.5 font-mono font-semibold text-gray-900">
                        {{ ord.orderNumber }}
                        <span class="block font-sans font-normal text-[11px] text-gray-500">
                          {{ ord.createdAt | date: 'dd/MM/yy HH:mm' }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5">
                        <p class="font-semibold text-gray-900">{{ ord.recipientName || ord.customerName }}</p>
                        <span class="text-[11px] text-gray-500">
                          {{ ord.invoiceType }} {{ ord.customerTaxId ? '· RUC ' + ord.customerTaxId : '' }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5">
                        <span class="font-medium text-gray-800">{{ formatDeliveryType(ord.deliveryType) }}</span>
                        @if (ord.distanceMeters) {
                          <span class="block text-[11px] tabular-nums text-emerald-700">
                            {{ (ord.distanceMeters / 1000) | number: '1.2-2' }} km
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3.5">
                        <span
                          [class]="statusBadgeClass(ord.status)"
                          class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                        >
                          {{ formatOrderStatus(ord.status) }}
                        </span>
                      </td>
                      <td class="px-4 py-3.5">
                        @if (ord.deliveryType === 'DELIVERY') {
                          @if (ord.assignedDriverName) {
                            <div class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <img src="/images/icons/repartidor.png" alt="" class="h-3.5 w-3.5 object-contain" />
                              <span>{{ ord.assignedDriverName }}</span>
                            </div>
                            @if (ord.status !== 'ENTREGADO' && ord.status !== 'CANCELADO') {
                              <button
                                type="button"
                                (click)="openDriverAssignmentModal(ord)"
                                class="ml-1.5 text-[10px] font-semibold text-orange-600 hover:text-orange-700 underline cursor-pointer"
                              >
                                Cambiar
                              </button>
                            }
                          } @else if (ord.status !== 'ENTREGADO' && ord.status !== 'CANCELADO') {
                            <button
                              type="button"
                              (click)="openDriverAssignmentModal(ord)"
                              class="inline-flex items-center gap-1.5 rounded-lg border border-orange-300 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 shadow-2xs hover:bg-orange-100 hover:border-orange-400 transition cursor-pointer"
                            >
                              <img src="/images/icons/repartidor.png" alt="" class="h-3.5 w-3.5 object-contain" />
                              <span>Asignar repartidor</span>
                            </button>
                          } @else {
                            <span class="text-[11px] text-gray-400">Sin asignar</span>
                          }
                        } @else {
                          <span class="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                            Recojo en tienda
                          </span>
                        }
                      </td>
                      <td class="px-4 py-3.5 text-right font-bold tabular-nums text-gray-900">
                        S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                      </td>
                      <td class="px-4 py-3.5 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          (click)="downloadOrderPdf(ord)"
                          title="Descargar Comprobante PDF"
                          class="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition cursor-pointer"
                        >
                          <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>PDF</span>
                        </button>
                        <a
                          routerLink="/track"
                          [queryParams]="{ order: ord.orderNumber }"
                          class="inline-flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-bold text-orange-700 hover:bg-orange-100 transition"
                        >
                          <span>{{ ord.status === 'ENTREGADO' ? 'Constancia' : 'Seguimiento' }}</span>
                        </a>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 5: EMAIL NOTIFICATIONS CONFIGURATION & LIVE OUTBOX                    -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'notifications') {
          @if (!auth.hasAnyRole(['ADMIN'])) {
            <div class="rounded-2xl border border-gray-200 bg-white p-10 text-center space-y-2 shadow-2xs">
              <h2 class="text-base font-bold text-gray-900">
                Configuración reservada para el perfil Administrador
              </h2>
              <p class="text-xs text-gray-500 max-w-md mx-auto">
                La configuración de credenciales de correo SMTP y el registro de notificaciones salientes solo están disponibles para cuentas con permisos de administración general.
              </p>
            </div>
          } @else {
            <div class="space-y-6">
              <!-- TOP CARD: Notificaciones Automáticas por Correo -->
              <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
                <div class="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-4">
                  <div class="space-y-1">
                    <span class="inline-flex items-center rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                      Avisos automáticos a clientes
                    </span>
                    <h2 class="text-base sm:text-lg font-bold text-gray-900">
                      Notificaciones por Correo Electrónico
                    </h2>
                    <p class="text-xs text-gray-500">
                      Tus clientes recibirán confirmaciones automáticas de registro, compras, preparación de almacén y entrega de repuestos.
                    </p>
                  </div>

                  <!-- Estado real de credenciales SMTP (protegidas por variable de entorno en Render) -->
                  <div class="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs">
                    <span class="relative flex h-2.5 w-2.5">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    <span>Envío real de correos activo (Render Env)</span>
                  </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- Correo remitente fijo por entorno de nube -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Correo de la tienda (Remitente conectado en Render)
                    </label>
                    <input
                      type="email"
                      [ngModel]="mailConfigForm.username"
                      readonly
                      class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-base sm:text-sm font-semibold text-gray-700 cursor-not-allowed focus:outline-none"
                    />
                  </div>

                  <!-- Nombre visible -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Nombre de la empresa
                    </label>
                    <input
                      type="text"
                      [(ngModel)]="mailConfigForm.fromName"
                      placeholder="Repuestos Asunción"
                      class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                  </div>

                  <!-- Correo para alertas de nuevas ventas -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Correo para recibir alertas de pedidos nuevos
                    </label>
                    <input
                      type="email"
                      [(ngModel)]="mailConfigForm.adminNotificationEmail"
                      placeholder="luisoscarperez322@gmail.com"
                      class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                  </div>

                  <!-- Enviar correo de prueba -->
                  <div>
                    <label class="block text-xs font-medium text-gray-700 mb-1.5">
                      Enviar correo de prueba a
                    </label>
                    <div class="flex gap-2">
                      <input
                        type="email"
                        [(ngModel)]="testRecipientEmail"
                        placeholder="luisoscarperez322@gmail.com"
                        class="min-h-[42px] flex-1 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                      />
                      <button
                        type="button"
                        [disabled]="sendingTestMail() || !testRecipientEmail.trim()"
                        (click)="sendTestNotification()"
                        class="min-h-[42px] shrink-0 rounded-xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50 transition cursor-pointer"
                      >
                        {{ sendingTestMail() ? 'Enviando...' : 'Enviar correo de prueba' }}
                      </button>
                    </div>
                  </div>
                </div>

                <div class="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4 flex flex-wrap items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                      <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-xs font-bold text-emerald-950">
                        Credenciales protegidas en Render ({{ mailConfigForm.username || 'luisoscarperez322@gmail.com' }})
                      </p>
                      <p class="text-[11px] text-emerald-700">
                        La clave segura del servidor (<code class="font-mono font-bold">MAIL_APP_PASSWORD</code>) está activa permanentemente en la nube. Las confirmaciones de registro, compras, despacho y reclamos llegan directo a bandeja real.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    [disabled]="savingMailConfig()"
                    (click)="saveMailConfiguration()"
                    class="min-h-[40px] rounded-xl bg-orange-600 px-5 py-2 text-xs sm:text-sm font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    {{ savingMailConfig() ? 'Guardando...' : 'Guardar cambios' }}
                  </button>
                </div>
              </div>

              <!-- BOTTOM CARD: Historial de Notificaciones Enviadas -->
              <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
                <div class="border-b border-gray-200 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 class="text-base font-bold text-gray-900">
                      Historial de notificaciones enviadas ({{ notificationLogs().length }})
                    </h3>
                    <p class="text-xs text-gray-500">
                      Registro en tiempo real de correos enviados a clientes y alertas internas de pedidos.
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="loadNotificationLogs()"
                    class="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                  >
                    <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 3v5h5" />
                      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                      <path d="M16 16h5v5" />
                    </svg>
                    <span>Actualizar</span>
                  </button>
                </div>

                @if (loadingNotificationLogs()) {
                  <div class="p-10 text-center text-xs text-gray-500">
                    Cargando historial de notificaciones...
                  </div>
                } @else if (notificationLogs().length === 0) {
                  <div class="p-10 text-center space-y-1">
                    <p class="text-sm font-semibold text-gray-900">Aún no hay notificaciones registradas</p>
                    <p class="text-xs text-gray-500">
                      Envía un correo de prueba o realiza un pedido para visualizar las notificaciones aquí.
                    </p>
                  </div>
                } @else {
                  <div class="overflow-x-auto">
                    <table class="min-w-full divide-y divide-gray-200 text-xs">
                      <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                        <tr>
                          <th class="px-4 py-3">Fecha y hora</th>
                          <th class="px-4 py-3">Evento</th>
                          <th class="px-4 py-3">Destinatario</th>
                          <th class="px-4 py-3">Asunto</th>
                          <th class="px-4 py-3">Estado</th>
                          <th class="px-4 py-3 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody class="divide-y divide-gray-100">
                        @for (mailLog of notificationLogs(); track mailLog.id) {
                          <tr class="hover:bg-gray-50/70 transition">
                            <td class="px-4 py-3.5 whitespace-nowrap font-mono text-[11px] text-gray-600">
                              {{ mailLog.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                            </td>
                            <td class="px-4 py-3.5 whitespace-nowrap">
                              <span class="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-800">
                                {{ formatNotificationEvent(mailLog.eventType) }}
                              </span>
                            </td>
                            <td class="px-4 py-3.5">
                              <span class="block font-medium text-gray-900">{{ mailLog.recipientEmail }}</span>
                              @if (mailLog.orderNumber) {
                                <span class="font-mono text-[11px] text-orange-700">
                                  Pedido {{ mailLog.orderNumber }}
                                </span>
                              }
                            </td>
                            <td class="px-4 py-3.5 max-w-xs">
                              <p class="font-medium text-gray-800 truncate" [title]="mailLog.subject">
                                {{ mailLog.subject }}
                              </p>
                            </td>
                            <td class="px-4 py-3.5">
                              <span
                                [class]="notificationStatusBadgeClass(mailLog.deliveryStatus)"
                                class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                              >
                                {{ formatNotificationStatus(mailLog.deliveryStatus) }}
                              </span>
                              @if (mailLog.errorMessage && mailLog.deliveryStatus !== 'SENT') {
                                <p class="mt-1 text-[10px] text-red-600 max-w-[240px] truncate" [title]="mailLog.errorMessage">
                                  {{ mailLog.errorMessage }}
                                </p>
                              }
                            </td>
                            <td class="px-4 py-3.5 text-right whitespace-nowrap">
                              <button
                                type="button"
                                (click)="openEmailPreview(mailLog)"
                                class="inline-flex min-h-[32px] items-center rounded-lg border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                              >
                                Ver vista previa
                              </button>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>
          }
        }

        <!-- ========================================================================= -->
        <!-- TAB 6: PASARELAS DE PAGO & GESTIÓN DE COBROS (PERÚ)                       -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'payments' && auth.hasAnyRole(['ADMIN'])) {
          <div class="space-y-6">
            <!-- Summary of Transactions & Gateways -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Transacciones procesadas</span>
                <span class="text-2xl font-extrabold text-gray-900 mt-1 block">{{ paymentTransactions().length }}</span>
                <span class="text-[11px] text-emerald-700 font-semibold">Auditoría en tiempo real</span>
              </div>
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Entorno activo</span>
                <span class="text-xl font-bold text-gray-900 mt-1 block uppercase">{{ paymentConfigForm.environment }}</span>
                <span class="text-[11px] text-gray-500">Culqi Perú / Modo Seguro</span>
              </div>
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Pasarela Oficial</span>
                <span class="text-sm font-bold text-emerald-700 mt-2 block flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span>Culqi Habilitado</span>
                </span>
                <span class="text-[11px] text-gray-500">Tarjetas Visa, MC, Diners, Amex</span>
              </div>
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Billeteras Móviles QR</span>
                <span class="text-sm font-bold text-gray-900 mt-2 block flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-purple-600"></span>
                  <span>Yape & Plin Oficiales</span>
                </span>
                <span class="text-[11px] text-gray-500">Cobro web y por repartidor</span>
              </div>
            </div>

            <!-- SECCIÓN 1: BILLETERAS DIGITALES (YAPE & PLIN CON SUBIDA DIRECTA DE CÓDIGO QR) -->
            <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4">
                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span class="inline-flex items-center rounded-full bg-purple-100 text-purple-800 px-2.5 py-0.5 text-xs font-bold">
                      Billeteras Móviles
                    </span>
                    <h3 class="text-base font-bold text-gray-900">Cobro con Yape & Plin (Número Celular y QR)</h3>
                  </div>
                  <p class="text-xs text-gray-500">
                    Sube las imágenes oficiales de tus códigos QR. Se sincronizarán automáticamente tanto en el checkout web como en el celular del motorizado para cobrar.
                  </p>
                </div>
                <button
                  type="button"
                  [disabled]="savingPaymentConfig()"
                  (click)="savePaymentConfig()"
                  class="min-h-[40px] rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {{ savingPaymentConfig() ? 'Guardando...' : 'Guardar configuración de pagos' }}
                </button>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                <!-- Yape Card -->
                <div class="rounded-xl border border-purple-200 bg-purple-50/40 p-4 sm:p-5 space-y-4">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#742284] text-white font-extrabold text-sm shadow-2xs">
                        Y
                      </div>
                      <div>
                        <span class="font-bold text-sm text-gray-900">Yape (BCP)</span>
                        <span class="block text-[11px] text-purple-700 font-medium">Cobro móvil con QR oficial</span>
                      </div>
                    </div>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        [(ngModel)]="storePaymentMethods.yapeEnabled"
                        class="peer sr-only"
                      />
                      <div class="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-purple-700 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  <div class="space-y-3 text-xs">
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Número de Celular Yape</label>
                      <input
                        type="text"
                        [(ngModel)]="storePaymentMethods.yapePhone"
                        placeholder="Ej: 922 779 157"
                        class="w-full min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm font-semibold text-gray-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Nombre del Titular Registrado</label>
                      <input
                        type="text"
                        [(ngModel)]="storePaymentMethods.yapeHolder"
                        placeholder="Repuestos Automotrices Asunción S.A.C."
                        class="w-full min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-purple-600 focus:outline-none"
                      />
                    </div>

                    <!-- Código QR Yape Preview & Uploader -->
                    <div class="rounded-xl border border-purple-200 bg-white p-3 space-y-2">
                      <span class="block font-bold text-purple-950 text-xs">Código QR Oficial de Yape</span>
                      <div class="flex items-center gap-3">
                        <img
                          [src]="storePaymentMethods.yapeQrImageUrl || '/images/qr/qr-yape-default.svg'"
                          alt="QR Yape"
                          class="h-24 w-24 object-contain rounded-lg border border-purple-200 p-1 bg-white shadow-2xs shrink-0"
                        />
                        <div class="space-y-1.5 flex-1">
                          <p class="text-[11px] text-gray-600 leading-snug">
                            Este QR se muestra al cliente en la web y al motorizado en su celular para cobrar en la entrega.
                          </p>
                          <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#742284] px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-purple-900 transition">
                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span>Subir foto de QR Yape</span>
                            <input
                              type="file"
                              accept="image/*"
                              (change)="onUploadWalletQr($event, 'YAPE')"
                              class="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Plin Card -->
                <div class="rounded-xl border border-sky-200 bg-sky-50/40 p-4 sm:p-5 space-y-4">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00D09C] text-white font-extrabold text-sm shadow-2xs">
                        P
                      </div>
                      <div>
                        <span class="font-bold text-sm text-gray-900">Plin (Interbank / BBVA / Scotiabank)</span>
                        <span class="block text-[11px] text-teal-700 font-medium">Cobro móvil con QR oficial</span>
                      </div>
                    </div>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        [(ngModel)]="storePaymentMethods.plinEnabled"
                        class="peer sr-only"
                      />
                      <div class="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-teal-600 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>

                  <div class="space-y-3 text-xs">
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Número de Celular Plin</label>
                      <input
                        type="text"
                        [(ngModel)]="storePaymentMethods.plinPhone"
                        placeholder="Ej: 922 779 157"
                        class="w-full min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 font-mono text-sm font-semibold text-gray-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Nombre del Titular Registrado</label>
                      <input
                        type="text"
                        [(ngModel)]="storePaymentMethods.plinHolder"
                        placeholder="Repuestos Automotrices Asunción S.A.C."
                        class="w-full min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 focus:border-teal-600 focus:outline-none"
                      />
                    </div>

                    <!-- Código QR Plin Preview & Uploader -->
                    <div class="rounded-xl border border-teal-200 bg-white p-3 space-y-2">
                      <span class="block font-bold text-teal-950 text-xs">Código QR Oficial de Plin</span>
                      <div class="flex items-center gap-3">
                        <img
                          [src]="storePaymentMethods.plinQrImageUrl || '/images/qr/qr-plin-default.svg'"
                          alt="QR Plin"
                          class="h-24 w-24 object-contain rounded-lg border border-teal-200 p-1 bg-white shadow-2xs shrink-0"
                        />
                        <div class="space-y-1.5 flex-1">
                          <p class="text-[11px] text-gray-600 leading-snug">
                            Este QR se muestra al cliente en la web y al motorizado en su celular para cobrar en la entrega.
                          </p>
                          <label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-teal-700 transition">
                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                            <span>Subir foto de QR Plin</span>
                            <input
                              type="file"
                              accept="image/*"
                              (change)="onUploadWalletQr($event, 'PLIN')"
                              class="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Instrucción de confirmación para el cliente (Envío de constancia)
                </label>
                <input
                  type="text"
                  [(ngModel)]="storePaymentMethods.walletInstructions"
                  placeholder="Envía la constancia o captura de tu pago al WhatsApp +51 922 779 157 indicando tu N° de Pedido."
                  class="w-full min-h-[40px] rounded-xl border border-gray-200 bg-white px-3.5 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                />
              </div>
            </div>

            <!-- SECCIÓN 2: PASARELA OFICIAL DE TARJETAS (CULQI) — SIMPLIFICADA Y SIN DETALLES TÉCNICOS -->
            <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div class="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
                <div class="space-y-0.5">
                  <span class="inline-flex items-center rounded-full bg-orange-100 text-orange-800 px-2.5 py-0.5 text-xs font-bold">
                    Tarjetas de Crédito / Débito
                  </span>
                  <h3 class="text-base font-bold text-gray-900">Pasarela Oficial Culqi</h3>
                  <p class="text-xs text-gray-500">
                    Procesamiento de pagos con tarjetas de débito y crédito Visa, Mastercard, American Express y Diners Club.
                  </p>
                </div>
                <span class="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                  ● Activo y en servicio
                </span>
              </div>

              <div class="rounded-xl border border-gray-200 bg-[#F8F9FA] p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3.5">
                  <img src="/images/logos/culqi-logo.png" alt="Culqi Checkout" class="h-8 w-auto object-contain" />
                  <div>
                    <h4 class="text-sm font-bold text-gray-900">Autopartes Asunción trabaja con Culqi</h4>
                    <p class="text-xs text-gray-600 mt-0.5">
                      Cobros seguros para tus clientes con liquidación directa a la cuenta corriente registrada de la empresa.
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <img src="/images/logos/visa.png" alt="Visa" class="h-6 w-auto object-contain" />
                  <img src="/images/logos/mastercard.svg" alt="Mastercard" class="h-6 w-auto object-contain" />
                </div>
              </div>
            </div>

            <!-- SECCIÓN 4: CONTRA ENTREGA & RECOJO EN TIENDA -->
            <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
              <div class="border-b border-gray-100 pb-3">
                <span class="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2.5 py-0.5 text-xs font-bold mb-1">
                  Logística & Despacho
                </span>
                <h3 class="text-base font-bold text-gray-900">Pago Contra Entrega & Recojo Presencial</h3>
                <p class="text-xs text-gray-500">
                  Controla las opciones de cobro físico por motorizado o entrega en mostrador de almacén.
                </p>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <!-- Efectivo Contra Entrega -->
                <div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-900">Efectivo al Recibir</span>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        [(ngModel)]="storePaymentMethods.codCashEnabled"
                        class="peer sr-only"
                      />
                      <div class="peer h-4 w-7 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-gray-500">
                    El cliente paga en billetes o monedas al motorizado al momento de la entrega en su taller o domicilio.
                  </p>
                </div>

                <!-- POS Móvil en Ruta -->
                <div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2.5">
                  <div class="flex items-center justify-between">
                    <span class="font-bold text-gray-900">POS Móvil en Ruta</span>
                    <label class="relative inline-flex cursor-pointer items-center">
                      <input
                        type="checkbox"
                        [(ngModel)]="storePaymentMethods.codPosEnabled"
                        class="peer sr-only"
                      />
                      <div class="peer h-4 w-7 rounded-full bg-gray-200 after:absolute after:top-[2px] after:left-[2px] after:h-3 after:w-3 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-emerald-600 peer-checked:after:translate-x-full"></div>
                    </label>
                  </div>
                  <p class="text-[11px] text-gray-500">
                    El motorizado porta un terminal inalámbrico (Izipay / Niubiz POS) para cobrar con tarjeta física al entregar.
                  </p>
                </div>

                <!-- Límite Máximo Contra Entrega -->
                <div class="rounded-xl border border-gray-200 bg-gray-50/50 p-4 space-y-2.5">
                  <span class="font-bold text-gray-900 block">Límite Máximo Contra Entrega</span>
                  <div>
                    <div class="flex items-center gap-1.5">
                      <span class="font-bold text-gray-700">S/</span>
                      <input
                        type="number"
                        [(ngModel)]="storePaymentMethods.codMaxAmount"
                        class="w-full rounded border border-gray-200 bg-white px-2 py-1 font-mono font-bold text-xs text-gray-900"
                      />
                    </div>
                    <span class="text-[10px] text-gray-500 mt-1 block">Por seguridad del motorizado en Lima</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- SECCIÓN 5: AUDITORÍA EN TIEMPO REAL DE TRANSACCIONES -->
            <div class="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 class="text-sm font-bold text-gray-900">Auditoría de Transacciones Registradas</h3>
                  <p class="text-xs text-gray-500">Historial en tiempo real de transacciones por tarjetas, códigos CIP y pagos confirmados.</p>
                </div>
                <button
                  type="button"
                  (click)="refreshPaymentTransactions()"
                  class="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Actualizar transacciones
                </button>
              </div>

              @if (paymentTransactions().length === 0) {
                <div class="p-8 text-center text-xs text-gray-500">
                  Aún no se han registrado transacciones de pago en el sistema.
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-gray-100">
                    <thead class="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th class="px-4 py-3">Fecha</th>
                        <th class="px-4 py-3">Pedido</th>
                        <th class="px-4 py-3">Medio de Pago</th>
                        <th class="px-4 py-3">Banco / Franquicia</th>
                        <th class="px-4 py-3">Importe</th>
                        <th class="px-4 py-3">Estado</th>
                        <th class="px-4 py-3">Cód. Autorización / CIP</th>
                        <th class="px-4 py-3">Transacción ID</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (tx of paymentTransactions(); track tx.id) {
                        <tr class="hover:bg-gray-50/70 transition">
                          <td class="px-4 py-3 font-mono text-[11px] text-gray-500 whitespace-nowrap">
                            {{ tx.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                          </td>
                          <td class="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                            {{ tx.orderNumber }}
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap">
                            <span class="rounded bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-800">
                              {{ tx.paymentMethod }}
                            </span>
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap">
                            <div class="font-semibold text-gray-900">{{ tx.cardBank || 'PagoEfectivo' }}</div>
                            <div class="text-[10px] text-gray-500">{{ tx.cardBrand }} {{ tx.cardLastFour ? '•••• ' + tx.cardLastFour : '' }}</div>
                          </td>
                          <td class="px-4 py-3 font-bold text-gray-900 whitespace-nowrap">
                            S/ {{ tx.amount | number: '1.2-2' }}
                          </td>
                          <td class="px-4 py-3 whitespace-nowrap">
                            <span
                              [class]="
                                tx.status === 'APROBADO'
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                  : 'bg-amber-50 border-amber-200 text-amber-700'
                              "
                              class="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold"
                            >
                              {{ tx.status }}
                            </span>
                          </td>
                          <td class="px-4 py-3 font-mono text-xs font-bold text-gray-800 whitespace-nowrap">
                            {{ tx.authorizationCode || tx.cipCode || '—' }}
                          </td>
                          <td class="px-4 py-3 font-mono text-[10px] text-gray-400 whitespace-nowrap">
                            {{ tx.transactionId }}
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 7: GESTIÓN DE PERSONAL Y TRABAJADORES DEL SISTEMA                      -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'users' && auth.hasAnyRole(['ADMIN'])) {
          <div class="space-y-6">
            <!-- Summary KPI Strip -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Total Trabajadores</span>
                <span class="text-2xl font-extrabold text-gray-900 mt-1 block">{{ staffUsers().length }}</span>
                <span class="text-[11px] text-emerald-700 font-semibold">Cuentas registradas</span>
              </div>
              <div class="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-blue-700">Administradores</span>
                <span class="text-2xl font-extrabold text-blue-900 mt-1 block">{{ countStaffByRole('ADMIN') }}</span>
                <span class="text-[11px] text-blue-600">Acceso total ERP</span>
              </div>
              <div class="rounded-2xl border border-orange-200 bg-orange-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-orange-700">Ventas y Almacén</span>
                <span class="text-2xl font-extrabold text-orange-900 mt-1 block">{{ countStaffByRole('VENDEDOR') }}</span>
                <span class="text-[11px] text-orange-600">Picking y facturación</span>
              </div>
              <div class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-emerald-700">Repartidores Motorizados</span>
                <span class="text-2xl font-extrabold text-emerald-900 mt-1 block">{{ countStaffByRole('MOTORIZADO') }}</span>
                <span class="text-[11px] text-emerald-600">Rutas satelitales GPS</span>
              </div>
            </div>

            <!-- Main Table & Actions Container -->
            <div class="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
              <div class="p-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 class="text-base font-bold text-gray-900">Nómina de Personal y Roles</h3>
                  <p class="text-xs text-gray-500">Administra accesos, contraseñas temporales, cargos de almacén, repartidores y directivos.</p>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <!-- Search input -->
                  <div class="relative">
                    <input
                      type="text"
                      [(ngModel)]="userSearchQuery"
                      placeholder="Buscar por nombre, correo o DNI..."
                      class="h-9 w-64 rounded-xl border border-gray-200 bg-gray-50/70 pl-8 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-orange-500/20"
                    />
                    <svg class="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>

                  <!-- Role filter pills -->
                  <div class="flex items-center rounded-xl bg-gray-100 p-1 text-xs">
                    <button
                      type="button"
                      (click)="userRoleFilter = 'TODOS'"
                      [class]="userRoleFilter === 'TODOS' ? 'bg-white font-bold text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      (click)="userRoleFilter = 'ADMIN'"
                      [class]="userRoleFilter === 'ADMIN' ? 'bg-white font-bold text-blue-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Admin
                    </button>
                    <button
                      type="button"
                      (click)="userRoleFilter = 'VENDEDOR'"
                      [class]="userRoleFilter === 'VENDEDOR' ? 'bg-white font-bold text-orange-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Ventas
                    </button>
                    <button
                      type="button"
                      (click)="userRoleFilter = 'MOTORIZADO'"
                      [class]="userRoleFilter === 'MOTORIZADO' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Repartidor
                    </button>
                  </div>

                  <!-- Add User Button -->
                  <button
                    type="button"
                    (click)="openCreateUserModal()"
                    class="h-9 inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 transition cursor-pointer"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                    <span>Nuevo Trabajador</span>
                  </button>
                </div>
              </div>

              <!-- Table -->
              @if (loadingStaffUsers()) {
                <div class="p-12 text-center text-xs text-gray-500">
                  <div class="inline-block h-6 w-6 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
                  <p class="mt-2 font-medium">Cargando nómina de personal...</p>
                </div>
              } @else if (filteredStaffUsers().length === 0) {
                <div class="p-12 text-center text-xs text-gray-500">
                  No se encontraron trabajadores con los filtros seleccionados.
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-gray-100">
                    <thead class="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th class="px-5 py-3">Personal</th>
                        <th class="px-5 py-3">Correo institucional</th>
                        <th class="px-5 py-3">Rol / Cargo</th>
                        <th class="px-5 py-3">Documento & Teléfono</th>
                        <th class="px-5 py-3">Estado</th>
                        <th class="px-5 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (u of filteredStaffUsers(); track u.id) {
                        <tr class="hover:bg-gray-50/70 transition">
                          <!-- Name and Avatar -->
                          <td class="px-5 py-3.5">
                            <div class="flex items-center gap-3">
                              <div
                                [class]="
                                  u.role === 'ADMIN'
                                    ? 'bg-blue-100 text-blue-700'
                                    : u.role === 'VENDEDOR'
                                      ? 'bg-orange-100 text-orange-700'
                                      : 'bg-emerald-100 text-emerald-700'
                                "
                                class="h-9 w-9 rounded-full font-bold flex items-center justify-center text-xs shrink-0"
                              >
                                {{ u.fullName.slice(0, 2).toUpperCase() }}
                              </div>
                              <div>
                                <div class="flex items-center gap-1.5">
                                  <span class="font-bold text-gray-900">{{ u.fullName }}</span>
                                  @if (u.employeeCode) {
                                    <span class="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono font-bold text-gray-700 border border-gray-200">
                                      {{ u.employeeCode }}
                                    </span>
                                  }
                                </div>
                                <span class="text-[11px] text-gray-400">ID: #{{ u.id }}</span>
                              </div>
                            </div>
                          </td>

                          <!-- Email -->
                          <td class="px-5 py-3.5 font-mono text-[11px] text-gray-700">
                            {{ u.email }}
                          </td>

                          <!-- Role Badge -->
                          <td class="px-5 py-3.5">
                            <span [class]="staffRoleBadgeClass(u.role)" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                              {{ formatStaffRole(u.role) }}
                            </span>
                            @if (u.role === 'MOTORIZADO' && (u.licenseNumber || u.vehiclePlate)) {
                              <div class="mt-1 text-[10px] text-gray-500 font-mono">
                                {{ u.licenseNumber ? 'Brevete: ' + u.licenseNumber : '' }}
                                {{ u.licenseNumber && u.vehiclePlate ? ' • ' : '' }}
                                {{ u.vehiclePlate ? 'Placa: ' + u.vehiclePlate : '' }}
                              </div>
                            }
                            @if (u.role === 'MOTORIZADO') {
                              <div class="mt-1.5 flex items-center gap-1.5">
                                <span class="inline-flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                  <span>⭐</span>
                                  @if (getDriverRatingStats(u.fullName).totalReviews > 0) {
                                    <span>{{ getDriverRatingStats(u.fullName).averageRating }}</span>
                                    <span class="text-amber-700 font-normal">({{ getDriverRatingStats(u.fullName).totalReviews }} op.)</span>
                                  } @else {
                                    <span class="text-gray-500 font-normal">Sin calif. (0)</span>
                                  }
                                </span>
                                <button
                                  type="button"
                                  (click)="openDriverRatingsModal(u.fullName)"
                                  class="text-[11px] font-semibold text-orange-600 hover:text-orange-800 hover:underline cursor-pointer"
                                >
                                  Ver opiniones ({{ getDriverRatingStats(u.fullName).totalReviews }})
                                </button>
                              </div>
                            }
                          </td>

                          <!-- Document & Phone -->
                          <td class="px-5 py-3.5 text-gray-600">
                            <div class="space-y-0.5">
                              <span class="block font-medium text-gray-900">{{ u.documentType || 'DNI' }}: {{ u.documentNumber || '—' }}</span>
                              <span class="block text-[11px] text-gray-500">{{ u.phone || 'Sin teléfono' }}</span>
                            </div>
                          </td>

                          <!-- Status Pill -->
                          <td class="px-5 py-3.5">
                            @if (u.active) {
                              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                <span class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                <span>Activo</span>
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-500">
                                <span class="h-1.5 w-1.5 rounded-full bg-gray-400"></span>
                                <span>Inactivo</span>
                              </span>
                            }
                          </td>

                          <!-- Actions -->
                          <td class="px-5 py-3.5 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                (click)="openEditUserModal(u)"
                                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-orange-600 transition cursor-pointer"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                (click)="toggleStaffUserStatus(u)"
                                [class]="u.active ? 'text-amber-700 hover:bg-amber-50 border-amber-200' : 'text-emerald-700 hover:bg-emerald-50 border-emerald-200'"
                                class="rounded-lg border bg-white px-2.5 py-1 text-xs font-semibold transition cursor-pointer"
                              >
                                {{ u.active ? 'Suspender' : 'Reactivar' }}
                              </button>

                              @if (u.email !== 'admin@asuncion.pe') {
                                <button
                                  type="button"
                                  (click)="deleteStaffUser(u)"
                                  class="rounded-lg border border-red-200 bg-white px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 transition cursor-pointer"
                                  title="Eliminar trabajador"
                                >
                                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              }
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }

        <!-- ========================================================================= -->
        <!-- TAB 8: LIBRO DE RECLAMACIONES VIRTUAL (INDECOPI - LEY 29571)              -->
        <!-- ========================================================================= -->
        @if (activeTab() === 'claims') {
          <div class="space-y-6">
            <!-- KPI Summary Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div class="rounded-2xl border border-gray-200 bg-white p-4 shadow-2xs">
                <span class="block text-xs font-medium text-gray-500">Total Hojas Registradas</span>
                <span class="text-2xl font-extrabold text-gray-900 mt-1 block">{{ complaintsService.complaints().length }}</span>
                <span class="text-[11px] text-gray-500">Conforme a Ley INDECOPI</span>
              </div>
              <div class="rounded-2xl border border-red-200 bg-red-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-red-700">Reclamos Pendientes</span>
                <span class="text-2xl font-extrabold text-red-900 mt-1 block">{{ pendingClaimsCount() }}</span>
                <span class="text-[11px] text-red-600">Requieren respuesta formal</span>
              </div>
              <div class="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-emerald-700">Reclamos Atendidos</span>
                <span class="text-2xl font-extrabold text-emerald-900 mt-1 block">{{ resolvedClaimsCount() }}</span>
                <span class="text-[11px] text-emerald-600">Respuesta oficial emitida</span>
              </div>
              <div class="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
                <span class="block text-xs font-medium text-blue-700">Plazo Legal de Atención</span>
                <span class="text-xl font-bold text-blue-900 mt-1 block">15 Días Hábiles</span>
                <span class="text-[11px] text-blue-600">Art. 24 D.S. 011-2011-PCM</span>
              </div>
            </div>

            <!-- Table & Filters Container -->
            <div class="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden">
              <div class="border-b border-gray-100 p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                <div class="space-y-0.5">
                  <div class="flex items-center gap-2">
                    <img src="/images/icons/libro_reclamaciones.png" alt="Libro Reclamaciones" class="h-6 w-auto object-contain" />
                    <h3 class="text-base font-bold text-gray-900">Libro de Reclamaciones Virtual Oficial</h3>
                  </div>
                  <p class="text-xs text-gray-500">
                    Control legal y atención formal a las hojas de reclamación interpuestas por los clientes.
                  </p>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                  <!-- Type Filter -->
                  <div class="flex items-center rounded-xl bg-gray-100 p-1 text-xs">
                    <button
                      type="button"
                      (click)="claimFilterType.set('TODOS')"
                      [class]="claimFilterType() === 'TODOS' ? 'bg-white font-bold text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Todos
                    </button>
                    <button
                      type="button"
                      (click)="claimFilterType.set('RECLAMO')"
                      [class]="claimFilterType() === 'RECLAMO' ? 'bg-white font-bold text-red-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Reclamos
                    </button>
                    <button
                      type="button"
                      (click)="claimFilterType.set('QUEJA')"
                      [class]="claimFilterType() === 'QUEJA' ? 'bg-white font-bold text-amber-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Quejas
                    </button>
                  </div>

                  <!-- Status Filter -->
                  <div class="flex items-center rounded-xl bg-gray-100 p-1 text-xs">
                    <button
                      type="button"
                      (click)="claimFilterStatus.set('TODOS')"
                      [class]="claimFilterStatus() === 'TODOS' ? 'bg-white font-bold text-gray-900 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Todos los estados
                    </button>
                    <button
                      type="button"
                      (click)="claimFilterStatus.set('PENDIENTE')"
                      [class]="claimFilterStatus() === 'PENDIENTE' ? 'bg-white font-bold text-red-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Pendientes
                    </button>
                    <button
                      type="button"
                      (click)="claimFilterStatus.set('ATENDIDO')"
                      [class]="claimFilterStatus() === 'ATENDIDO' ? 'bg-white font-bold text-emerald-800 shadow-2xs' : 'text-gray-500 hover:text-gray-900'"
                      class="rounded-lg px-2.5 py-1 transition cursor-pointer"
                    >
                      Atendidos
                    </button>
                  </div>

                  <button
                    type="button"
                    (click)="complaintsService.loadComplaints()"
                    class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition cursor-pointer shadow-2xs"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                    <span>Sincronizar</span>
                  </button>
                </div>
              </div>

              <!-- Complaints Table -->
              @if (filteredComplaints().length === 0) {
                <div class="p-12 text-center text-xs text-gray-500">
                  No se encontraron hojas de reclamación con los filtros aplicados.
                </div>
              } @else {
                <div class="overflow-x-auto">
                  <table class="w-full text-left text-xs divide-y divide-gray-100">
                    <thead class="bg-gray-50 text-gray-600 font-semibold">
                      <tr>
                        <th class="px-5 py-3">N° Hoja & Fecha</th>
                        <th class="px-5 py-3">Consumidor Reclamante</th>
                        <th class="px-5 py-3">Tipo</th>
                        <th class="px-5 py-3">Bien Contratado</th>
                        <th class="px-5 py-3">Estado</th>
                        <th class="px-5 py-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
                      @for (c of filteredComplaints(); track c.sheetNumber) {
                        <tr class="hover:bg-gray-50/70 transition">
                          <!-- Sheet Number & Date -->
                          <td class="px-5 py-3.5">
                            <span class="font-mono font-bold text-gray-900 block">{{ c.sheetNumber }}</span>
                            <span class="text-[11px] text-gray-400">{{ c.createdAt }}</span>
                          </td>

                          <!-- Consumer Info -->
                          <td class="px-5 py-3.5">
                            <span class="font-bold text-gray-900 block">{{ c.fullName }}</span>
                            <span class="text-[11px] text-gray-500 block">{{ c.docType }}: {{ c.docNumber }} • Cel: {{ c.phone }}</span>
                            <span class="font-mono text-[11px] text-gray-400">{{ c.email }}</span>
                          </td>

                          <!-- Claim Type Badge -->
                          <td class="px-5 py-3.5">
                            @if (c.claimType === 'RECLAMO') {
                              <span class="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                                Reclamo (Producto)
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                                Queja (Atención)
                              </span>
                            }
                          </td>

                          <!-- Good Description -->
                          <td class="px-5 py-3.5">
                            <span class="font-medium text-gray-900 block line-clamp-1 max-w-xs">{{ c.goodDescription }}</span>
                            <span class="text-[11px] text-gray-500">
                              {{ c.goodType }} {{ c.claimedAmount > 0 ? '• Monto: S/ ' + (c.claimedAmount | number: '1.2-2') : '' }}
                            </span>
                          </td>

                          <!-- Status Badge -->
                          <td class="px-5 py-3.5">
                            @if (c.status === 'ATENDIDO') {
                              <span class="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                                <span class="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                <span>Atendido</span>
                              </span>
                            } @else {
                              <span class="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-700">
                                <span class="h-1.5 w-1.5 rounded-full bg-red-600"></span>
                                <span>Pendiente</span>
                              </span>
                            }
                          </td>

                          <!-- Action Buttons -->
                          <td class="px-5 py-3.5 text-right whitespace-nowrap">
                            <div class="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                (click)="openComplaintModal(c)"
                                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 hover:text-orange-600 transition cursor-pointer"
                              >
                                Ver Hoja
                              </button>
                              <button
                                type="button"
                                (click)="complaintsService.downloadComplaintPdf(c)"
                                class="rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100 transition cursor-pointer"
                                title="Descargar comprobante oficial en PDF"
                              >
                                📄 PDF
                              </button>
                            </div>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- MODAL: DETALLE Y RESPUESTA A HOJA DE RECLAMACIÓN -->
      @if (selectedComplaint(); as claim) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div class="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <div class="flex items-center gap-2.5">
                <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-red-100 text-red-700 font-extrabold text-sm">
                  ⚖️
                </span>
                <div>
                  <h3 class="text-base font-bold text-gray-900">Hoja de Reclamación {{ claim.sheetNumber }}</h3>
                  <p class="text-xs text-gray-500">Registrada el {{ claim.createdAt }} • Tipo: {{ claim.claimType }}</p>
                </div>
              </div>
              <button
                type="button"
                (click)="closeComplaintModal()"
                class="rounded-xl border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Client Info Grid -->
            <div class="rounded-xl bg-[#F8F9FA] p-4 text-xs space-y-2 border border-gray-200">
              <p><strong>Consumidor:</strong> {{ claim.fullName }} ({{ claim.docType }} {{ claim.docNumber }})</p>
              <p><strong>Dirección:</strong> {{ claim.address }}</p>
              <p><strong>Contacto:</strong> Cel: {{ claim.phone }} | Correo: <span class="font-mono">{{ claim.email }}</span></p>
              <p><strong>Bien Contratado:</strong> {{ claim.goodDescription }} ({{ claim.goodType }} - S/ {{ claim.claimedAmount | number: '1.2-2' }})</p>
            </div>

            <!-- Detail of Facts & Request -->
            <div class="space-y-3 text-xs">
              <div class="rounded-xl border border-gray-200 p-3.5 space-y-1">
                <span class="font-bold text-gray-900 block">Detalle de los Hechos:</span>
                <p class="text-gray-700 leading-relaxed">{{ claim.claimDetail }}</p>
              </div>

              <div class="rounded-xl border border-gray-200 p-3.5 space-y-1">
                <span class="font-bold text-gray-900 block">Pedido Concreto del Consumidor:</span>
                <p class="text-gray-700 leading-relaxed">{{ claim.claimRequest }}</p>
              </div>
            </div>

            <!-- Response Form -->
            <div class="rounded-xl border-2 border-orange-200 bg-orange-50/40 p-4 space-y-2 text-xs">
              <span class="font-bold text-orange-950 block">Acción Adoptada por la Empresa (Respuesta Formal al Cliente):</span>
              @if (claim.status === 'ATENDIDO') {
                <div class="bg-white p-3 rounded-lg border border-emerald-300 text-emerald-950 space-y-1">
                  <p class="font-bold">✓ Reclamación Atendida el {{ claim.resolvedAt || 'Previamente' }}:</p>
                  <p class="text-gray-700">{{ claim.adminResponseNote }}</p>
                </div>
              } @else {
                <textarea
                  [(ngModel)]="claimResponseText"
                  rows="3"
                  placeholder="Escribe la respuesta formal y solución brindada al cliente conforme al marco legal INDECOPI..."
                  class="w-full rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                ></textarea>
                <div class="flex justify-end pt-1">
                  <button
                    type="button"
                    (click)="submitComplaintResolution()"
                    [disabled]="!claimResponseText.trim()"
                    class="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition cursor-pointer"
                  >
                    Marcar como Atendido y Emitir Respuesta
                  </button>
                </div>
              }
            </div>

            <div class="flex items-center justify-between pt-2 border-t border-gray-100">
              <button
                type="button"
                (click)="complaintsService.downloadComplaintPdf(claim)"
                class="rounded-xl border border-orange-200 bg-orange-50 px-3.5 py-2 text-xs font-bold text-orange-700 hover:bg-orange-100 transition cursor-pointer"
              >
                📄 Descargar Hoja Oficial PDF
              </button>
              <button
                type="button"
                (click)="closeComplaintModal()"
                class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- MODAL: CALIFICACIONES Y OPINIONES DEL REPARTIDOR -->
      @if (selectedDriverForRatings(); as driverName) {
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div class="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl space-y-5 animate-scaleIn max-h-[88vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-gray-100 pb-3">
              <div class="flex items-center gap-3">
                <span class="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-800 font-extrabold text-lg">
                  ⭐
                </span>
                <div>
                  <h3 class="text-base font-bold text-gray-900">Evaluación y Desempeño: {{ driverName }}</h3>
                  <p class="text-xs text-gray-500">Puntuación otorgada por clientes al recibir sus pedidos</p>
                </div>
              </div>
              <button
                type="button"
                (click)="closeDriverRatingsModal()"
                class="rounded-xl border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <!-- Score Summary Card -->
            <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                @if (getDriverRatingStats(driverName).totalReviews > 0) {
                  <span class="text-3xl font-black text-amber-900">{{ getDriverRatingStats(driverName).averageRating }}</span>
                  <div>
                    <div class="text-amber-500 text-sm font-bold">
                      {{ getDriverRatingStars(getDriverRatingStats(driverName).averageRating) }}
                    </div>
                    <span class="text-xs text-amber-800 font-medium">
                      Promedio general basado en {{ getDriverRatingStats(driverName).totalReviews }} {{ getDriverRatingStats(driverName).totalReviews === 1 ? 'entrega evaluada' : 'entregas evaluadas' }}
                    </span>
                  </div>
                } @else {
                  <span class="text-2xl font-bold text-gray-400">0.0</span>
                  <div>
                    <div class="text-gray-300 text-sm font-bold">☆☆☆☆☆</div>
                    <span class="text-xs text-gray-500 font-medium">
                      Sin entregas calificadas todavía
                    </span>
                  </div>
                }
              </div>
              @if (getDriverRatingStats(driverName).totalReviews > 0) {
                <span class="rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 px-3 py-1 text-xs font-bold">
                  {{ getDriverPerformanceLabel(getDriverRatingStats(driverName).averageRating) }}
                </span>
              } @else {
                <span class="rounded-full bg-gray-100 text-gray-600 border border-gray-300 px-3 py-1 text-xs font-semibold">
                  Sin calificaciones
                </span>
              }
            </div>

            <!-- Reviews Feed -->
            <div class="space-y-3">
              <h4 class="text-xs font-bold text-gray-900 uppercase tracking-wider">Opiniones registradas de clientes</h4>
              <div class="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                @if (driverRatingService.getRatingsForDriver(driverName).length === 0) {
                  <div class="p-8 text-center text-gray-400 text-xs space-y-2 rounded-xl bg-gray-50 border border-dashed border-gray-200">
                    <span class="text-2xl block">💬</span>
                    <p class="font-medium text-gray-600">No hay opiniones registradas para {{ driverName }}</p>
                    <p class="text-[11px] text-gray-400 max-w-md mx-auto">
                      Solo se mostrarán valoraciones cuando los clientes confirmen la entrega de sus compras y califiquen el servicio.
                    </p>
                  </div>
                } @else {
                  @for (rev of driverRatingService.getRatingsForDriver(driverName); track rev.id) {
                    <div class="rounded-xl border border-gray-200 bg-[#F8F9FA] p-3 text-xs space-y-1.5">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-gray-900">{{ rev.customerName }}</span>
                          <span class="text-amber-500 font-bold">
                            {{ '★'.repeat(rev.stars) }}{{ '☆'.repeat(5 - rev.stars) }}
                          </span>
                        </div>
                        <span class="text-[11px] text-gray-400">{{ rev.createdAt }}</span>
                      </div>
                      @if (rev.comment) {
                        <p class="text-gray-700 italic">"{{ rev.comment }}"</p>
                      }
                      @if (rev.tags.length > 0) {
                        <div class="flex flex-wrap gap-1 pt-0.5">
                          @for (t of rev.tags; track t) {
                            <span class="rounded-md bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                              {{ t }}
                            </span>
                          }
                        </div>
                      }
                    </div>
                  }
                }
              </div>
            </div>

            <div class="flex justify-end pt-2 border-t border-gray-100">
              <button
                type="button"
                (click)="closeDriverRatingsModal()"
                class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      }

      <!-- =========================================================================== -->
      <!-- MODAL: ESTRATEGIA COMERCIAL: CREAR OFERTA / PROMOCIÓN DE STOCK (CANDADO FINANCIERO) -->
      <!-- =========================================================================== -->
      @if (showPromotionModal()) {
        @if (promoPart(); as part) {
          <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
            <div class="w-full max-w-2xl rounded-3xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xl space-y-6 animate-scaleIn max-h-[92vh] overflow-y-auto">
              
              <!-- Modal Header -->
              <div class="flex items-center justify-between border-b border-gray-100 pb-4">
                <div class="flex items-center gap-3">
                  <span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 font-extrabold text-xl shadow-2xs">
                    🏷️
                  </span>
                  <div>
                    <h3 class="text-lg font-black text-gray-900">
                      Estrategia Comercial: Oferta & Rotación de Stock
                    </h3>
                    <p class="text-xs text-gray-500">
                      Impulsa la venta de inventario estancado protegiendo tu costo base y margen mínimo.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  (click)="closePromotionModal()"
                  class="rounded-xl border border-gray-200 p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <!-- Part Identity Card -->
              <div class="rounded-2xl border border-gray-200 bg-[#F8F9FA] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                  <div class="h-12 w-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                    @if (part.imageUrl) {
                      <img [src]="part.imageUrl" [alt]="part.name" class="h-full w-full object-cover" />
                    } @else {
                      <span class="text-xl">⚙️</span>
                    }
                  </div>
                  <div>
                    <h4 class="font-bold text-gray-900 text-sm leading-snug">{{ part.name }}</h4>
                    <div class="flex flex-wrap items-center gap-2 mt-0.5">
                      @if (part.oemCode) {
                        <span class="rounded bg-white border border-gray-200 px-1.5 py-0.5 text-[10px] font-mono text-gray-600">OEM {{ part.oemCode }}</span>
                      }
                      <span class="font-mono text-[10px] text-gray-500">{{ part.sku }}</span>
                      <span class="text-xs text-gray-400">•</span>
                      <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">{{ part.stockQuantity }} und. en stock</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Financial Guardrail 3-Card Strip -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div class="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
                  <span class="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Precio de Venta Normal</span>
                  <span class="text-lg font-black text-gray-900 mt-0.5 block">S/ {{ part.salePrice | number: '1.2-2' }}</span>
                  <span class="text-[10px] text-gray-400">Precio regular de lista</span>
                </div>
                <div class="rounded-xl border border-blue-200 bg-blue-50/50 p-3 shadow-2xs">
                  <span class="block text-[11px] font-semibold text-blue-700 uppercase tracking-wider">Costo Base (Piso Seguro)</span>
                  <span class="text-lg font-black text-blue-900 mt-0.5 block">S/ {{ part.purchasePrice | number: '1.2-2' }}</span>
                  <span class="text-[10px] text-blue-600">Costo de compra al importador</span>
                </div>
                <div class="rounded-xl border border-amber-200 bg-amber-50/50 p-3 shadow-2xs">
                  <span class="block text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Margen Bruto Actual</span>
                  <span class="text-lg font-black text-amber-900 mt-0.5 block">
                    {{ Math.round(((part.salePrice - part.purchasePrice) / part.salePrice) * 100) }}%
                  </span>
                  <span class="text-[10px] text-amber-700">Ganancia S/ {{ (part.salePrice - part.purchasePrice) | number: '1.2-2' }} c/u</span>
                </div>
              </div>

              <!-- Promo Type Toggle -->
              <div class="space-y-2">
                <span class="block text-xs font-bold text-gray-800">1. Selecciona la modalidad de oferta:</span>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    (click)="promoType = 'DESCUENTO_DIRECTO'"
                    [class]="promoType === 'DESCUENTO_DIRECTO' ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'"
                    class="rounded-xl border p-3.5 text-left transition cursor-pointer"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-lg">🏷️</span>
                      <span class="text-xs font-bold text-gray-900">Descuento Directo en Catálogo</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-1">
                      Muestra el precio anterior tachado y la etiqueta de oferta en la web para incentivar la compra inmediata.
                    </p>
                  </button>

                  <button
                    type="button"
                    (click)="promoType = 'COMBO_SUGERIDO'"
                    [class]="promoType === 'COMBO_SUGERIDO' ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'"
                    class="rounded-xl border p-3.5 text-left transition cursor-pointer"
                  >
                    <div class="flex items-center gap-2">
                      <span class="text-lg">📦</span>
                      <span class="text-xs font-bold text-gray-900">Combo Automotriz Sugerido</span>
                    </div>
                    <p class="text-[11px] text-gray-500 mt-1">
                      Empareja este repuesto con uno complementario (aceite, filtro, pastilla o líquido) con ahorro conjunto exclusivo en la web.
                    </p>
                  </button>
                </div>
              </div>

              <!-- Discount Configuration Section -->
              <div class="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-xs font-bold text-gray-900">2. Define el porcentaje de descuento:</span>
                  <span class="text-xs text-gray-500">
                    Descuento máximo seguro sin pérdida: <strong class="text-emerald-700">{{ promoMaxSafeDiscount }}%</strong>
                  </span>
                </div>

                <!-- Quick Preset Pills -->
                <div class="flex flex-wrap items-center gap-2">
                  @for (pct of [5, 8, 10, 12, 15, 20]; track pct) {
                    <button
                      type="button"
                      (click)="selectPresetDiscount(pct)"
                      [disabled]="pct > promoMaxSafeDiscount"
                      [class]="
                        promoDiscountPercent === pct
                          ? 'bg-orange-600 text-white font-bold border-orange-600 shadow-xs'
                          : pct > promoMaxSafeDiscount
                            ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                            : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-orange-50 hover:border-orange-300'
                      "
                      class="rounded-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer"
                    >
                      {{ pct }}% {{ pct === 10 ? '⭐ Recomendado' : '' }}
                    </button>
                  }
                </div>

                <!-- Slider and Input -->
                <div class="flex items-center gap-4 pt-1">
                  <input
                    type="range"
                    min="1"
                    [max]="Math.max(1, promoMaxSafeDiscount)"
                    [(ngModel)]="promoDiscountPercent"
                    class="h-2 w-full rounded-lg bg-gray-200 accent-orange-600 cursor-pointer"
                  />
                  <div class="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      min="1"
                      [max]="promoMaxSafeDiscount"
                      [(ngModel)]="promoDiscountPercent"
                      class="h-9 w-16 rounded-xl border border-gray-200 text-center font-bold text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                    />
                    <span class="text-xs font-bold text-gray-600">%</span>
                  </div>
                </div>

                <!-- Warning if unsafe -->
                @if (!promoIsSafe) {
                  <div class="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                    <span class="text-lg">⚠️</span>
                    <span>
                      <strong>Alerta de Seguridad Financiera:</strong> Este descuento deja el precio por debajo del costo unitario (S/ {{ part.purchasePrice | number: '1.2-2' }}). Ajusta el porcentaje a máximo {{ promoMaxSafeDiscount }}%.
                    </span>
                  </div>
                }

                <!-- Complementary Item for Combo -->
                @if (promoType === 'COMBO_SUGERIDO') {
                  <div class="space-y-2 pt-2 border-t border-gray-100">
                    <div class="flex flex-wrap items-center justify-between gap-1">
                      <span class="text-xs font-bold text-gray-900">Repuesto complementario para el combo (-15% adicional):</span>
                      <span class="text-[11px] font-semibold text-orange-700">Doble descuento al llevar ambos repuestos</span>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      @for (comp of suggestedComplements; track comp.sku) {
                        <button
                          type="button"
                          (click)="onComboComplementSelect(comp.sku)"
                          [class]="promoComboComplementSku === comp.sku ? 'border-orange-500 bg-orange-50/70 ring-1 ring-orange-500/30' : 'border-gray-200 bg-white hover:bg-gray-50'"
                          class="rounded-xl border p-2.5 text-left text-xs transition cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div class="min-w-0">
                            <span class="block text-gray-900 font-semibold truncate">{{ comp.name }}</span>
                            <span class="text-[10px] text-gray-500">{{ comp.sku }} • Regular S/ {{ comp.price | number: '1.2-2' }}</span>
                          </div>
                          <div class="text-right shrink-0">
                            <span class="block text-xs font-extrabold text-orange-600">+S/ {{ (comp.price * 0.85) | number: '1.2-2' }}</span>
                            <span class="block text-[10px] font-bold text-emerald-700">-15% combo</span>
                          </div>
                        </button>
                      }
                    </div>
                  </div>
                }

                <!-- Real-time Simulation Box -->
                <div class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
                  <span class="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                    📊 {{ promoType === 'COMBO_SUGERIDO' ? 'Simulación Financiera del Combo Completo' : 'Simulación Financiera en Tiempo Real' }}
                  </span>
                  @if (promoType === 'COMBO_SUGERIDO') {
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span class="text-gray-500 block">Precio Total Combo</span>
                        <span class="text-base font-black text-gray-900 tabular-nums">
                          S/ {{ (promoCalculatedPrice + promoComboComplementPrice * 0.85) | number: '1.2-2' }}
                        </span>
                        <span class="block text-[10px] text-gray-400 line-through tabular-nums">
                          Normal S/ {{ (part.salePrice + promoComboComplementPrice) | number: '1.2-2' }}
                        </span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Ahorro Total Cliente</span>
                        <span class="text-base font-bold text-emerald-700 tabular-nums">
                          -S/ {{ (promoClientSavings + promoComboComplementPrice * 0.15) | number: '1.2-2' }}
                        </span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Ganancia Pieza Base</span>
                        <span class="text-base font-bold text-emerald-900 tabular-nums">S/ {{ promoUnitProfit | number: '1.2-2' }}</span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Margen Conservado</span>
                        <span class="text-base font-bold text-emerald-800 tabular-nums">{{ promoProfitMargin }}%</span>
                      </div>
                    </div>
                  } @else {
                    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span class="text-gray-500 block">Precio Oferta</span>
                        <span class="text-base font-black text-gray-900 tabular-nums">S/ {{ promoCalculatedPrice | number: '1.2-2' }}</span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Ahorro Cliente</span>
                        <span class="text-base font-bold text-emerald-700 tabular-nums">-S/ {{ promoClientSavings | number: '1.2-2' }}</span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Ganancia Neta c/u</span>
                        <span class="text-base font-bold text-emerald-900 tabular-nums">S/ {{ promoUnitProfit | number: '1.2-2' }}</span>
                      </div>
                      <div>
                        <span class="text-gray-500 block">Margen Conservado</span>
                        <span class="text-base font-bold text-emerald-800 tabular-nums">{{ promoProfitMargin }}%</span>
                      </div>
                    </div>
                  }
                </div>

                <!-- Promotion Settings Strip (Quota & Badge) -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label class="block text-xs font-semibold text-gray-700 mb-1">Cupo de unidades en oferta:</label>
                    <div class="flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        [max]="part.stockQuantity"
                        [(ngModel)]="promoUnitsQuota"
                        class="h-9 w-24 rounded-xl border border-gray-200 px-3 text-xs font-bold text-gray-900 focus:border-orange-500 focus:outline-hidden"
                      />
                      <span class="text-xs text-gray-500">de {{ part.stockQuantity }} und. disponibles</span>
                    </div>
                    <span class="text-[10px] text-gray-400 mt-0.5 block">Capital total a recuperar: S/ {{ promoRecoverableCapital | number: '1.2-2' }}</span>
                  </div>

                  <div>
                    <label class="block text-xs font-semibold text-gray-700 mb-1">Etiqueta visual en el catálogo:</label>
                    <select
                      [(ngModel)]="promoBadgeLabel"
                      class="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-900 focus:border-orange-500 focus:outline-hidden"
                    >
                      <option value="OFERTA FLASH">OFERTA FLASH 🔥</option>
                      <option value="LIQUIDACIÓN DE STOCK">LIQUIDACIÓN DE STOCK 🏷️</option>
                      <option value="PRECIO TALLER">PRECIO TALLER 🔧</option>
                      <option value="PROMOCIÓN ESPECIAL">PROMOCIÓN ESPECIAL ⭐</option>
                    </select>
                  </div>
                </div>
              </div>

              <!-- Action Buttons Footer -->
              <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-gray-100">
                @if (promotionService.hasPromotion(part.sku)) {
                  <button
                    type="button"
                    (click)="removeCurrentPromotion()"
                    class="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
                  >
                    🗑️ Desactivar Oferta
                  </button>
                } @else {
                  <div></div>
                }

                <div class="flex items-center gap-2.5">
                  <button
                    type="button"
                    (click)="closePromotionModal()"
                    class="rounded-xl border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    (click)="savePromotion()"
                    [disabled]="!promoIsSafe"
                    class="rounded-xl bg-orange-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-orange-700 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ✓ Guardar y Activar Oferta en Catálogo
                  </button>
                </div>
              </div>

            </div>
          </div>
        }
      }

      <!-- =========================================================================== -->
      <!-- MODAL EDITOR: SPARE PART DETAILS, SMART AUTOCOMPLETE, VEHICLES & PHOTOS     -->
      <!-- =========================================================================== -->
      @if (showPartModal()) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs p-3 sm:p-6 flex items-start justify-center">
          <div class="my-4 w-full max-w-4xl rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
            <!-- Modal Header -->
            <div class="border-b border-gray-200 bg-white px-5 sm:px-6 py-4 flex items-center justify-between gap-4">
              <div>
                <span class="text-xs font-medium text-orange-600">
                  {{ editingPart()?.id ? 'Ficha de repuesto #' + editingPart()!.id : 'Nuevo registro de catálogo' }}
                </span>
                <h3 class="text-base sm:text-lg font-bold text-gray-900">
                  {{ editingPart()?.id ? editingPart()!.name : 'Registrar repuesto automotriz' }}
                </h3>
              </div>
              <button
                type="button"
                (click)="closePartModal()"
                aria-label="Cerrar ventana"
                class="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <!-- Modal Body -->
            <div class="p-5 sm:p-6 space-y-5 max-h-[78vh] overflow-y-auto">
              <!-- TOP SMART AUTOCOMPLETE HELPER BOX -->
              <div class="relative rounded-2xl border border-orange-200 bg-orange-50/50 p-4 space-y-2">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <label class="text-xs font-bold text-gray-900">
                    Autocompletar datos del repuesto
                  </label>
                  <span class="text-[11px] font-medium text-orange-700">
                    Completa nombre, marca, categoría y precios en 1 clic
                  </span>
                </div>

                <div class="relative">
                  <svg class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-orange-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                  <input
                    type="text"
                    [(ngModel)]="partAutocompleteQuery"
                    (ngModelChange)="onPartAutocompleteInput($event)"
                    (focus)="onPartAutocompleteFocus()"
                    (blur)="hidePartAutocompleteDelayed()"
                    placeholder="Escribe ej: foco narva h4, pastilla freno, filtro aceite, bateria..."
                    class="min-h-[44px] w-full rounded-xl border border-orange-200 bg-white pl-10 pr-9 py-2 text-base sm:text-sm text-gray-900 placeholder:text-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                  @if (loadingPartSuggestions()) {
                    <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                      <svg class="h-4 w-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                        <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                      </svg>
                    </span>
                  }
                </div>

                @if (showPartSuggestionsDropdown() && partAutocompleteResults().length > 0) {
                  <div class="absolute left-4 right-4 z-30 mt-1 max-h-64 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl divide-y divide-gray-100">
                    @for (sug of partAutocompleteResults(); track $index) {
                      <button
                        type="button"
                        (mousedown)="applyPartAutocompleteSuggestion(sug)"
                        class="w-full px-4 py-3 text-left hover:bg-orange-50/70 flex items-center justify-between gap-3 transition"
                      >
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="text-xs font-bold text-gray-900">{{ sug.name }}</span>
                            <span class="rounded border border-orange-200 bg-orange-50 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700">
                              {{ sug.manufacturerBrand }}
                            </span>
                          </div>
                          @if (sug.commonVehicles && sug.commonVehicles.length > 0) {
                            <p class="mt-0.5 truncate text-[11px] text-gray-500">
                              Aplicación común: {{ sug.commonVehicles.join(', ') }}
                            </p>
                          }
                        </div>
                        <div class="shrink-0 text-right">
                          <span class="block text-[10px] text-gray-500">Precio sugerido</span>
                          <span class="text-xs font-bold tabular-nums text-gray-900">
                            S/ {{ sug.suggestedSalePrice | number: '1.2-2' }}
                          </span>
                        </div>
                      </button>
                    }
                  </div>
                }
              </div>

              <!-- PRIMARY FIELDS: Nombre, Marca (with Autocomplete), Categoría -->
              <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div class="sm:col-span-6">
                  <label class="block text-xs font-medium text-gray-700 mb-1.5">Nombre del repuesto *</label>
                  <input
                    type="text"
                    [(ngModel)]="partForm.name"
                    (ngModelChange)="onPartNameChange($event)"
                    placeholder="Ej: Foco halógeno H4 12V 60/55W / Juego de pastillas delanteras"
                    class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                </div>

                <div class="sm:col-span-3 relative">
                  <label class="block text-xs font-medium text-gray-700 mb-1.5">Marca fabricante *</label>
                  <input
                    type="text"
                    [(ngModel)]="partForm.manufacturerBrand"
                    (ngModelChange)="onBrandInput($event)"
                    (focus)="onBrandFocus()"
                    (blur)="hideBrandDropdownDelayed()"
                    list="admin-brands-datalist"
                    placeholder="Narva / Bosch / KYB"
                    class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                  <datalist id="admin-brands-datalist">
                    @for (brand of brandSuggestions(); track brand) {
                      <option [value]="brand"></option>
                    }
                  </datalist>

                  @if (showBrandDropdown() && brandSuggestions().length > 0) {
                    <div class="absolute left-0 right-0 z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg divide-y divide-gray-100">
                      @for (brand of brandSuggestions(); track brand) {
                        <button
                          type="button"
                          (mousedown)="selectBrandSuggestion(brand)"
                          class="w-full px-3 py-2 text-left text-xs font-medium text-gray-800 hover:bg-orange-50 hover:text-orange-700 transition"
                        >
                          {{ brand }}
                        </button>
                      }
                    </div>
                  }
                </div>

                <div class="sm:col-span-3">
                  <label class="block text-xs font-medium text-gray-700 mb-1.5">Categoría *</label>
                  <select
                    [(ngModel)]="partForm.categoryId"
                    (ngModelChange)="onCategoryChange()"
                    class="min-h-[42px] w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-base sm:text-sm font-medium text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  >
                    @for (c of categories(); track c.id) {
                      <option [ngValue]="c.id">{{ c.name }}</option>
                    }
                  </select>
                </div>
              </div>

              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1.5">Descripción y especificaciones técnicas</label>
                <textarea
                  rows="2"
                  [(ngModel)]="partForm.technicalDescription"
                  placeholder="Detalles técnicos, medidas, voltaje o compuesto del repuesto..."
                  class="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-base sm:text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                ></textarea>
              </div>

              <!-- SAE Viscosity Quick-Selector for Oils & Filters (Only displayed if category/name is Oil or Filter) -->
              @if (shouldShowViscositySelector()) {
                <div class="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <span class="text-base">🛢️</span>
                      <label class="text-xs font-bold text-amber-950">
                        Grado de Viscosidad SAE (Aceites, Lubricantes y Filtros)
                      </label>
                    </div>
                    @if (selectedSaEViscosity()) {
                      <button
                        type="button"
                        (click)="clearSaEViscosity()"
                        class="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                      >
                        Quitar selección
                      </button>
                    }
                  </div>
                  <p class="text-[11px] text-amber-800">
                    Toca el código de viscosidad para añadirlo automáticamente a la ficha técnica y facilitar que los clientes lo encuentren al buscar:
                  </p>
                  <div class="flex flex-wrap gap-1.5">
                    @for (v of commonSaEViscosities; track v) {
                      <button
                        type="button"
                        (click)="toggleSaEViscosity(v)"
                        [class]="
                          selectedSaEViscosity() === v
                            ? 'border-amber-600 bg-amber-600 text-white font-bold shadow-2xs'
                            : 'border-amber-200 bg-white text-gray-800 hover:border-amber-400 hover:bg-amber-100/50 font-medium'
                        "
                        class="rounded-lg border px-2.5 py-1 text-xs transition cursor-pointer"
                      >
                        {{ v }}
                      </button>
                    }
                  </div>
                </div>
              }

              <!-- Prices & Stock (5 balanced columns, NO warehouse/shelf location!) -->
              <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div>
                  <label class="block text-[11px] font-medium text-gray-600 mb-1">P. compra (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    [(ngModel)]="partForm.purchasePrice"
                    class="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs tabular-nums text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-600 mb-1">P. venta (S/) *</label>
                  <input
                    type="number"
                    step="0.01"
                    [(ngModel)]="partForm.salePrice"
                    class="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs tabular-nums text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-emerald-700 mb-1">P. por mayor (S/)</label>
                  <input
                    type="number"
                    step="0.01"
                    [(ngModel)]="partForm.wholesalePrice"
                    class="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs tabular-nums text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-gray-600 mb-1">Stock actual *</label>
                  <input
                    type="number"
                    [(ngModel)]="partForm.stockQuantity"
                    class="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs tabular-nums text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label class="block text-[11px] font-medium text-orange-700 mb-1">Stock mínimo</label>
                  <input
                    type="number"
                    [(ngModel)]="partForm.minStockLevel"
                    class="min-h-[40px] w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs tabular-nums text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
              </div>

              <!-- COLLAPSIBLE OPTIONAL CODES TOGGLE (OEM & SKU) -->
              <div class="rounded-xl border border-gray-200 bg-white overflow-hidden">
                <button
                  type="button"
                  (click)="showOptionalCodes.set(!showOptionalCodes())"
                  class="w-full px-4 py-3 flex items-center justify-between gap-2 text-left hover:bg-gray-50 transition"
                >
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-semibold text-gray-700">
                      Códigos adicionales (opcional — el SKU se genera solo)
                    </span>
                    @if (partForm.oemCode || partForm.sku) {
                      <span class="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] text-gray-600">
                        {{ partForm.sku || 'SKU automático' }}{{ partForm.oemCode ? ' · OEM ' + partForm.oemCode : '' }}
                      </span>
                    }
                  </div>
                  <svg
                    [class.rotate-180]="showOptionalCodes()"
                    class="h-4 w-4 text-gray-400 transition-transform"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                @if (showOptionalCodes()) {
                  <div class="border-t border-gray-100 bg-gray-50/60 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">
                        Código SKU interno (opcional)
                      </label>
                      <input
                        type="text"
                        [(ngModel)]="partForm.sku"
                        placeholder="Déjalo vacío para generar ASU-..."
                        class="min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-base sm:text-xs text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-orange-600 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-700 mb-1">
                        Código OEM de fabricante (opcional)
                      </label>
                      <input
                        type="text"
                        [(ngModel)]="partForm.oemCode"
                        placeholder="Ej: 04465-0K240 (opcional)"
                        class="min-h-[40px] w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-base sm:text-xs text-gray-900 placeholder:font-sans placeholder:text-gray-400 focus:border-orange-600 focus:outline-none"
                      />
                    </div>
                  </div>
                }
              </div>

              <!-- Drag-and-Drop Image Uploader -->
              <div class="rounded-2xl border border-gray-200 bg-white p-4">
                <app-part-image-uploader
                  [part]="editingPart()"
                  (partUpdated)="onPartImagesUpdated($event)"
                  (stagedFilesChange)="onStagedFilesChanged($event)"
                />
              </div>

              <!-- Compatible Vehicles Builder (Diseñado para no mecánicos con 1-clic y modo universal) -->
              <div class="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 space-y-3.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 class="text-sm font-bold text-gray-900">
                      Vehículos compatibles
                    </h4>
                    <p class="text-xs text-gray-500">
                      Indica las marcas y modelos donde aplica este repuesto (o márcalo como Universal en 1 clic).
                    </p>
                  </div>
                  <button
                    type="button"
                    (click)="toggleQuickVehicleImporter()"
                    [class]="
                      showQuickVehicleCreator()
                        ? 'border-orange-300 bg-orange-50 text-orange-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:text-orange-700'
                    "
                    class="inline-flex min-h-[34px] items-center rounded-lg border px-3 py-1.5 text-xs font-semibold transition"
                  >
                    {{ showQuickVehicleCreator() ? 'Cerrar catálogo de marcas' : '+ Ver catálogo de modelos' }}
                  </button>
                </div>

                <!-- ACCESOS RÁPIDOS EN 1-CLIC (Sin conocimientos mecánicos requeridos) -->
                <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 space-y-3">
                  <div class="flex flex-wrap items-center justify-between gap-2.5">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-base shadow-xs">
                        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                        </svg>
                      </div>
                      <div class="min-w-0">
                        <p class="text-xs font-bold text-gray-900">¿Es un repuesto universal o estándar?</p>
                        <p class="text-[11px] text-gray-600">
                          Para focos, fusibles, relés, plumillas, aceites o accesorios estándar que sirven para cualquier vehículo.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      (click)="setUniversalCompatibility()"
                      [class]="
                        isUniversalPart()
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 font-bold'
                          : 'bg-white hover:bg-blue-50 text-blue-700 border-blue-300 font-semibold'
                      "
                      class="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs shadow-2xs transition shrink-0"
                    >
                      <span>{{ isUniversalPart() ? '✓ Marcado como Universal' : 'Marcar como Repuesto Universal' }}</span>
                    </button>
                  </div>

                  <!-- Quick 1-Click Packs for Non-Mechanics -->
                  <div class="flex flex-wrap items-center gap-2 pt-2 border-t border-blue-200/60">
                    <span class="text-[11px] font-bold text-blue-900">Packs en 1 clic:</span>
                    <button
                      type="button"
                      (click)="addCommonCarsPack()"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50 px-2.5 py-1 text-xs font-medium text-gray-800 shadow-2xs transition"
                    >
                      <img src="/images/brands/toyota.jpg" class="h-3.5 w-5 object-contain rounded" alt="Toyota" />
                      <span>Autos comunes en Lima (Yaris, Hilux, Accent, Rio)</span>
                    </button>
                    <button
                      type="button"
                      (click)="addHeavyTrucksPack()"
                      class="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white hover:border-orange-400 hover:bg-orange-50 px-2.5 py-1 text-xs font-medium text-gray-800 shadow-2xs transition"
                    >
                      <img src="/images/brands/hino.png" class="h-3.5 w-5 object-contain" alt="Hino" />
                      <span>Camiones y Carga Pesada (Hino, Volvo, Scania, Isuzu)</span>
                    </button>
                    @if (compatibilityRows().length > 0) {
                      <div class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 shadow-2xs">
                        <span class="text-emerald-600 font-bold">✓</span>
                        <span>{{ compatibilityRows().length }} modelo(s) asignados al 100%</span>
                        <button type="button" (click)="compatibilityRows.set([])" class="text-[10px] text-emerald-700 underline hover:text-red-600 ml-1 cursor-pointer">Limpiar</button>
                      </div>
                    } @else if (partForm.name.trim().length > 2) {
                      <button
                        type="button"
                        (click)="autoApplyMechanicalFitment(true)"
                        class="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 px-2.5 py-1 text-xs font-semibold text-purple-800 shadow-2xs transition cursor-pointer"
                      >
                        <span class="text-xs">🔄</span>
                        <span>Re-analizar compatibilidad</span>
                      </button>
                    }
                  </div>
                </div>

                @if (isUniversalPart()) {
                  <div class="rounded-xl border border-emerald-300 bg-emerald-50 p-3 flex items-center gap-2.5 text-xs text-emerald-900">
                    <span class="text-lg">✓</span>
                    <div>
                      <strong class="font-bold">Repuesto Multimarca / Universal:</strong>
                      <span> Aplica a cualquier vehículo. Los clientes podrán encontrarlo buscando cualquier marca o modelo.</span>
                    </div>
                  </div>
                }

                <!-- 1-CLICK VEHICLE MAKES & MODELS IMPORTER PANEL -->
                @if (showQuickVehicleCreator()) {
                  <div class="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-3.5">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p class="text-xs font-bold text-gray-900">
                          Importador rápido de marcas y modelos
                        </p>
                        <p class="text-[11px] text-gray-600">
                          Toca una marca y luego el modelo para vincularlo al instante.
                        </p>
                      </div>
                    </div>

                    <!-- Step A: Select Make -->
                    <div class="space-y-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <select
                          [ngModel]="selectedApiMake()"
                          (ngModelChange)="selectApiMakeForImport($event)"
                          class="min-h-[38px] rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-base sm:text-xs font-semibold text-gray-900 focus:border-orange-600 focus:outline-none"
                        >
                          @for (mkName of apiVehicleMakes(); track mkName) {
                            <option [ngValue]="mkName">{{ mkName }}</option>
                          }
                        </select>

                        <!-- Quick Popular Make Pills -->
                        <div class="flex flex-wrap gap-1.5">
                          @for (popular of apiVehicleMakes().slice(0, 10); track popular) {
                            <button
                              type="button"
                              (click)="selectApiMakeForImport(popular)"
                              [class]="
                                selectedApiMake() === popular
                                  ? 'border-orange-600 bg-orange-600 text-white font-semibold'
                                  : 'border-gray-200 bg-white text-gray-700 hover:border-orange-300 font-medium'
                              "
                              class="rounded-full border px-2.5 py-1 text-[11px] transition"
                            >
                              {{ popular }}
                            </button>
                          }
                        </div>
                      </div>
                    </div>

                    <!-- Step B: Clickable Model Chips -->
                    @if (loadingApiModels()) {
                      <div class="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-500 flex items-center gap-2">
                        <svg class="h-4 w-4 animate-spin text-orange-600" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                          <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                        </svg>
                        <span>Consultando modelos de {{ selectedApiMake() }}...</span>
                      </div>
                    } @else if (apiVehicleModels().length > 0) {
                      <div class="space-y-1.5">
                        <span class="block text-[11px] font-medium text-gray-600">
                          Toca un modelo de <strong class="text-gray-900">{{ selectedApiMake() }}</strong> para vincularlo:
                        </span>
                        <div class="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-0.5">
                          @for (mdl of apiVehicleModels(); track mdl.name) {
                            <button
                              type="button"
                              [disabled]="importingModelName() === mdl.name"
                              (click)="quickImportSingleModelChip(mdl)"
                              [class]="
                                isModelAlreadyLinked(selectedApiMake(), mdl.name)
                                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold'
                                  : 'border-gray-200 bg-white text-gray-800 hover:border-orange-400 hover:bg-orange-50 font-medium'
                              "
                              class="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs shadow-2xs transition disabled:opacity-50"
                            >
                              @if (isModelAlreadyLinked(selectedApiMake(), mdl.name)) {
                                <svg class="h-3 w-3 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                </svg>
                              } @else {
                                <span class="text-orange-600 font-bold">+</span>
                              }
                              <span>{{ mdl.name }}</span>
                            </button>
                          }
                        </div>
                      </div>
                    }

                    <!-- Fallback Custom Make / Model Quick Input -->
                    <div class="pt-2 border-t border-orange-200/70 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        [(ngModel)]="customQuickMake"
                        [placeholder]="'Marca (ej: ' + (selectedApiMake() || 'Toyota') + ')'"
                        class="min-h-[36px] sm:w-40 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                      />
                      <input
                        type="text"
                        [(ngModel)]="customQuickModel"
                        placeholder="¿Otro modelo específico? Escríbelo aquí (ej: Hilux, FH 500, Dutro)"
                        class="min-h-[36px] flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-base sm:text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        [disabled]="!customQuickModel.trim() || importingModelName() === '__custom__'"
                        (click)="quickImportCustomMakeModel()"
                        class="min-h-[36px] rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-50 transition"
                      >
                        Vincular
                      </button>
                    </div>
                  </div>
                }

                <!-- Selector Manual de Modelos Guardados -->
                <div class="space-y-2">
                  <div class="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                    <div>
                      <label class="block text-[11px] font-medium text-gray-600 mb-1">Marca</label>
                      <select
                        [(ngModel)]="compDraftMakeId"
                        (ngModelChange)="onCompMakeChange()"
                        class="min-h-[38px] w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-base sm:text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                      >
                        <option [ngValue]="null">-- Seleccionar marca --</option>
                        @for (mk of makes(); track mk.id) {
                          <option [ngValue]="mk.id">{{ mk.name }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="block text-[11px] font-medium text-gray-600 mb-1">Modelo</label>
                      <select
                        [(ngModel)]="compDraftModelId"
                        [disabled]="!compDraftMakeId"
                        class="min-h-[38px] w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-base sm:text-xs text-gray-900 focus:border-orange-600 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        @if (!compDraftMakeId) {
                          <option [ngValue]="null">-- Elige primero la marca --</option>
                        } @else {
                          <option [ngValue]="null">-- Seleccionar modelo --</option>
                          @for (md of compModels(); track md.id) {
                            <option [ngValue]="md.id">{{ md.name }}</option>
                          }
                        }
                      </select>
                    </div>
                    <div class="sm:col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        [disabled]="!compDraftModelId || isSelectedMakeIncompatibleWithIgnition()"
                        (click)="addCompatibilityRow()"
                        class="min-h-[38px] flex-1 rounded-lg border border-orange-200 bg-orange-50 py-1.5 px-3 text-xs font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      >
                        + Vincular vehículo
                      </button>
                      <button
                        type="button"
                        (click)="showAdvancedTechFitment.set(!showAdvancedTechFitment())"
                        class="min-h-[38px] rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs text-gray-600 hover:border-gray-300 flex items-center gap-1.5"
                        title="Especificar año y motor (opcional)"
                      >
                        <svg class="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.15.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>{{ showAdvancedTechFitment() ? 'Ocultar detalles' : 'Año / Motor (Opcional)' }}</span>
                      </button>
                    </div>

                    @if (isSelectedMakeIncompatibleWithIgnition()) {
                      <div class="sm:col-span-4 rounded-xl border border-red-200 bg-red-50/90 p-3 flex items-start gap-2.5 text-xs text-red-900 animate-fadeIn">
                        <span class="text-base text-red-600 font-bold shrink-0">🚫</span>
                        <div>
                          <strong class="font-bold">Incompatibilidad mecánica crítica bloqueada:</strong>
                          <p class="mt-0.5 text-gray-700">
                            Una bobina de encendido o bujía no aplica a camiones diésel pesados como <strong>{{ getSelectedMakeName() }}</strong>.
                            Los motores diésel funcionan por autoignición mediante compresión y no cuentan con bujías ni bobinas.
                            Por seguridad del catálogo y satisfacción del cliente, este botón se encuentra protegido.
                          </p>
                        </div>
                      </div>
                    }
                  </div>

                  @if (showAdvancedTechFitment()) {
                    <div class="p-3 rounded-xl border border-gray-200 bg-white grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <div>
                        <label class="block text-[11px] text-gray-600 mb-1">Año desde (Opcional)</label>
                        <input
                          type="number"
                          min="1998"
                          max="2026"
                          [(ngModel)]="compDraftYearStart"
                          class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs tabular-nums text-gray-900"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] text-gray-600 mb-1">Año hasta (Opcional)</label>
                        <input
                          type="number"
                          min="1998"
                          max="2026"
                          [(ngModel)]="compDraftYearEnd"
                          class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs tabular-nums text-gray-900"
                        />
                      </div>
                      <div>
                        <label class="block text-[11px] text-gray-600 mb-1">Motor / Cilindrada (Opcional)</label>
                        <input
                          type="text"
                          [(ngModel)]="compDraftEngine"
                          placeholder="Ej: 1.5L / D13K (Dejar vacío si aplica a todos)"
                          class="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs text-gray-900"
                        />
                      </div>
                    </div>
                  }
                </div>

                @if (compatibilityRows().length > 0) {
                  <div class="flex flex-wrap gap-2 pt-1">
                    @for (row of compatibilityRows(); track $index; let idx = $index) {
                      <span class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs shadow-2xs">
                        <strong class="font-semibold text-gray-900">
                          {{ row.makeNameLabel }} {{ row.modelNameLabel || 'Modelo #' + row.modelId }}
                        </strong>
                        <span class="tabular-nums text-[11px] font-medium text-orange-700">
                          ({{ row.yearStart }}–{{ row.yearEnd }})
                        </span>
                        @if (row.engineSpec) {
                          <span class="text-[11px] text-gray-500">{{ row.engineSpec }}</span>
                        }
                        <button
                          type="button"
                          (click)="removeCompatibilityRow(idx)"
                          aria-label="Quitar compatibilidad"
                          class="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 transition"
                        >
                          <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18" />
                            <path d="m6 6 12 12" />
                          </svg>
                        </button>
                      </span>
                    }
                  </div>
                }
              </div>
            </div>

            <!-- Modal Footer -->
            <div class="border-t border-gray-200 bg-gray-50 px-5 sm:px-6 py-4 flex items-center justify-end gap-3">
              <button
                type="button"
                (click)="closePartModal()"
                class="min-h-[42px] rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="savingPart()"
                (click)="savePartForm()"
                class="min-h-[42px] rounded-xl bg-orange-600 px-5 py-2 text-sm font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition"
              >
                {{ savingPart() ? 'Guardando...' : 'Guardar repuesto' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- =========================================================================== -->
      <!-- MODAL: SAFE EMAIL HTML PREVIEW                                              -->
      <!-- =========================================================================== -->
      @if (previewingLog(); as mailLog) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs p-3 sm:p-6 flex items-center justify-center">
          <div class="w-full max-w-3xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            <div class="border-b border-gray-200 bg-white px-5 py-4 flex items-start justify-between gap-4">
              <div class="space-y-1 min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
                    {{ formatNotificationEvent(mailLog.eventType) }}
                  </span>
                  <span
                    [class]="notificationStatusBadgeClass(mailLog.deliveryStatus)"
                    class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold"
                  >
                    {{ formatNotificationStatus(mailLog.deliveryStatus) }}
                  </span>
                </div>
                <h3 class="text-base font-bold text-gray-900 truncate">
                  {{ mailLog.subject }}
                </h3>
                <p class="text-xs text-gray-500">
                  Para: <strong class="text-gray-800">{{ mailLog.recipientEmail }}</strong> ·
                  {{ mailLog.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                </p>
              </div>
              <button
                type="button"
                (click)="closeEmailPreview()"
                aria-label="Cerrar vista previa"
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div class="bg-[#F8F9FA] p-4">
              <iframe
                sandbox=""
                title="Vista previa del correo electrónico"
                [srcdoc]="safeEmailPreviewHtml()"
                class="w-full h-[440px] rounded-xl border border-gray-200 bg-white shadow-2xs"
              ></iframe>
            </div>

            <div class="border-t border-gray-200 bg-white px-5 py-3.5 flex justify-end">
              <button
                type="button"
                (click)="closeEmailPreview()"
                class="min-h-[38px] rounded-xl bg-orange-600 px-4 py-2 text-xs font-semibold text-white hover:bg-orange-700 transition"
              >
                Cerrar vista previa
              </button>
            </div>
          </div>
        </div>
      }

      <!-- =========================================================================== -->
      <!-- MODAL EDITOR: REGISTRAR / EDITAR COLABORADOR INSTITUCIONAL                     -->
      <!-- =========================================================================== -->
      @if (showUserModal()) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/40 backdrop-blur-xs p-4 flex items-center justify-center">
          <div class="w-full max-w-xl rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden animate-fadeIn">
            <!-- Modal Header -->
            <div class="border-b border-gray-200 bg-white px-6 py-4 flex items-start justify-between">
              <div>
                <span class="text-[11px] font-bold uppercase tracking-wider text-orange-600">
                  {{ editingUser() ? 'Modificación de Ficha' : 'Ficha de Alta Corporativa' }}
                </span>
                <h3 class="text-base font-bold text-gray-900 mt-0.5">
                  {{ editingUser() ? editingUser()!.fullName : 'Registrar Nuevo Colaborador' }}
                </h3>
                <p class="text-[11px] text-gray-500 mt-0.5">
                  Registro para personal con rol operativo, código institucional y credenciales de acceso.
                </p>
              </div>
              <button
                type="button"
                (click)="closeUserModal()"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form (ngSubmit)="saveStaffUser()" class="p-6 space-y-4 text-xs">
              <!-- Documento Tipo, Número y Consulta RENIEC -->
              <div>
                <label class="block font-medium text-gray-700 mb-1">Documento de Identidad Oficial *</label>
                <div class="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <div class="sm:col-span-3">
                    <select
                      [(ngModel)]="userForm.documentType"
                      name="documentType"
                      class="w-full h-9 rounded-xl border border-gray-300 px-2.5 text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                    >
                      <option value="DNI">DNI</option>
                      <option value="CE">Carnet Ext.</option>
                      <option value="RUC">RUC</option>
                      <option value="PASAPORTE">Pasaporte</option>
                    </select>
                  </div>
                  <div class="sm:col-span-5">
                    <input
                      type="text"
                      [(ngModel)]="userForm.documentNumber"
                      name="documentNumber"
                      placeholder="Número de documento"
                      class="w-full h-9 rounded-xl border border-gray-300 px-3 text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                    />
                  </div>
                  <div class="sm:col-span-4">
                    <button
                      type="button"
                      (click)="lookupStaffDocument()"
                      [disabled]="searchingDoc()"
                      class="w-full h-9 rounded-xl border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 hover:text-orange-600 transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      @if (searchingDoc()) {
                        <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></span>
                        <span>Consultando...</span>
                      } @else {
                        <svg class="h-3.5 w-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span>Validar RENIEC</span>
                      }
                    </button>
                  </div>
                </div>

                @if (docVerifiedName()) {
                  <div class="mt-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 flex items-center gap-2 text-[11px] text-emerald-800">
                    <svg class="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Identidad oficial confirmada: <strong>{{ docVerifiedName() }}</strong></span>
                  </div>
                }
              </div>

              <!-- Nombre y Apellidos -->
              <div>
                <label class="block font-medium text-gray-700 mb-1">Nombres y Apellidos Completos *</label>
                <input
                  type="text"
                  [(ngModel)]="userForm.fullName"
                  name="fullName"
                  required
                  placeholder="Ej: Miguel Ángel Soto Ramírez"
                  class="w-full h-9 rounded-xl border border-gray-300 px-3 text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <!-- Código de Empleado y Teléfono -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block font-medium text-gray-700 mb-1">Código de Empleado / Ficha *</label>
                  <input
                    type="text"
                    [(ngModel)]="userForm.employeeCode"
                    name="employeeCode"
                    placeholder="Ej: VEN-001, MOT-001, ADM-001"
                    class="w-full h-9 rounded-xl border border-gray-300 font-mono px-3 text-xs text-gray-900 uppercase focus:border-orange-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label class="block font-medium text-gray-700 mb-1">Teléfono Móvil / WhatsApp</label>
                  <input
                    type="tel"
                    [(ngModel)]="userForm.phone"
                    name="phone"
                    placeholder="+51 987 654 321"
                    class="w-full h-9 rounded-xl border border-gray-300 px-3 text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <!-- Correo Institucional -->
              <div>
                <label class="block font-medium text-gray-700 mb-1">Correo de Acceso Institucional *</label>
                <input
                  type="email"
                  [(ngModel)]="userForm.email"
                  name="email"
                  required
                  placeholder="ejemplo@asuncion.pe"
                  class="w-full h-9 rounded-xl border border-gray-300 px-3 text-xs text-gray-900 focus:border-orange-500 focus:outline-hidden"
                />
              </div>

              <!-- Puesto / Rol Corporativo -->
              <div>
                <label class="block font-medium text-gray-700 mb-1.5">Cargo / Rol Operativo en la Empresa *</label>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <!-- Vendedor -->
                  <button
                    type="button"
                    (click)="onRoleSelected('VENDEDOR')"
                    [class]="userForm.role === 'VENDEDOR' ? 'border-orange-500 bg-orange-50/70 text-orange-950 font-bold shadow-2xs' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'"
                    class="cursor-pointer rounded-xl border p-3 text-left transition block w-full"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      <span class="text-xs">Ventas y Almacén</span>
                    </div>
                    <p class="text-[10px] text-gray-500 font-normal">Acceso ERP para cotizaciones, picking y despacho.</p>
                  </button>

                  <!-- Motorizado -->
                  <button
                    type="button"
                    (click)="onRoleSelected('MOTORIZADO')"
                    [class]="userForm.role === 'MOTORIZADO' ? 'border-emerald-500 bg-emerald-50/70 text-emerald-950 font-bold shadow-2xs' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'"
                    class="cursor-pointer rounded-xl border p-3 text-left transition block w-full"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <svg class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span class="text-xs">Repartidor GPS</span>
                    </div>
                    <p class="text-[10px] text-gray-500 font-normal">Acceso PWA de entregas y rastreo en tiempo real.</p>
                  </button>

                  <!-- Administrador -->
                  <button
                    type="button"
                    (click)="onRoleSelected('ADMIN')"
                    [class]="userForm.role === 'ADMIN' ? 'border-blue-500 bg-blue-50/70 text-blue-950 font-bold shadow-2xs' : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'"
                    class="cursor-pointer rounded-xl border p-3 text-left transition block w-full"
                  >
                    <div class="flex items-center gap-2 mb-1">
                      <svg class="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      <span class="text-xs">Administrador</span>
                    </div>
                    <p class="text-[10px] text-gray-500 font-normal">Control total del ERP, personal, caja y reportes.</p>
                  </button>
                </div>
              </div>

              <!-- Datos Específicos para Repartidor Motorizado -->
              @if (userForm.role === 'MOTORIZADO') {
                <div class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3.5 space-y-3 animate-fadeIn">
                  <div class="flex items-center gap-2 text-emerald-900 font-bold">
                    <svg class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span>Habilitación Operativa de Reparto Vehicular</span>
                  </div>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">N° Brevete / Licencia de Conducir</label>
                      <input
                        type="text"
                        [(ngModel)]="userForm.licenseNumber"
                        name="licenseNumber"
                        placeholder="Ej: Q48201937"
                        class="w-full h-9 rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-900 uppercase focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                    <div>
                      <label class="block font-medium text-gray-700 mb-1">Placa de la Moto o Vehículo</label>
                      <input
                        type="text"
                        [(ngModel)]="userForm.vehiclePlate"
                        name="vehiclePlate"
                        placeholder="Ej: 5432-1A"
                        class="w-full h-9 rounded-xl border border-gray-300 bg-white px-3 text-xs text-gray-900 uppercase focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              }

              <!-- Contraseña de Acceso -->
              <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <label class="font-bold text-gray-900">
                    {{ editingUser() ? 'Actualizar Contraseña de Acceso (Opcional)' : 'Contraseña Temporal de Acceso *' }}
                  </label>
                  <div class="flex items-center gap-3">
                    <button
                      type="button"
                      (click)="generateRandomPassword()"
                      class="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
                    >
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                      </svg>
                      <span>Generar clave segura</span>
                    </button>
                    <button
                      type="button"
                      (click)="copyCredentials()"
                      class="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                    >
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                      </svg>
                      <span>Copiar datos</span>
                    </button>
                  </div>
                </div>

                <div class="relative">
                  <input
                    [type]="showUserPassword ? 'text' : 'password'"
                    [(ngModel)]="userForm.password"
                    name="passwordField"
                    [required]="!editingUser()"
                    placeholder="{{ editingUser() ? 'Dejar en blanco para mantener la contraseña actual' : 'Mínimo 6 caracteres' }}"
                    class="w-full h-9 rounded-xl border border-gray-300 bg-white px-3 pr-16 text-xs text-gray-900 font-mono focus:border-orange-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    (click)="showUserPassword = !showUserPassword"
                    class="absolute right-2.5 top-2.5 text-[11px] text-gray-500 hover:text-gray-800 font-medium cursor-pointer"
                  >
                    {{ showUserPassword ? 'Ocultar' : 'Ver' }}
                  </button>
                </div>

                <p class="text-[10px] text-gray-500">
                  {{ editingUser() ? 'Si no desea cambiar la clave del usuario, conserve el campo en blanco.' : 'El trabajador podrá iniciar sesión inmediatamente en /login con este correo y clave.' }}
                </p>
              </div>

              <!-- Footer Botones Modal -->
              <div class="pt-2 flex items-center justify-end gap-2.5 border-t border-gray-100">
                <button
                  type="button"
                  (click)="closeUserModal()"
                  class="h-9 rounded-xl border border-gray-200 px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  [disabled]="savingStaffUser()"
                  class="h-9 rounded-xl bg-orange-600 px-5 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {{ savingStaffUser() ? 'Guardando...' : (editingUser() ? 'Guardar Cambios' : 'Registrar Colaborador') }}
                </button>
              </div>
            </form>
          </div>
        </div>
      }

      <!-- Driver Assignment Modal for Delivery Orders -->
      @if (selectedOrderForDispatch(); as orderForDispatch) {
        <div class="fixed inset-0 z-50 overflow-y-auto bg-gray-900/50 backdrop-blur-xs p-4 flex items-center justify-center">
          <div class="w-full max-w-lg rounded-2xl border border-gray-200 bg-white shadow-2xl overflow-hidden">
            <!-- Modal Header -->
            <div class="border-b border-gray-200 bg-gray-50/80 px-6 py-4 flex items-center justify-between">
              <div class="flex items-center gap-3">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-orange-200 bg-orange-100/70 text-orange-700">
                  <img src="/images/icons/repartidor.png" alt="" class="h-6 w-6 object-contain" />
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <span class="font-mono text-xs font-bold text-orange-600">
                      {{ orderForDispatch.orderNumber }}
                    </span>
                    <span class="rounded-full bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-0.5 border border-orange-200">
                      Envío a domicilio
                    </span>
                  </div>
                  <h3 class="text-base font-bold text-gray-900">Asignar Repartidor Motorizado</h3>
                </div>
              </div>
              <button
                type="button"
                (click)="closeDriverAssignmentModal()"
                class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition cursor-pointer"
                aria-label="Cerrar modal"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Modal Content -->
            <div class="p-6 space-y-4 text-xs">
              <!-- Order Destination Details -->
              <div class="rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-gray-500 font-medium">Cliente:</span>
                  <span class="font-bold text-gray-900">{{ orderForDispatch.recipientName || orderForDispatch.customerName }}</span>
                </div>
                <div class="flex items-start justify-between gap-2">
                  <span class="text-gray-500 font-medium shrink-0">Dirección:</span>
                  <span class="text-right font-medium text-gray-800">{{ orderForDispatch.deliveryAddress }}</span>
                </div>
                @if (orderForDispatch.deliveryReference) {
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-gray-500 font-medium shrink-0">Referencia:</span>
                    <span class="text-right text-gray-600">{{ orderForDispatch.deliveryReference }}</span>
                  </div>
                }
              </div>

              <!-- Driver Selection -->
              <div>
                <label class="block font-bold text-gray-900 mb-2">
                  Selecciona el repartidor para esta entrega:
                </label>

                @if (loadingDrivers()) {
                  <div class="py-8 text-center text-gray-500">
                    <span class="inline-block animate-spin mr-2">⏳</span> Cargando lista de motorizados...
                  </div>
                } @else if (drivers().length === 0) {
                  <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center text-amber-800 space-y-1">
                    <p class="font-bold">No hay motorizados registrados</p>
                    <p class="text-[11px]">Crea o habilita un usuario con rol "Motorizado" en la pestaña de Usuarios.</p>
                  </div>
                } @else {
                  <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                    @for (d of drivers(); track d.id) {
                      <label
                        [class]="selectedDriverId() === d.id ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20' : 'border-gray-200 bg-white hover:bg-gray-50'"
                        class="flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition"
                      >
                        <div class="flex items-center gap-3">
                          <input
                            type="radio"
                            name="assignedDriver"
                            [value]="d.id"
                            [checked]="selectedDriverId() === d.id"
                            (change)="selectedDriverId.set(d.id)"
                            class="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
                          />
                          <div>
                            <div class="flex items-center gap-2">
                              <span class="font-bold text-gray-900">{{ d.fullName }}</span>
                              @if (d.vehiclePlate) {
                                <span class="font-mono text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200">
                                  {{ d.vehiclePlate }}
                                </span>
                              }
                            </div>
                            <p class="text-[11px] text-gray-500">
                              {{ d.phone || d.email || 'Sin teléfono' }}
                              @if (d.vehicleModel) {
                                <span>· {{ d.vehicleModel }}</span>
                              }
                            </p>
                          </div>
                        </div>

                        <span
                          [class]="driverStatusBadgeClass(d.status)"
                          class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shrink-0"
                        >
                          {{ driverStatusLabel(d.status) }}
                        </span>
                      </label>
                    }
                  </div>
                }
              </div>

              <!-- Error Alert -->
              @if (driverAssignError()) {
                <div class="rounded-xl border border-red-200 bg-red-50 p-3 text-red-700 text-xs flex items-center gap-2">
                  <svg class="h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <span>{{ driverAssignError() }}</span>
                </div>
              }
            </div>

            <!-- Modal Footer -->
            <div class="border-t border-gray-100 bg-gray-50/80 px-6 py-4 flex items-center justify-end gap-2.5">
              <button
                type="button"
                (click)="closeDriverAssignmentModal()"
                class="h-9.5 rounded-xl border border-gray-200 bg-white px-4 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                [disabled]="!selectedDriverId() || isAssigningDriver()"
                (click)="confirmDriverAssignment()"
                class="h-9.5 rounded-xl bg-orange-600 px-5 text-xs font-bold text-white shadow-xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer inline-flex items-center gap-2"
              >
                @if (isAssigningDriver()) {
                  <span class="inline-block animate-spin">⏳</span>
                  <span>Asignando...</span>
                } @else {
                  <span>Confirmar y Despachar</span>
                }
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class AdminErpPageComponent implements OnInit, OnDestroy {
  readonly complaintsService = inject(ComplaintsService);
  readonly driverRatingService = inject(DriverRatingService);
  readonly promotionService = inject(PromotionService);

  // Libro de Reclamaciones State
  readonly selectedComplaint = signal<ComplaintRecord | null>(null);
  claimResponseText = '';
  readonly claimFilterType = signal<'TODOS' | 'RECLAMO' | 'QUEJA'>('TODOS');
  readonly claimFilterStatus = signal<'TODOS' | 'PENDIENTE' | 'ATENDIDO'>('TODOS');

  // Real-Time New Order Monitor & Chime
  readonly newOrderBanner = signal<{ orderNumber: string; total: number; customerName: string } | null>(null);
  readonly newOrdersAlertCount = signal<number>(0);
  private knownOrderNumbers = new Set<string>();
  private orderMonitorInterval: ReturnType<typeof setInterval> | null = null;
  private hasInitializedOrderMonitor = false;

  // Driver Ratings Modal State
  readonly selectedDriverForRatings = signal<string | null>(null);

  readonly auth = inject(AuthService);
  readonly notifService = inject(NotificationCenterService);
  private readonly analyticsService = inject(AnalyticsService);
  private readonly catalogService = inject(CatalogService);
  private readonly logisticsService = inject(LogisticsService);
  private readonly notificationAdminService = inject(NotificationAdminService);
  private readonly ordersService = inject(OrdersService);
  private readonly syncBus = inject(SyncBusService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly paymentService = inject(PaymentService);
  readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly toast = inject(ToastService);
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly lookupService = inject(LookupService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly Math = Math;

  readonly activeTab = signal<AdminTab>('analytics');

  // TAB 7: USERS & STAFF MANAGEMENT
  readonly staffUsers = signal<AdminUserResponse[]>([]);
  readonly loadingStaffUsers = signal<boolean>(false);
  readonly savingStaffUser = signal<boolean>(false);
  readonly showUserModal = signal<boolean>(false);
  readonly editingUser = signal<AdminUserResponse | null>(null);
  readonly searchingDoc = signal<boolean>(false);
  readonly docVerifiedName = signal<string | null>(null);

  userSearchQuery = '';
  userRoleFilter = 'TODOS';
  showUserPassword = false;

  userForm = {
    fullName: '',
    email: '',
    phone: '',
    documentType: 'DNI',
    documentNumber: '',
    role: 'VENDEDOR',
    password: '',
    newPassword: '',
    active: true,
    employeeCode: '',
    licenseNumber: '',
    vehiclePlate: '',
  };

  // Payment Gateway State (Culqi, PagoEfectivo, Niubiz)
  readonly paymentTransactions = signal<PaymentTransactionDto[]>([]);
  readonly savingPaymentConfig = signal<boolean>(false);
  readonly loadingPaymentTransactions = signal<boolean>(false);
  paymentConfigForm: PaymentConfigUpdateRequest & { updatedAt?: string } = {
    culqiEnabled: true,
    culqiPublicKey: '',
    culqiSecretKey: '',
    pagoefectivoEnabled: true,
    pagoefectivoServiceId: '',
    pagoefectivoSecretKey: '',
    niubizEnabled: false,
    niubizMerchantId: '',
    niubizUser: '',
    niubizPassword: '',
    environment: 'SANDBOX',
    updatedAt: undefined,
  };

  readonly showCulqiSecret = signal<boolean>(false);

  // Peruvian Store Payment Methods Settings (Yape, Plin, Bank Accounts, COD)
  storePaymentMethods = {
    // Billeteras Digitales
    yapeEnabled: true,
    yapePhone: '922779157',
    yapeHolder: 'Repuestos Automotrices Asunción S.A.C.',
    yapeQrImageUrl: '/images/qr/qr-yape-default.svg',
    plinEnabled: true,
    plinPhone: '922779157',
    plinHolder: 'Repuestos Automotrices Asunción S.A.C.',
    plinQrImageUrl: '/images/qr/qr-plin-default.svg',
    walletInstructions: 'Envía la constancia o captura de tu pago al WhatsApp +51 922779157 indicando tu N° de Pedido.',
    
    // Transferencias Bancarias
    bcpEnabled: true,
    bcpAccount: '193-98765432-0-12',
    bcpCci: '002-193-009876543201-12',
    bcpHolder: 'Repuestos Automotrices Asunción S.A.C.',
    
    bbvaEnabled: true,
    bbvaAccount: '0011-0123-0100045678',
    bbvaCci: '011-123-000100045678-45',
    bbvaHolder: 'Repuestos Automotrices Asunción S.A.C.',
    
    interbankEnabled: true,
    interbankAccount: '200-3001234567',
    interbankCci: '003-200-003001234567-89',
    interbankHolder: 'Repuestos Automotrices Asunción S.A.C.',
    
    // Contra Entrega & Presencial
    codCashEnabled: true,
    codPosEnabled: true,
    codMaxAmount: 1500,
    storePickupEnabled: true,
    storePickupAddress: 'Av. Sta. Ana 441, Santa Anita, Lima (Almacén Central)'
  };

  loadStorePaymentMethods(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('asuncion_store_payment_methods');
        if (stored) {
          const parsed = JSON.parse(stored);
          this.storePaymentMethods = { ...this.storePaymentMethods, ...parsed };
        }
      } catch (e) {
        console.warn('Could not parse stored payment methods:', e);
      }
    }
    this.paymentService.fetchStoreWalletConfig().subscribe({
      next: (cfg) => {
        this.storePaymentMethods = {
          ...this.storePaymentMethods,
          ...cfg,
          yapeQrImageUrl: cfg.yapeQrImageUrl || this.storePaymentMethods.yapeQrImageUrl,
          plinQrImageUrl: cfg.plinQrImageUrl || this.storePaymentMethods.plinQrImageUrl,
        };
      },
    });
  }

  
  private compressImageFile(file: File, maxWidth = 600, maxHeight = 600, quality = 0.85): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(reader.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(reader.result as string);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async onUploadWalletQr(event: Event, type: 'YAPE' | 'PLIN'): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    try {
      const compressedBase64 = await this.compressImageFile(file, 600, 600, 0.85);
      if (type === 'YAPE') {
        this.storePaymentMethods.yapeQrImageUrl = compressedBase64;
      } else {
        this.storePaymentMethods.plinQrImageUrl = compressedBase64;
      }
      this.saveStorePaymentMethods();
      this.toast.success('QR Actualizado', `Se optimizó y guardó la imagen oficial de ${type} exitosamente.`);
    } catch (e) {
      console.error('Error al procesar imagen QR:', e);
      this.toast.error('Error al subir imagen', 'No se pudo procesar la foto seleccionada.');
    }
  }

  downloadOrderPdf(order: Order): void {
    this.pdfInvoiceService.generateInvoicePdf(order, true);
    this.toast.success('Descargando comprobante', `Generando PDF oficial para el pedido #${order.orderNumber}`);
  }

  saveStorePaymentMethods(): void {
    this.paymentService.saveStoreWalletConfig(this.storePaymentMethods);
    if (this.auth.hasAnyRole(['ADMIN'])) {
      const payload: PaymentConfigUpdateRequest = {
        culqiEnabled: Boolean(this.paymentConfigForm?.culqiEnabled ?? true),
        culqiPublicKey: (this.paymentConfigForm?.culqiPublicKey || '').trim(),
        culqiSecretKey: (this.paymentConfigForm?.culqiSecretKey || '').trim(),
        pagoefectivoEnabled: Boolean(this.paymentConfigForm?.pagoefectivoEnabled ?? false),
        pagoefectivoServiceId: (this.paymentConfigForm?.pagoefectivoServiceId || '').trim(),
        pagoefectivoSecretKey: (this.paymentConfigForm?.pagoefectivoSecretKey || '').trim(),
        niubizEnabled: Boolean(this.paymentConfigForm?.niubizEnabled ?? false),
        niubizMerchantId: (this.paymentConfigForm?.niubizMerchantId || '').trim(),
        niubizUser: (this.paymentConfigForm?.niubizUser || '').trim(),
        niubizPassword: (this.paymentConfigForm?.niubizPassword || '').trim(),
        environment: this.paymentConfigForm?.environment || 'SANDBOX',
        yapePhone: (this.storePaymentMethods.yapePhone || '').trim(),
        yapeHolder: (this.storePaymentMethods.yapeHolder || '').trim(),
        yapeQrImageUrl: this.storePaymentMethods.yapeQrImageUrl || '',
        plinPhone: (this.storePaymentMethods.plinPhone || '').trim(),
        plinHolder: (this.storePaymentMethods.plinHolder || '').trim(),
        plinQrImageUrl: this.storePaymentMethods.plinQrImageUrl || '',
        walletInstructions: (this.storePaymentMethods.walletInstructions || '').trim(),
      };
      this.paymentService.updateAdminConfig(payload).subscribe({
        next: () => {},
        error: (err) => console.warn('Could not sync payment config with server:', err),
      });
    }
  }

  // Analytics State
  readonly analyticsDays = signal<number>(30);
  readonly loadingAnalytics = signal<boolean>(false);
  readonly dashboard = signal<ExecutiveDashboardResponse | null>(null);

  // Admin Parts State
  readonly adminParts = signal<Part[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly makes = signal<VehicleMake[]>([]);
  readonly compModels = signal<VehicleModel[]>([]);
  partSearchTerm = '';
  lowStockOnlyFilter = false;

  readonly criticalStockParts = computed(() => {
    return this.adminParts()
      .filter((p) => (p.stockQuantity ?? 0) <= (p.minStockLevel ?? 5))
      .sort((a, b) => (a.stockQuantity ?? 0) - (b.stockQuantity ?? 0));
  });

  // Part Editor Modal State
  // ---------------------------------------------------------------------------
  // PROMOTIONS & STOCK ROTATION COMMERCIAL MODAL
  // ---------------------------------------------------------------------------
  readonly showPromotionModal = signal<boolean>(false);
  readonly promoPart = signal<{
    sku: string;
    partId?: number;
    name: string;
    oemCode?: string;
    categoryName?: string;
    stockQuantity: number;
    salePrice: number;
    purchasePrice: number;
    imageUrl?: string;
  } | null>(null);

  promoDiscountPercent: number = 10;
  promoType: 'DESCUENTO_DIRECTO' | 'COMBO_SUGERIDO' = 'DESCUENTO_DIRECTO';
  promoBadgeLabel: string = 'OFERTA FLASH';
  promoUnitsQuota: number = 5;
  promoComboComplementSku: string = 'ASU-FIL-001';
  promoComboComplementName: string = 'Filtro de Aceite Blindado Denso';
  promoComboComplementPrice: number = 42;

  private readonly fallbackComplements = [
    { sku: 'ASU-FIL-001', name: 'Filtro de Aceite Blindado Denso', price: 42 },
    { sku: 'ASU-FRE-004', name: 'Líquido de Frenos DOT 4 Bosch 500ml', price: 28 },
    { sku: 'ASU-REF-003', name: 'Refrigerante 50/50 Prestone Galón', price: 48 },
    { sku: 'ASU-ELE-002', name: 'Bujía Iridium Power Denso', price: 45 },
    { sku: 'ASU-FIL-002', name: 'Filtro de Aire Motor Mann Filter', price: 58 },
  ];

  get suggestedComplements(): Array<{ sku: string; name: string; price: number }> {
    const currentSku = this.promoPart()?.sku;
    const allParts = this.adminParts();
    if (!allParts || allParts.length === 0) {
      return this.fallbackComplements.filter((c) => c.sku !== currentSku);
    }

    const consumableParts = allParts
      .filter(
        (p) =>
          p.sku !== currentSku &&
          (p.availableStock ?? p.stockQuantity ?? 0) > 0 &&
          p.salePrice <= 150 &&
          /(filtro|aceite|lubricante|liquido|líquido|refrigerante|bujia|bujía|foco|plumilla)/i.test(
            `${p.name} ${p.categoryName || ''}`
          )
      )
      .slice(0, 6)
      .map((p) => ({ sku: p.sku, name: p.name, price: p.salePrice }));

    if (consumableParts.length >= 4) {
      return consumableParts;
    }

    const fallbackMapped = allParts
      .filter((p) => p.sku !== currentSku && (p.availableStock ?? p.stockQuantity ?? 0) > 0)
      .sort((a, b) => a.salePrice - b.salePrice)
      .slice(0, 6)
      .map((p) => ({ sku: p.sku, name: p.name, price: p.salePrice }));

    return fallbackMapped.length > 0
      ? fallbackMapped
      : this.fallbackComplements.filter((c) => c.sku !== currentSku);
  }

  get promoCalculatedPrice(): number {
    const p = this.promoPart();
    if (!p) return 0;
    return Number((p.salePrice * (1 - this.promoDiscountPercent / 100)).toFixed(2));
  }

  get promoClientSavings(): number {
    const p = this.promoPart();
    if (!p) return 0;
    return Number((p.salePrice - this.promoCalculatedPrice).toFixed(2));
  }

  get promoUnitProfit(): number {
    const p = this.promoPart();
    if (!p) return 0;
    return Number((this.promoCalculatedPrice - p.purchasePrice).toFixed(2));
  }

  get promoProfitMargin(): number {
    const price = this.promoCalculatedPrice;
    if (price <= 0) return 0;
    return Number(((this.promoUnitProfit / price) * 100).toFixed(1));
  }

  get promoIsSafe(): boolean {
    const p = this.promoPart();
    if (!p) return true;
    return this.promoCalculatedPrice >= p.purchasePrice;
  }

  get promoMaxSafeDiscount(): number {
    const p = this.promoPart();
    if (!p || p.salePrice <= 0) return 0;
    return Math.max(0, Math.floor(((p.salePrice - p.purchasePrice) / p.salePrice) * 100));
  }

  get promoRecoverableCapital(): number {
    return Number((this.promoCalculatedPrice * this.promoUnitsQuota).toFixed(2));
  }

  openManualComboCreator(partItem?: any): void {
    const item = partItem || (this.adminParts().length > 0 ? this.adminParts()[0] : null);
    if (!item) {
      this.toast.info('Sin repuestos', 'Primero registra al menos un repuesto en inventario para crear un combo.');
      return;
    }
    this.openPromotionModal(item);
    this.promoType = 'COMBO_SUGERIDO';
    this.promoBadgeLabel = 'COMBO RECOMENDADO';
    if (!this.promoDiscountPercent || this.promoDiscountPercent < 5) {
      this.promoDiscountPercent = 10;
    }
  }

  onPrimaryPartSelect(sku: string): void {
    const p = this.adminParts().find((it: Part) => it.sku === sku);
    if (p) {
      this.openPromotionModal(p);
      this.promoType = 'COMBO_SUGERIDO';
    }
  }

  openPromotionModal(item: any): void {
    const fullPart = this.adminParts().find((p: Part) => p.sku === item.sku || p.id === item.partId);
    
    // Calculate reliable prices
    const salePrice = fullPart ? fullPart.salePrice : (item.immobilizedCapital ? Number((item.immobilizedCapital / (item.currentStock || 1) * 1.30).toFixed(2)) : 100);
    const purchasePrice = fullPart && fullPart.purchasePrice ? fullPart.purchasePrice : (item.immobilizedCapital ? Number((item.immobilizedCapital / (item.currentStock || 1)).toFixed(2)) : Number((salePrice * 0.70).toFixed(2)));
    const stockQuantity = item.currentStock ?? item.stockQuantity ?? fullPart?.stockQuantity ?? 1;

    this.promoPart.set({
      sku: item.sku,
      partId: fullPart?.id ?? item.partId,
      name: item.name || item.partName || fullPart?.name || 'Repuesto Automotriz',
      oemCode: item.oemCode || fullPart?.oemCode,
      categoryName: item.categoryName || fullPart?.categoryName,
      stockQuantity,
      salePrice,
      purchasePrice,
      imageUrl: fullPart?.primaryImageUrl || '/images/categories/repuesto-default.png',
    });

    // Check if there is an existing promo
    const defaultComp = this.suggestedComplements[0] || {
      sku: 'ASU-FIL-001',
      name: 'Filtro de Aceite Blindado Denso',
      price: 42,
    };
    const existing = this.promotionService.getPromotion(item.sku);
    if (existing) {
      this.promoDiscountPercent = existing.discountPercentage;
      this.promoType = existing.promoType;
      this.promoBadgeLabel = existing.badgeLabel;
      this.promoUnitsQuota = existing.unitsQuota;
      this.promoComboComplementSku = existing.comboComplementSku || defaultComp.sku;
      this.promoComboComplementName = existing.comboComplementName || defaultComp.name;
      this.promoComboComplementPrice = existing.comboComplementPrice || defaultComp.price;
    } else {
      this.promoDiscountPercent = Math.min(10, this.promoMaxSafeDiscount || 10);
      this.promoType = 'DESCUENTO_DIRECTO';
      this.promoBadgeLabel = 'OFERTA FLASH';
      this.promoUnitsQuota = Math.min(5, Math.max(1, stockQuantity));
      this.promoComboComplementSku = defaultComp.sku;
      this.promoComboComplementName = defaultComp.name;
      this.promoComboComplementPrice = defaultComp.price;
    }

    this.showPromotionModal.set(true);
  }

  closePromotionModal(): void {
    this.showPromotionModal.set(false);
    this.promoPart.set(null);
  }

  selectPresetDiscount(pct: number): void {
    if (pct <= this.promoMaxSafeDiscount) {
      this.promoDiscountPercent = pct;
    }
  }

  onComboComplementSelect(sku: string): void {
    const comp = this.suggestedComplements.find((c) => c.sku === sku);
    if (comp) {
      this.promoComboComplementSku = comp.sku;
      this.promoComboComplementName = comp.name;
      this.promoComboComplementPrice = comp.price;
    }
  }

  savePromotion(): void {
    const part = this.promoPart();
    if (!part || !this.promoIsSafe) return;

    this.promotionService.applyPromotion({
      sku: part.sku,
      partId: part.partId,
      partName: part.name,
      categoryName: part.categoryName,
      originalPrice: part.salePrice,
      purchasePrice: part.purchasePrice,
      promoPrice: this.promoCalculatedPrice,
      discountPercentage: this.promoDiscountPercent,
      badgeLabel: this.promoBadgeLabel,
      promoType: this.promoType,
      comboComplementSku: this.promoType === 'COMBO_SUGERIDO' ? this.promoComboComplementSku : undefined,
      comboComplementName: this.promoType === 'COMBO_SUGERIDO' ? this.promoComboComplementName : undefined,
      comboComplementPrice: this.promoType === 'COMBO_SUGERIDO' ? this.promoComboComplementPrice : undefined,
      comboTotalPromoPrice: this.promoType === 'COMBO_SUGERIDO' ? Number((this.promoCalculatedPrice + this.promoComboComplementPrice * 0.85).toFixed(2)) : undefined,
      unitsQuota: this.promoUnitsQuota,
      unitsSoldInPromo: 0,
      active: true,
      startDate: new Date().toLocaleDateString('es-PE'),
    });

    this.closePromotionModal();
  }

  removeCurrentPromotion(): void {
    const part = this.promoPart();
    if (!part) return;
    this.promotionService.removePromotion(part.sku);
    this.closePromotionModal();
  }

  readonly showPartModal = signal<boolean>(false);
  readonly editingPart = signal<Part | null>(null);
  readonly savingPart = signal<boolean>(false);
  readonly showOptionalCodes = signal<boolean>(false);
  readonly compatibilityRows = signal<CompatibilityDraftRow[]>([]);
  readonly showQuickVehicleCreator = signal<boolean>(false);
  stagedUploadBundle: StagedUploadBundle = { files: [], primaryIndex: null };

  // Smart Part & Brand Autocomplete State
  partAutocompleteQuery = '';
  readonly partAutocompleteResults = signal<PartAutocompleteSuggestion[]>([]);
  readonly loadingPartSuggestions = signal<boolean>(false);
  readonly showPartSuggestionsDropdown = signal<boolean>(false);
  private partAutocompleteTimer: ReturnType<typeof setTimeout> | null = null;

  readonly brandSuggestions = signal<string[]>([]);
  readonly showBrandDropdown = signal<boolean>(false);
  private brandAutocompleteTimer: ReturnType<typeof setTimeout> | null = null;

  // 1-Click Vehicle Makes & Models API Importer State
  readonly apiVehicleMakes = signal<string[]>([]);
  readonly selectedApiMake = signal<string>('Toyota');
  readonly apiVehicleModels = signal<VehicleModelSuggestion[]>([]);
  readonly loadingApiModels = signal<boolean>(false);
  readonly importingModelName = signal<string>('');
  customQuickMake = '';
  customQuickModel = '';

  readonly isUniversalPart = signal<boolean>(false);
  readonly showAdvancedTechFitment = signal<boolean>(false);

  // SAE Viscosity State (Aceites, Lubricantes y Filtros)
  readonly commonSaEViscosities = ['0W-20', '5W-30', '5W-40', '10W-30', '10W-40', '15W-40', '20W-50', '75W-90', '80W-90'];
  readonly selectedSaEViscosity = signal<string | null>(null);

  partForm: PartUpsertRequest = this.emptyPartForm();
  compDraftMakeId: number | null = null;
  compDraftModelId: number | null = null;
  compDraftYearStart = 1998;
  compDraftYearEnd = 2026;
  compDraftEngine = '';

  // Branches State
  readonly branches = signal<Branch[]>([]);
  selectedBranchId = 1;
  branchDraft: Branch | null = null;
  readonly savingBranch = signal<boolean>(false);

  // Global Orders State
  readonly globalOrders = signal<Order[]>([]);
  readonly orderStatusFilter = signal<'ALL' | 'PENDING' | 'EN_RUTA' | 'ENTREGADO'>('ALL');
  orderSearchQuery = '';

  readonly pendingDispatchOrdersCount = computed(() =>
    this.globalOrders().filter(
      (o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO' && o.status !== 'EN_RUTA'
    ).length
  );

  filteredGlobalOrders(): Order[] {
    const statusFilter = this.orderStatusFilter();
    const q = this.orderSearchQuery.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return this.globalOrders().filter((o) => {
      if (statusFilter === 'PENDING') {
        if (o.status === 'ENTREGADO' || o.status === 'CANCELADO' || o.status === 'EN_RUTA') {
          return false;
        }
      } else if (statusFilter === 'EN_RUTA') {
        if (o.status !== 'EN_RUTA') return false;
      } else if (statusFilter === 'ENTREGADO') {
        if (o.status !== 'ENTREGADO') return false;
      }
      if (!q) return true;
      const haystack = `${o.orderNumber} ${o.recipientName || ''} ${o.customerName || ''} ${o.customerTaxId || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return haystack.includes(q);
    });
  }

  readonly computedHourlySales = computed<SalesTimelinePoint[]>(() => {
    const orders = this.globalOrders();
    const hours = [
      { h: 8, label: '08:00' },
      { h: 9, label: '09:00' },
      { h: 10, label: '10:00' },
      { h: 11, label: '11:00' },
      { h: 12, label: '12:00' },
      { h: 13, label: '13:00' },
      { h: 14, label: '14:00' },
      { h: 15, label: '15:00' },
      { h: 16, label: '16:00' },
      { h: 17, label: '17:00' },
      { h: 18, label: '18:00' },
      { h: 19, label: '19:00' },
      { h: 20, label: '20:00' },
    ];

    const map = new Map<number, { sales: number; profit: number; count: number; units: number }>();
    hours.forEach(({ h }) => map.set(h, { sales: 0, profit: 0, count: 0, units: 0 }));

    for (const ord of orders) {
      if (ord.status === 'CANCELADO') continue;
      const d = new Date(ord.createdAt);
      let h = d.getHours();
      if (h < 8) h = 8;
      if (h > 20) h = 20;

      const existing = map.get(h) || { sales: 0, profit: 0, count: 0, units: 0 };
      const total = ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0;
      existing.sales += total;
      existing.count += 1;

      let profit = 0;
      let units = 0;
      if (ord.items && ord.items.length > 0) {
        for (const it of ord.items) {
          const qty = it.quantity || 1;
          units += qty;
          const saleP = it.unitPrice || 0;
          const costP = Number((saleP * 0.65).toFixed(2));
          profit += (saleP - costP) * qty;
        }
      } else {
        units += 1;
        profit += total * 0.35;
      }
      existing.profit += profit;
      existing.units += units;
      map.set(h, existing);
    }

    return hours.map(({ h, label }) => {
      const data = map.get(h)!;
      return {
        periodKey: `hour-${h}`,
        label,
        subLabel: `${label} - ${h + 1 < 10 ? '0' + (h + 1) : h + 1}:00`,
        totalSales: Number(data.sales.toFixed(2)),
        grossProfit: Number(data.profit.toFixed(2)),
        ordersCount: data.count,
        unitsSold: data.units,
      };
    });
  });

  readonly computedWeekdaySales = computed<SalesTimelinePoint[]>(() => {
    const weekdayData = this.dashboard()?.weekdaySales;
    const daysInfo = [
      { dow: 1, name: 'Lunes' },
      { dow: 2, name: 'Martes' },
      { dow: 3, name: 'Miércoles' },
      { dow: 4, name: 'Jueves' },
      { dow: 5, name: 'Viernes' },
      { dow: 6, name: 'Sábado' },
      { dow: 7, name: 'Domingo' },
    ];

    if (weekdayData && weekdayData.length > 0) {
      return daysInfo.map(({ dow, name }) => {
        const found = weekdayData.find((w) => w.dayOfWeek === dow);
        const sales = found ? Number(found.totalAmount) : 0;
        const count = found ? found.ordersCount : 0;
        const share = found ? found.sharePercent : 0;
        return {
          periodKey: `weekday-${dow}`,
          label: name,
          subLabel: `${share}% facturación`,
          totalSales: sales,
          grossProfit: Number((sales * 0.35).toFixed(2)),
          ordersCount: count,
          unitsSold: count * 2,
        };
      });
    }

    const orders = this.globalOrders();
    const map = new Map<number, { sales: number; count: number; profit: number; units: number }>();
    daysInfo.forEach(({ dow }) => map.set(dow, { sales: 0, count: 0, profit: 0, units: 0 }));

    for (const ord of orders) {
      if (ord.status === 'CANCELADO') continue;
      const d = new Date(ord.createdAt);
      let dow = d.getDay();
      dow = dow === 0 ? 7 : dow;
      const total = ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0;
      const existing = map.get(dow) || { sales: 0, count: 0, profit: 0, units: 0 };
      existing.sales += total;
      existing.count += 1;
      existing.profit += total * 0.35;
      existing.units += 2;
      map.set(dow, existing);
    }

    return daysInfo.map(({ dow, name }) => {
      const data = map.get(dow)!;
      return {
        periodKey: `weekday-${dow}`,
        label: name,
        subLabel: `${name}`,
        totalSales: Number(data.sales.toFixed(2)),
        grossProfit: Number(data.profit.toFixed(2)),
        ordersCount: data.count,
        unitsSold: data.units,
      };
    });
  });

  // Motorizados & Dispatch
  readonly drivers = signal<DriverSummary[]>([]);
  readonly loadingDrivers = signal<boolean>(false);
  readonly selectedOrderForDispatch = signal<Order | null>(null);
  readonly selectedDriverId = signal<number | null>(null);
  readonly isAssigningDriver = signal<boolean>(false);
  readonly driverAssignError = signal<string>('');

  // Email Notifications & Outbox State
  mailConfigForm: MailConfigUpdateRequest = {
    enabled: false,
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    username: 'luisoscarperez322@gmail.com',
    password: '',
    fromName: 'Repuestos Asunción',
    adminNotificationEmail: 'luisoscarperez322@gmail.com',
  };
  readonly hasSavedMailPassword = signal<boolean>(true);
  readonly showSmtpPassword = signal<boolean>(false);
  readonly savingMailConfig = signal<boolean>(false);
  readonly sendingTestMail = signal<boolean>(false);
  testRecipientEmail = 'luisoscarperez322@gmail.com';

  readonly notificationLogs = signal<NotificationLogItem[]>([]);
  readonly loadingNotificationLogs = signal<boolean>(false);
  readonly previewingLog = signal<NotificationLogItem | null>(null);
  readonly safeEmailPreviewHtml = signal<string>('');
  private mailConfigLoaded = false;

  filteredAdminParts(): Part[] {
    const q = this.partSearchTerm.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const list = this.adminParts();
    if (!q) return list;
    const tokens = q.split(/\s+/).filter(Boolean);
    return list.filter((p) => {
      const haystack = `${p.name} ${p.sku || ''} ${p.oemCode || ''} ${p.manufacturerBrand || ''} ${p.categoryName || ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      return tokens.every((t) => haystack.includes(t));
    });
  }

  ngOnInit(): void {
    this.loadAnalytics(30);
    this.loadReferenceCatalogs();
    this.loadAdminParts();
    this.loadBranches();
    this.loadStorePaymentMethods();
    this.initOrderMonitor();
    this.loadGlobalOrders();

    // Deep-link routing via query parameters (e.g. from Notifications or direct 1-click links)
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'parts') {
        if (params['lowStock'] === 'true') {
          this.lowStockOnlyFilter = true;
        }
        this.activeTab.set('parts');
        this.loadAdminParts();
      } else if (params['tab']) {
        this.switchTab(params['tab'] as AdminTab);
      }
    });
  }

  switchTab(tab: AdminTab): void {
    if ((tab === 'branches' || tab === 'notifications' || tab === 'payments' || tab === 'users') && !this.auth.hasAnyRole(['ADMIN'])) {
      this.activeTab.set('analytics');
      return;
    }
    this.activeTab.set(tab);
    if (tab === 'orders') {
      this.loadGlobalOrders();
      this.loadDrivers();
    }
    if (tab === 'parts' && this.adminParts().length === 0) {
      this.loadAdminParts();
    }
    if (tab === 'notifications' && this.auth.hasAnyRole(['ADMIN'])) {
      if (!this.mailConfigLoaded) {
        this.loadMailConfiguration();
      }
      this.loadNotificationLogs();
    }
    if (tab === 'payments' && this.auth.hasAnyRole(['ADMIN'])) {
      this.loadPaymentConfig();
      this.refreshPaymentTransactions();
    }
    if (tab === 'users' && this.auth.hasAnyRole(['ADMIN'])) {
      this.loadStaffUsers();
    }
    if (tab === 'claims') {
      this.complaintsService.loadComplaints();
    }
  }

  openLowStockParts(): void {
    this.lowStockOnlyFilter = true;
    this.activeTab.set('parts');
    this.loadAdminParts();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: 'parts', lowStock: 'true' },
      queryParamsHandling: 'merge',
    });
  }

  formatRole(role: string | null): string {
    if (!role) return 'Usuario';
    const labels: Record<string, string> = {
      ADMIN: 'Administrador',
      VENDEDOR: 'Asesor de ventas',
      SALES: 'Asesor de ventas',
      MOTORIZADO: 'Reparto',
      DELIVERY: 'Reparto',
      CLIENTE: 'Cliente',
      CUSTOMER: 'Cliente',
    };
    return labels[role] || role;
  }

  formatDeliveryType(type?: string): string {
    if (type === 'PICKUP') return 'Recojo en tienda';
    if (type === 'DELIVERY') return 'Envío a domicilio';
    return type || 'Envío estándar';
  }

  formatOrderStatus(status?: string): string {
    const labels: Record<string, string> = {
      RESERVADO: 'Stock reservado',
      PENDING: 'Pendiente',
      PENDIENTE: 'Pendiente',
      CONFIRMED: 'Confirmado',
      CONFIRMADO: 'Confirmado',
      PICKING: 'En preparación',
      EN_PREPARACION: 'En preparación',
      READY_FOR_DISPATCH: 'Listo para despacho',
      LISTO_PARA_DESPACHO: 'Listo para despacho',
      OUT_FOR_DELIVERY: 'En reparto',
      EN_RUTA: 'En reparto',
      DELIVERED: 'Entregado',
      ENTREGADO: 'Entregado',
      CANCELLED: 'Cancelado',
      CANCELADO: 'Cancelado',
    };
    return status ? labels[status] || status : 'Registrado';
  }

  statusBadgeClass(status?: string): string {
    switch (status) {
      case 'RESERVADO':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'DELIVERED':
      case 'ENTREGADO':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'PICKING':
      case 'EN_PREPARACION':
      case 'READY_FOR_DISPATCH':
      case 'LISTO_PARA_DESPACHO':
      case 'OUT_FOR_DELIVERY':
      case 'EN_RUTA':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'CANCELLED':
      case 'CANCELADO':
        return 'border-red-200 bg-red-50 text-red-700';
      default:
        return 'border-gray-200 bg-gray-100 text-gray-700';
    }
  }

  // ===================== ANALYTICS =====================

  loadAnalytics(days: number): void {
    this.analyticsDays.set(days);
    if (!this.dashboard()) {
      this.loadingAnalytics.set(true);
    }
    this.analyticsService
      .getExecutiveDashboard(days)
      .pipe(
        retry({ count: 3, delay: 2500 }),
        finalize(() => this.loadingAnalytics.set(false))
      )
      .subscribe({
        next: (res) => this.dashboard.set(res),
        error: () => {
          if (!this.dashboard()) {
            this.dashboard.set({
              kpis: {},
              salespersonRanking: [],
              highRotationParts: [],
              lowRotationParts: [],
              salesByCategory: [],
            });
          }
        },
      });
  }

  quotaPercent(sp: SalespersonMetric): number {
    const direct =
      sp.quotaAchievementPercent ?? sp.quotaProgressPercent ?? sp.goalCompletionPercent;
    if (typeof direct === 'number') return direct;
    const sales = sp.totalSalesVolume ?? sp.totalSales ?? sp.totalRevenue ?? 0;
    const quota = sp.monthlyQuota ?? sp.salesQuota ?? sp.quotaAmount ?? 15000;
    return quota > 0 ? (sales / quota) * 100 : 0;
  }

  categoryPercent(cat: CategorySalesMetric, all: CategorySalesMetric[]): number {
    if (typeof cat.sharePercent === 'number') return cat.sharePercent;
    if (typeof cat.percentage === 'number') return cat.percentage;
    const maxRev = Math.max(
      ...all.map((c) => c.totalAmount ?? c.totalRevenue ?? c.revenue ?? 0),
      1
    );
    return ((cat.totalAmount ?? cat.totalRevenue ?? cat.revenue ?? 0) / maxRev) * 100;
  }

  inspectPartInInventory(sku: string): void {
    this.partSearchTerm = sku;
    this.lowStockOnlyFilter = false;
    this.activeTab.set('parts');
    this.loadAdminParts();
  }

  maxRotationUnits(items: any[]): number {
    if (!items || items.length === 0) return 1;
    return Math.max(...items.map((i) => i.unitsSold ?? i.totalUnitsSold ?? 0), 1);
  }

  // ===================== PARTS, AUTOCOMPLETE & VEHICLE IMPORTER =====================

  private loadReferenceCatalogs(): void {
    this.catalogService.getCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        if (cats.length > 0 && !this.partForm.categoryId) {
          this.partForm.categoryId = cats[0].id;
        }
      },
      error: () => {},
    });

    this.refreshSavedVehicleMakes();
  }

  private refreshSavedVehicleMakes(preferredMakeId?: number): void {
    this.catalogService.getVehicleMakes().subscribe({
      next: (mks) => {
        this.makes.set(mks);
        if (preferredMakeId) {
          this.compDraftMakeId = preferredMakeId;
          this.onCompMakeChange();
        }
      },
      error: () => {},
    });
  }

  loadAdminParts(): void {
    if (this.adminParts().length === 0 && !this.lowStockOnlyFilter && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('asuncion_catalog_snapshot_v7');
        if (raw) {
          const parsed = JSON.parse(raw) as { parts?: Part[] };
          if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
            this.adminParts.set(parsed.parts);
          }
        }
      } catch {
        // Ignore storage error
      }
    }

    this.catalogService
      .getAdminParts(this.lowStockOnlyFilter)
      .pipe(retry({ count: 3, delay: 2500 }))
      .subscribe({
        next: (list) => this.adminParts.set(list),
        error: () => {
          if (this.adminParts().length === 0) {
            this.adminParts.set([]);
          }
        },
      });
  }

  resolvePartImg(part: Part): string {
    return this.apiConfig.resolvePartPrimaryImage(part);
  }

  onAdminPartImgError(event: Event, part: Part): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const fallback = this.apiConfig.getCategoryFallback(part.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }

  openCreatePartModal(): void {
    this.editingPart.set(null);
    this.partForm = this.emptyPartForm();
    if (this.categories().length > 0) {
      this.partForm.categoryId = this.categories()[0].id;
    }
    this.partAutocompleteQuery = '';
    this.partAutocompleteResults.set([]);
    this.showPartSuggestionsDropdown.set(false);
    this.showOptionalCodes.set(false);
    this.showQuickVehicleCreator.set(false);
    this.isUniversalPart.set(false);
    this.showAdvancedTechFitment.set(false);
    this.compatibilityRows.set([]);
    this.stagedUploadBundle = { files: [], primaryIndex: null };
    this.preloadBrandSuggestions('');
    this.selectedSaEViscosity.set(null);

    // Default to clean state: no pre-selected vehicle
    this.compDraftMakeId = null;
    this.compDraftModelId = null;
    this.compDraftYearStart = 1998;
    this.compDraftYearEnd = 2026;
    this.compDraftEngine = '';
    this.compModels.set([]);

    this.showPartModal.set(true);
  }

  openEditPartModal(part: Part): void {
    this.editingPart.set(part);
    this.partForm = {
      sku: part.sku || '',
      oemCode: part.oemCode || '',
      name: part.name,
      technicalDescription: part.technicalDescription || '',
      manufacturerBrand: part.manufacturerBrand || '',
      categoryId: part.categoryId,
      purchasePrice: part.purchasePrice ?? Number((part.salePrice * 0.65).toFixed(2)),
      salePrice: part.salePrice,
      wholesalePrice: part.wholesalePrice ?? null,
      stockQuantity: part.stockQuantity,
      minStockLevel: part.minStockLevel ?? 5,
      active: part.active ?? true,
      compatibilities: [],
    };
    this.partAutocompleteQuery = '';
    this.partAutocompleteResults.set([]);
    this.showPartSuggestionsDropdown.set(false);
    this.showOptionalCodes.set(Boolean(part.oemCode));
    this.showQuickVehicleCreator.set(false);

    // Detect SAE Viscosity from name or specs
    const text = `${part.name} ${part.technicalDescription || ''}`;
    const vMatch = text.match(/\b(0W-20|5W-20|5W-30|5W-40|10W-30|10W-40|15W-40|20W-50|75W-90|80W-90|0W20|5W30|5W40|10W30|10W40|15W40|20W50)\b/i);
    if (vMatch) {
      let raw = vMatch[1].toUpperCase();
      if (!raw.includes('-')) raw = raw.replace(/(\d{1,2}W)(\d{2})/, '$1-$2');
      this.selectedSaEViscosity.set(raw);
    } else {
      this.selectedSaEViscosity.set(null);
    }
    const isUni =
      (part.technicalDescription || '').toLowerCase().includes('universal') ||
      (part.name || '').toLowerCase().includes('universal') ||
      !part.compatibilities ||
      part.compatibilities.length === 0;
    this.isUniversalPart.set(isUni);
    this.showAdvancedTechFitment.set(false);
    this.compatibilityRows.set(
      (part.compatibilities || []).map((c) => ({
        modelId: c.modelId,
        yearStart: c.yearStart,
        yearEnd: c.yearEnd,
        engineSpec: c.engineSpec || '',
        notes: c.notes || '',
        makeNameLabel: c.makeName,
        modelNameLabel: c.modelName,
      }))
    );
    this.stagedUploadBundle = { files: [], primaryIndex: null };
    this.preloadBrandSuggestions('');
    this.showPartModal.set(true);
  }

  closePartModal(): void {
    this.showPartModal.set(false);
  }

  // ---- Smart Spare Part Autocomplete ----

  onPartAutocompleteFocus(): void {
    if (this.partAutocompleteResults().length > 0) {
      this.showPartSuggestionsDropdown.set(true);
      return;
    }
    this.fetchPartSuggestions(this.partAutocompleteQuery);
  }

  onPartAutocompleteInput(value: string): void {
    if (this.partAutocompleteTimer) {
      clearTimeout(this.partAutocompleteTimer);
    }
    this.partAutocompleteTimer = setTimeout(() => {
      this.fetchPartSuggestions(value || '');
    }, 200);
  }

  private fetchPartSuggestions(query: string): void {
    this.loadingPartSuggestions.set(true);
    this.catalogService
      .autocompleteParts(query)
      .pipe(finalize(() => this.loadingPartSuggestions.set(false)))
      .subscribe({
        next: (list) => {
          this.partAutocompleteResults.set(list || []);
          this.showPartSuggestionsDropdown.set((list || []).length > 0);
        },
        error: () => {
          this.partAutocompleteResults.set([]);
          this.showPartSuggestionsDropdown.set(false);
        },
      });
  }

  hidePartAutocompleteDelayed(): void {
    setTimeout(() => this.showPartSuggestionsDropdown.set(false), 180);
  }

  applyPartAutocompleteSuggestion(sug: PartAutocompleteSuggestion): void {
    this.partForm.name = sug.name;
    this.partForm.manufacturerBrand = sug.manufacturerBrand || this.partForm.manufacturerBrand;
    this.partForm.technicalDescription = sug.technicalDescription || '';
    if (typeof sug.suggestedPurchasePrice === 'number') {
      this.partForm.purchasePrice = sug.suggestedPurchasePrice;
    }
    if (typeof sug.suggestedSalePrice === 'number') {
      this.partForm.salePrice = sug.suggestedSalePrice;
    }
    if (typeof sug.suggestedWholesalePrice === 'number') {
      this.partForm.wholesalePrice = sug.suggestedWholesalePrice;
    }
    this.partForm.oemCode = sug.oemCode || '';

    if (sug.categoryCode) {
      const targetCode = sug.categoryCode.trim().toUpperCase();
      const matchedCat = this.categories().find(
        (c) =>
          (c.code || '').toUpperCase() === targetCode ||
          c.name.toUpperCase().includes(targetCode)
      );
      if (matchedCat) {
        this.partForm.categoryId = matchedCat.id;
      }
    }

    this.partAutocompleteQuery = sug.name;
    this.showPartSuggestionsDropdown.set(false);
    this.toast.info(
      'Datos autocompletados',
      `Se cargaron los datos sugeridos para ${sug.name}.`
    );
  }

  // ---- Brand Autocomplete ----

  private preloadBrandSuggestions(query: string): void {
    this.catalogService.autocompleteBrands(query).subscribe({
      next: (brands) => this.brandSuggestions.set(brands || []),
      error: () => {},
    });
  }

  onBrandFocus(): void {
    this.preloadBrandSuggestions(this.partForm.manufacturerBrand || '');
    this.showBrandDropdown.set(true);
  }

  onBrandInput(value: string): void {
    if (this.brandAutocompleteTimer) {
      clearTimeout(this.brandAutocompleteTimer);
    }
    this.brandAutocompleteTimer = setTimeout(() => {
      this.catalogService.autocompleteBrands(value || '').subscribe({
        next: (brands) => {
          this.brandSuggestions.set(brands || []);
          this.showBrandDropdown.set((brands || []).length > 0);
        },
        error: () => {},
      });
    }, 180);
  }

  selectBrandSuggestion(brand: string): void {
    this.partForm.manufacturerBrand = brand;
    this.showBrandDropdown.set(false);
  }

  hideBrandDropdownDelayed(): void {
    setTimeout(() => this.showBrandDropdown.set(false), 160);
  }

  // ---- 1-Click Vehicle Makes & Models API Importer ----

  toggleQuickVehicleImporter(): void {
    const next = !this.showQuickVehicleCreator();
    this.showQuickVehicleCreator.set(next);
    if (next && this.apiVehicleMakes().length === 0) {
      this.catalogService.autocompleteVehicleMakes().subscribe({
        next: (makesList) => {
          const list = makesList && makesList.length > 0
            ? makesList
            : ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'Hino', 'Volvo', 'Scania', 'Isuzu', 'Freightliner', 'Chevrolet', 'Suzuki', 'Volkswagen', 'Mitsubishi'];
          this.apiVehicleMakes.set(list);
          this.selectApiMakeForImport(list[0]);
        },
        error: () => {
          const fallback = ['Toyota', 'Hyundai', 'Kia', 'Nissan', 'Hino', 'Volvo', 'Scania', 'Isuzu', 'Freightliner', 'Chevrolet', 'Suzuki'];
          this.apiVehicleMakes.set(fallback);
          this.selectApiMakeForImport(fallback[0]);
        },
      });
    } else if (next && this.apiVehicleModels().length === 0 && this.selectedApiMake()) {
      this.selectApiMakeForImport(this.selectedApiMake());
    }
  }

  selectApiMakeForImport(makeName: string): void {
    if (!makeName) return;
    this.selectedApiMake.set(makeName);
    this.customQuickMake = makeName;
    this.loadingApiModels.set(true);
    this.catalogService
      .autocompleteVehicleModels(makeName)
      .pipe(finalize(() => this.loadingApiModels.set(false)))
      .subscribe({
        next: (models) => this.apiVehicleModels.set(models || []),
        error: () => this.apiVehicleModels.set([]),
      });
  }

  isModelAlreadyLinked(makeName: string, modelName: string): boolean {
    const mkLower = (makeName || '').trim().toLowerCase();
    const mdLower = (modelName || '').trim().toLowerCase();
    return this.compatibilityRows().some(
      (r) =>
        (r.makeNameLabel || '').trim().toLowerCase() === mkLower &&
        (r.modelNameLabel || '').trim().toLowerCase() === mdLower
    );
  }

  quickImportSingleModelChip(mdl: VehicleModelSuggestion): void {
    const makeName = this.selectedApiMake().trim();
    if (!makeName || !mdl.name) return;

    this.importingModelName.set(mdl.name);
    this.catalogService
      .quickImportVehicles({
        makeName,
        models: [{ name: mdl.name, vehicleType: mdl.vehicleType || 'Automóvil' }],
      })
      .pipe(finalize(() => this.importingModelName.set('')))
      .subscribe({
        next: (importedModels) => {
          this.linkImportedVehicleModels(makeName, importedModels);
        },
        error: (err) => {
          this.toast.error(
            'No se pudo importar el modelo',
            err?.error?.message || 'Inténtalo nuevamente.'
          );
        },
      });
  }

  quickImportCustomMakeModel(): void {
    const makeName = (this.customQuickMake || this.selectedApiMake() || '').trim();
    const modelName = this.customQuickModel.trim();
    if (!makeName || !modelName) return;

    this.importingModelName.set('__custom__');
    this.catalogService
      .quickImportVehicles({
        makeName,
        models: [{ name: modelName, vehicleType: 'Automóvil / Camioneta' }],
      })
      .pipe(finalize(() => this.importingModelName.set('')))
      .subscribe({
        next: (importedModels) => {
          this.customQuickModel = '';
          this.linkImportedVehicleModels(makeName, importedModels);
        },
        error: (err) => {
          this.toast.error(
            'No se pudo registrar el vehículo',
            err?.error?.message || 'Verifica los datos ingresados.'
          );
        },
      });
  }

  private linkImportedVehicleModels(fallbackMakeName: string, importedModels: VehicleModel[]): void {
    if (!importedModels || importedModels.length === 0) return;
    let addedCount = 0;

    this.compatibilityRows.update((rows) => {
      const next = [...rows];
      for (const vm of importedModels) {
        if (!next.some((r) => r.modelId === vm.id)) {
          next.push({
            modelId: vm.id,
            yearStart: this.compDraftYearStart,
            yearEnd: this.compDraftYearEnd,
            engineSpec: this.compDraftEngine.trim(),
            notes: '',
            makeNameLabel: vm.makeName || fallbackMakeName,
            modelNameLabel: vm.name,
          });
          addedCount++;
        }
      }
      return next;
    });

    const firstMakeId = importedModels[0]?.makeId;
    this.refreshSavedVehicleMakes(firstMakeId);

    if (addedCount > 0) {
      const names = importedModels.map((m) => `${m.makeName || fallbackMakeName} ${m.name}`).join(', ');
      this.toast.success('Vehículo vinculado', `${names} agregado a las compatibilidades.`);
    }
  }

  onCompMakeChange(): void {
    if (!this.compDraftMakeId) return;
    this.catalogService.getVehicleModels(this.compDraftMakeId).subscribe({
      next: (models) => {
        this.compModels.set(models);
        this.compDraftModelId = models[0]?.id ?? null;
      },
      error: () => this.compModels.set([]),
    });
  }

  addCompatibilityRow(): void {
    if (!this.compDraftModelId) return;
    const makeObj = this.makes().find((m) => m.id === Number(this.compDraftMakeId));
    const modelObj = this.compModels().find((m) => m.id === Number(this.compDraftModelId));

    if (this.isIgnitionPart() && this.isDieselTruckMake(makeObj?.name || '')) {
      this.toast.error(
        'Incompatibilidad mecánica crítica',
        `Los camiones pesados ${makeObj?.name} cuentan con motores diésel de encendido por compresión. NO utilizan bobinas de encendido ni bujías a gasolina. No es posible vincular este repuesto.`
      );
      return;
    }

    this.compatibilityRows.update((rows) => [
      ...rows,
      {
        modelId: Number(this.compDraftModelId),
        yearStart: this.compDraftYearStart,
        yearEnd: this.compDraftYearEnd,
        engineSpec: this.compDraftEngine.trim(),
        notes: '',
        makeNameLabel: makeObj?.name,
        modelNameLabel: modelObj?.name,
      },
    ]);
    this.compDraftEngine = '';
  }

  removeCompatibilityRow(index: number): void {
    this.compatibilityRows.update((rows) => rows.filter((_, idx) => idx !== index));
  }

  setUniversalCompatibility(): void {
    const nextVal = !this.isUniversalPart();
    this.isUniversalPart.set(nextVal);
    if (nextVal) {
      if (!this.partForm.technicalDescription.toLowerCase().includes('universal')) {
        const prefix = 'Aplicación universal: Repuesto estándar multimarca (Apto para cualquier vehículo / 12V / 24V).\n';
        this.partForm.technicalDescription = prefix + (this.partForm.technicalDescription || '');
      }
      this.toast.success(
        'Repuesto Universal Activado',
        'Este repuesto aparecerá en el catálogo para cualquier vehículo buscado.'
      );
    } else {
      this.toast.info('Modo universal desactivado', 'Ahora puedes seleccionar marcas específicas.');
    }
  }

  // ---- SAE Viscosity Actions (Aceites, Lubricantes y Filtros) ----

  toggleSaEViscosity(v: string): void {
    if (this.selectedSaEViscosity() === v) {
      this.selectedSaEViscosity.set(null);
      return;
    }
    this.selectedSaEViscosity.set(v);

    const upperName = this.partForm.name.toUpperCase();
    if (!upperName.includes(v.toUpperCase()) && !upperName.includes(v.replace('-', ''))) {
      this.partForm.name = `${this.partForm.name.trim()} ${v}`.trim();
    }

    const specLine = `Viscosidad SAE: ${v}`;
    if (!this.partForm.technicalDescription.toUpperCase().includes(v.toUpperCase())) {
      this.partForm.technicalDescription = this.partForm.technicalDescription
        ? `${this.partForm.technicalDescription}\n${specLine}`
        : specLine;
    }

    if (['0W-20', '5W-30', '5W-40', '10W-30', '10W-40', '20W-50', '75W-90', '80W-90'].includes(v)) {
      this.isUniversalPart.set(true);
      this.toast.info('Viscosidad Asignada', `Se configuró el grado ${v} y se marcó como repuesto universal multimarca.`);
    } else {
      this.toast.info('Viscosidad Asignada', `Se configuró el grado ${v} en la ficha técnica.`);
    }
  }

  clearSaEViscosity(): void {
    this.selectedSaEViscosity.set(null);
    this.partForm.technicalDescription = (this.partForm.technicalDescription || '')
      .replace(/Viscosidad SAE:[^\n]*\n?/gi, '')
      .trim();
  }

  shouldShowViscositySelector(): boolean {
    const cat = this.categories().find((c) => c.id === Number(this.partForm.categoryId));
    if (cat) {
      const catText = `${cat.name} ${cat.code || ''}`.toLowerCase();
      if (
        catText.includes('aceite') ||
        catText.includes('lubricante') ||
        catText.includes('filtro') ||
        catText.includes('filter')
      ) {
        return true;
      }
    }

    const nameText = (this.partForm.name || '').toLowerCase();
    return (
      nameText.includes('aceite') ||
      nameText.includes('lubricante') ||
      nameText.includes('filtro') ||
      nameText.includes('filter')
    );
  }

  onCategoryChange(): void {
    if (!this.shouldShowViscositySelector()) {
      this.selectedSaEViscosity.set(null);
      this.partForm.technicalDescription = (this.partForm.technicalDescription || '')
        .replace(/Viscosidad SAE:[^\n]*\n?/gi, '')
        .trim();
    }
    this.autoApplyMechanicalFitment(false);
  }

  onPartNameChange(val?: string): void {
    if (val !== undefined) {
      this.partForm.name = val;
    }
    if (!this.shouldShowViscositySelector()) {
      this.selectedSaEViscosity.set(null);
      this.partForm.technicalDescription = (this.partForm.technicalDescription || '')
        .replace(/Viscosidad SAE:[^\n]*\n?/gi, '')
        .trim();
    }
    this.autoApplyMechanicalFitment(false);
  }

  getStagedFileNames(): string {
    return this.stagedUploadBundle?.files?.map((f) => f.name).join(' ') || '';
  }

  isIgnitionPart(): boolean {
    const staged = this.getStagedFileNames();
    const text = `${this.partForm.name} ${this.partForm.technicalDescription || ''} ${this.editingPart()?.name || ''} ${staged}`.toLowerCase();
    return [
      'bobina',
      'ignition coil',
      'ignitioncoil',
      'directignition',
      'bujia',
      'bujía',
      'spark plug',
      'sparkplug',
      'delco',
      'cables de bujia',
      'cables bujia',
      'distribuidor',
      'rotor encendido',
    ].some((t) => text.includes(t));
  }

  isDieselTruckMake(makeName: string): boolean {
    if (!makeName) return false;
    const n = makeName.toLowerCase();
    return n.includes('scania') || n.includes('volvo') || n.includes('hino') || n.includes('isuzu');
  }

  isSelectedMakeIncompatibleWithIgnition(): boolean {
    if (!this.isIgnitionPart()) return false;
    const makeObj = this.makes().find((m) => m.id === Number(this.compDraftMakeId));
    return this.isDieselTruckMake(makeObj?.name || '');
  }

  getSelectedMakeName(): string {
    const makeObj = this.makes().find((m) => m.id === Number(this.compDraftMakeId));
    return makeObj?.name || 'este camión pesado';
  }

  isDieselPart(): boolean {
    const text = `${this.partForm.name} ${this.partForm.technicalDescription || ''}`.toLowerCase();
    return [
      'diesel',
      'diésel',
      'petroleo',
      'petróleo',
      'common rail',
      'trampa de agua',
      'separador agua',
      'filtro racor',
      'bujia precalentamiento',
      'calentador',
      'bomba lineal',
    ].some((t) => text.includes(t));
  }

  setMakeSelectorByName(makeName: string): void {
    const found = this.makes().find((m) => m.name.toLowerCase() === makeName.toLowerCase());
    if (found) {
      this.compDraftMakeId = found.id;
      this.onCompMakeChange();
    }
  }

  linkSingleVehicle(makeName: string, modelName: string, vehicleType = 'Automóvil'): void {
    this.catalogService
      .quickImportVehicles({
        makeName,
        models: [{ name: modelName, vehicleType }],
      })
      .subscribe({
        next: (models) => {
          this.linkImportedVehicleModels(makeName, models);
          this.toast.success(
            'Compatibilidad Verificada',
            `Se vinculó ${makeName} ${modelName} (${vehicleType}).`
          );
        },
        error: () => {
          this.toast.error('Error', `No se pudo vincular ${makeName} ${modelName}`);
        },
      });
  }

  addCommonCarsPack(): void {
    if (this.isDieselPart()) {
      this.toast.error(
        'Incompatibilidad mecánica',
        'Este repuesto diésel/pesado no aplica a autos sedanes ligeros a gasolina.'
      );
      return;
    }

    this.isUniversalPart.set(false);
    this.catalogService
      .quickImportVehicles({
        makeName: 'Toyota',
        models: [
          { name: 'Yaris', vehicleType: 'Automóvil' },
          { name: 'Hilux', vehicleType: 'Camioneta Pickup' },
        ],
      })
      .subscribe({
        next: (m1) => this.linkImportedVehicleModels('Toyota', m1),
      });

    this.catalogService
      .quickImportVehicles({
        makeName: 'Hyundai',
        models: [{ name: 'Accent', vehicleType: 'Automóvil' }],
      })
      .subscribe({
        next: (m2) => this.linkImportedVehicleModels('Hyundai', m2),
      });

    this.catalogService
      .quickImportVehicles({
        makeName: 'Kia',
        models: [{ name: 'Rio', vehicleType: 'Automóvil' }],
      })
      .subscribe({
        next: (m3) => this.linkImportedVehicleModels('Kia', m3),
      });

    this.toast.success(
      'Pack Autos Populares Agregado',
      'Toyota Yaris, Hilux, Hyundai Accent y Kia Rio vinculados.'
    );
  }

  addHeavyTrucksPack(): void {
    if (this.isIgnitionPart()) {
      this.toast.error(
        'Incompatibilidad mecánica',
        'Una bobina de encendido o bujía a gasolina NO aplica a camiones diésel pesados (Scania, Volvo, Hino).'
      );
      return;
    }

    this.isUniversalPart.set(false);
    this.catalogService
      .quickImportVehicles({
        makeName: 'Hino',
        models: [{ name: 'Dutro 300/500', vehicleType: 'Camión de carga' }],
      })
      .subscribe({
        next: (m1) => this.linkImportedVehicleModels('Hino', m1),
      });

    this.catalogService
      .quickImportVehicles({
        makeName: 'Volvo',
        models: [{ name: 'FH 460 / 500', vehicleType: 'Tractor camión' }],
      })
      .subscribe({
        next: (m2) => this.linkImportedVehicleModels('Volvo', m2),
      });

    this.catalogService
      .quickImportVehicles({
        makeName: 'Scania',
        models: [{ name: 'R-Series Heavy', vehicleType: 'Tractor camión' }],
      })
      .subscribe({
        next: (m3) => this.linkImportedVehicleModels('Scania', m3),
      });

    this.catalogService
      .quickImportVehicles({
        makeName: 'Isuzu',
        models: [{ name: 'Forward', vehicleType: 'Camión pesado' }],
      })
      .subscribe({
        next: (m4) => this.linkImportedVehicleModels('Isuzu', m4),
      });

    this.toast.success(
      'Pack Transporte Pesado Agregado',
      'Hino Dutro, Volvo FH, Scania e Isuzu vinculados.'
    );
  }

  autoApplyMechanicalFitment(isManual = false): void {
    const name = (this.partForm.name || '').trim();
    const raw = name.toLowerCase();
    const oem = (this.partForm.oemCode || '').trim().toLowerCase();
    const fullText = `${raw} ${oem}`;

    if (raw.length < 3) {
      if (isManual) {
        this.toast.info('Nombre requerido', 'Ingresa el nombre del repuesto para analizar compatibilidad.');
      }
      return;
    }

    // 1. Repuestos universales (Fluidos, bombillas, fusibles, relés, químicos)
    const universalTerms = [
      'h4', 'h7', 'h1', 'h11', '1156', '1157', 't10', '12v', '24v',
      'foco', 'ampolleta', 'bombillo', 'fusible', 'rele', 'relé',
      'refrigerante', 'coolant', 'grasa', 'borne', 'terminal', 'silicona',
      'limpiaparabrisas', 'plumilla', 'claxon', 'bocina', 'abrazadera'
    ];

    if (universalTerms.some((t) => fullText.includes(t))) {
      this.setUniversalCompatibility();
      if (isManual) {
        this.toast.success(
          'Repuesto Universal Identificado',
          'Fluidos, fusibles, bombillas y consumibles estándar aplican a toda la flota automotriz.'
        );
      }
      return;
    }

    // 2. Aceites y lubricantes con viscosidad SAE
    const viscosityMatch = fullText.match(/\b(0w-20|5w-20|5w-30|5w-40|10w-30|10w-40|15w-40|20w-50|75w-90|80w-90|0w20|5w30|5w40|10w30|10w40|15w40|20w50)\b/i);
    if (viscosityMatch || raw.includes('aceite') || raw.includes('lubricante')) {
      const visc = viscosityMatch ? viscosityMatch[1].toUpperCase() : 'Multigrado';
      this.setUniversalCompatibility();
      if (isManual) {
        this.toast.success(
          `Lubricante ${visc} Detectado`,
          'Los lubricantes automotrices aplican como repuestos universales multimarca según su especificación SAE/API.'
        );
      }
      return;
    }

    // 3. Clasificación de sistema mecánico
    const isIgnition = this.isIgnitionPart();
    const isDiesel = this.isDieselPart();

    // 4. Reconocimiento de modelos específicos en el nombre
    // TOYOTA
    if (fullText.includes('hilux')) {
      this.linkSingleVehicle('Toyota', 'Hilux', isDiesel ? 'Pickup Diésel 1KD/2GD' : 'Pickup');
      if (isManual) this.toast.success('Toyota Hilux Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('yaris')) {
      this.linkSingleVehicle('Toyota', 'Yaris', 'Automóvil Sedán/Hatchback');
      if (isManual) this.toast.success('Toyota Yaris Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('corolla')) {
      this.linkSingleVehicle('Toyota', 'Corolla', 'Automóvil');
      if (isManual) this.toast.success('Toyota Corolla Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('rav4')) {
      this.linkSingleVehicle('Toyota', 'RAV4', 'SUV');
      if (isManual) this.toast.success('Toyota RAV4 Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('hiace')) {
      this.linkSingleVehicle('Toyota', 'Hiace', 'Minivan Comercial');
      if (isManual) this.toast.success('Toyota Hiace Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('fortuner')) {
      this.linkSingleVehicle('Toyota', 'Fortuner', 'SUV 4x4');
      if (isManual) this.toast.success('Toyota Fortuner Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }

    // NISSAN
    if (fullText.includes('sentra')) {
      this.linkSingleVehicle('Nissan', 'Sentra', 'Sedán');
      if (isManual) this.toast.success('Nissan Sentra Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('tiida')) {
      this.linkSingleVehicle('Nissan', 'Tiida', 'Sedán / Hatchback');
      if (isManual) this.toast.success('Nissan Tiida Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('frontier') || fullText.includes('navara')) {
      this.linkSingleVehicle('Nissan', 'Frontier', 'Pickup');
      if (isManual) this.toast.success('Nissan Frontier Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('versa')) {
      this.linkSingleVehicle('Nissan', 'Versa', 'Sedán');
      if (isManual) this.toast.success('Nissan Versa Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('urvan')) {
      this.linkSingleVehicle('Nissan', 'Urvan', 'Comercial');
      if (isManual) this.toast.success('Nissan Urvan Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }

    // HYUNDAI
    if (fullText.includes('accent')) {
      this.linkSingleVehicle('Hyundai', 'Accent', 'Sedán / Hatchback');
      if (isManual) this.toast.success('Hyundai Accent Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('elantra')) {
      this.linkSingleVehicle('Hyundai', 'Elantra', 'Sedán');
      if (isManual) this.toast.success('Hyundai Elantra Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('tucson')) {
      this.linkSingleVehicle('Hyundai', 'Tucson', 'SUV');
      if (isManual) this.toast.success('Hyundai Tucson Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('h1') || fullText.includes('starex')) {
      this.linkSingleVehicle('Hyundai', 'H1', 'Minivan');
      if (isManual) this.toast.success('Hyundai H1 Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('hd78') || fullText.includes('porter')) {
      this.linkSingleVehicle('Hyundai', fullText.includes('hd78') ? 'HD78' : 'Porter', 'Camión Liviano');
      if (isManual) this.toast.success('Hyundai Comercial Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }

    // KIA
    if (fullText.includes('rio')) {
      this.linkSingleVehicle('Kia', 'Rio', 'Sedán / Hatchback');
      if (isManual) this.toast.success('Kia Rio Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('cerato')) {
      this.linkSingleVehicle('Kia', 'Cerato', 'Sedán');
      if (isManual) this.toast.success('Kia Cerato Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('sportage')) {
      this.linkSingleVehicle('Kia', 'Sportage', 'SUV');
      if (isManual) this.toast.success('Kia Sportage Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('picanto')) {
      this.linkSingleVehicle('Kia', 'Picanto', 'Citycar');
      if (isManual) this.toast.success('Kia Picanto Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }

    // MITSUBISHI
    if (fullText.includes('l200')) {
      this.linkSingleVehicle('Mitsubishi', 'L200', 'Pickup 4x4');
      if (isManual) this.toast.success('Mitsubishi L200 Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }
    if (fullText.includes('canter') || fullText.includes('fuso')) {
      this.linkSingleVehicle('Mitsubishi', 'Canter Fuso', 'Camión');
      if (isManual) this.toast.success('Mitsubishi Canter Vinculado', 'Compatibilidad asignada con certeza mecánica.');
      return;
    }

    // HEAVY TRUCKS (HINO, ISUZU, VOLVO, SCANIA)
    if (!isIgnition) {
      if (fullText.includes('dutro') || fullText.includes('hino 300') || fullText.includes('hino 500')) {
        this.linkSingleVehicle('Hino', 'Dutro 300/500', 'Camión Pesado');
        if (isManual) this.toast.success('Hino Dutro Vinculado', 'Compatibilidad asignada con certeza mecánica.');
        return;
      }
      if (fullText.includes('forward') || fullText.includes('npr') || fullText.includes('nqr') || fullText.includes('isuzu')) {
        const md = fullText.includes('npr') ? 'NPR' : fullText.includes('nqr') ? 'NQR' : 'Forward';
        this.linkSingleVehicle('Isuzu', md, 'Camión Pesado');
        if (isManual) this.toast.success('Isuzu Pesado Vinculado', 'Compatibilidad asignada con certeza mecánica.');
        return;
      }
      if (fullText.includes('fh') || fullText.includes('fm') || fullText.includes('volvo')) {
        const md = fullText.includes('fm') ? 'FM Series' : 'FH Series';
        this.linkSingleVehicle('Volvo', md, 'Camión Pesado');
        if (isManual) this.toast.success('Volvo Pesado Vinculado', 'Compatibilidad asignada con certeza mecánica.');
        return;
      }
      if (fullText.includes('scania') || fullText.includes('r-series') || fullText.includes('r440') || fullText.includes('p-series')) {
        const md = fullText.includes('p-series') ? 'P-Series' : 'R-Series Heavy';
        this.linkSingleVehicle('Scania', md, 'Camión Pesado');
        if (isManual) this.toast.success('Scania Pesado Vinculado', 'Compatibilidad asignada con certeza mecánica.');
        return;
      }
    } else if (fullText.includes('scania') || fullText.includes('volvo') || fullText.includes('hino') || fullText.includes('isuzu')) {
      if (isManual) {
        this.toast.error('Incompatibilidad termodinámica', 'Los camiones pesados operan por compresión diésel y NO usan bobinas ni bujías.');
      }
      return;
    }

    // 5. REGLAS MECÁNICAS SEGURAS CUANDO NO SE INDICA EL VEHÍCULO EN EL NOMBRE
    if (isIgnition) {
      this.setMakeSelectorByName('Toyota');
      this.catalogService
        .quickImportVehicles({
          makeName: 'Toyota',
          models: [
            { name: 'Yaris', vehicleType: 'Automóvil' },
            { name: 'Corolla', vehicleType: 'Automóvil' },
          ],
        })
        .subscribe({
          next: (m) => this.linkImportedVehicleModels('Toyota', m),
        });
      if (isManual) {
        this.toast.success(
          'Encendido a Gasolina Configurado',
          'Bobina/bujía asignada automáticamente a Toyota Yaris y Corolla. Incompatible con camiones diésel pesados.'
        );
      }
      return;
    }

    if (isDiesel) {
      this.setMakeSelectorByName('Hino');
      if (isManual) {
        this.toast.warning(
          'Sistema Diésel / Pesado',
          'Componente diésel detectado. Selecciona el modelo diésel (Hino, Isuzu, Scania, Volvo FH o Hilux Diésel) en el selector inferior.'
        );
      }
      return;
    }

    // 6. RESPUESTA HONESTA: NO INVENTAR VEHÍCULOS AL AZAR
    if (isManual) {
      this.toast.info(
        'Modelo no identificado',
        'No se detectó el modelo en el nombre. Por favor selecciona la marca y modelo en el selector para evitar compatibilidades erróneas.'
      );
    }
  }

  onBranchLocationChanged(coords: { latitude: number; longitude: number; address?: string }): void {
    if (!this.branchDraft) return;
    this.branchDraft = {
      ...this.branchDraft,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  }

  onManualCoordsChange(): void {
    if (!this.branchDraft) return;
    this.branchDraft = { ...this.branchDraft };
  }

  onPartImagesUpdated(updated: Part): void {
    this.editingPart.set(updated);
    this.adminParts.update((list) => list.map((p) => (p.id === updated.id ? updated : p)));
  }

  onStagedFilesChanged(bundle: StagedUploadBundle): void {
    this.stagedUploadBundle = bundle;
    if (this.isIgnitionPart() && this.compatibilityRows().length === 0) {
      this.autoApplyMechanicalFitment(false);
    }
  }

  savePartForm(): void {
    if (!this.partForm.name.trim() || !this.partForm.manufacturerBrand.trim()) {
      this.toast.warning(
        'Campos obligatorios',
        'Completa al menos el nombre del repuesto y la marca fabricante.'
      );
      return;
    }

    if (this.isIgnitionPart()) {
      const hasDiesel = this.compatibilityRows().some((r) =>
        this.isDieselTruckMake(r.makeNameLabel || '')
      );
      if (hasDiesel) {
        this.toast.error(
          'Incompatibilidad mecánica crítica',
          'No se puede guardar: has vinculado un camión diésel (Scania, Volvo, Hino o Isuzu) a un repuesto de ignición a chispa. Elimina dicho vehículo antes de guardar.'
        );
        return;
      }
    }

    const payload: PartUpsertRequest = {
      sku: (this.partForm.sku || '').trim(),
      oemCode: (this.partForm.oemCode || '').trim(),
      name: this.partForm.name.trim(),
      technicalDescription: (this.partForm.technicalDescription || '').trim(),
      manufacturerBrand: this.partForm.manufacturerBrand.trim(),
      categoryId: Number(this.partForm.categoryId),
      purchasePrice: Number(this.partForm.purchasePrice) || 0,
      salePrice: Number(this.partForm.salePrice) || 0,
      wholesalePrice:
        this.partForm.wholesalePrice !== null && this.partForm.wholesalePrice !== undefined
          ? Number(this.partForm.wholesalePrice)
          : null,
      stockQuantity: Number(this.partForm.stockQuantity) || 0,
      minStockLevel: Number(this.partForm.minStockLevel) || 5,
      active: this.partForm.active ?? true,
      compatibilities: this.compatibilityRows().map((r) => ({
        modelId: r.modelId,
        yearStart: r.yearStart,
        yearEnd: r.yearEnd,
        engineSpec: r.engineSpec,
        notes: r.notes,
      })),
    };

    this.savingPart.set(true);
    const existing = this.editingPart();
    const request$ = existing?.id
      ? this.catalogService.updatePart(existing.id, payload)
      : this.catalogService.createPart(payload);

    request$.subscribe({
      next: (savedPart) => {
        if (this.stagedUploadBundle.files.length > 0) {
          this.catalogService
            .uploadPartImages(
              savedPart.id,
              this.stagedUploadBundle.files,
              this.stagedUploadBundle.primaryIndex
            )
            .pipe(finalize(() => this.savingPart.set(false)))
            .subscribe({
              next: (withImages) => {
                this.finishPartSave(withImages, Boolean(existing?.id));
              },
              error: () => {
                this.finishPartSave(savedPart, Boolean(existing?.id));
              },
            });
        } else {
          this.savingPart.set(false);
          this.finishPartSave(savedPart, Boolean(existing?.id));
        }
      },
      error: (err) => {
        this.savingPart.set(false);
        this.toast.error(
          'No se pudo guardar el repuesto',
          err?.error?.message || 'Revisa los datos ingresados e inténtalo nuevamente.'
        );
      },
    });
  }

  private finishPartSave(saved: Part, isUpdate: boolean): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('asuncion_catalog_snapshot_v7');
      localStorage.removeItem('asuncion_catalog_snapshot_v6');
      localStorage.removeItem('asuncion_catalog_snapshot_v4');
    }
    this.syncBus.notifyAdminStockMutated([saved.id]);
    const codeLabel = saved.oemCode ? `OEM ${saved.oemCode}` : saved.sku;
    this.toast.success(
      isUpdate ? 'Repuesto actualizado' : 'Repuesto registrado',
      `${saved.name}${codeLabel ? ' (' + codeLabel + ')' : ''}`
    );
    this.loadAdminParts();
    this.showPartModal.set(false);
  }

  deletePart(part: Part): void {
    this.catalogService.deletePart(part.id).subscribe({
      next: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('asuncion_catalog_snapshot_v7');
          localStorage.removeItem('asuncion_catalog_snapshot_v6');
          localStorage.removeItem('asuncion_catalog_snapshot_v4');
        }
        this.syncBus.notifyAdminStockMutated([part.id]);
        this.adminParts.update((list) => list.filter((p) => p.id !== part.id));
        this.toast.info('Repuesto retirado', `${part.sku} fue desactivado del catálogo.`);
      },
      error: (err) =>
        this.toast.error('No se pudo eliminar', err?.error?.message || 'Operación no permitida.'),
    });
  }

  private emptyPartForm(): PartUpsertRequest {
    return {
      sku: '',
      oemCode: '',
      name: '',
      technicalDescription: '',
      manufacturerBrand: '',
      categoryId: 1,
      purchasePrice: 45,
      salePrice: 75,
      wholesalePrice: 65,
      stockQuantity: 20,
      minStockLevel: 5,
      active: true,
      compatibilities: [],
    };
  }

  // ===================== DELIVERY ZONES / BRANCHES =====================

  private loadBranches(): void {
    this.logisticsService.getBranches().subscribe({
      next: (list) => {
        this.branches.set(list);
        if (list.length > 0) {
          this.selectedBranchId = list[0].id;
          this.branchDraft = { ...list[0] };
        }
      },
      error: () => {},
    });
  }

  onSelectBranchForEdit(): void {
    const found = this.branches().find((b) => b.id === Number(this.selectedBranchId));
    if (found) {
      this.branchDraft = { ...found };
    }
  }

  saveBranchCoverage(): void {
    if (!this.branchDraft) return;
    this.savingBranch.set(true);
    this.logisticsService
      .updateBranch(this.branchDraft.id, this.branchDraft)
      .pipe(finalize(() => this.savingBranch.set(false)))
      .subscribe({
        next: (updated) => {
          this.branchDraft = { ...updated };
          this.branches.update((list) => list.map((b) => (b.id === updated.id ? updated : b)));
          this.toast.success(
            'Zona de reparto actualizada',
            `${updated.name}: cobertura configurada en ${(updated.coverageRadiusMeters / 1000).toFixed(2)} km.`
          );
        },
        error: (err) =>
          this.toast.error(
            'No se pudo actualizar la sucursal',
            err?.error?.message || 'Se requieren permisos de administrador para modificar la zona de reparto.'
          ),
      });
  }

  // ===================== GLOBAL ORDERS & MOTORIZADOS =====================

  private isCounterSaleOrder(ord: Order): boolean {
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

  loadGlobalOrders(): void {
    this.ordersService.getAllOrders().subscribe({
      next: (list) => this.globalOrders.set(list.filter((o) => !this.isCounterSaleOrder(o))),
      error: () => this.globalOrders.set([]),
    });
  }

  
  exportOrdersToExcelForSunat(): void {
    const orders = this.globalOrders();
    if (!orders || orders.length === 0) {
      this.toast.info('Sin registros', 'No hay pedidos disponibles para exportar.');
      return;
    }

    // Cabecera estándar según formato 14.1 de Registro de Ventas para Contabilidad / SUNAT
    const headers = [
      'NRO_PEDIDO',
      'FECHA_EMISION',
      'TIPO_COMPROBANTE',
      'SERIE_COMPROBANTE',
      'NUMERO_COMPROBANTE',
      'TIPO_DOC_IDENTIDAD',
      'NUMERO_DOC_IDENTIDAD',
      'RAZON_SOCIAL_O_CLIENTE',
      'BASE_IMPONIBLE_SUBTOTAL_PEN',
      'IGV_18_PEN',
      'FLETE_DELIVERY_PEN',
      'TOTAL_VENTA_PEN',
      'MONEDA',
      'METODO_PAGO',
      'ESTADO_OPERATIVO',
      'ESTADO_PAGO',
      'MODALIDAD_ENTREGA',
      'DIRECCION_ENTREGA'
    ];

    const rows = orders.map((ord, idx) => {
      const docNum = (ord.customerTaxId || ord.billingDocumentNumber || '').trim();
      const invType = ord.invoiceType || (docNum.length === 11 ? 'FACTURA' : 'BOLETA');
      const tipoComprobante = invType === 'FACTURA' ? '01 (Factura)' : '03 (Boleta)';
      const serie = invType === 'FACTURA' ? 'F001' : 'B001';
      const docType = docNum.length === 11 ? '6 (RUC)' : (docNum.length === 8 ? '1 (DNI)' : '0 (Otros)');
      const fecha = ord.createdAt ? new Date(ord.createdAt).toISOString().slice(0, 10) : '';

      const subtotal = Number(ord.subtotal || 0).toFixed(2);
      const igv = Number(ord.igvAmount ?? ord.taxAmount ?? 0).toFixed(2);
      const deliveryFee = Number(ord.deliveryFee || 0).toFixed(2);
      const total = Number(ord.totalAmount ?? ord.total ?? 0).toFixed(2);

      const sanitize = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

      return [
        sanitize(ord.orderNumber || `ASN-2026-${String(idx + 1).padStart(4, '0')}`),
        sanitize(fecha),
        sanitize(tipoComprobante),
        sanitize(serie),
        sanitize(ord.orderNumber || String(idx + 1)),
        sanitize(docType),
        sanitize(docNum),
        sanitize(ord.billingBusinessName || ord.customerBusinessName || ord.recipientName || ord.customerName || 'Cliente Asunción'),
        subtotal,
        igv,
        deliveryFee,
        total,
        sanitize('PEN (Soles)'),
        sanitize(ord.paymentMethod || 'CONTRA_ENTREGA'),
        sanitize(ord.status || 'PENDIENTE'),
        sanitize(ord.status === 'ENTREGADO' || ord.status === 'CONFIRMADO' ? 'PAGADO' : 'PENDIENTE'),
        sanitize(ord.deliveryType || 'DELIVERY'),
        sanitize(ord.deliveryAddress || 'Recojo en tienda')
      ].join(';');
    });

    const csvContent = [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Registro_Ventas_SUNAT_Asuncion_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.toast.success(
      'Excel generado con éxito',
      `Se exportaron ${orders.length} registros contables en formato listo para SUNAT / Microsoft Excel.`
    );
  }

  loadDrivers(): void {
    this.loadingDrivers.set(true);
    this.ordersService.getDrivers().subscribe({
      next: (list) => {
        this.drivers.set(list);
        this.loadingDrivers.set(false);
      },
      error: () => this.loadingDrivers.set(false),
    });
  }

  openDriverAssignmentModal(order: Order): void {
    this.selectedOrderForDispatch.set(order);
    this.selectedDriverId.set(null);
    this.driverAssignError.set('');
    this.loadDrivers();
  }

  closeDriverAssignmentModal(): void {
    this.selectedOrderForDispatch.set(null);
    this.selectedDriverId.set(null);
    this.driverAssignError.set('');
  }

  confirmDriverAssignment(): void {
    const order = this.selectedOrderForDispatch();
    const driverId = this.selectedDriverId();
    if (!order || !driverId) return;

    this.isAssigningDriver.set(true);
    this.driverAssignError.set('');

    this.ordersService.markReadyForDispatch(order.id, { assignedDriverId: driverId }).subscribe({
      next: (_updatedOrder: Order) => {
        this.isAssigningDriver.set(false);
        this.toast.success(
          'Motorizado asignado',
          `El pedido #${order.orderNumber} fue asignado al repartidor exitosamente.`
        );
        this.closeDriverAssignmentModal();
        this.loadGlobalOrders();
        this.loadDrivers();
      },
      error: (err: any) => {
        this.isAssigningDriver.set(false);
        const msg = err?.error?.message || 'Error al asignar repartidor. Verifica que esté disponible.';
        this.driverAssignError.set(msg);
      },
    });
  }

  updateDriverStatusByAdmin(driver: DriverSummary, newStatus: DriverStatus): void {
    this.ordersService.updateDriverStatus(driver.id, newStatus).subscribe({
      next: () => {
        this.toast.info('Estado actualizado', `Repartidor ${driver.fullName}: ${newStatus}`);
        this.loadDrivers();
        this.loadGlobalOrders();
      },
      error: (err: any) => {
        this.toast.error('Error al cambiar estado', err?.error?.message || 'No se pudo actualizar el estado del motorizado.');
      },
    });
  }

  driverStatusBadgeClass(status?: DriverStatus): string {
    switch (status) {
      case 'DISPONIBLE':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      case 'EN_RUTA':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'RETORNANDO':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'FUERA_DE_TURNO':
      default:
        return 'border-gray-200 bg-gray-50 text-gray-600';
    }
  }

  driverStatusLabel(status?: DriverStatus): string {
    switch (status) {
      case 'DISPONIBLE':
        return 'En tienda (Disponible)';
      case 'EN_RUTA':
        return 'En ruta de entrega';
      case 'RETORNANDO':
        return 'Retornando a tienda';
      case 'FUERA_DE_TURNO':
      default:
        return 'Fuera de turno';
    }
  }

  // ===================== EMAIL NOTIFICATIONS & LIVE OUTBOX =====================

  loadMailConfiguration(): void {
    this.notificationAdminService.getConfig().subscribe({
      next: (cfg) => {
        this.mailConfigLoaded = true;
        this.mailConfigForm = {
          enabled: Boolean(cfg.enabled),
          smtpHost: cfg.smtpHost || 'smtp.gmail.com',
          smtpPort: cfg.smtpPort || 587,
          username: cfg.username || 'luisoscarperez322@gmail.com',
          password: '',
          fromName: cfg.fromName || 'Repuestos Asunción',
          adminNotificationEmail: cfg.adminNotificationEmail || 'luisoscarperez322@gmail.com',
        };
        this.hasSavedMailPassword.set(Boolean(cfg.hasPassword));
        if (!this.testRecipientEmail) {
          this.testRecipientEmail =
            cfg.adminNotificationEmail || cfg.username || 'luisoscarperez322@gmail.com';
        }
      },
      error: () => {},
    });
  }

  saveMailConfiguration(): void {
    this.savingMailConfig.set(true);
    const payload: MailConfigUpdateRequest = {
      enabled: true,
      smtpHost: (this.mailConfigForm.smtpHost || 'smtp.gmail.com').trim(),
      smtpPort: Number(this.mailConfigForm.smtpPort) || 587,
      username: (this.mailConfigForm.username || 'luisoscarperez322@gmail.com').trim(),
      password: '',
      fromName: (this.mailConfigForm.fromName || 'Repuestos Asunción').trim(),
      adminNotificationEmail: (
        this.mailConfigForm.adminNotificationEmail || 'luisoscarperez322@gmail.com'
      ).trim(),
    };

    this.notificationAdminService
      .updateConfig(payload)
      .pipe(finalize(() => this.savingMailConfig.set(false)))
      .subscribe({
        next: (saved) => {
          this.hasSavedMailPassword.set(true);
          this.mailConfigForm.password = '';
          this.toast.success(
            'Configuración de correo guardada',
            `Las alertas llegan a ${saved.adminNotificationEmail || payload.adminNotificationEmail} usando las credenciales protegidas de Render.`
          );
        },
        error: (err) => {
          this.toast.error(
            'No se pudo guardar la configuración',
            err?.error?.message || 'Revisa los campos de correo e inténtalo nuevamente.'
          );
        },
      });
  }

  sendTestNotification(): void {
    const recipient = this.testRecipientEmail.trim();
    if (!recipient) return;
    this.dispatchTestEmailRequest(recipient);
  }

  private dispatchTestEmailRequest(recipient: string): void {
    this.sendingTestMail.set(true);
    this.notificationAdminService
      .sendTestEmail(recipient)
      .pipe(finalize(() => this.sendingTestMail.set(false)))
      .subscribe({
        next: (res) => {
          if (res.success) {
            this.hasSavedMailPassword.set(true);
            this.toast.success(
              'Correo real enviado con éxito',
              res.message || `Revisa la bandeja de entrada (o Spam) de ${recipient}.`
            );
          } else {
            this.toast.warning(
              'No se pudo enviar el correo real',
              res.message || 'Falta configurar la Contraseña de Aplicación de Google de 16 letras.'
            );
          }
          this.loadNotificationLogs();
        },
        error: (err) => {
          this.toast.error(
            'Error al enviar correo de prueba',
            err?.error?.message || 'Verifica la Contraseña de Aplicación de Google e inténtalo de nuevo.'
          );
          this.loadNotificationLogs();
        },
      });
  }

  loadNotificationLogs(): void {
    this.loadingNotificationLogs.set(true);
    this.notificationAdminService
      .getLogs()
      .pipe(finalize(() => this.loadingNotificationLogs.set(false)))
      .subscribe({
        next: (logs) => this.notificationLogs.set(logs || []),
        error: () => this.notificationLogs.set([]),
      });
  }

  clearNotificationLogs(): void {
    if (!confirm('¿Deseas vaciar todos los correos del historial de notificaciones?')) return;
    this.notificationAdminService.clearLogs().subscribe({
      next: () => {
        this.notificationLogs.set([]);
        this.toast.success('Historial vaciado', 'Se eliminaron los registros de prueba.');
      },
      error: (err) => {
        this.toast.error('Error al limpiar', err?.message || 'No se pudo vaciar el historial.');
      },
    });
  }

  // =========================================================================
  // TAB 6: PAYMENT GATEWAYS (CULQI, PAGOEFECTIVO, NIUBIZ)
  // =========================================================================
  loadPaymentConfig(): void {
    this.paymentService.getAdminConfig().subscribe({
      next: (cfg) => {
        this.paymentConfigForm = {
          culqiEnabled: cfg.culqiEnabled,
          culqiPublicKey: cfg.culqiPublicKey || '',
          culqiSecretKey: '',
          pagoefectivoEnabled: cfg.pagoefectivoEnabled,
          pagoefectivoServiceId: cfg.pagoefectivoServiceId || '',
          pagoefectivoSecretKey: '',
          niubizEnabled: cfg.niubizEnabled,
          niubizMerchantId: cfg.niubizMerchantId || '',
          niubizUser: '',
          niubizPassword: '',
          environment: cfg.environment || 'SANDBOX',
          updatedAt: cfg.updatedAt,
        };
        if (cfg.yapePhone) this.storePaymentMethods.yapePhone = cfg.yapePhone;
        if (cfg.yapeHolder) this.storePaymentMethods.yapeHolder = cfg.yapeHolder;
        if (cfg.yapeQrImageUrl) this.storePaymentMethods.yapeQrImageUrl = cfg.yapeQrImageUrl;
        if (cfg.plinPhone) this.storePaymentMethods.plinPhone = cfg.plinPhone;
        if (cfg.plinHolder) this.storePaymentMethods.plinHolder = cfg.plinHolder;
        if (cfg.plinQrImageUrl) this.storePaymentMethods.plinQrImageUrl = cfg.plinQrImageUrl;
        if (cfg.walletInstructions) this.storePaymentMethods.walletInstructions = cfg.walletInstructions;
        this.paymentService.saveStoreWalletConfig(this.storePaymentMethods);
      },
      error: (err) => {
        this.toast.error(
          'Error al cargar pasarelas',
          err?.error?.message || 'No se pudo obtener la configuración de pagos.'
        );
      },
    });
  }

  savePaymentConfig(): void {
    this.savingPaymentConfig.set(true);
    const payload: PaymentConfigUpdateRequest = {
      culqiEnabled: Boolean(this.paymentConfigForm.culqiEnabled),
      culqiPublicKey: (this.paymentConfigForm.culqiPublicKey || '').trim(),
      culqiSecretKey: (this.paymentConfigForm.culqiSecretKey || '').trim(),
      pagoefectivoEnabled: Boolean(this.paymentConfigForm.pagoefectivoEnabled),
      pagoefectivoServiceId: (this.paymentConfigForm.pagoefectivoServiceId || '').trim(),
      pagoefectivoSecretKey: (this.paymentConfigForm.pagoefectivoSecretKey || '').trim(),
      niubizEnabled: Boolean(this.paymentConfigForm.niubizEnabled),
      niubizMerchantId: (this.paymentConfigForm.niubizMerchantId || '').trim(),
      niubizUser: (this.paymentConfigForm.niubizUser || '').trim(),
      niubizPassword: (this.paymentConfigForm.niubizPassword || '').trim(),
      environment: this.paymentConfigForm.environment || 'SANDBOX',
      yapePhone: (this.storePaymentMethods.yapePhone || '').trim(),
      yapeHolder: (this.storePaymentMethods.yapeHolder || '').trim(),
      yapeQrImageUrl: this.storePaymentMethods.yapeQrImageUrl || '',
      plinPhone: (this.storePaymentMethods.plinPhone || '').trim(),
      plinHolder: (this.storePaymentMethods.plinHolder || '').trim(),
      plinQrImageUrl: this.storePaymentMethods.plinQrImageUrl || '',
      walletInstructions: (this.storePaymentMethods.walletInstructions || '').trim(),
    };

    this.paymentService
      .updateAdminConfig(payload)
      .pipe(finalize(() => this.savingPaymentConfig.set(false)))
      .subscribe({
        next: (saved) => {
          this.paymentConfigForm.culqiPublicKey = saved.culqiPublicKey || this.paymentConfigForm.culqiPublicKey;
          this.paymentConfigForm.culqiSecretKey = '';
          this.paymentConfigForm.pagoefectivoServiceId = saved.pagoefectivoServiceId || this.paymentConfigForm.pagoefectivoServiceId;
          this.paymentConfigForm.pagoefectivoSecretKey = '';
          this.paymentConfigForm.environment = saved.environment;
          this.paymentConfigForm.updatedAt = saved.updatedAt;
          this.saveStorePaymentMethods();
          this.toast.success(
            'Pasarelas y Métodos de Pago Actualizados',
            `Configuración bancaria, billeteras digitales y pasarelas guardadas en modo ${saved.environment}.`
          );
        },
        error: (err) => {
          this.toast.error(
            'Error al guardar pasarelas',
            err?.error?.message || 'No se pudo actualizar la configuración de pagos.'
          );
        },
      });
  }

  refreshPaymentTransactions(): void {
    this.loadingPaymentTransactions.set(true);
    this.paymentService
      .getRecentTransactions()
      .pipe(finalize(() => this.loadingPaymentTransactions.set(false)))
      .subscribe({
        next: (txs) => this.paymentTransactions.set(txs || []),
        error: () => this.paymentTransactions.set([]),
      });
  }

  formatNotificationEvent(eventType?: string): string {
    if (!eventType) return 'Notificación';
    const key = eventType.trim().toUpperCase();
    const map: Record<string, string> = {
      BIENVENIDA: 'Bienvenida cliente',
      BIENVENIDA_REGISTRO: 'Bienvenida cliente',
      WELCOME: 'Bienvenida cliente',
      NUEVO_CLIENTE: 'Bienvenida cliente',
      ALTA_TRABAJADOR: 'Alta colaborador',
      RECUPERACION_PASSWORD: 'Clave de recuperación',
      PRUEBA_SMTP: 'Verificación de correo',
      COMPRA_CONFIRMADA: 'Compra confirmada',
      NUEVO_PEDIDO_TIENDA: 'Alerta nuevo pedido',
      ORDEN_CREADA: 'Pedido confirmado',
      ORDER_CONFIRMED: 'Pedido confirmado',
      PAGO_CONFIRMADO: 'Pago verificado',
      PEDIDO_EN_PREPARACION: 'En preparación',
      ORDER_PROCESSING: 'En preparación',
      PEDIDO_LISTO_DESPACHO: 'Listo despacho',
      PEDIDO_EN_CAMINO: 'En camino',
      ORDER_IN_TRANSIT: 'En camino',
      ORDER_ON_ROUTE: 'En camino',
      OUT_FOR_DELIVERY: 'En camino',
      EN_RUTA: 'En camino',
      EN_CAMINO: 'En camino',
      PEDIDO_ENTREGADO: 'Entregado',
      ORDER_DELIVERED: 'Entregado',
      DELIVERED: 'Entregado',
      ENTREGADO: 'Entregado',
      RECLAMO_REGISTRADO: 'Hoja reclamación',
      ALERTA_RECLAMO: 'Alerta reclamo',
      RECLAMO_ATENDIDO: 'Reclamo atendido',
      TEST: 'Verificación de correo',
      TEST_EMAIL: 'Verificación de correo',
      SMTP_TEST: 'Verificación de correo',
    };
    return map[key] || 'Notificación';
  }

  formatNotificationStatus(status?: string): string {
    const s = (status || '').trim().toUpperCase();
    if (s === 'SIMULATED_NO_SMTP') return 'Falta clave Gmail';
    if (s === 'FAILED') return 'Error de envío';
    return 'Enviado con éxito';
  }

  notificationStatusBadgeClass(status?: string): string {
    const s = (status || '').trim().toUpperCase();
    if (s === 'SIMULATED_NO_SMTP') return 'border-amber-300 bg-amber-50 text-amber-800';
    if (s === 'FAILED') return 'border-red-300 bg-red-50 text-red-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }

  openEmailPreview(log: NotificationLogItem): void {
    const rawHtml =
      log.htmlBody ||
      '<div style="font-family:system-ui,sans-serif;padding:24px;color:#374151;">Sin contenido disponible para previsualizar.</div>';
    const sanitizedNoScripts = rawHtml.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ''
    );
    this.safeEmailPreviewHtml.set(
      this.sanitizer.bypassSecurityTrustHtml(sanitizedNoScripts) as unknown as string
    );
    this.previewingLog.set(log);
  }

  closeEmailPreview(): void {
    this.previewingLog.set(null);
    this.safeEmailPreviewHtml.set('');
  }

  // =========================================================================
  // TAB 7: USERS & STAFF MANAGEMENT METHODS
  // =========================================================================

  loadStaffUsers(): void {
    this.loadingStaffUsers.set(true);
    this.adminUsersService
      .getUsers()
      .pipe(finalize(() => this.loadingStaffUsers.set(false)))
      .subscribe({
        next: (users) => {
          // Strictly exclude customer accounts (CLIENTE / ROLE_CLIENTE) from staff payroll
          const staffOnly = users.filter((u) => u.role !== 'CLIENTE' && u.role !== 'ROLE_CLIENTE');
          this.staffUsers.set(staffOnly);
        },
        error: (err) =>
          this.toast.error('Error al cargar personal', err?.error?.message || 'No se pudo obtener la lista de usuarios.'),
      });
  }

  countStaffByRole(role: string): number {
    return this.staffUsers().filter((u) => u.role === role).length;
  }

  filteredStaffUsers(): AdminUserResponse[] {
    const q = this.userSearchQuery.trim().toLowerCase();
    const roleFilter = this.userRoleFilter;

    return this.staffUsers()
      .filter((u) => u.role !== 'CLIENTE' && u.role !== 'ROLE_CLIENTE')
      .filter((u) => {
        const matchesRole = roleFilter === 'TODOS' || u.role === roleFilter;
      const matchesQuery =
        !q ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
        (u.documentNumber && u.documentNumber.includes(q)) ||
        (u.licenseNumber && u.licenseNumber.toLowerCase().includes(q)) ||
        (u.vehiclePlate && u.vehiclePlate.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q));
      return matchesRole && matchesQuery;
    });
  }

  openCreateUserModal(): void {
    this.editingUser.set(null);
    this.docVerifiedName.set(null);
    const count = this.staffUsers().length + 1;
    this.userForm = {
      fullName: '',
      email: '',
      phone: '',
      documentType: 'DNI',
      documentNumber: '',
      role: 'VENDEDOR',
      password: '',
      newPassword: '',
      active: true,
      employeeCode: `VEN-${count.toString().padStart(3, '0')}`,
      licenseNumber: '',
      vehiclePlate: '',
    };
    this.generateRandomPassword();
    this.showUserPassword = false;
    this.showUserModal.set(true);
  }

  openEditUserModal(user: AdminUserResponse): void {
    this.editingUser.set(user);
    this.docVerifiedName.set(null);
    this.userForm = {
      fullName: user.fullName,
      email: user.email,
      phone: user.phone || '',
      documentType: user.documentType || 'DNI',
      documentNumber: user.documentNumber || '',
      role: user.role || 'VENDEDOR',
      password: '',
      newPassword: '',
      active: user.active,
      employeeCode: user.employeeCode || '',
      licenseNumber: user.licenseNumber || '',
      vehiclePlate: user.vehiclePlate || '',
    };
    this.showUserPassword = false;
    this.showUserModal.set(true);
  }

  onRoleSelected(role: string): void {
    this.userForm.role = role;
    if (!this.editingUser()) {
      const prefix = role === 'ADMIN' ? 'ADM' : role === 'MOTORIZADO' ? 'MOT' : 'VEN';
      const count = this.staffUsers().length + 1;
      this.userForm.employeeCode = `${prefix}-${count.toString().padStart(3, '0')}`;
    }
  }

  lookupStaffDocument(): void {
    const docNum = this.userForm.documentNumber.trim();
    if (!docNum || (docNum.length !== 8 && docNum.length !== 11)) {
      this.toast.info('Documento requerido', 'Ingrese un DNI de 8 dígitos para consultar en RENIEC.');
      return;
    }
    this.searchingDoc.set(true);
    this.lookupService.lookupDocument(docNum)
      .pipe(finalize(() => this.searchingDoc.set(false)))
      .subscribe({
        next: (res) => {
          if (res.found && res.fullName) {
            this.userForm.fullName = res.fullName;
            this.docVerifiedName.set(res.fullName);
            this.toast.success('Documento verificado', `Identidad oficial: ${res.fullName}`);
          } else {
            this.toast.info('Sin resultado automático', 'No se encontró el registro oficial. Puede ingresar el nombre manualmente.');
          }
        },
        error: () => {
          this.toast.info('Consulta no disponible', 'Ingrese el nombre y apellidos completos manualmente.');
        },
      });
  }

  copyCredentials(): void {
    const text = [
      '--- FICHA DE ACCESO OPERATIVO: REPUESTOS ASUNCIÓN ---',
      `Colaborador: ${this.userForm.fullName || 'Nuevo personal'}`,
      `Código de Empleado: ${this.userForm.employeeCode || 'Asignado'}`,
      `Cargo / Rol: ${this.formatStaffRole(this.userForm.role)}`,
      `Correo de Acceso: ${this.userForm.email}`,
      `Contraseña Inicial: ${this.userForm.password || '(Conservar actual)'}`,
      this.userForm.role === 'MOTORIZADO' ? `Brevete: ${this.userForm.licenseNumber || 'N/D'} | Placa: ${this.userForm.vehiclePlate || 'N/D'}` : '',
      `Acceso al Sistema: ${window.location.origin}/login`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text).then(() => {
      this.toast.success('Credenciales copiadas', 'La ficha de acceso ha sido copiada al portapapeles.');
    });
  }

  closeUserModal(): void {
    this.showUserModal.set(false);
    this.editingUser.set(null);
    this.docVerifiedName.set(null);
  }

  generateRandomPassword(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$';
    let pwd = 'Asun';
    for (let i = 0; i < 4; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += '2026!';
    this.userForm.password = pwd;
    this.showUserPassword = true;
    this.toast.info('Contraseña generada', `Clave asignada: ${pwd}`);
  }

  saveStaffUser(): void {
    if (!this.userForm.fullName.trim() || !this.userForm.email.trim()) {
      this.toast.error('Datos incompletos', 'Nombre y correo institucional son obligatorios.');
      return;
    }

    this.savingStaffUser.set(true);

    const target = this.editingUser();
    if (target) {
      const payload: UpdateStaffUserRequest = {
        fullName: this.userForm.fullName.trim(),
        email: this.userForm.email.trim(),
        phone: this.userForm.phone.trim() || undefined,
        documentType: this.userForm.documentType,
        documentNumber: this.userForm.documentNumber.trim() || undefined,
        role: this.userForm.role,
        active: this.userForm.active,
        newPassword: this.userForm.password.trim() || undefined,
        employeeCode: this.userForm.employeeCode.trim() || undefined,
        licenseNumber: this.userForm.role === 'MOTORIZADO' ? (this.userForm.licenseNumber.trim() || undefined) : undefined,
        vehiclePlate: this.userForm.role === 'MOTORIZADO' ? (this.userForm.vehiclePlate.trim() || undefined) : undefined,
      };

      this.adminUsersService
        .updateUser(target.id, payload)
        .pipe(finalize(() => this.savingStaffUser.set(false)))
        .subscribe({
          next: (updated) => {
            this.staffUsers.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
            this.toast.success('Trabajador actualizado', `Se guardaron los datos de ${updated.fullName}.`);
            this.closeUserModal();
          },
          error: (err) =>
            this.toast.error('Error al actualizar', err?.error?.message || 'No se pudo guardar la información.'),
        });
    } else {
      const payload: CreateStaffUserRequest = {
        fullName: this.userForm.fullName.trim(),
        email: this.userForm.email.trim(),
        password: this.userForm.password.trim(),
        phone: this.userForm.phone.trim() || undefined,
        documentType: this.userForm.documentType,
        documentNumber: this.userForm.documentNumber.trim() || undefined,
        role: this.userForm.role,
        employeeCode: this.userForm.employeeCode.trim() || undefined,
        licenseNumber: this.userForm.role === 'MOTORIZADO' ? (this.userForm.licenseNumber.trim() || undefined) : undefined,
        vehiclePlate: this.userForm.role === 'MOTORIZADO' ? (this.userForm.vehiclePlate.trim() || undefined) : undefined,
      };

      this.adminUsersService
        .createUser(payload)
        .pipe(finalize(() => this.savingStaffUser.set(false)))
        .subscribe({
          next: (created) => {
            this.staffUsers.update((list) => [created, ...list]);
            this.toast.success(
              'Colaborador creado',
              `Se registró a ${created.fullName} con código ${created.employeeCode || 'asignado'}.`
            );
            this.closeUserModal();
          },
          error: (err) =>
            this.toast.error('Error al registrar', err?.error?.message || 'No se pudo crear el usuario.'),
        });
    }
  }

  toggleStaffUserStatus(user: AdminUserResponse): void {
    this.adminUsersService.toggleStatus(user.id).subscribe({
      next: (updated) => {
        this.staffUsers.update((list) => list.map((u) => (u.id === updated.id ? updated : u)));
        this.toast.success(
          updated.active ? 'Trabajador activado' : 'Acceso suspendido',
          `El usuario ${updated.fullName} ahora está ${updated.active ? 'activo' : 'inactivo'}.`
        );
      },
      error: (err) =>
        this.toast.error('Error al cambiar estado', err?.error?.message || 'Operación no permitida.'),
    });
  }

  deleteStaffUser(user: AdminUserResponse): void {
    if (!confirm(`¿Estás seguro de que deseas eliminar o revocar el acceso a ${user.fullName}?`)) {
      return;
    }
    this.adminUsersService.deleteUser(user.id).subscribe({
      next: () => {
        this.staffUsers.update((list) => list.filter((u) => u.id !== user.id));
        this.toast.success('Trabajador retirado', `Se removió a ${user.fullName} del sistema.`);
      },
      error: (err) =>
        this.toast.error('Error al eliminar', err?.error?.message || 'No se pudo eliminar el trabajador.'),
    });
  }

  formatStaffRole(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'Administrador';
      case 'VENDEDOR':
        return 'Ventas y Almacén';
      case 'MOTORIZADO':
        return 'Repartidor GPS';
      case 'CLIENTE':
        return 'Cliente';
      default:
        return role;
    }
  }

  staffRoleBadgeClass(role: string): string {
    switch (role) {
      case 'ADMIN':
        return 'border-blue-200 bg-blue-50 text-blue-700';
      case 'VENDEDOR':
        return 'border-orange-200 bg-orange-50 text-orange-700';
      case 'MOTORIZADO':
        return 'border-emerald-200 bg-emerald-50 text-emerald-700';
      default:
        return 'border-gray-200 bg-gray-50 text-gray-700';
    }
  }

  // ---------------------------------------------------------------------------
  // LIBRO DE RECLAMACIONES & CALIFICACIONES DE REPARTIDORES
  // ---------------------------------------------------------------------------
  pendingClaimsCount(): number {
    return this.complaintsService.complaints().filter((c) => c.status === 'PENDIENTE').length;
  }

  resolvedClaimsCount(): number {
    return this.complaintsService.complaints().filter((c) => c.status === 'ATENDIDO').length;
  }

  filteredComplaints(): ComplaintRecord[] {
    return this.complaintsService.complaints().filter((c) => {
      if (this.claimFilterType() !== 'TODOS' && c.claimType !== this.claimFilterType()) {
        return false;
      }
      if (this.claimFilterStatus() !== 'TODOS' && c.status !== this.claimFilterStatus()) {
        return false;
      }
      return true;
    });
  }

  openComplaintModal(c: ComplaintRecord): void {
    this.selectedComplaint.set(c);
    this.claimResponseText = c.adminResponseNote || '';
  }

  closeComplaintModal(): void {
    this.selectedComplaint.set(null);
    this.claimResponseText = '';
  }

  submitComplaintResolution(): void {
    const claim = this.selectedComplaint();
    if (!claim || !this.claimResponseText.trim()) return;
    this.complaintsService.resolveComplaint(claim.sheetNumber, this.claimResponseText.trim());
    this.closeComplaintModal();
  }

  getDriverRatingStats(driverName: string = 'Miguel Ángel Flores'): DriverRatingStats {
    return this.driverRatingService.getDriverStats(driverName);
  }

  getDriverPerformanceLabel(avg: number): string {
    if (avg >= 4.5) return 'Excelente Servicio';
    if (avg >= 3.5) return 'Buen Desempeño';
    if (avg >= 2.5) return 'Regular';
    if (avg > 0) return 'Requiere Atención';
    return 'Sin calificaciones';
  }

  getDriverRatingStars(rating: number): string {
    const full = Math.max(0, Math.min(5, Math.round(rating)));
    return '★'.repeat(full) + '☆'.repeat(5 - full);
  }

  openDriverRatingsModal(driverName: string): void {
    this.selectedDriverForRatings.set(driverName);
  }

  closeDriverRatingsModal(): void {
    this.selectedDriverForRatings.set(null);
  }

  // ---------------------------------------------------------------------------
  // REAL-TIME ORDER MONITOR & WEB AUDIO API CHIME (DING-DONG)
  // ---------------------------------------------------------------------------
  initOrderMonitor(): void {
    if (typeof window === 'undefined') return;
    this.checkNewOrders();
    this.orderMonitorInterval = setInterval(() => {
      this.checkNewOrders();
      if (this.activeTab() === 'orders') {
        this.loadDrivers();
      }
    }, 4000); // Poll every 4 seconds in real-time
  }

  private checkNewOrders(): void {
    this.ordersService.getAllOrders().subscribe({
      next: (orders: Order[]) => {
        if (!orders || orders.length === 0) return;

        // Only monitor online orders (counter sales in Caja do not trigger notifications/chimes)
        const onlineOrders = orders.filter((o) => !this.isCounterSaleOrder(o));

        if (this.activeTab() === 'orders') {
          this.globalOrders.set(onlineOrders);
        }

        if (!this.hasInitializedOrderMonitor) {
          // First run: populate known IDs without chiming
          onlineOrders.forEach((o) => this.knownOrderNumbers.add(o.orderNumber));
          this.hasInitializedOrderMonitor = true;
          return;
        }

        // Check for any newly arrived online order
        const newOrders = onlineOrders.filter((o) => !this.knownOrderNumbers.has(o.orderNumber));
        if (newOrders.length > 0) {
          const latest = newOrders[0];
          newOrders.forEach((o) => this.knownOrderNumbers.add(o.orderNumber));
          this.newOrdersAlertCount.update((c) => c + newOrders.length);
          this.newOrderBanner.set({
            orderNumber: latest.orderNumber,
            total: latest.totalAmount ?? latest.total ?? latest.subtotal ?? 0,
            customerName: latest.customerName || 'Cliente Asunción',
          });
          this.playNewOrderChime();
          this.toast.info('¡Nuevo Pedido!', `Orden #${latest.orderNumber} por S/ ${(latest.totalAmount ?? latest.total ?? latest.subtotal ?? 0).toFixed(2)}`);

          // Request native browser desktop notification if permitted
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('¡Nuevo Pedido en Autopartes Asunción!', {
              body: `Orden #${latest.orderNumber} por S/ ${(latest.totalAmount ?? latest.total ?? latest.subtotal ?? 0).toFixed(2)} de ${latest.customerName || "Cliente"}`,
              icon: '/images/logos/logo.jpg',
            });
          } else if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
          }
        }
      },
      error: () => {},
    });
  }

  playNewOrderChime(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const playTone = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
        gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + duration);
      };

      // Two-tone bell chime: E5 (659Hz) -> G5 (784Hz)
      playTone(659.25, 0, 0.25);
      playTone(783.99, 0.18, 0.45);
    } catch (e) {
      console.warn('AudioContext not allowed or not supported:', e);
    }
  }

  dismissNewOrderBanner(): void {
    this.newOrderBanner.set(null);
    this.newOrdersAlertCount.set(0);
  }

  ngOnDestroy(): void {
    if (this.orderMonitorInterval) {
      clearInterval(this.orderMonitorInterval);
    }
    if (this.partAutocompleteTimer) {
      clearTimeout(this.partAutocompleteTimer);
    }
    if (this.brandAutocompleteTimer) {
      clearTimeout(this.brandAutocompleteTimer);
    }
  }
}
