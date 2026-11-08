import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, retry } from 'rxjs';
import { Part } from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { ToastService } from '../../core/services/toast.service';
import { PromotionService } from '../../core/services/promotion.service';

@Component({
  selector: 'app-part-detail-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pt-6 pb-24 lg:pb-14 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-7xl space-y-6">
        <!-- Breadcrumb & Back Bar -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <nav class="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
            <a routerLink="/" class="hover:text-orange-600 font-semibold transition">Catálogo</a>
            <span>/</span>
            @if (part(); as p) {
              <span class="text-gray-600">{{ p.categoryName || 'Repuestos' }}</span>
              <span>/</span>
              <span class="font-mono text-gray-900 font-bold">{{ p.oemCode || p.sku }}</span>
            }
          </nav>

          <a
            routerLink="/"
            class="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-1.5 text-xs font-bold text-gray-700 hover:border-orange-300 hover:text-orange-700 transition shadow-2xs"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            <span>Volver al catálogo</span>
          </a>
        </div>

        @if (isLoading()) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-xs">
            <div class="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></div>
            <p class="text-xs font-medium text-gray-500">Cargando ficha técnica y compatibilidad del repuesto...</p>
          </div>
        } @else if (!part()) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-xs">
            <h2 class="text-lg font-extrabold text-gray-900">Repuesto no encontrado</h2>
            <p class="text-xs text-gray-500">Es posible que el producto ya no esté disponible en el catálogo.</p>
            <a routerLink="/" class="inline-block rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700">
              Volver al catálogo
            </a>
          </div>
        } @else if (part(); as p) {
          <!-- Main 2-Column E-Commerce Product Card -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 rounded-2xl border border-gray-200/90 bg-white p-5 sm:p-8 shadow-xs relative overflow-hidden">
            <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>

            <!-- Left: Gallery with Interactive Hover Lens Zoom -->
            <div class="lg:col-span-6 space-y-3">
              <div
                (mousemove)="onMouseMoveZoom($event)"
                (mouseenter)="isZooming.set(true)"
                (mouseleave)="isZooming.set(false)"
                [class.border-orange-400]="isZooming()"
                class="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 cursor-zoom-in select-none transition-colors"
              >
                <img
                  [src]="activeImageUrl()"
                  [alt]="p.name"
                  (error)="onDetailImageError($event, p)"
                  [style.transform]="isZooming() ? 'scale(2.35)' : 'scale(1)'"
                  [style.transform-origin]="zoomOrigin()"
                  class="h-full w-full object-cover transition-transform duration-100 ease-out"
                />

                <div class="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-600 shadow-2xs">
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                  <span>Pasa el cursor para inspección a detalle</span>
                </div>
              </div>

              <!-- Gallery Thumbnails -->
              @if (galleryUrls().length > 1) {
                <div class="flex gap-2.5 overflow-x-auto pb-1">
                  @for (imgUrl of galleryUrls(); track imgUrl; let i = $index) {
                    <button
                      type="button"
                      (click)="selectedImageIndex.set(i)"
                      [class]="
                        selectedImageIndex() === i
                          ? 'ring-2 ring-orange-500 border-orange-400'
                          : 'border-gray-200 opacity-75 hover:opacity-100 hover:border-gray-300'
                      "
                      class="h-18 w-22 shrink-0 overflow-hidden rounded-xl border bg-gray-50 transition cursor-pointer"
                    >
                      <img [src]="imgUrl" alt="Miniatura del repuesto" width="88" height="72" loading="lazy" class="h-full w-full object-cover" />
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Right: Product Info & Purchase Box -->
            <div class="lg:col-span-6 flex flex-col space-y-5">
              <div class="space-y-3">
                <div class="flex flex-wrap items-center gap-2">
                  @if (p.manufacturerBrand) {
                    <span class="rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-extrabold text-orange-700">
                      {{ p.manufacturerBrand }}
                    </span>
                  }
                  @if (p.categoryName) {
                    <span class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                      {{ p.categoryName }}
                    </span>
                  }
                </div>

                <h1 class="text-2xl sm:text-3xl font-black text-gray-950 leading-snug tracking-tight">
                  {{ p.name }}
                </h1>

                <!-- Technical Specs Micro-Grid -->
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                  <div class="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5">
                    <span class="block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Código OEM</span>
                    <span class="text-sm font-black text-gray-950 tabular-nums">{{ p.oemCode || 'Estándar' }}</span>
                  </div>
                  <div class="rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5">
                    <span class="block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Código SKU</span>
                    <span class="text-sm font-extrabold text-gray-900 tabular-nums">{{ p.sku }}</span>
                  </div>
                  <div class="col-span-2 sm:col-span-1 rounded-xl border border-gray-300 bg-gray-50 px-3.5 py-2.5">
                    <span class="block text-[11px] font-extrabold uppercase tracking-wide text-gray-600">Procedencia / Marca</span>
                    <span class="text-sm font-extrabold text-gray-900">{{ p.manufacturerBrand || 'Certificado OEM' }}</span>
                  </div>
                </div>

                <!-- SAE Viscosity Badge if present -->
                @if (getPartViscosity(p); as visc) {
                  <div class="rounded-xl border border-amber-300 bg-amber-50/80 p-3 flex items-start gap-2.5 text-xs text-amber-950">
                    <span class="text-xl shrink-0">🛢️</span>
                    <div class="space-y-0.5">
                      <div class="flex items-center gap-2">
                        <strong class="font-bold text-amber-950">Grado de Viscosidad SAE {{ visc }}</strong>
                        <span class="rounded bg-amber-200/80 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">Estándar API</span>
                      </div>
                      <p class="text-[11px] text-amber-800">
                        {{ getViscosityDescription(visc) }}
                      </p>
                    </div>
                  </div>
                }

                @if (p.technicalDescription) {
                  <p class="text-sm text-gray-600 leading-relaxed">
                    {{ p.technicalDescription }}
                  </p>
                }
              </div>

              <!-- Pricing Box (Retail vs Interactive Wholesale) -->
              <div class="rounded-2xl border border-gray-200 bg-gray-50/70 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  @if (promotionService.getDirectOffer(p.sku); as promo) {
                    <div class="flex items-center gap-2 mb-1">
                      <span class="rounded-full bg-red-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 animate-pulse">
                        🏷️ {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                      </span>
                      <span class="font-mono text-xs text-gray-400 line-through">
                        Normal: S/ {{ p.salePrice | number: '1.2-2' }}
                      </span>
                    </div>
                    <span class="block text-xs font-bold text-red-600">
                      Precio de Oferta Especial (incluye IGV)
                    </span>
                    <div class="flex items-baseline gap-3">
                      <span class="mt-0.5 block font-mono text-3xl font-black tracking-tight text-red-600">
                        S/ {{ promo.promoPrice | number: '1.2-2' }}
                      </span>
                      <span class="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                        Ahorras S/ {{ (p.salePrice - promo.promoPrice) | number: '1.2-2' }}
                      </span>
                    </div>
                  } @else {
                    <span class="block text-xs font-semibold text-gray-500">
                      Precio unitario (incluye IGV)
                    </span>
                    <span class="mt-0.5 block font-mono text-3xl font-extrabold tracking-tight text-gray-900">
                      S/ {{ p.salePrice | number: '1.2-2' }}
                    </span>
                  }
                </div>

                @if (p.wholesalePrice) {
                  <button
                    type="button"
                    (click)="quantity.set(Math.min(p.stockQuantity || 4, Math.max(4, quantity())))"
                    [class]="quantity() >= 4 ? 'ring-2 ring-emerald-500 border-emerald-400 bg-emerald-50' : 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-100/70'"
                    class="rounded-xl border px-3.5 py-2.5 text-right transition cursor-pointer"
                    title="Haz clic para seleccionar 4 unidades y activar tarifa mayorista"
                  >
                    <span class="block text-[11px] font-bold text-emerald-800">
                      Precio Mayorista (4+ und.)
                    </span>
                    <span class="font-mono text-lg font-extrabold tracking-tight text-emerald-700">
                      S/ {{ p.wholesalePrice | number: '1.2-2' }} c/u
                    </span>
                    <span class="block text-[10px] font-semibold text-emerald-600">
                      {{ quantity() >= 4 ? '✓ Tarifa mayorista activa' : 'Clic para llevar 4 und.' }}
                    </span>
                  </button>
                }
              </div>

              @if (promotionService.getPromotion(p.sku); as comboPromo) {
                @if (comboPromo.promoType === 'COMBO_SUGERIDO') {
                  <div class="rounded-2xl border-2 border-orange-200 bg-orange-50/60 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div class="space-y-1">
                      <div class="flex items-center gap-2">
                        <span class="rounded-full bg-orange-600 px-2.5 py-0.5 text-[10px] font-black text-white uppercase">
                          📦 Combo Automotriz Activo
                        </span>
                        <span class="text-xs font-extrabold text-emerald-700">
                          Doble descuento al llevar el kit
                        </span>
                      </div>
                      <p class="text-xs font-bold text-gray-900">
                        Llévalo junto con <span class="text-orange-700">{{ comboPromo.comboComplementName }}</span> por solo
                        <strong class="text-sm font-black text-gray-950 tabular-nums">
                          S/ {{ (comboPromo.comboTotalPromoPrice || (comboPromo.promoPrice + (comboPromo.comboComplementPrice || 0) * 0.85)) | number: '1.2-2' }}
                        </strong>
                      </p>
                    </div>
                    <a
                      routerLink="/"
                      [queryParams]="{ sort: 'ONLY_COMBOS' }"
                      class="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-extrabold text-white shadow-2xs hover:bg-orange-700 transition"
                    >
                      <span>Ver Combo Completo</span>
                      <span>→</span>
                    </a>
                  </div>
                }
              }

              <!-- Availability & Delivery Info -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="rounded-xl border border-gray-200 bg-white p-3.5">
                  <span class="block text-gray-500 font-medium">Disponibilidad en tiempo real</span>
                  <div class="mt-1 flex flex-wrap items-center gap-1.5">
                    <span
                      [class]="cart.getRemainingStockToAdd(p) > 0 ? 'bg-emerald-500' : 'bg-red-500'"
                      class="h-2 w-2 rounded-full"
                    ></span>
                    <span
                      [class]="cart.getRemainingStockToAdd(p) > 0 ? 'text-emerald-700' : 'text-red-600'"
                      class="font-bold text-sm"
                    >
                      @if (cart.getRemainingStockToAdd(p) > 0) {
                        {{ cart.getRemainingStockToAdd(p) }} disponibles
                      } @else if (cart.getTotalReservedDisplay(p) > 0) {
                        En reserva ({{ cart.getTotalReservedDisplay(p) }} und.)
                      } @else if (cart.getMyCartQuantity(p.id) > 0) {
                        En tu carrito ({{ cart.getMyCartQuantity(p.id) }} und.)
                      } @else {
                        Agotado temporalmente
                      }
                    </span>
                    @if (cart.getTotalReservedDisplay(p) > 0) {
                      <span class="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                        ⏳ {{ cart.getTotalReservedDisplay(p) }} en reserva
                      </span>
                    }
                  </div>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-3.5 flex items-center gap-3">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 border border-orange-100">
                    <img src="/images/icons/casa.png" alt="Despacho" class="h-5 w-5 object-contain" />
                  </div>
                  <div>
                    <span class="block text-gray-500 font-medium">Modalidades de entrega</span>
                    <span class="block font-bold text-gray-900 text-sm">
                      Envío en Lima o recojo gratis
                    </span>
                  </div>
                </div>
              </div>

              <!-- Quantity & Purchase Actions -->
              <div class="pt-1 flex flex-col sm:flex-row gap-3">
                <div class="inline-flex min-h-[46px] items-center justify-between rounded-xl border border-gray-200 bg-white px-2 sm:w-36">
                  <button
                    type="button"
                    (click)="decrementQty()"
                    class="h-9 w-9 rounded-lg text-base font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 cursor-pointer"
                  >
                    −
                  </button>
                  <span class="font-mono text-sm font-extrabold text-gray-900">{{ quantity() }}</span>
                  <button
                    type="button"
                    [disabled]="quantity() >= cart.getRemainingStockToAdd(p)"
                    (click)="incrementQty(cart.getRemainingStockToAdd(p))"
                    class="h-9 w-9 rounded-lg text-base font-bold text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  [disabled]="cart.getRemainingStockToAdd(p) <= 0"
                  (click)="addToCart(p)"
                  class="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 px-5 text-sm font-bold text-white shadow-xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition-all duration-150 ease-out select-none cursor-pointer"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span>{{ cart.getRemainingStockToAdd(p) <= 0 ? (cart.getTotalReservedDisplay(p) > 0 ? 'En reserva' : 'Sin stock disp.') : 'Agregar al carrito' }}</span>
                </button>

                <button
                  type="button"
                  [disabled]="cart.getRemainingStockToAdd(p) <= 0"
                  (click)="buyNow(p)"
                  class="flex-1 min-h-[46px] rounded-xl border border-orange-200 bg-orange-50 py-3 px-5 text-sm font-bold text-orange-700 hover:bg-orange-100 active:scale-[0.98] disabled:opacity-40 transition-all duration-150 ease-out select-none cursor-pointer"
                >
                  Comprar ahora
                </button>
              </div>



              <!-- Oil & Filter Cross-Sell Recommendation -->
              @if (isOilOrFilter(p)) {
                <div class="rounded-xl border border-amber-200 bg-amber-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div class="flex items-start gap-2.5">
                    <span class="text-xl">💡</span>
                    <div>
                      <p class="font-bold text-gray-900">
                        {{ isOil(p) ? '¿Realizando el cambio de aceite?' : '¿Comprando este filtro automotriz?' }}
                      </p>
                      <p class="text-[11px] text-gray-600">
                        {{ isOil(p) ? 'Recuerda reemplazar también el filtro de aceite para garantizar la protección del motor.' : 'Asegúrate de contar con el lubricante del grado de viscosidad SAE correcto.' }}
                      </p>
                    </div>
                  </div>
                  <a
                    routerLink="/"
                    [queryParams]="isOil(p) ? { category: 'FILTROS' } : { category: 'LUBRICANTES' }"
                    class="shrink-0 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-orange-700 transition"
                  >
                    {{ isOil(p) ? 'Ver Filtros Compatibles' : 'Ver Aceites Disponibles' }}
                  </a>
                </div>
              }
            </div>
          </div>

          <!-- Vehicle Compatibility Table -->
          <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-xs">
            <div class="border-b border-gray-200 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-base font-extrabold text-gray-900">
                  Matriz de Vehículos Compatibles
                </h2>
                <p class="text-xs text-gray-500">
                  @if (p.oemCode) {
                    Modelos verificados para el código OEM <span class="font-mono font-bold text-gray-700">{{ p.oemCode }}</span>
                  } @else {
                    Modelos y años de aplicación verificados para este repuesto
                  }
                </p>
              </div>
              <span class="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700">
                {{ p.compatibilities?.length || 0 }} aplicaciones registradas
              </span>
            </div>

            @if (!p.compatibilities || p.compatibilities.length === 0) {
              <div class="p-6 text-xs text-gray-500">
                Repuesto de aplicación universal o multimarca. Consulta con nuestro asistente si deseas confirmar compatibilidad con tu vehículo.
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-xs">
                  <thead class="bg-gray-50 text-left font-bold text-gray-600 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th class="px-6 py-3">Marca</th>
                      <th class="px-6 py-3">Modelo</th>
                      <th class="px-6 py-3">Rango de Años</th>
                      <th class="px-6 py-3">Motorización</th>
                      <th class="px-6 py-3">Notas técnicas</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    @for (comp of p.compatibilities; track $index) {
                      <tr class="hover:bg-orange-50/30 transition">
                        <td class="px-6 py-3.5 font-bold text-gray-900">
                          <div class="flex items-center gap-2">
                            @if (getBrandLogo(comp.makeName); as logoUrl) {
                              <img [src]="logoUrl" [alt]="comp.makeName" class="h-4 w-7 object-contain rounded bg-gray-50 border border-gray-100 p-0.5 shrink-0" />
                            }
                            <span>{{ comp.makeName || 'Marca' }}</span>
                          </div>
                        </td>
                        <td class="px-6 py-3.5 font-semibold text-gray-800">
                          {{ comp.modelName || 'Modelo #' + comp.modelId }}
                          @if (comp.vehicleType) {
                            <span class="ml-1.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
                              {{ comp.vehicleType }}
                            </span>
                          }
                        </td>
                        <td class="px-6 py-3.5">
                          <span class="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[11px] font-bold text-orange-700">
                            {{ comp.yearStart }} – {{ comp.yearEnd }}
                          </span>
                        </td>
                        <td class="px-6 py-3.5 font-mono text-gray-700">
                          {{ comp.engineSpec || 'Estándar' }}
                        </td>
                        <td class="px-6 py-3.5 text-gray-500">
                          {{ comp.notes || 'Instalación directa OEM' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PartDetailPageComponent implements OnInit {
  protected readonly Math = Math;
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly promotionService = inject(PromotionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  readonly cart = inject(CartService);

  readonly part = signal<Part | null>(null);
  readonly isLoading = signal<boolean>(true);
  readonly selectedImageIndex = signal<number>(0);
  readonly quantity = signal<number>(1);

  readonly isZooming = signal<boolean>(false);
  readonly zoomOrigin = signal<string>('50% 50%');

  readonly galleryUrls = computed<string[]>(() => {
    const p = this.part();
    if (!p) return [];
    if (p.images && p.images.length > 0) {
      const sorted = [...p.images].sort((a, b) => {
        const pa = this.apiConfig.isPrimary(a) ? 0 : 1;
        const pb = this.apiConfig.isPrimary(b) ? 0 : 1;
        return pa - pb;
      });
      return sorted.map((img) =>
        this.apiConfig.resolveMediaUrl(img.imageUrl, p.sku, p.manufacturerBrand)
      );
    }
    return [this.apiConfig.resolvePartPrimaryImage(p)];
  });

  readonly activeImageUrl = computed<string>(() => {
    const urls = this.galleryUrls();
    const idx = this.selectedImageIndex();
    return urls[idx] || urls[0] || '';
  });

  ngOnInit(): void {
    this.cart.refreshPosHoldsAndReconcile();
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.fetchPart(id);
      }
    });
  }

  private fetchPart(id: number): void {
    this.selectedImageIndex.set(0);
    const cached = this.findCachedPart(id);
    if (cached) {
      this.part.set(cached);
      this.isLoading.set(false);
    } else {
      this.isLoading.set(true);
    }

    this.catalogService
      .getPartById(id)
      .pipe(
        retry({ count: 3, delay: 2000 }),
        finalize(() => this.isLoading.set(false))
      )
      .subscribe({
        next: (data) => this.part.set(data),
        error: () => {
          if (!this.part()) {
            this.part.set(null);
          }
        },
      });
  }

  private findCachedPart(id: number): Part | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw =
        localStorage.getItem('asuncion_catalog_snapshot_v7') ||
        localStorage.getItem('asuncion_catalog_snapshot_v4');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { parts?: Part[] };
      return parsed.parts?.find((item) => item.id === id) ?? null;
    } catch {
      return null;
    }
  }

  onMouseMoveZoom(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const xPct = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
    const yPct = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
    this.zoomOrigin.set(`${xPct.toFixed(1)}% ${yPct.toFixed(1)}%`);
  }

  incrementQty(max: number): void {
    this.quantity.update((q) => Math.min(max, q + 1));
  }

  decrementQty(): void {
    this.quantity.update((q) => Math.max(1, q - 1));
  }

  addToCart(part: Part): void {
    this.cart.addPart(part, this.quantity(), true);
  }

  buyNow(part: Part): void {
    this.cart.addPart(part, this.quantity(), false);
    if (!this.auth.isAuthenticated()) {
      this.toast.info(
        'Inicio de sesión o registro requerido',
        'Inicia sesión con tu cuenta o regístrate para tramitar tu compra y emitir tu comprobante.'
      );
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    void this.router.navigate(['/checkout']);
  }

  getBrandLogo(makeName?: string): string | null {
    if (!makeName) return null;
    const lower = makeName.toLowerCase();
    if (lower.includes('toyota')) return '/images/brands/toyota.jpg';
    if (lower.includes('hyundai')) return '/images/brands/hyundai.png';
    if (lower.includes('nissan')) return '/images/brands/nissan.png';
    if (lower.includes('kia')) return '/images/brands/kia.png';
    if (lower.includes('mitsubishi')) return '/images/brands/mitsubishi.png';
    if (lower.includes('hino')) return '/images/brands/hino.png';
    if (lower.includes('isuzu')) return '/images/brands/isuzu.png';
    if (lower.includes('scania')) return '/images/brands/scania.jpg';
    return null;
  }

  getPartViscosity(part: Part): string | null {
    const text = `${part.name} ${part.technicalDescription || ''}`;
    const match = text.match(/\b(0W-20|5W-20|5W-30|5W-40|10W-30|10W-40|15W-40|20W-50|75W-90|80W-90|85W-140|0W20|5W30|5W40|10W30|10W40|15W40|20W50)\b/i);
    if (!match) return null;
    const raw = match[1].toUpperCase();
    if (!raw.includes('-')) {
      return raw.replace(/(\d{1,2}W)(\d{2})/, '$1-$2');
    }
    return raw;
  }

  getViscosityDescription(visc: string): string {
    switch (visc) {
      case '0W-20':
        return '100% Sintético ultraligero para motores modernos e híbridos (Ahorro de combustible y arranque en frío).';
      case '5W-30':
        return 'Sintético para motores modernos a gasolina y diésel ligero (Protección avanzada contra el desgaste).';
      case '5W-40':
        return 'Sintético de alta resistencia térmica para motores turboalimentados y condiciones exigentes.';
      case '10W-30':
        return 'Semisintético balanceado para sedanes y SUVs en tránsito urbano y carretera.';
      case '10W-40':
        return 'Semisintético recomendado para vehículos con más de 100,000 km y trabajo continuo.';
      case '15W-40':
        return 'Aceite Diésel Servicio Pesado (API CK-4 / CI-4) para camiones, buses, flotas y pickups 4x4.';
      case '20W-50':
        return 'Mineral de alta viscosidad para trabajo pesado y motores con holgura mecánica o alto kilometraje.';
      case '75W-90':
      case '80W-90':
        return 'Lubricante para transmisiones mecánicas, cajas de transferencia y diferenciales (Norma API GL-5).';
      default:
        return 'Grado SAE certificado bajo estándares de los principales fabricantes automotrices.';
    }
  }

  isOilOrFilter(part: Part): boolean {
    const text = `${part.name} ${part.categoryName || ''} ${part.technicalDescription || ''}`.toLowerCase();
    return text.includes('aceite') || text.includes('lubricante') || text.includes('filtro') || text.includes('filter');
  }

  isOil(part: Part): boolean {
    const text = `${part.name} ${part.categoryName || ''}`.toLowerCase();
    return text.includes('aceite') || text.includes('lubricante') || text.includes('oil');
  }

  onDetailImageError(event: Event, part: Part): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const fallback = this.apiConfig.getCategoryFallback(part.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }
}
