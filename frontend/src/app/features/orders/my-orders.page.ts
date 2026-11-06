import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Order } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-my-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pt-6 pb-24 lg:pb-14 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-5xl space-y-6">
        <!-- Executive Customer Profile Header Banner -->
        <div class="rounded-2xl border border-gray-200/80 bg-white p-5 sm:p-6 shadow-xs relative overflow-hidden">
          <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>

          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pt-1">
            <div class="flex items-start sm:items-center gap-4">
              <div class="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-white font-extrabold text-lg shadow-xs ring-4 ring-orange-50">
                {{ getUserInitials() }}
              </div>
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h1 class="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                    {{ auth.currentUser()?.fullName || 'Mi Cuenta de Cliente' }}
                  </h1>
                  <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                    <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Cliente Verificado
                  </span>
                </div>
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                  <span>{{ auth.currentUser()?.email }}</span>
                  @if (auth.currentUser()?.documentNumber) {
                    <span class="text-gray-300">•</span>
                    <span class="font-mono font-semibold text-gray-700">
                      {{ auth.currentUser()?.documentType || 'DOC' }}: {{ auth.currentUser()?.documentNumber }}
                    </span>
                  }
                  @if (auth.currentUser()?.phone) {
                    <span class="text-gray-300">•</span>
                    <span class="font-mono text-gray-600">Cel: {{ auth.currentUser()?.phone }}</span>
                  }
                </div>
              </div>
            </div>

            <!-- Account Quick Metrics & CTA -->
            <div class="flex flex-wrap items-center gap-2.5 sm:gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100">
              <div class="rounded-xl border border-gray-200/80 bg-gray-50/70 px-3.5 py-2 text-center min-w-[82px]">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Compras</span>
                <span class="font-mono text-base font-extrabold text-gray-900">{{ orders().length }}</span>
              </div>
              <div class="rounded-xl border border-orange-200/70 bg-orange-50/50 px-3.5 py-2 text-center min-w-[82px]">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-orange-600">En curso</span>
                <span class="font-mono text-base font-extrabold text-orange-700">{{ activeOrdersCount() }}</span>
              </div>
              <div class="rounded-xl border border-emerald-200/70 bg-emerald-50/50 px-3.5 py-2 text-center min-w-[82px]">
                <span class="block text-[10px] font-bold uppercase tracking-wider text-emerald-600">Entregados</span>
                <span class="font-mono text-base font-extrabold text-emerald-700">{{ completedOrdersCount() }}</span>
              </div>
              <a
                routerLink="/"
                class="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 transition ml-auto sm:ml-1"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Catálogo</span>
              </a>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs & Filter Bar -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-3">
          <div class="inline-flex rounded-xl bg-gray-200/70 p-1 w-fit">
            <button
              type="button"
              (click)="activeTab.set('orders')"
              [class]="
                activeTab() === 'orders'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900 font-medium'
              "
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm transition cursor-pointer"
            >
              <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span>Historial de Pedidos</span>
              @if (orders().length > 0) {
                <span class="rounded-full bg-orange-100 px-2 py-0.5 font-mono text-[11px] font-bold text-orange-700">
                  {{ orders().length }}
                </span>
              }
            </button>

            <button
              type="button"
              (click)="activeTab.set('profile')"
              [class]="
                activeTab() === 'profile'
                  ? 'bg-white text-gray-900 shadow-2xs font-bold'
                  : 'text-gray-600 hover:text-gray-900 font-medium'
              "
              class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm transition cursor-pointer"
            >
              <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>Datos de Facturación y Contacto</span>
            </button>
          </div>

          @if (activeTab() === 'orders' && orders().length > 0) {
            <div class="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
              <button
                type="button"
                (click)="orderFilter.set('ALL')"
                [class]="orderFilter() === 'ALL' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'"
                class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0"
              >
                Todos ({{ orders().length }})
              </button>
              <button
                type="button"
                (click)="orderFilter.set('ACTIVE')"
                [class]="orderFilter() === 'ACTIVE' ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-orange-50'"
                class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0"
              >
                En curso ({{ activeOrdersCount() }})
              </button>
              <button
                type="button"
                (click)="orderFilter.set('COMPLETED')"
                [class]="orderFilter() === 'COMPLETED' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-emerald-50'"
                class="rounded-lg border px-3 py-1.5 text-xs font-semibold transition cursor-pointer shrink-0"
              >
                Entregados ({{ completedOrdersCount() }})
              </button>
            </div>
          }
        </div>

        <!-- TAB 1: MIS PEDIDOS -->
        @if (activeTab() === 'orders') {
          @if (isLoading()) {
            <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-xs">
              <div class="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
              <p class="text-xs font-medium text-gray-500">Cargando tu historial de compras y comprobantes...</p>
            </div>
          } @else if (orders().length === 0) {
            <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-xs">
              <div class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600 mb-1 border border-orange-100">
                <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <p class="text-base font-bold text-gray-900">Aún no tienes pedidos registrados</p>
              <p class="text-xs text-gray-500 max-w-sm mx-auto leading-relaxed">
                Explora nuestro catálogo con compatibilidad garantizada para camiones y vehículos livianos con despacho express en Lima.
              </p>
              <a
                routerLink="/"
                class="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-700 transition shadow-2xs"
              >
                <span>Explorar catálogo de repuestos</span>
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </a>
            </div>
          } @else if (filteredOrders().length === 0) {
            <div class="rounded-2xl border border-gray-200 bg-white p-10 text-center space-y-2 shadow-xs">
              <p class="text-sm font-bold text-gray-800">No hay pedidos en este filtro</p>
              <p class="text-xs text-gray-500">Prueba seleccionando "Todos" para ver el historial completo de tus compras.</p>
              <button
                type="button"
                (click)="orderFilter.set('ALL')"
                class="mt-2 inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
              >
                Mostrar todos los pedidos
              </button>
            </div>
          } @else {
            <div class="space-y-3.5">
              @for (ord of filteredOrders(); track ord.id) {
                <div class="rounded-2xl border border-gray-200/90 bg-white p-5 shadow-xs hover:border-orange-300/90 hover:shadow-md transition-all">
                  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <!-- Left Info -->
                    <div class="space-y-2.5 min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-mono text-sm sm:text-base font-extrabold text-gray-900 tracking-tight">
                          {{ ord.orderNumber }}
                        </span>
                        <span [class]="statusBadgeClass(ord.status)" class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold">
                          <span
                            class="h-1.5 w-1.5 rounded-full"
                            [class]="ord.status === 'ENTREGADO' ? 'bg-emerald-500' : ord.status === 'CANCELADO' ? 'bg-red-500' : 'bg-orange-500'"
                          ></span>
                          {{ formatStatus(ord.status) }}
                        </span>
                        <span class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-semibold text-gray-600">
                          {{ ord.invoiceType === 'FACTURA' ? 'Factura Electrónica' : 'Boleta de Venta' }}
                        </span>
                        <span class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-600">
                          {{ ord.deliveryType === 'PICKUP' ? 'Recojo en sede' : 'Despacho a domicilio' }}
                        </span>
                      </div>

                      <!-- Metadata line -->
                      <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500">
                        <span class="inline-flex items-center gap-1 font-medium text-gray-600">
                          <svg class="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {{ ord.createdAt | date: 'dd/MM/yyyy HH:mm' }}
                        </span>
                        <span>•</span>
                        <span class="font-semibold text-gray-700">
                          {{ ord.items.length }} {{ ord.items.length === 1 ? 'repuesto' : 'repuestos' }}
                        </span>
                        <span>•</span>
                        <span class="truncate max-w-md text-gray-600">
                          {{ ord.deliveryAddress || ord.branchName }}
                        </span>
                      </div>

                      <!-- Item pills preview -->
                      @if (ord.items && ord.items.length > 0) {
                        <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                          @for (it of ord.items.slice(0, 3); track it.partId) {
                            <span class="inline-flex items-center gap-1 rounded-md bg-gray-100/80 border border-gray-200/60 px-2 py-0.5 text-[11px] text-gray-700 max-w-[230px] truncate">
                              <strong class="font-mono text-gray-900">{{ it.quantity }}x</strong> {{ it.partName }}
                            </span>
                          }
                          @if (ord.items.length > 3) {
                            <span class="rounded-md bg-orange-50 border border-orange-200/60 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                              +{{ ord.items.length - 3 }} más
                            </span>
                          }
                        </div>
                      }
                    </div>

                    <!-- Right Price & Actions -->
                    <div class="flex flex-wrap sm:flex-nowrap items-center justify-between lg:justify-end gap-4 pt-3 lg:pt-0 border-t lg:border-t-0 border-gray-100 shrink-0">
                      <div class="sm:text-right">
                        <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Importe Total</span>
                        <span class="font-mono text-lg font-extrabold tracking-tight text-gray-900">
                          S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                        </span>
                      </div>

                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          (click)="downloadBoletaPdf(ord)"
                          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-xs font-bold text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition cursor-pointer"
                          title="Descargar comprobante electrónico en PDF"
                        >
                          <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <span>Comprobante PDF</span>
                        </button>

                        <a
                          routerLink="/track"
                          [queryParams]="{ order: ord.orderNumber }"
                          [class]="
                            ord.status === 'ENTREGADO'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              : 'border-orange-600 bg-orange-600 text-white hover:bg-orange-700 shadow-2xs'
                          "
                          class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold transition"
                        >
                          @if (ord.status === 'ENTREGADO') {
                            <svg class="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>Ver constancia</span>
                          } @else {
                            <span>Rastrear pedido</span>
                            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                            </svg>
                          }
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- TAB 2: MIS DATOS PERSONALES -->
        @if (activeTab() === 'profile') {
          <div class="rounded-2xl border border-gray-200/80 bg-white p-6 sm:p-8 shadow-xs space-y-6">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-gray-100">
              <div>
                <h2 class="text-base sm:text-lg font-extrabold text-gray-900">Datos de Facturación y Despacho</h2>
                <p class="text-xs text-gray-500 mt-0.5">
                  Tus datos se autocompletarán automáticamente al finalizar tus próximas compras de repuestos.
                </p>
              </div>
              <span class="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-[11px] font-bold text-emerald-700">
                Sincronización SUNAT / RENIEC activa
              </span>
            </div>

            <!-- Email (Read only) -->
            <div class="rounded-xl border border-gray-200/70 bg-gray-50/80 p-4 flex flex-wrap items-center justify-between gap-2">
              <div class="space-y-0.5">
                <span class="block text-[10px] font-bold text-gray-400 uppercase tracking-wider">Correo electrónico de acceso y envío de comprobantes</span>
                <span class="font-semibold text-sm text-gray-900">{{ auth.currentUser()?.email }}</span>
              </div>
              <span class="rounded-lg bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                Correo verificado
              </span>
            </div>

            <form (ngSubmit)="saveProfile()" class="space-y-5">
              <!-- Document Selection & Number -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1.5">Tipo de documento</label>
                  <select
                    [(ngModel)]="profileDocType"
                    name="profileDocType"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-medium text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  >
                    <option value="DNI">DNI (8 dígitos)</option>
                    <option value="RUC">RUC (11 dígitos)</option>
                    <option value="CE">Carnet de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div class="sm:col-span-2">
                  <label class="block text-xs font-bold text-gray-700 mb-1.5">
                    Número de documento
                  </label>
                  <div class="relative flex items-center">
                    <input
                      type="text"
                      [(ngModel)]="profileDocNumber"
                      name="profileDocNumber"
                      (blur)="onProfileDocChange()"
                      [attr.maxlength]="profileDocType === 'RUC' ? 11 : profileDocType === 'DNI' ? 8 : 15"
                      placeholder="Ej: 71156519 o 20608899114"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-28 py-2 text-sm font-mono font-semibold text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                    <div class="absolute right-1.5 flex items-center">
                      @if (isLookingUpDoc()) {
                        <span class="p-1.5 text-orange-600">
                          <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                          </svg>
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="lookupProfileDoc()"
                          class="rounded-lg px-3 py-1.5 text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 transition cursor-pointer"
                          title="Consultar padrón oficial"
                        >
                          Autocompletar
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <!-- Notice only when lookup error / not found -->
              @if (profileDocNotice()) {
                <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
                  <svg class="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>No pudimos consultar el documento automáticamente. Puedes escribir tu nombre o razón social directamente abajo.</span>
                </div>
              }

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <!-- Full Name / Business Name -->
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1.5">
                    {{ profileDocType === 'RUC' ? 'Razón Social *' : 'Nombre Completo *' }}
                  </label>
                  <input
                    type="text"
                    [(ngModel)]="profileFullName"
                    name="profileFullName"
                    required
                    placeholder="Nombres y apellidos o razón social"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                </div>

                <!-- Phone Number (9 digits) -->
                <div>
                  <label class="block text-xs font-bold text-gray-700 mb-1.5">
                    Teléfono celular <span class="text-gray-400 font-normal">(9 dígitos para coordinación GPS)</span>
                  </label>
                  <input
                    type="tel"
                    [(ngModel)]="profilePhone"
                    name="profilePhone"
                    maxlength="9"
                    placeholder="Ej: 987654321"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-mono font-semibold text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  />
                </div>
              </div>

              <!-- Purchase Requirements Recommendation Card -->
              <div class="rounded-xl border border-orange-200/70 bg-orange-50/50 p-4 text-xs text-gray-800 space-y-1.5">
                <div class="font-bold flex items-center gap-1.5 text-gray-900">
                  <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>Normativa SUNAT para Comprobantes Electrónicos:</span>
                </div>
                <ul class="list-disc list-inside space-y-1 text-gray-600 text-[11px] pt-0.5">
                  <li><strong class="text-gray-800">Boleta de venta menor a S/ 700:</strong> Emisión rápida sin DNI obligatorio.</li>
                  <li><strong class="text-gray-800">Boleta de venta desde S/ 700:</strong> Es obligatorio consignar DNI o Carnet de Extranjería vigente.</li>
                  <li><strong class="text-gray-800">Factura electrónica comercial:</strong> Requiere RUC de 11 dígitos activo y habido en SUNAT.</li>
                </ul>
              </div>

              <!-- Submit button -->
              <div class="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  [disabled]="isSavingProfile()"
                  class="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition cursor-pointer"
                >
                  @if (isSavingProfile()) {
                    <svg class="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                      <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                    </svg>
                    <span>Guardando cambios...</span>
                  } @else {
                    <span>Guardar datos de cliente</span>
                  }
                </button>

                <button
                  type="button"
                  (click)="resetProfileForm()"
                  class="min-h-[44px] rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
                >
                  Restablecer
                </button>
              </div>
            </form>
          </div>
        }
      </div>
    </div>
  `,
})
export class MyOrdersPageComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  readonly auth = inject(AuthService);
  private readonly lookupService = inject(LookupService);
  private readonly toast = inject(ToastService);
  readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly route = inject(ActivatedRoute);

  readonly orders = signal<Order[]>([]);
  readonly isLoading = signal(true);
  readonly activeTab = signal<'orders' | 'profile'>('orders');
  readonly orderFilter = signal<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

  readonly activeOrdersCount = computed(
    () => this.orders().filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO').length
  );
  readonly completedOrdersCount = computed(
    () => this.orders().filter((o) => o.status === 'ENTREGADO').length
  );
  readonly filteredOrders = computed(() => {
    const filter = this.orderFilter();
    const list = this.orders();
    if (filter === 'ACTIVE') {
      return list.filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO');
    }
    if (filter === 'COMPLETED') {
      return list.filter((o) => o.status === 'ENTREGADO');
    }
    return list;
  });

  profileFullName = '';
  profileDocType = 'DNI';
  profileDocNumber = '';
  profilePhone = '';

  readonly isSavingProfile = signal(false);
  readonly isLookingUpDoc = signal(false);
  readonly profileDocNotice = signal(false);

  getUserInitials(): string {
    const name = (this.auth.currentUser()?.fullName || 'Cliente').trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  downloadBoletaPdf(ord: Order): void {
    this.pdfInvoiceService.generateInvoicePdf(ord, true);
    this.toast.success('Descargando comprobante', `Generando PDF oficial para el pedido #${ord.orderNumber}`);
  }

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'profile') {
        this.activeTab.set('profile');
      }
    });

    this.resetProfileForm();

    this.ordersService
      .getMyOrders()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (list) => this.orders.set(list),
        error: () => this.orders.set([]),
      });
  }

  resetProfileForm(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.profileFullName = user.fullName || '';
      this.profileDocType = user.documentType || 'DNI';
      this.profileDocNumber = user.documentNumber || '';
      this.profilePhone = user.phone || '';
    }
    this.profileDocNotice.set(false);
  }

  onProfileDocChange(): void {
    const digits = (this.profileDocNumber || '').replace(/\D/g, '');
    this.profileDocNumber = digits;
    if (this.profileDocType === 'DNI' && digits.length === 11 && (digits.startsWith('10') || digits.startsWith('20'))) {
      this.profileDocType = 'RUC';
    }
  }

  lookupProfileDoc(): void {
    const doc = (this.profileDocNumber || '').trim();
    if (!doc) {
      this.toast.info('Documento', 'Ingresa un número de DNI u RUC para buscar.');
      return;
    }
    this.isLookingUpDoc.set(true);
    this.profileDocNotice.set(false);

    this.lookupService
      .lookupDocument(doc)
      .pipe(finalize(() => this.isLookingUpDoc.set(false)))
      .subscribe({
        next: (res) => {
          const resolved = (res.businessName || res.fullName || '').trim();
          if (res.found && resolved) {
            this.profileFullName = resolved;
            if (res.documentType === 'RUC') this.profileDocType = 'RUC';
            else if (res.documentType === 'DNI') this.profileDocType = 'DNI';
          } else {
            this.profileDocNotice.set(true);
          }
        },
        error: () => {
          this.profileDocNotice.set(true);
        },
      });
  }

  saveProfile(): void {
    const fullName = (this.profileFullName || '').trim();
    if (!fullName) {
      this.toast.error('Nombre requerido', 'Por favor ingresa tu nombre completo o razón social.');
      return;
    }

    const phone = (this.profilePhone || '').trim();
    if (phone && !/^9\d{8}$/.test(phone)) {
      this.toast.error('Celular inválido', 'El celular debe tener 9 dígitos y comenzar con 9.');
      return;
    }

    const docNum = (this.profileDocNumber || '').trim();
    if (docNum) {
      const expLen = this.profileDocType === 'RUC' ? 11 : this.profileDocType === 'DNI' ? 8 : null;
      if (expLen && docNum.length !== expLen) {
        this.toast.error('Documento incompleto', `El número de ${this.profileDocType} debe tener exactamente ${expLen} dígitos.`);
        return;
      }
    }

    this.isSavingProfile.set(true);
    this.auth
      .updateProfile({
        fullName,
        phone: phone || undefined,
        documentType: docNum ? this.profileDocType : undefined,
        documentNumber: docNum || undefined,
      })
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Datos actualizados', 'Tu información personal se ha guardado correctamente.');
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo guardar la información. Inténtalo nuevamente.';
          this.toast.error('Error al actualizar', msg);
        },
      });
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'CONFIRMADO':
        return 'Confirmado';
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
}
