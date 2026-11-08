import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import {
  NotificationCenterService,
  AppNotification,
} from '../../../core/services/notification-center.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  styles: [`
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 40;
      width: 100%;
    }
  `],
  template: `
    <header class="w-full border-b border-gray-200/90 bg-white/95 text-gray-900 backdrop-blur-md shadow-2xs">
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div class="flex h-16 items-center justify-between gap-3">
          <!-- Real Store Brand Logo (User's Official Logo) -->
          <a [routerLink]="auth.brandHomeLink()" class="flex items-center gap-3 group shrink-0">
            <img
              src="/images/logos/logo.jpg"
              alt="Autopartes Asunción"
              class="h-10 sm:h-11 w-auto object-contain rounded-xl border border-gray-200/80 shadow-2xs group-hover:scale-103 transition"
            />
            <div class="leading-tight hidden sm:block">
              <span class="block text-base font-black tracking-tight text-gray-950">Autopartes Asunción</span>
              <span class="block text-[11px] font-bold text-orange-600">
                Camiones y Vehículos Automotores
              </span>
            </div>
          </a>

          <!-- Desktop Navigation -->
          <nav class="hidden lg:flex items-center gap-1 shrink-0">
            @if (auth.canAccessCatalog()) {
              <a
                routerLink="/"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                [routerLinkActiveOptions]="{ exact: true }"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                </svg>
                <span>Catálogo</span>
              </a>
            }

            @if (auth.canAccessTracking()) {
              <a
                routerLink="/track"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>Seguimiento</span>
              </a>
            }

            @if (auth.canAccessMyOrders()) {
              <a
                routerLink="/my-orders"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Mis pedidos</span>
              </a>
            }

            @if (auth.canAccessAdmin()) {
              <a
                routerLink="/admin"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
                <span>{{ auth.primaryRole() === 'VENDEDOR' ? 'Panel de Ventas' : 'Administración' }}</span>
              </a>

              <a
                routerLink="/pos"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
                <span>Caja / Punto de Venta</span>
              </a>
            }

            @if (auth.canAccessDelivery()) {
              <a
                routerLink="/delivery"
                routerLinkActive="bg-orange-50 text-orange-700 border-orange-200 font-bold"
                class="inline-flex shrink-0 whitespace-nowrap items-center gap-1.5 rounded-xl border border-transparent px-2.5 xl:px-3 py-2 text-xs xl:text-sm font-bold text-gray-800 hover:bg-gray-50 hover:text-gray-950 transition"
              >
                <svg class="h-4 w-4 shrink-0 text-orange-600/80" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V4.5A2.25 2.25 0 0012 2.25H4.5A2.25 2.25 0 002.25 4.5v9.75m12 0H2.25" />
                </svg>
                <span>Reparto</span>
              </a>
            }
          </nav>

          <!-- Right Action Controls -->
          <div class="flex items-center gap-2">
            <!-- 1. NOTIFICATIONS BELL & DROPDOWN (Only when authenticated) -->
            @if (auth.isAuthenticated()) {
              <div class="relative notif-dropdown-container">
                <button
                  type="button"
                  (click)="toggleNotifications($event)"
                  class="relative inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-xs font-semibold text-gray-700 shadow-2xs hover:border-orange-300 hover:text-orange-600 transition cursor-pointer"
                  title="Historial de notificaciones y actualizaciones en vivo"
                  aria-label="Notificaciones"
                >
                <!-- Bell SVG -->
                <svg
                  class="h-5 w-5 text-gray-600 transition-transform group-hover:scale-110"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="1.8"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>

                <!-- Unread Badge with ping animation -->
                @if (notifService.unreadCount() > 0) {
                  <span
                    [class]="notifService.unreadStockAlertsCount() > 0 ? 'bg-red-600 ring-2 ring-red-300' : 'bg-red-600'"
                    class="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black text-white shadow-xs"
                  >
                    <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                    <span class="relative">{{ notifService.unreadCount() > 99 ? '99+' : notifService.unreadCount() }}</span>
                  </span>
                }
              </button>

              <!-- Notifications Popover Dropdown -->
              @if (notifOpen()) {
                <div
                  class="fixed left-3 right-3 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 max-w-sm sm:max-w-none mx-auto sm:mx-0 rounded-2xl border border-gray-200 bg-white shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                  (click)="$event.stopPropagation()"
                >
                  <!-- Popover Header -->
                  <div class="flex items-center justify-between border-b border-gray-100 bg-gray-50/90 px-4 py-3">
                    <div class="flex items-center gap-2.5">
                      <div class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                        </svg>
                      </div>
                      <div>
                        <h3 class="text-sm font-extrabold text-gray-900 leading-none">Notificaciones</h3>
                        <span class="text-[11px] text-gray-500 font-medium">
                          {{ notifService.unreadCount() }} pendiente(s) de lectura
                        </span>
                      </div>
                    </div>

                    <div class="flex items-center gap-1">
                      @if (notifService.unreadCount() > 0) {
                        <button
                          type="button"
                          (click)="notifService.markAllAsRead()"
                          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-white hover:text-orange-600 hover:shadow-2xs transition cursor-pointer"
                          title="Marcar todas como leídas"
                        >
                          <svg class="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                          </svg>
                          <span class="hidden sm:inline">Leer todas</span>
                        </button>
                      }
                      @if (notifService.notifications().length > 0) {
                        <button
                          type="button"
                          (click)="notifService.clearAll()"
                          class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-white hover:text-red-600 hover:shadow-2xs transition cursor-pointer"
                          title="Vaciar bandeja de notificaciones"
                        >
                          <span>Limpiar</span>
                        </button>
                      }
                      <button
                        type="button"
                        (click)="notifService.refresh()"
                        class="rounded-lg p-1.5 text-xs text-gray-600 hover:bg-white hover:text-orange-600 hover:shadow-2xs transition cursor-pointer"
                        title="Actualizar ahora"
                      >
                        <svg class="h-4 w-4" [class.animate-spin]="notifService.isLoading()" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        (click)="notifOpen.set(false)"
                        class="rounded-lg p-1.5 text-xs text-gray-400 hover:bg-white hover:text-gray-700 hover:shadow-2xs transition"
                        title="Cerrar panel"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <!-- Filter Tabs -->
                  <div class="flex items-center gap-1 border-b border-gray-100 bg-white px-3 py-2 text-xs overflow-x-auto scrollbar-none">
                    <button
                      type="button"
                      (click)="notifFilter.set('ALL')"
                      [class]="notifFilter() === 'ALL' ? 'bg-orange-50 font-bold text-orange-700' : 'text-gray-600 hover:text-gray-900 font-medium'"
                      class="rounded-md px-2.5 py-1 transition"
                    >
                      Todas ({{ notifService.notifications().length }})
                    </button>
                    <button
                      type="button"
                      (click)="notifFilter.set('UNREAD')"
                      [class]="notifFilter() === 'UNREAD' ? 'bg-orange-50 font-bold text-orange-700' : 'text-gray-600 hover:text-gray-900 font-medium'"
                      class="rounded-md px-2.5 py-1 transition"
                    >
                      No leídas ({{ notifService.unreadCount() }})
                    </button>
                    @if (auth.hasAnyRole(['ADMIN', 'VENDEDOR'])) {
                      <button
                        type="button"
                        (click)="notifFilter.set('SALES')"
                        [class]="notifFilter() === 'SALES' ? 'bg-orange-50 font-bold text-orange-700' : 'text-gray-600 hover:text-gray-900 font-medium'"
                        class="rounded-md px-2.5 py-1 transition"
                      >
                        Ventas
                      </button>
                      <button
                        type="button"
                        (click)="notifFilter.set('DELIVERY')"
                        [class]="notifFilter() === 'DELIVERY' ? 'bg-orange-50 font-bold text-orange-700' : 'text-gray-600 hover:text-gray-900 font-medium'"
                        class="rounded-md px-2.5 py-1 transition"
                      >
                        Repartos
                      </button>
                      <button
                        type="button"
                        (click)="notifFilter.set('STOCK')"
                        [class]="notifFilter() === 'STOCK' ? 'bg-red-50 font-bold text-red-700 ring-1 ring-red-200' : 'text-gray-600 hover:text-gray-900 font-medium'"
                        class="rounded-md px-2.5 py-1 transition inline-flex items-center gap-1.5"
                        title="Alertas de stock agotado o por reponer"
                      >
                        <img src="/images/icons/alarma.png" alt="Stock" class="h-3.5 w-3.5 object-contain inline-block" />
                        <span>Stock</span>
                        @if (notifService.unreadStockAlertsCount() > 0) {
                          <span class="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-bold text-white">
                            {{ notifService.unreadStockAlertsCount() }}
                          </span>
                        }
                      </button>
                    }
                  </div>

                  <!-- Notification List -->
                  <div class="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    @for (item of filteredNotifications(); track item.id) {
                      <div
                        (click)="onNotificationClick(item)"
                        [class.bg-red-50/70]="item.category === 'STOCK_ALERT' && !item.read"
                        [class.border-l-4]="item.category === 'STOCK_ALERT'"
                        [class.border-l-red-600]="item.category === 'STOCK_ALERT'"
                        [class.bg-orange-50/50]="item.category !== 'STOCK_ALERT' && !item.read"
                        class="group flex items-start gap-3 p-3.5 hover:bg-gray-50/90 transition cursor-pointer relative"
                      >
                        <!-- Category Icon Badge -->
                        <div
                          class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl font-bold shadow-2xs"
                          [ngClass]="getCategoryBadgeClass(item)"
                        >
                          @switch (item.iconType) {
                            @case ('truck') {
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V4.5A2.25 2.25 0 0012 2.25H4.5A2.25 2.25 0 002.25 4.5v9.75m12 0H2.25" />
                              </svg>
                            }
                            @case ('shopping-bag') {
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                              </svg>
                            }
                            @case ('cash') {
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                              </svg>
                            }
                            @case ('check-circle') {
                              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            }
                            @default {
                              @if (item.category === 'STOCK_ALERT') {
                                <img src="/images/icons/alarma.png" alt="Alerta Stock" class="h-5 w-5 object-contain" />
                              } @else {
                                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                                </svg>
                              }
                            }
                          }
                        </div>

                        <!-- Content -->
                        <div class="flex-1 min-w-0 pr-5">
                          <div class="flex items-center justify-between gap-1 mb-0.5">
                            <span
                              [class]="item.category === 'STOCK_ALERT' ? 'text-xs font-black text-red-950 truncate' : 'text-xs font-bold text-gray-900 truncate'"
                            >
                              {{ item.title }}
                            </span>
                            @if (!item.read) {
                              <span
                                [class]="item.category === 'STOCK_ALERT' ? 'h-2 w-2 rounded-full bg-red-600 shrink-0 animate-pulse' : 'h-2 w-2 rounded-full bg-orange-600 shrink-0'"
                              ></span>
                            }
                          </div>
                          <p class="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                            {{ item.message }}
                          </p>
                          <div class="flex items-center gap-2 mt-1.5">
                            <span class="text-[10px] text-gray-400 font-medium">
                              {{ item.relativeTime }}
                            </span>
                            @if (item.statusBadge) {
                              <span
                                [class]="
                                  item.category === 'STOCK_ALERT'
                                    ? 'rounded bg-red-600 text-white font-black px-1.5 py-0.5 text-[9px] uppercase shadow-2xs'
                                    : 'rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-semibold text-gray-600 uppercase'
                                "
                              >
                                {{ item.statusBadge }}
                              </span>
                            }
                          </div>
                        </div>

                        <!-- Dismiss single notification button -->
                        <button
                          type="button"
                          (click)="notifService.dismissNotification(item.id, $event)"
                          class="absolute top-2.5 right-2.5 rounded-md p-1 text-[11px] text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-gray-200/70 hover:text-gray-700 transition cursor-pointer"
                          title="Descartar aviso"
                        >
                          ✕
                        </button>
                      </div>
                    } @empty {
                      <div class="flex flex-col items-center justify-center p-8 text-center text-gray-500">
                        <div class="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600 mb-2">
                          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p class="text-xs font-bold text-gray-800">¡Todo al día!</p>
                        <p class="text-[11px] text-gray-500 max-w-[200px] mt-0.5">
                          No tienes notificaciones pendientes en este momento.
                        </p>
                      </div>
                    }
                  </div>

                  <!-- Popover Footer -->
                  <div class="border-t border-gray-100 bg-gray-50/70 p-2.5 text-center space-y-1">
                    <span class="block text-[10px] text-gray-400">
                      Auto-limpieza activa: los avisos completados se archivan tras 7 días (o 24 h de leídos).
                    </span>
                    @if (auth.hasAnyRole(['ADMIN', 'VENDEDOR'])) {
                      <a
                        routerLink="/admin"
                        (click)="notifOpen.set(false)"
                        class="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition"
                      >
                        <span>Ver panel completo de administración</span>
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </a>
                    } @else if (auth.isAuthenticated()) {
                      <a
                        routerLink="/my-orders"
                        (click)="notifOpen.set(false)"
                        class="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition"
                      >
                        <span>Ver historial completo de mis pedidos</span>
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </a>
                    } @else {
                      <a
                        routerLink="/login"
                        (click)="notifOpen.set(false)"
                        class="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 hover:text-orange-700 transition"
                      >
                        <span>Inicia sesión para recibir alertas en tiempo real</span>
                      </a>
                    }
                  </div>
                </div>
              }
              </div>
            }

            <!-- 2. Cart Drawer Button (Dazzling Highlight when cart has items) -->
            @if (auth.canAccessCart()) {
              <button
                type="button"
                (click)="cart.toggleDrawer()"
                [class]="cart.totalItems() > 0
                  ? 'hidden lg:inline-flex relative shrink-0 whitespace-nowrap min-h-[40px] items-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 px-3.5 py-2 text-xs font-black text-white shadow-md shadow-orange-500/35 ring-2 ring-orange-300 hover:scale-103 active:scale-95 transition-all cursor-pointer'
                  : 'hidden lg:inline-flex relative shrink-0 whitespace-nowrap min-h-[40px] items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-800 shadow-2xs hover:border-orange-300 hover:bg-orange-50/40 hover:text-gray-950 transition cursor-pointer'
                "
              >
                <div class="relative flex items-center justify-center">
                  @if (cart.totalItems() > 0) {
                    <span class="absolute -inset-1 rounded-full bg-white/40 animate-ping"></span>
                  }
                  <svg class="h-4 w-4 shrink-0" [class.text-white]="cart.totalItems() > 0" [class.text-orange-600]="cart.totalItems() <= 0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                </div>
                <span class="hidden sm:inline">Carrito</span>
                @if (cart.totalItems() > 0) {
                  <span class="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-mono text-[11px] font-black text-orange-600 shadow-xs">
                    {{ cart.totalItems() }}
                  </span>
                  <span class="hidden md:inline font-black text-white text-[11px]">
                    · S/ {{ cart.subtotal() | number: '1.2-2' }}
                  </span>
                  @if (cart.hasActiveReservation()) {
                    <span class="hidden lg:inline-flex items-center gap-1 rounded-full bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-amber-200 ring-1 ring-white/20 font-mono">
                      ⏳ {{ cart.reservationFormattedTimer() }}
                    </span>
                  }
                }
              </button>
            }

            <!-- 3. User Session -->
            @if (auth.isAuthenticated()) {
              <div class="hidden sm:flex shrink-0 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/90 pl-2 pr-1.5 py-1">
                <div class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-[11px] font-extrabold text-white">
                  {{ getUserInitials() }}
                </div>
                <div class="text-left leading-tight pr-1">
                  <span class="block text-xs font-bold text-gray-900 max-w-[120px] truncate">
                    {{ auth.currentUser()?.fullName }}
                  </span>
                  <span class="inline-block text-[10px] font-bold uppercase tracking-wider text-orange-600">
                    {{ roleLabel() }}
                  </span>
                </div>

                @if (auth.canAccessMyOrders()) {
                  <a
                    routerLink="/my-orders"
                    [queryParams]="{ tab: 'profile' }"
                    class="inline-flex h-8 shrink-0 whitespace-nowrap items-center rounded-lg border border-gray-200 bg-white px-2.5 text-[11px] font-semibold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                    title="Editar mis datos de cliente"
                  >
                    Mis datos
                  </a>
                }

                <button
                  type="button"
                  (click)="onLogout()"
                  class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                  title="Cerrar sesión"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </button>
              </div>
            } @else {
              <div class="flex items-center gap-1.5">
                <a
                  routerLink="/login"
                  class="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition"
                >
                  Iniciar sesión
                </a>
                <a
                  routerLink="/login"
                  [queryParams]="{ tab: 'register' }"
                  class="hidden sm:inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 transition"
                >
                  Registrarse
                </a>
              </div>
            }

            <!-- Mobile More Menu Button -->
            <button
              type="button"
              (click)="mobileOpen.set(!mobileOpen())"
              class="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              aria-label="Abrir menú"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                @if (mobileOpen()) {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                } @else {
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                }
              </svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Mobile Dropdown Menu (Clean, Non-Redundant Operational & Session Access) -->
      @if (mobileOpen()) {
        <div class="lg:hidden border-t border-gray-200 bg-white px-4 py-3 space-y-2 shadow-lg animate-fadeIn">
          @if (auth.isAuthenticated()) {
            <!-- User Profile Summary Card -->
            <div class="rounded-xl border border-orange-100 bg-orange-50/50 p-3 flex items-center justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-1.5">
                  <span class="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <p class="truncate text-xs font-bold text-gray-950">{{ auth.currentUser()?.fullName }}</p>
                </div>
                <p class="text-[11px] font-semibold text-orange-700 mt-0.5">{{ roleLabel() }} • {{ auth.currentUser()?.email }}</p>
              </div>
              <a
                routerLink="/my-orders"
                [queryParams]="{ tab: 'profile' }"
                (click)="mobileOpen.set(false)"
                class="shrink-0 rounded-lg border border-orange-200 bg-white px-2.5 py-1 text-xs font-bold text-orange-700 shadow-2xs hover:bg-orange-50"
              >
                Mi perfil
              </a>
            </div>

            <!-- Staff-only Quick Links -->
            @if (auth.canAccessAdmin()) {
              <div class="pt-1 space-y-1">
                <a
                  routerLink="/admin"
                  (click)="mobileOpen.set(false)"
                  class="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-orange-50 hover:text-orange-700"
                >
                  <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
                  </svg>
                  <span>{{ auth.primaryRole() === 'VENDEDOR' ? 'Panel de Ventas ERP' : 'Panel de Administración' }}</span>
                </a>
                <a
                  routerLink="/pos"
                  (click)="mobileOpen.set(false)"
                  class="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-orange-50 hover:text-orange-700"
                >
                  <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25" />
                  </svg>
                  <span>Caja / Punto de Venta POS</span>
                </a>
              </div>
            }

            @if (auth.canAccessDelivery()) {
              <a
                routerLink="/delivery"
                (click)="mobileOpen.set(false)"
                class="flex items-center gap-2.5 rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2 text-xs font-semibold text-gray-800 hover:bg-orange-50 hover:text-orange-700"
              >
                <svg class="h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125" />
                </svg>
                <span>Panel de Reparto Motorizado</span>
              </a>
            }

            <!-- Institutional Links & Session Termination -->
            <div class="pt-2 flex items-center justify-between gap-2 border-t border-gray-100">
              <a
                routerLink="/libro-de-reclamaciones"
                (click)="mobileOpen.set(false)"
                class="text-xs text-gray-500 hover:text-orange-600 font-medium"
              >
                Libro de Reclamaciones
              </a>
              <div class="flex items-center gap-2">
                <button
                  type="button"
                  (click)="onLogout(); mobileOpen.set(false)"
                  class="rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 transition cursor-pointer"
                >
                  Cerrar sesión
                </button>
              </div>
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-2 w-full pt-1">
              <a
                routerLink="/login"
                (click)="mobileOpen.set(false)"
                class="text-center rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Iniciar sesión
              </a>
              <a
                routerLink="/login"
                [queryParams]="{ tab: 'register' }"
                (click)="mobileOpen.set(false)"
                class="text-center rounded-xl bg-orange-600 py-2.5 text-xs font-semibold text-white hover:bg-orange-700"
              >
                Registrarse
              </a>
            </div>
            <div class="pt-2 text-center border-t border-gray-100">
              <a
                routerLink="/libro-de-reclamaciones"
                (click)="mobileOpen.set(false)"
                class="text-xs text-gray-500 hover:text-orange-600 font-medium"
              >
                Libro de Reclamaciones INDECOPI
              </a>
            </div>
          }
        </div>
      }
    </header>

    <!-- Mobile Bottom Navigation Bar (Thumb-Friendly Smartphone Ergonomics) -->
    <nav
      aria-label="Navegación móvil"
      class="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-md safe-area-pb"
    >
      <div class="flex items-stretch justify-around px-1">
        @if (auth.canAccessCatalog()) {
          <a
            routerLink="/"
            routerLinkActive="text-orange-600"
            [routerLinkActiveOptions]="{ exact: true }"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
            </svg>
            <span class="text-[11px] font-medium">Catálogo</span>
          </a>
        }

        @if (auth.canAccessTracking()) {
          <a
            routerLink="/track"
            routerLinkActive="text-orange-600"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            <span class="text-[11px] font-medium">Seguimiento</span>
          </a>
        }

        @if (auth.canAccessCart()) {
          <button
            type="button"
            (click)="cart.toggleDrawer()"
            [class]="cart.totalItems() > 0 ? 'text-orange-600' : 'text-gray-500 hover:text-gray-900'"
            class="relative flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 min-h-[56px] transition-all select-none cursor-pointer"
          >
            @if (cart.totalItems() > 0) {
              <!-- Glowing Dazzle Halo effect when cart has items -->
              <div class="relative flex items-center justify-center">
                <!-- Outer Pulsing Glow Aura (Deslumbre) -->
                <span class="absolute -inset-1.5 rounded-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-400 opacity-75 blur-[3px] animate-pulse"></span>
                <span class="absolute -inset-2.5 rounded-full bg-orange-400/30 animate-ping"></span>

                <!-- Central Radiant Cart Icon Container -->
                <div class="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-tr from-orange-600 to-amber-500 text-white shadow-md shadow-orange-500/40 ring-2 ring-white">
                  <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                </div>

                <!-- Live Item Count Badge with subtle bounce -->
                <span class="absolute -top-1 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[9px] font-black text-white shadow-xs ring-2 ring-white animate-bounce">
                  {{ cart.totalItems() }}
                </span>
              </div>

              <!-- Live Amount & Timer Tag -->
              <div class="flex flex-col items-center leading-none mt-0.5">
                <span class="text-[11px] font-black text-orange-600 tracking-tight">
                  Carrito · S/ {{ cart.subtotal() | number: '1.0-0' }}
                </span>
                @if (cart.hasActiveReservation()) {
                  <span class="text-[9px] font-extrabold text-amber-600 font-mono tracking-tighter">
                    ⏳ {{ cart.reservationFormattedTimer() }}
                  </span>
                }
              </div>
            } @else {
              <!-- Normal Flat Quiet State when cart is empty -->
              <div class="relative">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <span class="text-[11px] font-medium">Carrito</span>
            }
          </button>
        }

        @if (auth.canAccessDelivery() && auth.primaryRole() === 'MOTORIZADO') {
          <a
            routerLink="/delivery"
            routerLinkActive="text-orange-600"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
            <span class="text-[11px] font-medium">Reparto</span>
          </a>
        } @else if (auth.canAccessAdmin()) {
          <a
            routerLink="/admin"
            routerLinkActive="text-orange-600"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
            <span class="text-[11px] font-medium">Gestión</span>
          </a>
        } @else if (auth.isAuthenticated()) {
          <a
            routerLink="/my-orders"
            [routerLinkActiveOptions]="{ exact: true }"
            routerLinkActive="text-orange-600 font-bold"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
            <span class="text-[11px] font-medium">Pedidos</span>
          </a>
        }

        @if (auth.isAuthenticated()) {
          <a
            routerLink="/my-orders"
            [queryParams]="{ tab: 'profile' }"
            routerLinkActive="text-orange-600"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span class="text-[11px] font-medium">Cuenta</span>
          </a>
        } @else {
          <a
            routerLink="/login"
            routerLinkActive="text-orange-600"
            class="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 min-h-[56px] text-gray-500 hover:text-gray-900 transition"
          >
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
            <span class="text-[11px] font-medium">Ingresar</span>
          </a>
        }
      </div>
    </nav>
    <!-- Desktop Floating Quick-Cart Dock (PC & Laptop Ergonomics: NEVER scroll up) -->
    @if (auth.canAccessCart() && cart.totalItems() > 0) {
      <div class="hidden lg:flex fixed bottom-6 right-6 z-40 items-center gap-3 rounded-2xl bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 p-2 pl-4 text-white shadow-xl shadow-orange-600/35 ring-2 ring-white/90">
        <div class="flex items-center gap-2.5">
          <div class="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white text-orange-600 font-bold shadow-xs">
            <svg class="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span class="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-red-600 px-1 font-mono text-[9px] font-black text-white ring-1 ring-white">
              {{ cart.totalItems() }}
            </span>
          </div>
          <div class="leading-tight select-none">
            <span class="block text-xs font-black tracking-tight text-white">
              {{ cart.totalItems() }} {{ cart.totalItems() === 1 ? 'repuesto' : 'repuestos' }} · S/ {{ cart.subtotal() | number: '1.2-2' }}
            </span>
            @if (cart.hasActiveReservation()) {
              <span class="block text-[10px] font-bold text-amber-100 font-mono">
                ⏳ Reserva asegurada: {{ cart.reservationFormattedTimer() }}
              </span>
            }
          </div>
        </div>
        <button
          type="button"
          (click)="cart.toggleDrawer()"
          class="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-black text-orange-700 shadow-xs hover:bg-orange-50 active:scale-95 transition cursor-pointer"
        >
          <span>Ver Carrito</span>
          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>
    }

  `,
})
export class NavbarComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly notifService = inject(NotificationCenterService);
  private readonly router = inject(Router);

  readonly mobileOpen = signal(false);
  readonly notifOpen = signal(false);
  readonly notifFilter = signal<'ALL' | 'UNREAD' | 'SALES' | 'DELIVERY' | 'STOCK'>('ALL');

  readonly filteredNotifications = computed(() => {
    const list = this.notifService.notifications();
    const filter = this.notifFilter();

    switch (filter) {
      case 'UNREAD':
        return list.filter((n) => !n.read);
      case 'SALES':
        return list.filter(
          (n) =>
            n.category === 'NEW_SALE' ||
            n.category === 'PAYMENT' ||
            n.category === 'ORDER_STATUS'
        );
      case 'DELIVERY':
        return list.filter((n) => n.category === 'DELIVERY');
      case 'STOCK':
        return list.filter((n) => n.category === 'STOCK_ALERT');
      default:
        return list;
    }
  });

  getUserInitials(): string {
    const name = (this.auth.currentUser()?.fullName || 'U').trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.notif-dropdown-container')) {
      this.notifOpen.set(false);
    }
  }

  toggleNotifications(event: MouseEvent): void {
    event.stopPropagation();
    this.notifOpen.set(!this.notifOpen());
    if (this.notifOpen()) {
      this.notifService.refresh(true);
    }
  }

  onNotificationClick(item: AppNotification): void {
    this.notifService.handleNotificationClick(item);
    this.notifOpen.set(false);
  }

  getCategoryBadgeClass(item: AppNotification): string {
    if (item.category === 'STOCK_ALERT') {
      return 'bg-red-100 text-red-700 border border-red-300 ring-2 ring-red-200/50';
    }
    switch (item.accentColor) {
      case 'orange':
        return 'bg-orange-100 text-orange-700 border border-orange-200';
      case 'emerald':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'blue':
        return 'bg-blue-100 text-blue-700 border border-blue-200';
      case 'purple':
        return 'bg-purple-100 text-purple-700 border border-purple-200';
      case 'rose':
        return 'bg-rose-100 text-rose-700 border border-rose-200';
      case 'amber':
        return 'bg-amber-100 text-amber-700 border border-amber-200';
      default:
        return 'bg-gray-100 text-gray-700 border border-gray-200';
    }
  }

  roleLabel(): string {
    switch (this.auth.primaryRole()) {
      case 'ADMIN':
        return 'Administrador';
      case 'VENDEDOR':
        return 'Asesor de ventas';
      case 'MOTORIZADO':
        return 'Reparto';
      default:
        return 'Cliente';
    }
  }

  onLogout(): void {
    this.auth.logout(true);
    void this.router.navigate(['/login']);
  }
}
