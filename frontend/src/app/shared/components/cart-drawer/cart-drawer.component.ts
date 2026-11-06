import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Part } from '../../../core/models/api.models';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (cart.isDrawerOpen()) {
      <div class="fixed inset-0 z-50 overflow-hidden">
        <!-- Backdrop -->
        <div
          (click)="cart.closeDrawer()"
          class="fixed inset-0 bg-gray-900/40 backdrop-blur-xs transition-opacity"
        ></div>

        <div class="fixed inset-y-0 right-0 flex max-w-full pl-8 sm:pl-10">
          <div class="w-screen max-w-md bg-white shadow-2xl border-l border-gray-200 flex flex-col">
            <!-- Header -->
            <div class="border-b border-gray-200 bg-white px-5 py-4 flex items-center justify-between relative">
              <div class="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500"></div>
              <div class="pt-0.5">
                <div class="flex items-center gap-2">
                  <h2 class="text-base font-extrabold text-gray-900">Tu Carrito de Repuestos</h2>
                  <span class="rounded-full border border-orange-200 bg-orange-50 px-2.5 py-0.5 font-mono text-xs font-extrabold text-orange-700">
                    {{ cart.totalItems() }}
                  </span>
                </div>
                <p class="mt-0.5 text-xs text-gray-500">
                  Precios incluyen IGV · Facturación electrónica SUNAT
                </p>
              </div>
              <button
                type="button"
                (click)="cart.closeDrawer()"
                class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 transition cursor-pointer"
                aria-label="Cerrar carrito"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <!-- Wholesale Tier Incentive Strip -->
            <div class="border-b border-emerald-200/70 bg-emerald-50/70 px-5 py-2.5 flex items-center gap-2 text-xs text-emerald-900">
              <svg class="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span><strong>Beneficio Mayorista:</strong> Llevando 4+ unidades de un repuesto aplicamos tarifa por mayor automáticamente.</span>
            </div>

            <!-- Items Body -->
            <div class="flex-1 overflow-y-auto p-5 space-y-3 bg-[#F8F9FA]">
              @if (cart.items().length === 0) {
                <div class="py-16 text-center space-y-3">
                  <div class="mx-auto flex h-15 w-15 items-center justify-center rounded-2xl border border-gray-200 bg-white text-orange-500 shadow-2xs">
                    <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                    </svg>
                  </div>
                  <p class="text-sm font-extrabold text-gray-900">Tu carrito está vacío</p>
                  <p class="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                    Selecciona la marca, modelo y año de tu vehículo en el catálogo para agregar repuestos 100% compatibles.
                  </p>
                </div>
              } @else {
                @for (item of cart.items(); track item.part.id) {
                  <div class="flex gap-3.5 rounded-2xl border border-gray-200/90 bg-white p-3.5 shadow-2xs hover:border-orange-200 transition">
                    <img
                      [src]="resolveImage(item.part)"
                      [alt]="item.part.name"
                      (error)="onCartImageError($event, item.part)"
                      class="h-18 w-18 shrink-0 rounded-xl border border-gray-100 object-cover bg-gray-50"
                    />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-start justify-between gap-2">
                        <p class="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">
                          {{ item.part.name }}
                        </p>
                        <button
                          type="button"
                          (click)="cart.removePart(item.part.id)"
                          class="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer"
                          title="Quitar del carrito"
                        >
                          <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </div>

                      <div class="mt-1 flex flex-wrap gap-1.5">
                        @if (item.part.oemCode) {
                          <span class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-600">
                            OEM {{ item.part.oemCode }}
                          </span>
                        }
                        @if (item.part.sku) {
                          <span class="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                            {{ item.part.sku }}
                          </span>
                        }
                      </div>

                      <div class="mt-3 flex items-center justify-between">
                        <div class="inline-flex items-center rounded-xl border border-gray-200 bg-gray-50/70">
                          <button
                            type="button"
                            (click)="cart.updateQuantity(item.part.id, item.quantity - 1)"
                            class="h-7 w-7 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-white hover:text-gray-900 rounded-l-xl cursor-pointer"
                          >
                            −
                          </button>
                          <span class="px-2.5 font-mono text-xs font-extrabold text-gray-900">
                            {{ item.quantity }}
                          </span>
                          <button
                            type="button"
                            [disabled]="item.quantity >= item.part.stockQuantity"
                            (click)="cart.updateQuantity(item.part.id, item.quantity + 1)"
                            class="h-7 w-7 flex items-center justify-center text-sm font-bold text-gray-600 hover:bg-white hover:text-gray-900 disabled:opacity-40 rounded-r-xl cursor-pointer"
                          >
                            +
                          </button>
                        </div>

                        <div class="text-right">
                          <span class="block font-mono text-sm font-extrabold tracking-tight text-gray-900">
                            S/ {{ (cart.effectiveUnitPrice(item) * item.quantity) | number: '1.2-2' }}
                          </span>
                          @if (cart.effectiveUnitPrice(item) < item.part.salePrice) {
                            @if (cart.promotionService.getPromotion(item.part.sku); as promo) {
                              <span class="inline-block rounded bg-red-50 border border-red-200 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
                                {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                              </span>
                            } @else {
                              <span class="inline-block rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                Tarifa Mayorista
                              </span>
                            }
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              }
            </div>

            <!-- Footer Summary -->
            @if (cart.items().length > 0) {
              <div class="border-t border-gray-200 bg-white p-5 space-y-4">
                <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 space-y-1.5 text-xs">
                  <div class="flex justify-between text-gray-500">
                    <span>Valor neto (sin IGV)</span>
                    <span class="font-mono">S/ {{ cart.netBaseAmount() | number: '1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between text-gray-500">
                    <span>IGV (18%)</span>
                    <span class="font-mono">S/ {{ cart.igvAmount() | number: '1.2-2' }}</span>
                  </div>
                  <div class="flex justify-between text-sm font-extrabold text-gray-900 pt-2 border-t border-gray-200/70">
                    <span>Subtotal de repuestos</span>
                    <span class="font-mono text-base">S/ {{ cart.subtotal() | number: '1.2-2' }}</span>
                  </div>
                </div>

                @if (!auth.isAuthenticated()) {
                  <div class="rounded-xl border border-amber-200 bg-amber-50/80 p-2.5 text-center text-xs text-amber-900 flex items-center justify-center gap-1.5">
                    <svg class="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    <span>Inicia sesión o regístrate para tramitar tu pedido</span>
                  </div>
                }

                <div class="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    (click)="cart.clear()"
                    class="col-span-1 min-h-[44px] rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 ease-out select-none cursor-pointer"
                  >
                    Vaciar
                  </button>
                  <button
                    type="button"
                    (click)="proceedToCheckout()"
                    class="col-span-2 min-h-[44px] inline-flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 py-2.5 px-4 text-xs font-bold text-white shadow-xs hover:bg-orange-700 active:scale-[0.98] transition-all duration-150 ease-out select-none cursor-pointer"
                  >
                    <span>{{ auth.isAuthenticated() ? 'Procesar compra' : 'Iniciar sesión y pagar' }}</span>
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                    </svg>
                  </button>
                </div>
              </div>
            }
          </div>
        </div>
      </div>
    }
  `,
})
export class CartDrawerComponent {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly router = inject(Router);

  resolveImage(part: Part): string {
    return this.apiConfig.resolvePartPrimaryImage(part);
  }

  onCartImageError(event: Event, part: Part): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const fallback = this.apiConfig.getCategoryFallback(part.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }

  proceedToCheckout(): void {
    this.cart.closeDrawer();
    if (!this.auth.isAuthenticated()) {
      this.toast.info(
        'Inicio de sesión requerido',
        'Debes iniciar sesión con tu cuenta o registrarte para completar el pedido y emitir tu comprobante.'
      );
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/checkout' } });
      return;
    }
    void this.router.navigate(['/checkout']);
  }
}
