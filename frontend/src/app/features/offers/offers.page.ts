import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { retry } from 'rxjs';
import { Part } from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PartPromotion, PromotionService } from '../../core/services/promotion.service';

const CATALOG_CACHE_KEY = 'asuncion_catalog_snapshot_v7';

export interface HydratedComboView {
  promo: PartPromotion;
  mainPart: Part;
  complementPart: Part;
  additionalComplements?: Part[];
  regularCombinedPrice: number;
  comboTotalPrice: number;
  totalSavings: number;
  complementComboPrice: number;
  remainingQuota: number;
}

export interface HydratedDirectOfferView {
  promo: PartPromotion;
  part: Part;
  savings: number;
  remainingQuota: number;
}

@Component({
  selector: 'app-offers-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pb-24 lg:pb-14">
      <!-- Dedicated Offers & Combos Hero Banner -->
      <section class="relative bg-gray-950 text-white overflow-hidden border-b border-gray-800 shadow-md">
        <div class="absolute inset-0 z-0">
          <img
            src="/images/banners/banner-warehouse.jpg"
            alt="Ofertas y Combos Automotrices Asunción"
            class="h-full w-full object-cover object-center filter brightness-45 contrast-125"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/88 to-orange-950/70"></div>
        </div>

        <div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div class="space-y-2.5 max-w-2xl">
              <div class="inline-flex items-center gap-2 rounded-full border border-orange-400/50 bg-orange-500/20 px-3.5 py-1 text-xs sm:text-[13px] font-extrabold text-orange-200">
                <img src="/images/icons/fuego-demanda.png" alt="Oferta" class="h-4 w-4 object-contain inline-block" />
                <span>Sección Especial · Ahorro Directo y Paquetes de Mantenimiento</span>
              </div>
              <h1 class="text-3xl sm:text-4xl font-black tracking-tight text-white leading-tight">
                Ofertas y Combos Automotrices
              </h1>
              <p class="text-sm sm:text-base text-gray-200 leading-relaxed font-medium">
                Aprovecha combos automotrices oficiales y descuentos directos para el mantenimiento de tu vehículo. Repuestos originales y alternativos con garantía directa Asunción S.A.C.
              </p>
              <div class="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-500/20 px-3.5 py-1.5 text-xs font-bold text-amber-200 shadow-sm">
                <img src="/images/icons/alarma.png" alt="Aviso" class="h-3.5 w-3.5 object-contain inline-block" />
                <span>Promociones y Combos Exclusivos de nuestra Tienda Web Online (En mostrador de tienda física rige precio estándar).</span>
              </div>
            </div>

            <div class="flex flex-wrap items-center gap-2.5">
              <a
                routerLink="/"
                class="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2 text-xs sm:text-sm font-extrabold text-white backdrop-blur-xs hover:bg-white/20 transition"
              >
                <span>← Volver al Catálogo</span>
              </a>
              @if (auth.canAccessAdmin()) {
                <a
                  routerLink="/admin"
                  class="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-orange-600 px-4 py-2 text-xs sm:text-sm font-extrabold text-white shadow-sm hover:bg-orange-700 transition"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Gestionar en Administración</span>
                </a>
              }
            </div>
          </div>

          <!-- Filter Tabs -->
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              (click)="activeTab.set('ALL')"
              [class]="
                activeTab() === 'ALL'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                  : 'bg-white/10 text-gray-200 border-white/20 hover:bg-white/20'
              "
              class="min-h-[40px] rounded-xl border px-4 py-2 text-xs sm:text-sm font-extrabold transition cursor-pointer"
            >
              Todas ({{ hydratedCombos().length + hydratedOffers().length }})
            </button>

            <button
              type="button"
              (click)="activeTab.set('COMBOS')"
              [class]="
                activeTab() === 'COMBOS'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                  : 'bg-white/10 text-gray-200 border-white/20 hover:bg-white/20'
              "
              class="min-h-[40px] rounded-xl border px-4 py-2 text-xs sm:text-sm font-extrabold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <img src="/images/icons/combo-paquete.png" alt="Combos" class="h-4 w-4 object-contain inline-block" />
              <span>Combos Oficiales ({{ hydratedCombos().length }})</span>
            </button>
            <button
              type="button"
              (click)="activeTab.set('OFFERS')"
              [class]="
                activeTab() === 'OFFERS'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-sm'
                  : 'bg-white/10 text-gray-200 border-white/20 hover:bg-white/20'
              "
              class="min-h-[40px] rounded-xl border px-4 py-2 text-xs sm:text-sm font-extrabold transition cursor-pointer inline-flex items-center gap-1.5"
            >
              <img src="/images/icons/etiqueta-oferta.png" alt="Ofertas" class="h-4 w-4 object-contain inline-block" />
              <span>Ofertas Directas ({{ hydratedOffers().length }})</span>
            </button>
          </div>
        </div>
      </section>

      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-10">
        @if (isLoading() && allParts().length === 0) {
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center shadow-2xs">
            <div class="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-orange-600 border-t-transparent"></div>
            <p class="mt-3 text-sm font-bold text-gray-700">Cargando ofertas y combos disponibles...</p>
          </div>
        }

        <!-- ==================== 1. SECCIÓN DE COMBOS AUTOMOTRICES OFICIALES ==================== -->
        @if ((activeTab() === 'ALL' || activeTab() === 'COMBOS') && hydratedCombos().length > 0) {
          <section class="space-y-4">
            <div class="flex flex-wrap items-end justify-between gap-2">
              <div>
                <span class="text-xs font-extrabold uppercase tracking-wider text-orange-600">
                  Paquetes Inteligentes de Mantenimiento
                </span>
                <h2 class="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2">
                  <img src="/images/icons/combo-paquete.png" alt="Combos" class="h-6 w-6 object-contain inline-block shrink-0" />
                  <span>Combos Automotrices Oficiales</span>
                </h2>
              </div>
              <p class="text-xs sm:text-sm font-semibold text-gray-600">
                Paquetes sugeridos con doble descuento aplicable de inmediato.
              </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              @for (combo of hydratedCombos(); track combo.promo.sku) {
                <article class="group flex flex-col rounded-2xl border border-orange-200 bg-white overflow-hidden shadow-2xs hover:shadow-lg hover:border-orange-400 transition-all duration-200">
                  <!-- Header Badge -->
                  <div class="border-b border-orange-100 bg-orange-50/60 px-4 py-2.5 flex items-center justify-between">
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-orange-600 px-2.5 py-0.5 text-[11px] font-black text-white uppercase tracking-wider">
                      {{ combo.promo.badgeLabel || 'COMBO RECOMENDADO' }}
                    </span>
                    <span class="font-mono text-xs font-black text-emerald-700">
                      Ahorras S/ {{ combo.totalSavings | number: '1.2-2' }}
                    </span>
                  </div>

                  <!-- 2-Part Combined Visual Display -->
                  <div class="p-4 sm:p-5 grid grid-cols-2 gap-3 relative items-stretch">
                    <!-- Main Part Preview -->
                    <div class="flex flex-col items-center text-center space-y-2">
                      <a [routerLink]="['/part', combo.mainPart.id]" class="h-32 w-full flex items-center justify-center bg-white rounded-lg p-2 border border-gray-100">
                        <img
                          [src]="resolveImage(combo.mainPart)"
                          [alt]="combo.mainPart.name"
                          (error)="onPartImageError($event, combo.mainPart)"
                          class="max-h-full max-w-full object-contain"
                        />
                      </a>
                      <span class="text-[10px] font-extrabold uppercase text-orange-600">Principal</span>
                      <a [routerLink]="['/part', combo.mainPart.id]" class="text-xs font-bold text-gray-900 line-clamp-2 hover:text-orange-600 transition">
                        {{ combo.mainPart.name }}
                      </a>
                      <div class="text-xs font-mono">
                        <span class="text-gray-400 line-through mr-1.5">S/ {{ combo.mainPart.salePrice | number: '1.2-2' }}</span>
                        <strong class="text-gray-950 font-black">S/ {{ combo.promo.promoPrice | number: '1.2-2' }}</strong>
                      </div>
                    </div>

                    <!-- Complement Part Preview -->
                    <div class="flex flex-col items-center text-center space-y-2">
                      <a [routerLink]="['/part', combo.complementPart.id]" class="h-32 w-full flex items-center justify-center bg-white rounded-lg p-2 border border-gray-100">
                        <img
                          [src]="resolveImage(combo.complementPart)"
                          [alt]="combo.complementPart.name"
                          (error)="onPartImageError($event, combo.complementPart)"
                          class="max-h-full max-w-full object-contain"
                        />
                      </a>
                      <span class="text-[10px] font-extrabold uppercase text-emerald-600">Complemento</span>
                      <a [routerLink]="['/part', combo.complementPart.id]" class="text-xs font-bold text-gray-900 line-clamp-2 hover:text-orange-600 transition">
                        {{ combo.complementPart.name }}
                      </a>
                      <div class="text-xs font-mono">
                        <span class="text-gray-400 line-through mr-1.5">S/ {{ combo.complementPart.salePrice | number: '1.2-2' }}</span>
                        <strong class="text-emerald-800 font-black">S/ {{ combo.complementComboPrice | number: '1.2-2' }}</strong>
                      </div>
                    </div>
                  </div>

                  <!-- Combo Price & CTA Footer -->
                  <div class="border-t border-gray-100 bg-gray-50/70 px-4 sm:px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 mt-auto">
                    <div>
                      <span class="block text-xs font-semibold text-gray-500 tabular-nums">
                        Por separado: <span class="line-through">S/ {{ combo.regularCombinedPrice | number: '1.2-2' }}</span>
                      </span>
                      <div class="flex items-baseline gap-2">
                        <span class="text-2xl font-black tracking-tight text-orange-600 tabular-nums">
                          S/ {{ combo.comboTotalPrice | number: '1.2-2' }}
                        </span>
                        <span class="text-xs font-bold text-gray-600">por ambos</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      [disabled]="!canAddCombo(combo)"
                      (click)="cart.addCombo(combo.mainPart, combo.additionalComplements && combo.additionalComplements.length > 0 ? combo.additionalComplements : combo.complementPart, true)"
                      class="min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-sm hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-300 disabled:text-gray-500 transition cursor-pointer"
                    >
                      <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      <span>{{ canAddCombo(combo) ? 'Llevar Combo' : 'Sin stock' }}</span>
                    </button>
                  </div>
                </article>
              }
            </div>
          </section>
        }

        <!-- ==================== 2. SECCIÓN DE OFERTAS DIRECTAS ==================== -->
        @if ((activeTab() === 'ALL' || activeTab() === 'OFFERS') && hydratedOffers().length > 0) {
          <section class="space-y-4">
            <div>
              <span class="text-xs font-extrabold uppercase tracking-wider text-red-600">
                Precios Rebajados Inmediatos
              </span>
              <h2 class="text-xl sm:text-2xl font-black text-gray-950 flex items-center gap-2">
                <img src="/images/icons/etiqueta-oferta.png" alt="Oferta" class="h-6 w-6 object-contain inline-block shrink-0" />
                <span>Repuestos en Oferta Directa</span>
              </h2>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              @for (offer of hydratedOffers(); track offer.promo.sku) {
                <article class="group flex flex-col rounded-2xl border border-red-200/90 bg-white overflow-hidden shadow-2xs hover:shadow-lg hover:border-red-400 transition-all duration-200">
                  <a
                    [routerLink]="['/part', offer.part.id]"
                    class="relative h-52 w-full bg-white p-4 border-b border-gray-100 flex items-center justify-center overflow-hidden"
                  >
                    <img
                      [src]="resolveImage(offer.part)"
                      [alt]="offer.part.name"
                      (error)="onPartImageError($event, offer.part)"
                      loading="lazy"
                      class="max-h-full max-w-full object-contain group-hover:scale-105 transition duration-300"
                    />
                    <span class="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-extrabold text-white shadow-xs">
                      <img src="/images/icons/fuego-demanda.png" alt="Oferta" class="h-3 w-3 object-contain inline-block" />
                      <span>{{ offer.promo.badgeLabel || 'OFERTA' }} -{{ offer.promo.discountPercentage }}%</span>
                    </span>
                    <span class="absolute top-2.5 right-2.5 rounded-full border border-emerald-300 bg-emerald-50/95 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800 tabular-nums">
                      {{ cart.getRemainingStockToAdd(offer.part) }} en stock
                    </span>
                  </a>

                  <div class="flex flex-1 flex-col p-4 space-y-2.5">
                    <span class="text-[11px] font-extrabold uppercase tracking-wide text-orange-600">
                      {{ offer.part.manufacturerBrand }} · {{ offer.part.categoryName }}
                    </span>
                    <a
                      [routerLink]="['/part', offer.part.id]"
                      class="text-[15px] font-extrabold text-gray-950 leading-snug group-hover:text-orange-600 transition"
                    >
                      {{ offer.part.name }}
                    </a>

                    <div class="mt-auto pt-3 border-t border-gray-100 space-y-3">
                      <div>
                        <div class="flex items-baseline gap-2">
                          <span class="text-xl font-black tracking-tight text-red-600 tabular-nums">
                            S/ {{ offer.promo.promoPrice | number: '1.2-2' }}
                          </span>
                          <span class="text-xs font-semibold text-gray-400 line-through tabular-nums">
                            S/ {{ offer.part.salePrice | number: '1.2-2' }}
                          </span>
                        </div>
                        <span class="inline-block mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 tabular-nums">
                          Ahorras S/ {{ offer.savings | number: '1.2-2' }} · Cupo: {{ offer.remainingQuota }} und.
                        </span>
                      </div>

                      <div class="grid grid-cols-5 gap-2">
                        <a
                          [routerLink]="['/part', offer.part.id]"
                          class="col-span-2 min-h-[42px] flex items-center justify-center rounded-xl border border-gray-300 bg-white px-2 text-[13px] font-extrabold text-gray-800 hover:bg-gray-50 transition"
                        >
                          Ver ficha
                        </a>
                        <button
                          type="button"
                          [disabled]="cart.getRemainingStockToAdd(offer.part) <= 0"
                          (click)="cart.addPart(offer.part, 1, true)"
                          class="col-span-3 min-h-[42px] flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 text-[13px] font-extrabold text-white shadow-2xs hover:bg-orange-700 disabled:bg-gray-200 disabled:text-gray-500 transition cursor-pointer"
                        >
                          <span>{{ cart.getRemainingStockToAdd(offer.part) > 0 ? '+ Agregar' : 'Sin stock' }}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              }
            </div>
          </section>
        }
      </div>
    </div>
  `,
})
export class OffersPageComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly route = inject(ActivatedRoute);
  readonly promotionService = inject(PromotionService);
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);

  readonly allParts = signal<Part[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly activeTab = signal<'ALL' | 'COMBOS' | 'OFFERS'>('ALL');

  // Custom Combo Builder State
  readonly customMainPart = signal<Part | null>(null);
  readonly customCompPart = signal<Part | null>(null);
  readonly mainSearchQuery = signal<string>('');
  readonly compSearchQuery = signal<string>('');
  readonly selectedCategoryFilter = signal<string>('TODOS');
  readonly categoryFilterOptions = ['TODOS', 'FRENOS', 'FILTROS', 'MOTOR', 'LUBRICANTES', 'SUSPENSION', 'ENCENDIDO'];

  readonly partsBySku = computed(() => {
    const map = new Map<string, Part>();
    for (const p of this.allParts()) {
      if (p.sku) {
        map.set(p.sku.trim().toUpperCase(), p);
      }
    }
    return map;
  });

  readonly hydratedCombos = computed<HydratedComboView[]>(() => {
    const map = this.partsBySku();
    const out: HydratedComboView[] = [];
    for (const promo of this.promotionService.activeCombos()) {
      const mainPart = map.get((promo.sku || '').trim().toUpperCase());
      if (!mainPart) continue;

      let comps: Part[] = [];
      if (promo.comboComplements && promo.comboComplements.length > 0) {
        comps = promo.comboComplements
          .map((c) => map.get((c.sku || '').trim().toUpperCase()))
          .filter((p): p is Part => Boolean(p));
      }
      if (comps.length === 0 && promo.comboComplementSku) {
        const singleComp = map.get(promo.comboComplementSku.trim().toUpperCase());
        if (singleComp) comps = [singleComp];
      }
      if (comps.length === 0) continue;
      const compPart = comps[0];

      const compComboPrice = this.promotionService.getComplementComboPrice(
        promo,
        compPart.salePrice
      );
      const compsRegularTotal = comps.reduce((sum, c) => sum + c.salePrice, 0);
      const compsComboTotal = comps.reduce((sum, c) => {
        const itemPromo = (promo.comboComplements || []).find((ic) => ic.sku === c.sku);
        const itemPrice = itemPromo?.promoPrice ?? Number(Math.max(c.purchasePrice ?? 0, c.salePrice * 0.85).toFixed(2));
        return sum + itemPrice;
      }, 0);

      const regularCombined = Number((mainPart.salePrice + compsRegularTotal).toFixed(2));
      const comboTotal = promo.comboTotalPromoPrice ?? Number((promo.promoPrice + compsComboTotal).toFixed(2));
      const savings = Math.max(0, Number((regularCombined - comboTotal).toFixed(2)));
      const remQuota = Math.max(1, (promo.unitsQuota || 8) - (promo.unitsSoldInPromo || 0));
      out.push({
        promo,
        mainPart,
        complementPart: compPart,
        additionalComplements: comps,
        regularCombinedPrice: regularCombined,
        comboTotalPrice: comboTotal,
        totalSavings: savings,
        complementComboPrice: compComboPrice,
        remainingQuota: remQuota,
      });
    }
    return out;
  });

  readonly hydratedOffers = computed<HydratedDirectOfferView[]>(() => {
    const map = this.partsBySku();
    const out: HydratedDirectOfferView[] = [];
    for (const promo of this.promotionService.activeDirectOffers()) {
      const part = map.get((promo.sku || '').trim().toUpperCase());
      if (!part) continue;
      const savings = Math.max(0, Number((part.salePrice - promo.promoPrice).toFixed(2)));
      const remQuota = Math.max(1, (promo.unitsQuota || 8) - (promo.unitsSoldInPromo || 0));
      out.push({
        promo,
        part,
        savings,
        remainingQuota: remQuota,
      });
    }
    return out;
  });

  // Custom Combo Calculations
  readonly selectableMainParts = computed<Part[]>(() => {
    const q = this.mainSearchQuery().toLowerCase().trim();
    const cat = this.selectedCategoryFilter();
    const comp = this.customCompPart();

    return this.allParts().filter((p) => {
      if (!p.active || p.stockQuantity <= 0) return false;
      if (comp && p.id === comp.id) return false;
      if (cat !== 'TODOS') {
        const pCat = (p.categoryName || '').toUpperCase();
        if (!pCat.includes(cat)) return false;
      }
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.manufacturerBrand && p.manufacturerBrand.toLowerCase().includes(q))
      );
    });
  });

  readonly selectableCompParts = computed<Part[]>(() => {
    const q = this.compSearchQuery().toLowerCase().trim();
    const main = this.customMainPart();

    return this.allParts().filter((p) => {
      if (!p.active || p.stockQuantity <= 0) return false;
      if (main && p.id === main.id) return false;
      if (!q) {
        // If main is chosen, prioritize smart complements
        if (main) {
          const mCat = (main.categoryName || '').toUpperCase();
          const pCat = (p.categoryName || '').toUpperCase();
          if (mCat.includes('FRENO') && (pCat.includes('LUBRI') || pCat.includes('FRENO'))) return true;
          if (mCat.includes('MOTOR') && (pCat.includes('FILTRO') || pCat.includes('LUBRI'))) return true;
          if (mCat.includes('FILTRO') && (pCat.includes('LUBRI') || pCat.includes('MOTOR'))) return true;
        }
        return true;
      }
      return (
        p.name.toLowerCase().includes(q) ||
        (p.sku && p.sku.toLowerCase().includes(q)) ||
        (p.manufacturerBrand && p.manufacturerBrand.toLowerCase().includes(q))
      );
    });
  });

  readonly customComboRegularTotal = computed<number>(() => {
    const m = this.customMainPart();
    const c = this.customCompPart();
    const total = (m?.salePrice ?? 0) + (c?.salePrice ?? 0);
    return Number(total.toFixed(2));
  });

  readonly customComboDiscount = computed<number>(() => {
    const total = this.customComboRegularTotal();
    return Number((total * 0.10).toFixed(2));
  });

  readonly customComboFinalTotal = computed<number>(() => {
    const total = this.customComboRegularTotal();
    const disc = this.customComboDiscount();
    return Number(Math.max(0, total - disc).toFixed(2));
  });

  canAddCustomCombo(): boolean {
    const m = this.customMainPart();
    const c = this.customCompPart();
    if (!m || !c) return false;
    return (
      (this.cart.getRemainingStockToAdd(m) > 0 || this.cart.getMyCartQuantity(m.id) > 0) &&
      (this.cart.getRemainingStockToAdd(c) > 0 || this.cart.getMyCartQuantity(c.id) > 0) &&
      m.stockQuantity > 0 &&
      c.stockQuantity > 0
    );
  }

  addCustomComboToCart(): void {
    const m = this.customMainPart();
    const c = this.customCompPart();
    if (!m || !c) return;
    this.cart.addCustomCombo(m, c, true);
  }

  resetCustomCombo(): void {
    this.customMainPart.set(null);
    this.customCompPart.set(null);
    this.mainSearchQuery.set('');
    this.compSearchQuery.set('');
  }

  onMainSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    this.mainSearchQuery.set(val);
  }

  onCompSearchInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value || '';
    this.compSearchQuery.set(val);
  }

  ngOnInit(): void {
    this.hydratePartsFromLocalCache();
    this.promotionService.refreshFromCloud();
    this.catalogService
      .searchParts({})
      .pipe(retry({ count: 4, delay: 2500 }))
      .subscribe({
        next: (parts) => {
          this.allParts.set(parts);
          this.isLoading.set(false);
          this.checkQueryParamPreselection();
        },
        error: () => {
          this.isLoading.set(false);
        },
      });

    this.checkQueryParamPreselection();
  }

  private checkQueryParamPreselection(): void {
    const paramId = this.route.snapshot.queryParamMap.get('comboPartId');
    if (paramId && this.allParts().length > 0) {
      this.activeTab.set('COMBOS');
    }
  }

  private hydratePartsFromLocalCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        this.allParts.set(parsed.parts);
        this.isLoading.set(false);
      }
    } catch {
      // Ignore cache error
    }
  }

  canAddCombo(combo: HydratedComboView): boolean {
    const mainOk =
      this.cart.getRemainingStockToAdd(combo.mainPart) > 0 ||
      this.cart.getMyCartQuantity(combo.mainPart.id) > 0;
    const comps = combo.additionalComplements && combo.additionalComplements.length > 0 ? combo.additionalComplements : [combo.complementPart];
    const compsOk = comps.every(
      (c) => (this.cart.getRemainingStockToAdd(c) > 0 || this.cart.getMyCartQuantity(c.id) > 0) && c.stockQuantity > 0
    );
    return mainOk && compsOk && combo.mainPart.stockQuantity > 0;
  }

  resolveImage(part: Part): string {
    return this.apiConfig.resolvePartPrimaryImage(part);
  }

  onPartImageError(event: Event, part: Part): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const fallback = this.apiConfig.getCategoryFallback(part.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }
}
