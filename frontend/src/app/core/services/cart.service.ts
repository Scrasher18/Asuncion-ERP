import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CartItem, Part, ReservationSyncResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';
import { AuthService } from './auth.service';
import { PromotionService } from './promotion.service';

const GUEST_CART_KEY = 'asuncion_cart_guest_v2';
const RESERVATION_SESSION_KEY = 'asuncion_reservation_session_id';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);
  private readonly authService = inject(AuthService);
  readonly promotionService = inject(PromotionService);

  readonly items = signal<CartItem[]>([]);
  readonly isDrawerOpen = signal<boolean>(false);

  // Stock Reservation (Estado RESERVADO) Signals
  readonly reservationSessionId: string = this.initOrLoadSessionId();
  readonly reservationExpiresAt = signal<number | null>(null);
  readonly reservationRemainingSeconds = signal<number>(0);
  readonly reservedByOthersMap = signal<Record<number, number>>({});
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
      if (loaded.length > 0) {
        this.syncReservationWithServer(false);
      }
    }, { allowSignalWrites: true });

    if (typeof window !== 'undefined') {
      setInterval(() => {
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
    const promo = this.promotionService.getPromotion(item.part.sku);
    const basePrice = promo && promo.active ? promo.promoPrice : item.part.salePrice;

    if (
      item.part.wholesalePrice &&
      item.part.wholesalePrice > 0 &&
      item.quantity >= 4
    ) {
      return Math.min(item.part.wholesalePrice, basePrice);
    }
    return basePrice;
  }

  getAvailableStockForPart(part: Part): number {
    const reservedByOthers = this.reservedByOthersMap()[part.id] ?? 0;
    return Math.max(0, part.stockQuantity - reservedByOthers);
  }

  openDrawer(): void {
    this.isDrawerOpen.set(true);
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
    const maxAvail = this.getAvailableStockForPart(part);
    if (part.stockQuantity <= 0 || maxAvail <= 0) {
      if (part.stockQuantity > 0 && maxAvail <= 0) {
        this.toast.warning(
          'Stock en estado RESERVADO',
          `Las ${part.stockQuantity} und. de ${part.name} están reservadas temporalmente por otro cliente en proceso de compra.`
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
    this.persist();
    this.syncReservationWithServer(false);
  }

  clear(): void {
    this.items.set([]);
    this.reservationExpiresAt.set(null);
    this.reservationRemainingSeconds.set(0);
    this.persist();
    if (typeof window !== 'undefined') {
      this.http
        .delete(`${this.apiConfig.apiUrl}/catalog/reservations/${this.reservationSessionId}`)
        .pipe(catchError(() => of(null)))
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
      return this.http
        .delete(`${this.apiConfig.apiUrl}/catalog/reservations/${this.reservationSessionId}`)
        .pipe(
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

          const othersMap: Record<number, number> = { ...this.reservedByOthersMap() };
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
