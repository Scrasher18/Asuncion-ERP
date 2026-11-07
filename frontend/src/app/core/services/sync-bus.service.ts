import { Injectable, NgZone, inject } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export type SyncEventType =
  | 'POS_SALE_COMPLETED'
  | 'ONLINE_ORDER_COMPLETED'
  | 'RESERVATIONS_UPDATED'
  | 'ADMIN_STOCK_MUTATED'
  | 'CATALOG_REFRESH_REQUESTED';

export interface SyncEventPayload {
  type: SyncEventType;
  timestamp: number;
  origin?: string;
  orderNumber?: string;
  partIds?: number[];
}

const STORAGE_SYNC_PULSE_KEY = 'asuncion_sync_pulse';
const CHANNEL_NAME = 'asuncion_erp_realtime_sync_bus';

@Injectable({ providedIn: 'root' })
export class SyncBusService {
  private readonly ngZone = inject(NgZone);
  private readonly bus$ = new Subject<SyncEventPayload>();
  private channel: BroadcastChannel | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // 1. BroadcastChannel across tabs/windows in same browser
      if ('BroadcastChannel' in window) {
        try {
          this.channel = new BroadcastChannel(CHANNEL_NAME);
          this.channel.onmessage = (event: MessageEvent<SyncEventPayload>) => {
            if (event && event.data && event.data.type) {
              this.ngZone.run(() => {
                this.bus$.next(event.data);
              });
            }
          };
        } catch {
          this.channel = null;
        }
      }

      // 2. Storage event listener (fallback & cross-tab sync)
      window.addEventListener('storage', (evt: StorageEvent) => {
        if (evt.key === STORAGE_SYNC_PULSE_KEY && evt.newValue) {
          try {
            const parsed = JSON.parse(evt.newValue) as SyncEventPayload;
            if (parsed && parsed.type) {
              this.ngZone.run(() => {
                this.bus$.next(parsed);
              });
            }
          } catch {
            // ignore JSON parse error
          }
        }
      });

      // 3. Custom DOM event (same-window listener)
      window.addEventListener('asuncion-sync-pulse', (evt: Event) => {
        const custom = evt as CustomEvent<SyncEventPayload>;
        if (custom.detail && custom.detail.type) {
          this.ngZone.run(() => {
            this.bus$.next(custom.detail);
          });
        }
      });
    }
  }

  get events$(): Observable<SyncEventPayload> {
    return this.bus$.asObservable();
  }

  emit(type: SyncEventType, data: Partial<Omit<SyncEventPayload, 'type' | 'timestamp'>> = {}): void {
    const payload: SyncEventPayload = {
      type,
      timestamp: Date.now(),
      ...data,
    };

    // Emit internally
    this.bus$.next(payload);

    if (typeof window !== 'undefined') {
      // Post to BroadcastChannel
      if (this.channel) {
        try {
          this.channel.postMessage(payload);
        } catch {
          // ignore channel error
        }
      }

      // Trigger storage event across other windows
      try {
        localStorage.setItem(STORAGE_SYNC_PULSE_KEY, JSON.stringify(payload));
      } catch {
        // ignore quota/privacy errors
      }

      // Dispatch DOM event for same-window listeners
      try {
        window.dispatchEvent(new CustomEvent('asuncion-sync-pulse', { detail: payload }));
      } catch {
        // ignore
      }
    }
  }

  notifyPosSale(orderNumber?: string, partIds?: number[]): void {
    this.emit('POS_SALE_COMPLETED', { orderNumber, partIds, origin: 'POS' });
  }

  notifyOnlineOrder(orderNumber?: string, partIds?: number[]): void {
    this.emit('ONLINE_ORDER_COMPLETED', { orderNumber, partIds, origin: 'CHECKOUT' });
  }

  notifyReservationsUpdated(partIds?: number[]): void {
    this.emit('RESERVATIONS_UPDATED', { partIds });
  }

  notifyAdminStockMutated(partIds?: number[]): void {
    this.emit('ADMIN_STOCK_MUTATED', { partIds, origin: 'ADMIN' });
  }

  notifyCatalogRefresh(): void {
    this.emit('CATALOG_REFRESH_REQUESTED');
  }
}
