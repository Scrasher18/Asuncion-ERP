import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CartItem, Part, ReservationSyncResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { PromotionService } from './promotion.service';
import { SyncBusService } from './sync-bus.service';

const GUEST_CART_KEY = 'asuncion_cart_guest_v2';
const RESERVATION_SESSION_KEY = 'asuncion_reservation_session_id';
export const POS_ACTIVE_HOLDS_KEY = 'asuncion_pos_active_holds';
export const ONLINE_ACTIVE_HOLDS_KEY = 'asuncion_online_active_holds';

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

  // Stock Reservation (Estado RESERVADO) Signals
  readonly reservationSessionId: string = this.initOrLoadSessionId();
  readonly reservationExpiresAt = signal<number | null>(null);
  readonly reservationRemainingSeconds = signal<number>(0);
  readonly reservedByOthersMap = signal<Record<number, number>>({});
  readonly posActiveHolds = signal<Record<number, number>>(this.loadPosActiveHolds());
  readonly isSyncingReservation = signal<boolean>(false);

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
    // Automatically switch cart storage when user logs in, logs out, or switches account
    effect(() => {
      const user = this.authService.currentUser();
      const storageKey = user && user.id ? `asuncion_cart_user_${user.id}_v2` : GUEST_CART_KEY;
      const loaded = this.loadCartFromKey(storageKey);
      this.items.set(loaded);
      this.publishOnlineHolds(loaded);
      if (loaded.length > 0) {
        this.syncReservationWithServer(false);
      }
    }, { allowSignalWrites: true });

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
      this.syncBus.notifyReservationsUpdated(cartItems ? cartItems.map((i) => i.part.id) : []);
    } catch {
      // ignore storage errors
    }
  }

  refreshPosHoldsAndReconcile(showToast = true): void {
    const latestPos = this.loadPosActiveHolds();
    this.posActiveHolds.set(latestPos);

    const current = this.items();
    if (current.length === 0) return;

    let adjusted = false;
    const nextList: CartItem[] = [];
    for (const item of current) {
      const posQty = latestPos[item.part.id] ?? 0;
      const serverOthers = this.reservedByOthersMap()[item.part.id] ?? 0;
      const reservedByOthers = Math.max(posQty, serverOthers);
      const maxAvail = Math.max(0, item.part.stockQuantity - reservedByOthers);
      if (item.quantity > maxAvail) {
        adjusted = true;
        if (showToast) {
          this.toast.warning(
            'Stock reservado en Punto de Venta',
            maxAvail > 0
              ? `Solo quedan ${maxAvail} und. disponibles de ${item.part.name} (el resto está reservado en Caja).`
              : `Las unidades de ${item.part.name} acaban de ser reservadas en Caja / Punto de Venta.`
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
    this.items.set([]);
    this.reservationExpiresAt.set(null);
    this.reservationRemainingSeconds.set(0);
    this.reservedByOthersMap.set({});
    this.persist();
    if (typeof window !== 'undefined') {
      this.http
        .delete(`${this.apiConfig.apiUrl}/catalog/reservations/${this.reservationSessionId}`)
        .pipe(
          tap(() => {
            this.syncBus.notifyReservationsUpdated([]);
            this.syncBus.notifyCatalogRefresh();
          }),
          catchError(() => of(null))
        )
        .subscribe();
    }
  }

  syncReservationWithServer(showAdjustToast = true): void {
    this.syncReservationObservable(showAdjustToast).subscribe();
  }

  syncReservationObservable(showAdjustToast = true): Observable<ReservationSyncResponse | null> {
    if (typeof window === 'undefined') return of(null);
    const currentItems = this.items();
    if (currentItems.length === 0) {
      this.reservationExpiresAt.set(null);
      this.reservationRemainingSeconds.set(0);
      this.reservedByOthersMap.set({});
      return this.http
        .delete(`${this.apiConfig.apiUrl}/catalog/reservations/${this.reservationSessionId}`)
        .pipe(
          tap(() => {
            this.syncBus.notifyReservationsUpdated([]);
            this.syncBus.notifyCatalogRefresh();
          }),
          mapToNull(),
          catchError(() => of(null))
        );
    }

    // Optimistic local 10-minute timer while server responds
    if (!this.reservationExpiresAt() || this.reservationRemainingSeconds() <= 0) {
      this.reservationExpiresAt.set(Date.now() + 600 * 1000);
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

          const expMs = res.expiresAt ? new Date(res.expiresAt).getTime() : Date.now() + 600 * 1000;
          this.reservationExpiresAt.set(expMs);
          this.reservationRemainingSeconds.set(Math.max(0, Math.floor((expMs - Date.now()) / 1000)));

          const othersMap: Record<number, number> = {};
          let anyAdjusted = false;

          for (const st of res.items || []) {
            othersMap[st.partId] = st.reservedByOthers;
            if (st.status === 'AJUSTADO_POR_RESERVA' || st.status === 'AGOTADO_EN_RESERVA' || st.status === 'AGOTADO') {
              anyAdjusted = true;
              if (showAdjustToast) {
                this.toast.warning('Reserva concurrente detectada', st.message);
              }
            }
          }
          this.reservedByOthersMap.set(othersMap);
          this.syncBus.notifyReservationsUpdated(res.items ? res.items.map((it) => it.partId) : []);
          this.syncBus.notifyCatalogRefresh();

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
      localStorage.setItem(key, JSON.stringify(this.items()));
      this.publishOnlineHolds(this.items());
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
