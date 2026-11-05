import { inject, Injectable, signal } from '@angular/core';
import { ToastService } from './toast.service';

export interface PartPromotion {
  sku: string;
  partId?: number;
  partName: string;
  categoryName?: string;
  originalPrice: number;
  purchasePrice: number;
  promoPrice: number;
  discountPercentage: number;
  badgeLabel: string; // e.g. 'OFERTA FLASH', 'LIQUIDACIÓN DE STOCK', 'PRECIO TALLER'
  promoType: 'DESCUENTO_DIRECTO' | 'COMBO_SUGERIDO';
  comboComplementSku?: string;
  comboComplementName?: string;
  comboComplementPrice?: number;
  comboTotalPromoPrice?: number;
  unitsQuota: number;
  unitsSoldInPromo: number;
  active: boolean;
  startDate: string;
  endDate?: string;
  notes?: string;
}

const STORAGE_KEY = 'asuncion_active_promotions';

@Injectable({
  providedIn: 'root',
})
export class PromotionService {
  private readonly toast = inject(ToastService);
  readonly promotions = signal<PartPromotion[]>([]);

  constructor() {
    this.loadPromotions();
  }

  loadPromotions(): void {
    if (typeof window === 'undefined') {
      this.promotions.set([]);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.promotions.set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading promotions from localStorage:', e);
    }
    this.promotions.set([]);
  }

  getPromotion(sku: string): PartPromotion | undefined {
    return this.promotions().find((p) => p.sku === sku && p.active);
  }

  hasPromotion(sku: string): boolean {
    return this.promotions().some((p) => p.sku === sku && p.active);
  }

  getEffectivePrice(sku: string, salePrice: number): number {
    const promo = this.getPromotion(sku);
    return promo && promo.active ? promo.promoPrice : salePrice;
  }

  applyPromotion(promo: PartPromotion): void {
    const existing = this.promotions().filter((p) => p.sku !== promo.sku);
    const updated = [promo, ...existing];
    this.promotions.set(updated);
    this.persist(updated);
    this.toast.success(
      '¡Oferta Activada en Catálogo!',
      `Se aplicó oferta en ${promo.partName} a S/ ${promo.promoPrice.toFixed(2)} (-${promo.discountPercentage}%).`
    );
  }

  removePromotion(sku: string): void {
    const promo = this.getPromotion(sku);
    const updated = this.promotions().filter((p) => p.sku !== sku);
    this.promotions.set(updated);
    this.persist(updated);
    this.toast.info(
      'Oferta Removida',
      `El repuesto ${promo?.partName || sku} volvió a su precio regular de lista.`
    );
  }

  private persist(records: PartPromotion[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.warn('Error saving promotions to localStorage:', e);
      }
    }
  }
}
