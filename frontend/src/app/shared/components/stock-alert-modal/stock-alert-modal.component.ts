import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-stock-alert-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (alert(); as currentAlert) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-alert-title"
      >
        <!-- Backdrop -->
        <div
          (click)="dismiss()"
          class="fixed inset-0 bg-gray-950/70 backdrop-blur-xs transition-opacity"
        ></div>

        <!-- Modal Dialog Card / Pantalla Explicativa -->
        <div
          class="relative w-full max-w-lg rounded-3xl border border-amber-200/80 bg-white p-6 shadow-2xl transition-all sm:p-7 z-10 my-8 ring-1 ring-black/5"
        >
          <!-- Top Accent Bar -->
          <div class="absolute inset-x-0 top-0 h-1.5 rounded-t-3xl bg-gradient-to-r from-amber-500 via-orange-500 to-red-500"></div>

          <!-- Header -->
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 shadow-2xs">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <div>
                <span class="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold text-amber-800 border border-amber-200">
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Inventario Omnicanal en Vivo
                </span>
                <h3 id="stock-alert-title" class="text-lg font-extrabold text-gray-900 mt-1">
                  {{ currentAlert.title }}
                </h3>
              </div>
            </div>

            <button
              type="button"
              (click)="dismiss()"
              class="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition cursor-pointer"
              aria-label="Cerrar notificación"
            >
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Nubecita Informativa / Explicación Transparente -->
          <div class="mt-4 rounded-2xl border border-amber-200/90 bg-amber-50/70 p-4 text-xs text-amber-950 leading-relaxed shadow-2xs">
            <div class="flex items-center gap-2 font-black text-amber-900 mb-1">
              <svg class="h-4 w-4 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>¿Por qué cambió la cantidad en mi carrito?</span>
            </div>
            <p>
              Operamos con <strong>inventario real sincronizado al instante</strong> entre nuestra tienda física (mostrador/caja) y la web.
              Cuando un cliente presencial completa una compra en mostrador con dinero en mano o se realiza un ajuste físico de almacén, el stock disponible se reasigna inmediatamente.
              Tus cantidades han sido actualizadas para garantizar que <strong>nunca pagues por un repuesto sin stock garantizado</strong>.
            </p>
          </div>

          <!-- Items List Affected -->
          <div class="mt-4 space-y-3 max-h-60 overflow-y-auto pr-1">
            @for (item of currentAlert.items; track item.partId) {
              <div
                class="rounded-2xl border p-3.5 transition"
                [class.border-red-200]="item.isFullyDepleted"
                [class.bg-red-50/50]="item.isFullyDepleted"
                [class.border-gray-200]="!item.isFullyDepleted"
                [class.bg-gray-50/60]="!item.isFullyDepleted"
              >
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="text-xs font-bold text-gray-900 leading-tight">
                      {{ item.partName }}
                    </h4>
                    @if (item.partSku) {
                      <span class="font-mono text-[10px] text-gray-500">
                        SKU: {{ item.partSku }}
                      </span>
                    }
                  </div>

                  <!-- Change Quantity Pill -->
                  <div class="shrink-0 flex items-center gap-1.5 text-xs font-black tabular-nums">
                    <span class="rounded-lg bg-gray-200/80 px-2 py-0.5 text-gray-600 line-through">
                      {{ item.previousQuantity }} und.
                    </span>
                    <span class="text-gray-400">&rarr;</span>
                    @if (item.isFullyDepleted) {
                      <span class="rounded-lg bg-red-600 px-2 py-0.5 text-white font-extrabold text-[11px]">
                        Agotado
                      </span>
                    } @else {
                      <span class="rounded-lg bg-emerald-600 px-2 py-0.5 text-white font-extrabold text-[11px]">
                        {{ item.newQuantity }} und. reservadas
                      </span>
                    }
                  </div>
                </div>

                <p class="mt-2 text-[11px] text-gray-600 leading-snug">
                  {{ item.reason }}
                </p>
              </div>
            }
          </div>

          <!-- Action Buttons -->
          <div class="mt-6 flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-4 border-t border-gray-100">
            @if (hasDepletedItems()) {
              <button
                type="button"
                (click)="goToCatalog()"
                class="w-full sm:w-auto min-h-[42px] px-4 rounded-xl border border-gray-300 bg-white text-xs font-bold text-gray-700 hover:bg-gray-50 transition cursor-pointer"
              >
                Ver alternativas en Catálogo
              </button>
            }

            <button
              type="button"
              (click)="dismissAndOpenCart()"
              class="w-full sm:w-auto min-h-[42px] px-5 rounded-xl bg-orange-600 text-xs font-extrabold text-white shadow-md hover:bg-orange-700 active:scale-[0.98] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <span>Entendido, revisar mi carrito</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.96) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .animate-fade-in {
      animation: modalFadeIn 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class StockAlertModalComponent {
  private readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly alert = this.cart.activeStockAlert;

  hasDepletedItems(): boolean {
    const a = this.alert();
    if (!a) return false;
    return a.items.some((i) => i.isFullyDepleted);
  }

  dismiss(): void {
    this.cart.dismissStockAlert();
  }

  dismissAndOpenCart(): void {
    this.cart.dismissStockAlert();
    this.cart.openDrawer();
  }

  goToCatalog(): void {
    this.cart.dismissStockAlert();
    this.router.navigate(['/catalog']);
  }
}
