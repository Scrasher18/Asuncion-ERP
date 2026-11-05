import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
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
        <!-- Breadcrumb -->
        <nav class="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-500">
          <a routerLink="/" class="hover:text-orange-600 transition">Catálogo</a>
          <span>/</span>
          @if (part(); as p) {
            <span class="text-gray-600">{{ p.categoryName || 'Repuestos' }}</span>
            <span>/</span>
            <span class="font-mono text-gray-900 font-semibold">{{ p.oemCode || p.sku }}</span>
          }
        </nav>

        @if (isLoading()) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            Cargando información del repuesto...
          </div>
        } @else if (!part()) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3">
            <h2 class="text-lg font-bold text-gray-900">Repuesto no encontrado</h2>
            <p class="text-xs text-gray-500">Es posible que el producto ya no esté disponible en el catálogo.</p>
            <a routerLink="/" class="inline-block rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700">
              Volver al catálogo
            </a>
          </div>
        } @else if (part(); as p) {
          <!-- Main 2-Column E-Commerce Product Card -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 rounded-2xl border border-gray-200 bg-white p-5 sm:p-8 shadow-2xs">
            <!-- Left: Gallery with Interactive Hover Lens Zoom -->
            <div class="lg:col-span-6 space-y-3">
              <div
                (mousemove)="onMouseMoveZoom($event)"
                (mouseenter)="isZooming.set(true)"
                (mouseleave)="isZooming.set(false)"
                [class.border-orange-400]="isZooming()"
                class="relative aspect-4/3 w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 cursor-zoom-in select-none transition-colors"
              >
                <img
                  [src]="activeImageUrl()"
                  [alt]="p.name"
                  (error)="onDetailImageError($event, p)"
                  [style.transform]="isZooming() ? 'scale(2.35)' : 'scale(1)'"
                  [style.transform-origin]="zoomOrigin()"
                  class="h-full w-full object-cover transition-transform duration-100 ease-out"
                />

                <div class="pointer-events-none absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1 text-[11px] font-medium text-gray-600 shadow-2xs">
                  <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                  <span>Pasa el cursor para ampliar</span>
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
                      class="h-18 w-22 shrink-0 overflow-hidden rounded-lg border bg-gray-50 transition"
                    >
                      <img [src]="imgUrl" alt="Miniatura del repuesto" width="88" height="72" loading="lazy" class="h-full w-full object-cover" />
                    </button>
                  }
                </div>
              }
            </div>

            <!-- Right: Product Info & Purchase Box -->
            <div class="lg:col-span-6 flex flex-col space-y-5">
              <div class="space-y-2.5">
                <div class="flex flex-wrap items-center gap-2">
                  @if (p.manufacturerBrand) {
                    <span class="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-xs font-semibold text-orange-700">
                      {{ p.manufacturerBrand }}
                    </span>
                  }
                  @if (p.oemCode) {
                    <span class="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-0.5 font-mono text-xs font-medium text-gray-700">
                      OEM {{ p.oemCode }}
                    </span>
                  }
                  @if (p.sku) {
                    <span class="rounded-md border border-gray-200 bg-gray-50 px-2.5 py-0.5 font-mono text-xs text-gray-500">
                      SKU {{ p.sku }}
                    </span>
                  }
                </div>

                <h1 class="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
                  {{ p.name }}
                </h1>

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

              <!-- Pricing Box -->
              <div class="rounded-xl border border-gray-200 bg-gray-50/70 p-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  @if (promotionService.getPromotion(p.sku); as promo) {
                    <div class="flex items-center gap-2 mb-1">
                      <span class="rounded-full bg-red-600 text-white font-extrabold text-[10px] px-2.5 py-0.5 animate-pulse">
                        🏷️ {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                      </span>
                      <span class="text-xs text-gray-400 line-through">
                        Normal: S/ {{ p.salePrice | number: '1.2-2' }}
                      </span>
                    </div>
                    <span class="block text-xs font-bold text-red-600">
                      Precio de Oferta Especial (incluye IGV)
                    </span>
                    <div class="flex items-baseline gap-3">
                      <span class="mt-0.5 block text-3xl font-black tracking-tight text-red-600">
                        S/ {{ promo.promoPrice | number: '1.2-2' }}
                      </span>
                      <span class="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-2 py-0.5">
                        Ahorras S/ {{ (p.salePrice - promo.promoPrice) | number: '1.2-2' }}
                      </span>
                    </div>
                  } @else {
                    <span class="block text-xs font-medium text-gray-500">
                      Precio unitario (incluye IGV)
                    </span>
                    <span class="mt-0.5 block text-3xl font-bold tracking-tight text-gray-900">
                      S/ {{ p.salePrice | number: '1.2-2' }}
                    </span>
                  }
                </div>

                @if (p.wholesalePrice) {
                  <div class="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-right">
                    <span class="block text-[11px] font-semibold text-emerald-800">
                      Precio por mayor (desde 4 und.)
                    </span>
                    <span class="text-lg font-bold tracking-tight text-emerald-700">
                      S/ {{ p.wholesalePrice | number: '1.2-2' }} c/u
                    </span>
                  </div>
                }
              </div>

              <!-- Availability & Delivery Info -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div class="rounded-xl border border-gray-200 bg-white p-3.5">
                  <span class="block text-gray-500 font-medium">Disponibilidad</span>
                  <div class="mt-1 flex items-center gap-1.5">
                    <span
                      [class]="p.stockQuantity > 0 ? 'bg-emerald-500' : 'bg-red-500'"
                      class="h-2 w-2 rounded-full"
                    ></span>
                    <span
                      [class]="p.stockQuantity > 0 ? 'text-emerald-700' : 'text-red-600'"
                      class="font-semibold text-sm"
                    >
                      {{ p.stockQuantity > 0 ? p.stockQuantity + ' unidades en stock' : 'Agotado temporalmente' }}
                    </span>
                  </div>
                </div>
                <div class="rounded-xl border border-gray-200 bg-white p-3.5 flex items-center gap-3">
                  <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 border border-orange-100">
                    <img src="/images/icons/casa.png" alt="Despacho" class="h-5 w-5 object-contain" />
                  </div>
                  <div>
                    <span class="block text-gray-500 font-medium">Despacho y entrega</span>
                    <span class="block font-semibold text-gray-900 text-sm">
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
                    class="h-9 w-9 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  >
                    −
                  </button>
                  <span class="text-sm font-bold text-gray-900">{{ quantity() }}</span>
                  <button
                    type="button"
                    [disabled]="quantity() >= p.stockQuantity"
                    (click)="incrementQty(p.stockQuantity)"
                    class="h-9 w-9 rounded-lg text-base font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 disabled:opacity-40"
                  >
                    +
                  </button>
                </div>

                <button
                  type="button"
                  [disabled]="p.stockQuantity <= 0"
                  (click)="addToCart(p)"
                  class="flex-1 min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 px-5 text-sm font-semibold text-white shadow-xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition-all duration-150 ease-out select-none"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                  </svg>
                  <span>Agregar al carrito</span>
                </button>

                <button
                  type="button"
                  [disabled]="p.stockQuantity <= 0"
                  (click)="buyNow(p)"
                  class="flex-1 min-h-[46px] rounded-xl border border-orange-200 bg-orange-50 py-3 px-5 text-sm font-semibold text-orange-700 hover:bg-orange-100 active:scale-[0.98] disabled:opacity-40 transition-all duration-150 ease-out select-none"
                >
                  Comprar ahora
                </button>
              </div>

              <!-- Oil & Filter Cross-Sell Recommendation -->
              @if (isOilOrFilter(p)) {
                <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div class="flex items-start gap-2.5">
                    <span class="text-xl">💡</span>
                    <div>
                      <p class="font-bold text-blue-950">
                        {{ isOil(p) ? '¿Realizando el cambio de aceite?' : '¿Comprando este filtro automotriz?' }}
                      </p>
                      <p class="text-[11px] text-blue-800">
                        {{ isOil(p) ? 'Recuerda reemplazar también el filtro de aceite para garantizar la protección del motor.' : 'Asegúrate de contar con el lubricante del grado de viscosidad SAE correcto.' }}
                      </p>
                    </div>
                  </div>
                  <a
                    routerLink="/"
                    [queryParams]="isOil(p) ? { category: 'FILTROS' } : { category: 'LUBRICANTES' }"
                    class="shrink-0 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                  >
                    {{ isOil(p) ? 'Ver Filtros Compatibles' : 'Ver Aceites Disponibles' }}
                  </a>
                </div>
              }
            </div>
          </div>

          <!-- Vehicle Compatibility Table -->
          <div class="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-2xs">
            <div class="border-b border-gray-200 bg-white px-6 py-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 class="text-base font-bold text-gray-900">
                  Vehículos compatibles
                </h2>
                <p class="text-xs text-gray-500">
                  @if (p.oemCode) {
                    Modelos verificados para el código OEM <span class="font-mono font-medium text-gray-700">{{ p.oemCode }}</span>
                  } @else {
                    Modelos y años de aplicación verificados para este repuesto
                  }
                </p>
              </div>
              <span class="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700">
                {{ p.compatibilities?.length || 0 }} modelos compatibles
              </span>
            </div>

            @if (!p.compatibilities || p.compatibilities.length === 0) {
              <div class="p-6 text-xs text-gray-500">
                Repuesto de aplicación general. Consulta con nuestro asistente si deseas confirmar compatibilidad con tu vehículo.
              </div>
            } @else {
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-xs">
                  <thead class="bg-gray-50 text-left font-semibold text-gray-600">
                    <tr>
                      <th class="px-6 py-3">Marca</th>
                      <th class="px-6 py-3">Modelo</th>
                      <th class="px-6 py-3">Años</th>
                      <th class="px-6 py-3">Motor</th>
                      <th class="px-6 py-3">Notas de instalación</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 bg-white">
                    @for (comp of p.compatibilities; track $index) {
                      <tr class="hover:bg-orange-50/30 transition">
                        <td class="px-6 py-3.5 font-semibold text-gray-900">
                          <div class="flex items-center gap-2">
                            @if (getBrandLogo(comp.makeName); as logoUrl) {
                              <img [src]="logoUrl" [alt]="comp.makeName" class="h-4 w-7 object-contain rounded bg-gray-50 border border-gray-100 p-0.5 shrink-0" />
                            }
                            <span>{{ comp.makeName || 'Marca' }}</span>
                          </div>
                        </td>
                        <td class="px-6 py-3.5 font-medium text-gray-800">
                          {{ comp.modelName || 'Modelo #' + comp.modelId }}
                          @if (comp.vehicleType) {
                            <span class="ml-1.5 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-500">
                              {{ comp.vehicleType }}
                            </span>
                          }
                        </td>
                        <td class="px-6 py-3.5">
                          <span class="rounded-md border border-orange-200 bg-orange-50 px-2 py-0.5 font-mono text-[11px] font-medium text-orange-700">
                            {{ comp.yearStart }} – {{ comp.yearEnd }}
                          </span>
                        </td>
                        <td class="px-6 py-3.5 font-mono text-gray-700">
                          {{ comp.engineSpec || 'Estándar' }}
                        </td>
                        <td class="px-6 py-3.5 text-gray-500">
                          {{ comp.notes || 'Instalación directa' }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>

          <!-- Trust & Logistics Operational Assurance Grid (Real Photography) -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <!-- Card 1: Motorized Express Delivery with Real GPS -->
            <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
              <div class="h-32 overflow-hidden">
                <img
                  src="/images/banners/banner-delivery.jpg"
                  alt="Despacho express motorizado con rastreo en vivo"
                  class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div class="p-4 space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>Rastreo GPS en tiempo real</span>
                </div>
                <h3 class="text-xs sm:text-sm font-bold text-gray-900">Envíos Express y Despacho en Lima</h3>
                <p class="text-[11px] text-gray-600 leading-relaxed">
                  Seguimiento del motorizado en el mapa con firma digital y comprobante al instante.
                </p>
              </div>
            </div>

            <!-- Card 2: Centralized Warehouse & Immediate Stock -->
            <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
              <div class="h-32 overflow-hidden">
                <img
                  src="/images/banners/banner-warehouse.jpg"
                  alt="Almacén de repuestos automotrices Asunción"
                  class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div class="p-4 space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  <span>Stock Físico Inmediato</span>
                </div>
                <h3 class="text-xs sm:text-sm font-bold text-gray-900">Almacén Centralizado en Lima</h3>
                <p class="text-[11px] text-gray-600 leading-relaxed">
                  Piezas listas para retiro inmediato en Av. Sta. Ana 441, Santa Anita o despacho motorizado.
                </p>
              </div>
            </div>

            <!-- Card 3: Technical Specialist & Factory Warranty -->
            <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
              <div class="h-32 overflow-hidden">
                <img
                  src="/images/banners/banner-expert.jpg"
                  alt="Asesoría técnica automotriz garantizada"
                  class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                />
              </div>
              <div class="p-4 space-y-1">
                <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                  <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Garantía de Fábrica</span>
                </div>
                <h3 class="text-xs sm:text-sm font-bold text-gray-900">Asesoría Técnica y Calidad</h3>
                <p class="text-[11px] text-gray-600 leading-relaxed">
                  Asistencia especializada para confirmar compatibilidad de números de pieza y VIN.
                </p>
              </div>
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class PartDetailPageComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  readonly promotionService = inject(PromotionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly cart = inject(CartService);

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
        this.apiConfig.resolveMediaUrl(img.imageUrl, p.oemCode || p.sku, p.manufacturerBrand)
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
    this.route.paramMap.subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.fetchPart(id);
      }
    });
  }

  private fetchPart(id: number): void {
    this.isLoading.set(true);
    this.selectedImageIndex.set(0);
    this.catalogService
      .getPartById(id)
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => this.part.set(data),
        error: () => this.part.set(null),
      });
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
