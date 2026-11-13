import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { retry } from 'rxjs';
import { ApiConfigService } from './api-config.service';
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
  badgeLabel: string;
  promoType: 'DESCUENTO_DIRECTO' | 'COMBO_SUGERIDO';
  comboComplementSku?: string;
  comboComplementName?: string;
  comboComplementPrice?: number;
  comboComplementPromoPrice?: number;
  comboTotalPromoPrice?: number;
  comboComplements?: Array<{
    sku: string;
    name: string;
    price: number;
    promoPrice?: number;
    discountPercent?: number;
    imageUrl?: string;
  }>;
  unitsQuota: number;
  unitsSoldInPromo: number;
  active: boolean;
  startDate: string;
  endDate?: string;
  notes?: string;
}

const STORAGE_KEY = 'asuncion_active_promotions_v2';

@Injectable({
  providedIn: 'root',
})
export class PromotionService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  readonly promotions = signal<PartPromotion[]>([]);

  readonly activePromotions = computed(() =>
    this.promotions().filter((p) => p.active && p.unitsSoldInPromo < (p.unitsQuota || 999))
  );

  readonly activeCombos = computed(() =>
    this.activePromotions().filter(
      (p) => p.promoType === 'COMBO_SUGERIDO' && Boolean(p.comboComplementSku)
    )
  );

  readonly activeDirectOffers = computed(() =>
    this.activePromotions().filter((p) => p.promoType !== 'COMBO_SUGERIDO')
  );

  constructor() {
    this.hydrateFromLocalCache();
    this.refreshFromCloud();
  }

  hydrateFromLocalCache(): void {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.promotions.set(parsed);
        }
      }
    } catch {
      // Ignore storage corruption
    }
  }

  refreshFromCloud(): void {
    this.http
      .get<PartPromotion[]>(`${this.apiConfig.apiUrl}/catalog/promotions`)
      .pipe(retry({ count: 3, delay: 2500 }))
      .subscribe({
        next: (list) => {
          if (Array.isArray(list)) {
            this.promotions.set(list);
            this.persist(list);
          }
        },
        error: () => {},
      });
  }

  getPromotion(sku?: string | null): PartPromotion | undefined {
    if (!sku) return undefined;
    const norm = sku.trim().toUpperCase();
    return this.activePromotions().find((p) => (p.sku || '').trim().toUpperCase() === norm);
  }

  getDirectOffer(sku?: string | null): PartPromotion | undefined {
    const promo = this.getPromotion(sku);
    return promo && promo.promoType !== 'COMBO_SUGERIDO' ? promo : undefined;
  }

  hasPromotion(sku?: string | null): boolean {
    return Boolean(this.getPromotion(sku));
  }

  findComboWhereComplementIs(sku?: string | null, activeMainSkusInCart?: Set<string>): PartPromotion | undefined {
    if (!sku) return undefined;
    const norm = sku.trim().toUpperCase();
    return this.activeCombos().find((c) => {
      const singleMatch = (c.comboComplementSku || '').trim().toUpperCase() === norm;
      const multiMatch = (c.comboComplements || []).some(
        (comp) => (comp.sku || '').trim().toUpperCase() === norm
      );
      if (!singleMatch && !multiMatch) return false;
      if (!activeMainSkusInCart) return true;
      return activeMainSkusInCart.has((c.sku || '').trim().toUpperCase());
    });
  }

  getComplementComboPrice(promo: PartPromotion, regularFallbackPrice = 0, itemSku?: string): number {
    if (itemSku && promo.comboComplements && promo.comboComplements.length > 0) {
      const norm = itemSku.trim().toUpperCase();
      const matched = promo.comboComplements.find((c) => (c.sku || '').trim().toUpperCase() === norm);
      if (matched) {
        if (matched.promoPrice && matched.promoPrice > 0) return matched.promoPrice;
        const disc = (matched.discountPercent || 15) / 100;
        return Number((matched.price * (1 - disc)).toFixed(2));
      }
    }
    if (promo.comboComplementPromoPrice && promo.comboComplementPromoPrice > 0) {
      return promo.comboComplementPromoPrice;
    }
    const base = promo.comboComplementPrice || regularFallbackPrice;
    return Number((base * 0.85).toFixed(2));
  }

  getEffectivePrice(sku: string, salePrice: number): number {
    const promo = this.getDirectOffer(sku);
    return promo ? promo.promoPrice : salePrice;
  }

  applyPromotion(promo: PartPromotion): void {
    const normSku = promo.sku.trim().toUpperCase();
    const optimistic = [
      promo,
      ...this.promotions().filter((p) => p.sku.trim().toUpperCase() !== normSku),
    ];
    this.promotions.set(optimistic);
    this.persist(optimistic);

    this.http
      .post<PartPromotion>(`${this.apiConfig.apiUrl}/admin/promotions`, promo)
      .subscribe({
        next: (saved) => {
          const synced = [
            saved,
            ...this.promotions().filter((p) => p.sku.trim().toUpperCase() !== normSku),
          ];
          this.promotions.set(synced);
          this.persist(synced);
          this.toast.success(
            saved.promoType === 'COMBO_SUGERIDO'
              ? '¡Combo Automotriz Publicado!'
              : '¡Oferta Activada en la Web!',
            saved.promoType === 'COMBO_SUGERIDO'
              ? `Combo ${saved.partName} + ${saved.comboComplementName} disponible en Ofertas y Combos.`
              : `Se activó ${saved.partName} a S/ ${saved.promoPrice.toFixed(2)} (-${saved.discountPercentage}%).`
          );
        },
        error: () => {
          this.toast.success(
            '¡Promoción Activada!',
            `Se aplicó la promoción en ${promo.partName} (-${promo.discountPercentage}%).`
          );
        },
      });
  }

  removePromotion(sku: string): void {
    const normSku = sku.trim().toUpperCase();
    const promo = this.getPromotion(normSku);
    const updated = this.promotions().filter((p) => p.sku.trim().toUpperCase() !== normSku);
    this.promotions.set(updated);
    this.persist(updated);

    this.http
      .delete(`${this.apiConfig.apiUrl}/admin/promotions/${encodeURIComponent(normSku)}`)
      .subscribe({
        next: () => {
          this.toast.info(
            'Promoción Desactivada',
            `El repuesto ${promo?.partName || normSku} volvió a su precio regular de lista.`
          );
        },
        error: () => {
          this.toast.info(
            'Promoción Desactivada',
            `El repuesto ${promo?.partName || normSku} volvió a su precio regular.`
          );
        },
      });
  }

  private persist(records: PartPromotion[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch {
        // Ignore quota errors
      }
    }
  }
}
