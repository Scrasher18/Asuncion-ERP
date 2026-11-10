import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CartItem, CustomComboPair, Part, ReservationSyncResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { PromotionService } from './promotion.service';
import { SyncBusService } from './sync-bus.service';

const GUEST_CART_KEY = 'asuncion_cart_guest_v2';
const RESERVATION_SESSION_KEY = 'asuncion_reservation_session_id';
const CUSTOM_COMBOS_KEY = 'asuncion_custom_combos_v1';
export const POS_ACTIVE_HOLDS_KEY = 'asuncion_pos_active_holds';
export const ONLINE_ACTIVE_HOLDS_KEY = 'asuncion_online_active_holds';

export interface StockAdjustmentItem {
  partId: number;
  partName: string;
  partSku: string;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  isFullyDepleted: boolean;
}

export interface StockAdjustmentAlert {
  title: string;
  subtitle: string;
  items: StockAdjustmentItem[];
  timestamp: number;
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  readonly promotionService = inject(PromotionService);
  private readonly syncBus = inject(SyncBusService);

  readonly items = signal<CartItem[]>([]);
  readonly isDrawerOpen = signal<boolean>(false);
  readonly activeStockAlert = signal<StockAdjustmentAlert | null>(null);

  // Stock Reservation (Estado RESERVADO) Signals
  readonly reservationSessionId: string = this.initOrLoadSessionId();
  readonly reservationExpiresAt = signal<number | null>(this.loadStoredExpiresAt());
  readonly reservationRemainingSeconds = signal<number>(this.calculateInitialRemainingSeconds());
  readonly reservedByOthersMap = signal<Record<number, number>>({});
  readonly posActiveHolds = signal<Record<number, number>>(this.loadPosActiveHolds());
  readonly isSyncingReservation = signal<boolean>(false);
  readonly customCombos = signal<CustomComboPair[]>(this.loadCustomCombos());
  private lastProcessedUserId: number | null | undefined = undefined;

  readonly hasActiveReservation = computed(() =>
    this.items().length > 0 && this.reservationRemainingSeconds() > 0
  );

  readonly reservationFormattedTimer = computed(() => {
    const secs = Math.max(0, this.reservationRemainingSeconds());
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  });

  constructor() {
    // Automatically switch and seamlessly migrate cart storage when user logs in, logs out, or registers.
    // All internal signal reads/writes run inside untracked() so this effect only reacts to currentUser changes.
    effect(() => {
      const user = this.authService.currentUser();
      const currentUserId = user?.id ?? null;

      untracked(() => {
        if (this.lastProcessedUserId === currentUserId) {
          return;
        }
        const prevUserId = this.lastProcessedUserId;
        this.lastProcessedUserId = currentUserId;

        let loaded: CartItem[] = [];

        if (currentUserId !== null) {
          const userKey = `asuncion_cart_user_${currentUserId}_v2`;
          const userSaved = this.loadCartFromKey(userKey);
          const guestSaved = this.loadCartFromKey(GUEST_CART_KEY);
          const memoryUnauthed = prevUserId === null ? this.items() : [];
          const unauthedItems = guestSaved.length > 0 ? guestSaved : memoryUnauthed;

          if (unauthedItems.length > 0) {
            const map = new Map<number, CartItem>();
            for (const it of userSaved) {
              map.set(it.part.id, { ...it });
            }
            for (const it of unauthedItems) {
              if (map.has(it.part.id)) {
                const existing = map.get(it.part.id)!;
                const maxStock = existing.part.stockQuantity || it.part.stockQuantity || 999;
                existing.quantity = Math.min(maxStock, existing.quantity + it.quantity);
              } else {
                map.set(it.part.id, { ...it });
              }
            }
            loaded = Array.from(map.values());
            if (typeof window !== 'undefined') {
              localStorage.setItem(userKey, JSON.stringify(loaded));
              localStorage.removeItem(GUEST_CART_KEY);
            }
          } else {
            loaded = userSaved;
          }
        } else {
          // Guest user without active session
          loaded = this.loadCartFromKey(GUEST_CART_KEY);
        }

        this.items.set(loaded);
        if (loaded.length > 0) {
          this.publishOnlineHolds(loaded);
          this.syncReservationWithServer(false);
        } else {
          this.setReservationExpiresAt(null);
          this.reservationRemainingSeconds.set(0);
          this.reservedByOthersMap.set({});
        }
      });
    });

    if (typeof window !== 'undefined') {
      // Real-time synchronization across POS, Catalog, and Multi-Tabs
      this.syncBus.events$.subscribe(() => {
        this.refreshPosHoldsAndReconcile(false);
      });

      // Listen for POS holds or cross-tab changes in real time
      window.addEventListener('storage', (evt) => {
        if (evt.key === POS_ACTIVE_HOLDS_KEY) {
          this.refreshPosHoldsAndReconcile();
        }
      });

      window.addEventListener('asuncion-pos-holds-updated', () => {
        this.refreshPosHoldsAndReconcile();
      });

      setInterval(() => {
        this.refreshPosHoldsAndReconcile(false);
        const exp = this.reservationExpiresAt();
        if (!exp || this.items().length === 0) {
          if (this.reservationRemainingSeconds() !== 0) {
            this.reservationRemainingSeconds.set(0);
          }
          return;
        }
        const diff = Math.max(0, Math.floor((exp - Date.now()) / 1000));
        this.reservationRemainingSeconds.set(diff);
      }, 1000);
    }
  }

