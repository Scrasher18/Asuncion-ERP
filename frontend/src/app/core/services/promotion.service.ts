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
      (p) =>
        p.promoType === 'COMBO_SUGERIDO' &&
        Boolean(p.comboComplementSku || (p.comboComplements && p.comboComplements.length > 0))
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
            const currentBySku = new Map<string, PartPromotion>();
            for (const existing of this.promotions()) {
              if (existing.sku) {
                currentBySku.set(existing.sku.trim().toUpperCase(), existing);
              }
            }
            const mergedList = list.map((cloudItem) => {
              const norm = (cloudItem.sku || '').trim().toUpperCase();
              const localItem = currentBySku.get(norm);
              if (
                localItem &&
                localItem.comboComplements &&
                localItem.comboComplements.length > (cloudItem.comboComplements?.length || 0)
              ) {
                return {
                  ...cloudItem,
                  comboComplements: localItem.comboComplements,
                  comboTotalPromoPrice: localItem.comboTotalPromoPrice ?? cloudItem.comboTotalPromoPrice,
                };
              }
              return cloudItem;
            });
            this.promotions.set(mergedList);
            this.persist(mergedList);
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

  /**
   * Devuelve todos los SKUs complementarios requeridos por un combo (soporta 2, 3, 4+ productos).
   */
  getRequiredComplementSkus(promo?: PartPromotion | null): string[] {
    if (!promo || promo.promoType !== 'COMBO_SUGERIDO') return [];
    const skus: string[] = [];
    if (promo.comboComplements && promo.comboComplements.length > 0) {
      for (const comp of promo.comboComplements) {
        const s = (comp.sku || '').trim().toUpperCase();
        if (s && !skus.includes(s)) {
          skus.push(s);
        }
      }
    }
    if (promo.comboComplementSku) {
      for (const token of promo.comboComplementSku.split(',')) {
        const s = token.trim().toUpperCase();
        if (s && !skus.includes(s)) {
          skus.push(s);
        }
      }
    }
    return skus;
  }

  /**
   * Devuelve todos los SKUs que integran el kit completo (1 Principal + N Complementos).
   */
  getAllComboSkus(promo?: PartPromotion | null): string[] {
    if (!promo || promo.promoType !== 'COMBO_SUGERIDO') return [];
    const mainSku = (promo.sku || '').trim().toUpperCase();
    const comps = this.getRequiredComplementSkus(promo);
    return mainSku ? [mainSku, ...comps.filter((s) => s !== mainSku)] : comps;
  }

  /**
   * Verifica que el 100% de los productos del combo (sean 2, 3 o más) estén presentes en el carrito.
   * Si falta aunque sea 1 producto del combo, devuelve false y ninguno conserva el precio promocional de combo.
   */
  isComboCompleteInCart(promo?: PartPromotion | null, cartSkus?: Set<string>): boolean {
    if (!promo || !promo.active || promo.promoType !== 'COMBO_SUGERIDO' || !cartSkus) return false;
    const mainSku = (promo.sku || '').trim().toUpperCase();
    const reqComps = this.getRequiredComplementSkus(promo);
    if (!mainSku || reqComps.length === 0) return false;
    if (!cartSkus.has(mainSku)) return false;
    return reqComps.every((compSku) => cartSkus.has(compSku));
  }

  /**
   * Calcula cuántos kits completos del combo se forman en el carrito según las cantidades de cada ítem.
   * Ejemplo: si un combo de 3 productos (A + B + C) tiene en el carrito A=3, B=1, C=1, solo se forma 1 kit completo.
   */
  getCompleteComboSetsInCart(promo?: PartPromotion | null, qtyBySku?: Map<string, number>): number {
    if (!promo || !promo.active || promo.promoType !== 'COMBO_SUGERIDO' || !qtyBySku) return 0;
    const allSkus = this.getAllComboSkus(promo);
    if (allSkus.length < 2) return 0;
    let minSets = Number.MAX_SAFE_INTEGER;
    for (const s of allSkus) {
      const q = qtyBySku.get(s) ?? 0;
      if (q <= 0) return 0;
      if (q < minSets) minSets = q;
    }
    return minSets === Number.MAX_SAFE_INTEGER ? 0 : minSets;
  }

  findComboWhereComplementIs(sku?: string | null, activeCartSkus?: Set<string>): PartPromotion | undefined {
    if (!sku) return undefined;
    const norm = sku.trim().toUpperCase();
    return this.activeCombos().find((c) => {
      const reqComps = this.getRequiredComplementSkus(c);
      if (!reqComps.includes(norm)) return false;
      if (!activeCartSkus) return true;
      return this.isComboCompleteInCart(c, activeCartSkus);
    });
  }

  /**
   * Detecta si un SKU en el carrito pertenece a un combo oficial que quedó INCOMPLETO
   * (por ejemplo, un combo de 3 productos donde el cliente quitó 1 o 2 del carrito).
   */
  findIncompleteComboForCartSku(
    sku?: string | null,
    cartSkus?: Set<string>
  ): { promo: PartPromotion; missingSkus: string[]; missingNames: string[]; totalItems: number } | null {
    if (!sku || !cartSkus) return null;
    const norm = sku.trim().toUpperCase();
    for (const combo of this.activeCombos()) {
      const allSkus = this.getAllComboSkus(combo);
      if (!allSkus.includes(norm)) continue;
      if (this.isComboCompleteInCart(combo, cartSkus)) continue;

      const missingSkus = allSkus.filter((s) => !cartSkus.has(s));
      if (missingSkus.length > 0 && missingSkus.length < allSkus.length) {
        const mainSku = (combo.sku || '').trim().toUpperCase();
        const rawNames = (combo.comboComplementName || '').split('+').map((n) => n.trim()).filter(Boolean);
        const reqComps = this.getRequiredComplementSkus(combo);
        const missingNames = missingSkus.map((mSku) => {
          if (mSku === mainSku) return combo.partName || mSku;
          const compObj = (combo.comboComplements || []).find((cc) => (cc.sku || '').trim().toUpperCase() === mSku);
          if (compObj?.name) return compObj.name;
          const idx = reqComps.indexOf(mSku);
          return (idx >= 0 && rawNames[idx]) ? rawNames[idx] : mSku;
        });
        return {
          promo: combo,
          missingSkus,
          missingNames,
          totalItems: allSkus.length,
        };
      }
    }
    return null;
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
          const mergedSaved: PartPromotion = {
            ...saved,
            comboComplements:
              promo.comboComplements && promo.comboComplements.length > 0
                ? promo.comboComplements
                : saved.comboComplements,
            comboTotalPromoPrice: promo.comboTotalPromoPrice ?? saved.comboTotalPromoPrice,
          };
          const synced = [
            mergedSaved,
            ...this.promotions().filter((p) => p.sku.trim().toUpperCase() !== normSku),
          ];
          this.promotions.set(synced);
          this.persist(synced);
          const totalKitItems = 1 + (mergedSaved.comboComplements?.length || 1);
          this.toast.success(
            mergedSaved.promoType === 'COMBO_SUGERIDO'
              ? `¡Combo Automotriz de ${totalKitItems} Artículos Publicado!`
              : '¡Oferta Activada en la Web!',
            mergedSaved.promoType === 'COMBO_SUGERIDO'
              ? `Kit de ${totalKitItems} artículos (${mergedSaved.partName} + ${mergedSaved.comboComplements?.map((c) => c.name).join(' + ') || mergedSaved.comboComplementName}) activo en tienda.`
              : `Se activó ${mergedSaved.partName} a S/ ${mergedSaved.promoPrice.toFixed(2)} (-${mergedSaved.discountPercentage}%).`
          );
        },
        error: () => {
          const totalKitItems = 1 + (promo.comboComplements?.length || 1);
          this.toast.success(
            promo.promoType === 'COMBO_SUGERIDO'
              ? `¡Combo de ${totalKitItems} Artículos Activado!`
              : '¡Promoción Activada!',
            promo.promoType === 'COMBO_SUGERIDO'
              ? `Kit de ${totalKitItems} repuestos disponible en la tienda web.`
              : `Se aplicó la promoción en ${promo.partName} (-${promo.discountPercentage}%).`
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
