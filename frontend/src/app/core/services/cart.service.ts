import { computed, inject, Injectable, signal } from '@angular/core';
import { CartItem, Part } from '../models/api.models';
import { ToastService } from './toast.service';

const CART_STORAGE_KEY = 'asuncion_cart_v1';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly toast = inject(ToastService);

  readonly items = signal<CartItem[]>(this.loadCart());
  readonly isDrawerOpen = signal<boolean>(false);

  readonly totalItems = computed(() =>
    this.items().reduce((acc, item) => acc + item.quantity, 0)
  );

  readonly subtotal = computed(() =>
    this.items().reduce((acc, item) => acc + this.effectiveUnitPrice(item) * item.quantity, 0)
  );

  // Prices in Peru retail/B2B: calculate net & IGV (18%) breakdown cleanly
  readonly netBaseAmount = computed(() => Number((this.subtotal() / 1.18).toFixed(2)));
  readonly igvAmount = computed(() => Number((this.subtotal() - this.netBaseAmount()).toFixed(2)));

  effectiveUnitPrice(item: CartItem): number {
    if (
      item.part.wholesalePrice &&
      item.part.wholesalePrice > 0 &&
      item.quantity >= 4
    ) {
      return item.part.wholesalePrice;
    }
    return item.part.salePrice;
  }

  openDrawer(): void {
    this.isDrawerOpen.set(true);
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update((v) => !v);
  }

  addPart(part: Part, quantity = 1, openDrawerAfter = false): void {
    if (part.stockQuantity <= 0) {
      this.toast.warning('Sin stock disponible', `El repuesto ${part.sku} se encuentra agotado.`);
      return;
    }

    this.items.update((current) => {
      const idx = current.findIndex((i) => i.part.id === part.id);
      if (idx >= 0) {
        const nextQty = Math.min(current[idx].quantity + quantity, part.stockQuantity);
        const clone = [...current];
        clone[idx] = { part, quantity: nextQty };
        return clone;
      }
      return [...current, { part, quantity: Math.min(quantity, part.stockQuantity) }];
    });

    this.persist();
    this.toast.success('Agregado al carrito', `${part.name} (${part.oemCode || part.sku})`);
    if (openDrawerAfter) {
      this.isDrawerOpen.set(true);
    }
  }

  updateQuantity(partId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removePart(partId);
      return;
    }
    this.items.update((current) =>
      current.map((item) =>
        item.part.id === partId
          ? { ...item, quantity: Math.min(quantity, Math.max(1, item.part.stockQuantity)) }
          : item
      )
    );
    this.persist();
  }

  removePart(partId: number): void {
    this.items.update((current) => current.filter((i) => i.part.id !== partId));
    this.persist();
  }

  clear(): void {
    this.items.set([]);
    this.persist();
  }

  private persist(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items()));
    }
  }

  private loadCart(): CartItem[] {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as CartItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}