  private loadStoredExpiresAt(): number | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('asuncion_cart_expires_at');
    if (!raw) return null;
    const val = Number(raw);
    if (!val || isNaN(val) || val <= Date.now()) {
      localStorage.removeItem('asuncion_cart_expires_at');
      return null;
    }
    return val;
  }

  private calculateInitialRemainingSeconds(): number {
    const exp = this.loadStoredExpiresAt();
    if (!exp) return 0;
    return Math.max(0, Math.floor((exp - Date.now()) / 1000));
  }

  setReservationExpiresAt(timestamp: number | null): void {
    this.reservationExpiresAt.set(timestamp);
    if (typeof window === 'undefined') return;
    if (timestamp && timestamp > Date.now()) {
      localStorage.setItem('asuncion_cart_expires_at', String(timestamp));
    } else {
      localStorage.removeItem('asuncion_cart_expires_at');
    }
  }

  private loadPosActiveHolds(): Record<number, number> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(POS_ACTIVE_HOLDS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        if (parsed.expiresAt && typeof parsed.expiresAt === 'number' && parsed.expiresAt < Date.now()) {
          localStorage.removeItem(POS_ACTIVE_HOLDS_KEY);
          return {};
        }
        return parsed.holds || parsed;
      }
      return {};
    } catch {
      return {};
    }
  }

  private publishOnlineHolds(cartItems: CartItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      if (!cartItems || cartItems.length === 0) {
        localStorage.removeItem(ONLINE_ACTIVE_HOLDS_KEY);
      } else {
        const holds: Record<number, number> = {};
        for (const item of cartItems) {
          holds[item.part.id] = (holds[item.part.id] ?? 0) + item.quantity;
        }
        localStorage.setItem(
          ONLINE_ACTIVE_HOLDS_KEY,
          JSON.stringify({
            sessionId: this.reservationSessionId,
            expiresAt: Date.now() + 600_000,
            holds,
          })
        );
      }
      window.dispatchEvent(new CustomEvent('asuncion-online-holds-updated'));
    } catch {
      // ignore storage errors
    }
  }

  dismissStockAlert(): void {
    this.activeStockAlert.set(null);
  }

  refreshPosHoldsAndReconcile(showToast = true): void {
    const latestPos = this.loadPosActiveHolds();
    this.posActiveHolds.set(latestPos);

    const current = this.items();
    if (current.length === 0) return;

    let adjusted = false;
    const nextList: CartItem[] = [];
    const adjustments: StockAdjustmentItem[] = [];

    for (const item of current) {
      const posQty = latestPos[item.part.id] ?? 0;
      const serverOthers = this.reservedByOthersMap()[item.part.id] ?? 0;
      const reservedByOthers = Math.max(posQty, serverOthers);
      const maxAvail = Math.max(0, item.part.stockQuantity - reservedByOthers);
      if (item.quantity > maxAvail) {
        adjusted = true;
        const diff = item.quantity - maxAvail;
        adjustments.push({
          partId: item.part.id,
          partName: item.part.name,
          partSku: item.part.sku,
          previousQuantity: item.quantity,
          newQuantity: maxAvail,
          isFullyDepleted: maxAvail === 0,
          reason: maxAvail === 0
            ? 'Las unidades fueron adquiridas en caja de nuestra tienda física.'
            : `Se redujo en ${diff} und. por atención presencial en mostrador. Tienes ${maxAvail} und. reservadas.`,
        });
        if (showToast) {
          this.toast.warning(
            'Stock reservado en mostrador',
            maxAvail > 0
              ? `Solo quedan ${maxAvail} und. disponibles de ${item.part.name} (el resto está reservado en Caja).`
              : `Las unidades de ${item.part.name} acaban de ser adquiridas en mostrador de tienda física.`
          );
        }
        if (maxAvail > 0) {
          nextList.push({ ...item, quantity: maxAvail });
        }
      } else {
        nextList.push(item);
      }
    }

    if (adjusted) {
      this.items.set(nextList);
      this.persist();
      if (adjustments.length > 0) {
        this.activeStockAlert.set({
          title: 'Stock adquirido en Tienda Física',
          subtitle: 'Un cliente en mostrador completó una compra presencial con prioridad de despacho.',
          items: adjustments,
          timestamp: Date.now(),
        });
      }
      this.syncReservationWithServer(false);
    }
  }

  private initOrLoadSessionId(): string {
    if (typeof window === 'undefined') return 'ssr-session';
    let existing = localStorage.getItem(RESERVATION_SESSION_KEY);
    if (!existing) {
      existing = 'rsv-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(RESERVATION_SESSION_KEY, existing);
    }
    return existing;
  }

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
    const cartSkus = new Set(
      this.items().map((i) => (i.part.sku || '').trim().toUpperCase())
    );
    const itemSku = (item.part.sku || '').trim().toUpperCase();
    let basePrice = item.part.salePrice;

    const promo = this.promotionService.getPromotion(itemSku);
    if (promo && promo.active) {
      if (promo.promoType === 'COMBO_SUGERIDO' && promo.comboComplementSku) {
        if (cartSkus.has(promo.comboComplementSku.trim().toUpperCase())) {
          basePrice = Math.min(basePrice, promo.promoPrice);
        }
      } else {
        basePrice = Math.min(basePrice, promo.promoPrice);
      }
    }

    const pairedCombo = this.promotionService.findComboWhereComplementIs(itemSku, cartSkus);
    if (pairedCombo) {
      const compPrice = this.promotionService.getComplementComboPrice(
        pairedCombo,
        item.part.salePrice
      );
      basePrice = Math.min(basePrice, compPrice);
    }

    // Custom Combo Armado por el Cliente (10% de ahorro en el conjunto)
    if (this.isCustomComboActiveOnItem(item)) {
      const customComboDiscounted = Number((item.part.salePrice * 0.90).toFixed(2));
      basePrice = Math.min(basePrice, customComboDiscounted);
    }

    if (
      item.part.wholesalePrice &&
      item.part.wholesalePrice > 0 &&
      item.quantity >= 4
    ) {
      return Math.min(item.part.wholesalePrice, basePrice);
    }
    return basePrice;
  }

  isComboPriceActiveOnItem(item: CartItem): boolean {
    const cartSkus = new Set(
      this.items().map((i) => (i.part.sku || '').trim().toUpperCase())
    );
    const itemSku = (item.part.sku || '').trim().toUpperCase();
    const mainCombo = this.promotionService.getPromotion(itemSku);
    if (
      mainCombo &&
      mainCombo.promoType === 'COMBO_SUGERIDO' &&
      mainCombo.comboComplementSku &&
      cartSkus.has(mainCombo.comboComplementSku.trim().toUpperCase())
    ) {
      return true;
    }
    return Boolean(this.promotionService.findComboWhereComplementIs(itemSku, cartSkus));
  }

  isCustomComboActiveOnItem(item: CartItem): boolean {
    const currentPartIds = new Set(this.items().map((i) => i.part.id));
    return this.customCombos().some(
      (c) =>
        (c.mainPartId === item.part.id || c.complementPartId === item.part.id) &&
        currentPartIds.has(c.mainPartId) &&
        currentPartIds.has(c.complementPartId)
    );
  }

  addCustomCombo(mainPart: Part, complementPart: Part, openDrawerAfter = true): void {
    this.refreshPosHoldsAndReconcile(false);
    const remMain = this.getRemainingStockToAdd(mainPart);
    const remComp = this.getRemainingStockToAdd(complementPart);

    if (remMain <= 0 && this.getMyCartQuantity(mainPart.id) === 0) {
      this.toast.warning(
        'Stock insuficiente en el repuesto principal',
        `No hay unidades libres de ${mainPart.name} en este momento.`
      );
      return;
    }
    if (remComp <= 0 && this.getMyCartQuantity(complementPart.id) === 0) {
      this.toast.warning(
        'Stock insuficiente en el complemento',
        `No hay unidades libres de ${complementPart.name} en este momento.`
      );
      return;
    }

    this.items.update((current) => {
      let next = [...current];
      const upsertOne = (target: Part) => {
        const maxAvail = this.getAvailableStockForPart(target);
        if (maxAvail <= 0) return;
        const idx = next.findIndex((i) => i.part.id === target.id);
        if (idx >= 0) {
          next[idx] = {
            part: target,
            quantity: Math.min(next[idx].quantity + 1, maxAvail),
          };
        } else {
          next.push({ part: target, quantity: 1 });
        }
      };
      upsertOne(mainPart);
      upsertOne(complementPart);
      return next;
    });

    this.customCombos.update((list) => {
      const exists = list.some(
        (c) =>
          (c.mainPartId === mainPart.id && c.complementPartId === complementPart.id) ||
          (c.mainPartId === complementPart.id && c.complementPartId === mainPart.id)
      );
      if (!exists) {
        return [...list, { mainPartId: mainPart.id, complementPartId: complementPart.id, discountPercent: 10 }];
      }
      return list;
    });

    this.persist();
    this.persistCustomCombos();
    this.toast.success(
      '¡Combo Personalizado activado en tu carrito!',
      `Se combinaron ${mainPart.name} + ${complementPart.name} con 10% de ahorro conjunto.`
    );
    this.syncReservationWithServer(true);
    if (openDrawerAfter) {
      this.isDrawerOpen.set(true);
    }
  }

  getMyCartQuantity(partId: number): number {
    return this.items().find((i) => i.part.id === partId)?.quantity ?? 0;
  }

  getReservedByOthersForPart(part: Part): number {
    const posHold = this.posActiveHolds()[part.id] ?? 0;
    const myQty = this.getMyCartQuantity(part.id);
    if (this.reservedByOthersMap()[part.id] !== undefined) {
      return Math.max(posHold, this.reservedByOthersMap()[part.id]);
    }
    const serverOthers = Math.max(0, (part.reservedQuantity ?? 0) - myQty);
    return Math.max(posHold, serverOthers);
  }

  getAvailableStockForPart(part: Part): number {
    const reservedByOthers = this.getReservedByOthersForPart(part);
    return Math.max(0, part.stockQuantity - reservedByOthers);
  }

  getRemainingStockToAdd(part: Part): number {
    const availForCart = this.getAvailableStockForPart(part);
    const myQty = this.getMyCartQuantity(part.id);
    return Math.max(0, availForCart - myQty);
  }

  getTotalReservedDisplay(part: Part): number {
    const others = this.getReservedByOthersForPart(part);
    const myQty = this.getMyCartQuantity(part.id);
    return others + myQty;
  }

  openDrawer(): void {
    this.isDrawerOpen.set(true);
    this.refreshPosHoldsAndReconcile(false);
    if (this.items().length > 0) {
      this.syncReservationWithServer(false);
    }
  }

  closeDrawer(): void {
    this.isDrawerOpen.set(false);
  }

  toggleDrawer(): void {
    this.isDrawerOpen.update((v) => !v);
  }

  addPart(part: Part, quantity = 1, openDrawerAfter = false): void {
    this.refreshPosHoldsAndReconcile(false);
    const maxAvail = this.getAvailableStockForPart(part);
    const remainingToAdd = this.getRemainingStockToAdd(part);

    if (part.stockQuantity <= 0 || maxAvail <= 0 || remainingToAdd <= 0) {
      if (part.stockQuantity > 0 && maxAvail <= 0) {
        const posHold = this.posActiveHolds()[part.id] ?? 0;
        this.toast.warning(
          'Stock en estado RESERVADO',
          posHold > 0
            ? `Las unidades de ${part.name} están siendo atendidas en Caja / Punto de Venta en este momento.`
            : `Las ${part.stockQuantity} und. de ${part.name} están reservadas temporalmente por otro cliente en proceso de compra.`
        );
      } else if (remainingToAdd <= 0 && maxAvail > 0) {
        this.toast.warning(
          'Máximo stock disponible en tu carrito',
          `Ya tienes las ${maxAvail} und. disponibles de ${part.name} en tu carrito.`
        );
      } else {
        this.toast.warning('Sin stock disponible', `El repuesto ${part.sku} se encuentra agotado.`);
      }
      return;
    }

    let cappedByReservation = false;
    this.items.update((current) => {
      const idx = current.findIndex((i) => i.part.id === part.id);
      if (idx >= 0) {
        const desired = current[idx].quantity + quantity;
        if (desired > maxAvail) {
          cappedByReservation = true;
        }
        const nextQty = Math.min(desired, maxAvail);
        const clone = [...current];
        clone[idx] = { part, quantity: nextQty };
        return clone;
      }
      if (quantity > maxAvail) {
        cappedByReservation = true;
      }
      return [...current, { part, quantity: Math.min(quantity, maxAvail) }];
    });

    this.persist();
    if (cappedByReservation) {
      this.toast.warning(
        'Cantidad ajustada por reserva activa',
        `Solo hay ${maxAvail} und. disponibles de ${part.name} (el resto está en estado RESERVADO).`
      );
    } else {
      this.toast.success(
        'Agregado y reservado en tu carrito',
        `${part.name} (${part.oemCode || part.sku}) — Stock en estado RESERVADO temporalmente.`
      );
    }

    this.syncReservationWithServer(true);
    if (openDrawerAfter) {
      this.isDrawerOpen.set(true);
    }
  }

  addCombo(mainPart: Part, complementPart: Part, openDrawerAfter = true): void {
    this.refreshPosHoldsAndReconcile(false);
    const remMain = this.getRemainingStockToAdd(mainPart);
    const remComp = this.getRemainingStockToAdd(complementPart);

    if (remMain <= 0 && this.getMyCartQuantity(mainPart.id) === 0) {
      this.toast.warning(
        'Stock insuficiente en el repuesto principal',
        `No hay unidades libres de ${mainPart.name} en este momento.`
      );
      return;
    }
    if (remComp <= 0 && this.getMyCartQuantity(complementPart.id) === 0) {
      this.toast.warning(
        'Stock insuficiente en el complemento',
        `No hay unidades libres de ${complementPart.name} en este momento.`
      );
      return;
    }

    this.items.update((current) => {
      let next = [...current];
      const upsertOne = (target: Part) => {
        const maxAvail = this.getAvailableStockForPart(target);
        if (maxAvail <= 0) return;
        const idx = next.findIndex((i) => i.part.id === target.id);
        if (idx >= 0) {
          next[idx] = {
            part: target,
            quantity: Math.min(next[idx].quantity + 1, maxAvail),
          };
        } else {
          next.push({ part: target, quantity: 1 });
        }
      };
      upsertOne(mainPart);
      upsertOne(complementPart);
      return next;
    });

    this.persist();
    this.toast.success(
      '¡Combo Automotriz activado en tu carrito!',
      `Se agregaron ${mainPart.name} + ${complementPart.name} con descuento conjunto aplicado.`
    );
    this.syncReservationWithServer(true);
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
      current.map((item) => {
        if (item.part.id !== partId) return item;
        const maxAvail = Math.max(1, this.getAvailableStockForPart(item.part));
        return { ...item, quantity: Math.min(quantity, maxAvail) };
      })
    );
    this.persist();
    this.syncReservationWithServer(true);
  }

  removePart(partId: number): void {
    this.items.update((current) => current.filter((i) => i.part.id !== partId));
    this.customCombos.update((list) =>
      list.filter((c) => c.mainPartId !== partId && c.complementPartId !== partId)
    );
    this.persistCustomCombos();
    this.reservedByOthersMap.update((map) => {
      const next = { ...map };
      delete next[partId];
      return next;
    });
    this.persist();
    if (this.items().length === 0) {
      this.clear();
    } else {
      this.syncReservationWithServer(false);
    }
  }

  clear(): void {
    const currentSessionId = this.reservationSessionId;
    this.items.set([]);
    this.customCombos.set([]);
    this.persistCustomCombos();
    this.setReservationExpiresAt(null);
    this.reservationRemainingSeconds.set(0);
    this.reservedByOthersMap.set({});
    this.persist();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(ONLINE_ACTIVE_HOLDS_KEY);
        localStorage.removeItem('asuncion_cart_expires_at');
      } catch {
        // ignore
      }
      if (currentSessionId) {
        this.http
          .post(`${this.apiConfig.apiUrl}/catalog/reservations/release`, { sessionId: currentSessionId })
          .pipe(catchError(() => of(null)))
          .subscribe();
      }
      this.syncBus.notifyReservationsUpdated([]);
    }
  }

  syncReservationWithServer(showAdjustToast = true): void {
    this.syncReservationObservable(showAdjustToast).subscribe();
  }

  syncReservationObservable(showAdjustToast = true): Observable<ReservationSyncResponse | null> {
    if (typeof window === 'undefined') return of(null);
    const currentItems = this.items();
    if (currentItems.length === 0) {
      this.clear();
      return of(null);
    }

    // Optimistic local 10-minute timer while server responds
    if (!this.reservationExpiresAt() || this.reservationRemainingSeconds() <= 0) {
      const initExp = Date.now() + 600 * 1000;
      this.setReservationExpiresAt(initExp);
      this.reservationRemainingSeconds.set(600);
    }

    this.isSyncingReservation.set(true);
    const payload = {
      sessionId: this.reservationSessionId,
      items: currentItems.map((i) => ({
        partId: i.part.id,
        quantity: i.quantity,
      })),
    };

    return this.http
      .post<ReservationSyncResponse>(`${this.apiConfig.apiUrl}/catalog/reservations/sync`, payload)
      .pipe(
        tap((res) => {
          this.isSyncingReservation.set(false);
          if (!res) return;

          const currentExp = this.reservationExpiresAt();
          let expMs: number;
          if (res.expiresAt) {
            const serverExp = new Date(res.expiresAt).getTime();
            if (currentExp && currentExp > Date.now() && Math.abs(currentExp - serverExp) < 90000) {
              expMs = currentExp;
            } else {
              expMs = serverExp;
            }
          } else {
            expMs = currentExp && currentExp > Date.now() ? currentExp : Date.now() + 600 * 1000;
          }
          this.setReservationExpiresAt(expMs);
          this.reservationRemainingSeconds.set(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));

          const currentMap = new Map(this.items().map((i) => [i.part.id, i.quantity]));
          const currentPartMap = new Map(this.items().map((i) => [i.part.id, i.part]));
          const othersMap: Record<number, number> = {};
          let anyAdjusted = false;
          const adjustments: StockAdjustmentItem[] = [];

          for (const st of res.items || []) {
            othersMap[st.partId] = st.reservedByOthers;
            const prevQty = currentMap.get(st.partId) ?? 0;
            const partInfo = currentPartMap.get(st.partId);
            const partName = st.name || partInfo?.name || 'Repuesto';
            const partSku = st.sku || partInfo?.sku || '';

            if (st.reservedQuantity < prevQty) {
              const diff = prevQty - st.reservedQuantity;
              adjustments.push({
                partId: st.partId,
                partName,
                partSku,
                previousQuantity: prevQty,
                newQuantity: st.reservedQuantity,
                isFullyDepleted: st.reservedQuantity === 0,
                reason: st.reservedQuantity === 0
                  ? 'Se agotaron las unidades disponibles por una compra en mostrador de tienda física / ajuste de almacén.'
                  : `Se redujo en ${diff} und. debido a una venta presencial prioritaria en mostrador de tienda física. Las ${st.reservedQuantity} und. restantes quedan aseguradas para ti.`,
              });
            }

            if (st.status === 'AJUSTADO_POR_RESERVA' || st.status === 'AGOTADO_EN_RESERVA' || st.status === 'AGOTADO') {
              anyAdjusted = true;
              if (showAdjustToast) {
                this.toast.warning('Ajuste de inventario', st.message);
              }
            }
          }
          this.reservedByOthersMap.set(othersMap);
          this.syncBus.notifyReservationsUpdated(res.items ? res.items.map((it) => it.partId) : []);
          this.syncBus.notifyCatalogRefresh();

          if (adjustments.length > 0) {
            this.activeStockAlert.set({
              title: 'Actualización de Inventario en tu Carrito',
              subtitle: 'Detectamos un cambio en el stock físico de almacén mientras preparabas tu pedido.',
              items: adjustments,
              timestamp: Date.now(),
            });
          }

          if (anyAdjusted) {
            const statusByPart = new Map(res.items.map((it) => [it.partId, it]));
            this.items.update((list) =>
              list
                .map((cartItem) => {
                  const st = statusByPart.get(cartItem.part.id);
                  if (!st) return cartItem;
                  return {
                    ...cartItem,
                    part: {
                      ...cartItem.part,
                      stockQuantity: st.physicalStock,
                      reservedQuantity: st.reservedByOthers + st.reservedQuantity,
                      availableStock: st.availableForYou,
                    },
                    quantity: st.reservedQuantity,
                  };
                })
                .filter((cartItem) => cartItem.quantity > 0)
            );
            this.persist();
          }
        }),
        catchError(() => {
          this.isSyncingReservation.set(false);
          return of(null);
        })
      );
  }

  private getStorageKey(): string {
    const user = this.authService.currentUser();
    if (user && user.id) {
      return `asuncion_cart_user_${user.id}_v2`;
    }
    return GUEST_CART_KEY;
  }

  private persist(): void {
    if (typeof window !== 'undefined') {
      const key = this.getStorageKey();
      const serialized = JSON.stringify(this.items());
      localStorage.setItem(key, serialized);
      this.publishOnlineHolds(this.items());
    }
  }

  private loadCustomCombos(): CustomComboPair[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(CUSTOM_COMBOS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistCustomCombos(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(CUSTOM_COMBOS_KEY, JSON.stringify(this.customCombos()));
    }
  }

  private loadCartFromKey(key: string): CartItem[] {
    if (typeof window === 'undefined') return [];
    let raw = localStorage.getItem(key);
    if (!raw) {
      const legacy = localStorage.getItem('asuncion_cart_v1');
      if (legacy) {
        localStorage.removeItem('asuncion_cart_v1');
        localStorage.setItem(key, legacy);
        raw = legacy;
      }
    }
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as CartItem[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
}

function mapToNull() {
  return (source: Observable<unknown>): Observable<null> =>
    new Observable((subscriber) => {
      return source.subscribe({
        next: () => subscriber.next(null),
        error: (err) => subscriber.error(err),
        complete: () => subscriber.complete(),
      });
    });
}
