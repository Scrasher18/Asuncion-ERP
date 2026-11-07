import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartService } from '../../../core/services/cart.service';

@Component({
  selector: 'app-floating-cart',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (shouldShow()) {
      <aside
        aria-label="Resumen flotante de carrito"
        class="fixed bottom-16 inset-x-3 sm:inset-x-auto sm:left-6 sm:bottom-6 z-40 animate-fade-in transition-all duration-300"
      >
        <div
          (click)="openCart()"
          role="button"
          tabindex="0"
          (keydown.enter)="openCart()"
          (keydown.space)="openCart()"
          class="group flex items-center justify-between gap-3 sm:gap-4 rounded-2xl border border-gray-800/80 bg-gray-950/95 px-3.5 py-2.5 sm:px-4 sm:py-3 text-white shadow-2xl backdrop-blur-md hover:border-orange-500/70 hover:shadow-orange-950/30 transition cursor-pointer select-none ring-1 ring-white/10"
        >
          <!-- Cart Icon + Live Count Badge -->
          <div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md group-hover:scale-105 transition duration-200">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
            </svg>
            <span class="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1 text-[10px] font-black text-gray-950 shadow-xs tabular-nums ring-2 ring-gray-950">
              {{ cart.totalItems() }}
            </span>
          </div>

          <!-- Items Info & Price -->
          <div class="flex flex-col min-w-0 pr-1 sm:pr-2">
            <div class="flex items-center gap-2">
              <span class="text-xs font-extrabold text-gray-100 truncate">
                {{ cart.totalItems() }} {{ cart.totalItems() === 1 ? 'repuesto' : 'repuestos' }}
              </span>
              @if (cart.hasActiveReservation()) {
                <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300 ring-1 ring-amber-400/30 tabular-nums">
                  <span class="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping"></span>
                  {{ cart.reservationFormattedTimer() }}
                </span>
              }
            </div>
            <div class="flex items-baseline gap-1 text-[13px] font-black text-white tabular-nums tracking-tight">
              <span class="text-[11px] font-bold text-orange-400">Total:</span>
              <span>S/ {{ cart.subtotal() | number: '1.2-2' }}</span>
            </div>
          </div>

          <!-- Quick Action CTA -->
          <div class="flex items-center gap-1 rounded-xl bg-white/10 px-2.5 py-1.5 text-xs font-bold text-orange-400 group-hover:bg-orange-600 group-hover:text-white transition duration-200 shrink-0">
            <span>Ver carrito</span>
            <svg class="h-3.5 w-3.5 group-hover:translate-x-0.5 transition duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
            </svg>
          </div>
        </div>
      </aside>
    }
  `,
  styles: [`
    @keyframes fadeInSlide {
      from { opacity: 0; transform: translateY(12px) scale(0.96); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .animate-fade-in {
      animation: fadeInSlide 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class FloatingCartComponent {
  readonly cart = inject(CartService);
  private readonly router = inject(Router);

  readonly shouldShow = computed(() => {
    if (this.cart.totalItems() <= 0) return false;
    if (this.cart.isDrawerOpen()) return false;
    const url = this.router.url;
    // Don't clutter checkout or administrative screens
    if (url.startsWith('/checkout') || url.startsWith('/admin') || url.startsWith('/pos')) {
      return false;
    }
    return true;
  });

  openCart(): void {
    this.cart.openDrawer();
  }
}
