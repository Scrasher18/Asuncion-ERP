import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';
import { AuthService } from './auth.service';
import { OrdersService } from './orders.service';
import { ComplaintsService } from './complaints.service';
import { CatalogService } from './catalog.service';
import { Order, Part } from '../models/api.models';

export type NotificationCategory =
  | 'ORDER_STATUS'
  | 'NEW_SALE'
  | 'PAYMENT'
  | 'DELIVERY'
  | 'STOCK_ALERT'
  | 'COMPLAINT'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: string; // ISO date
  relativeTime: string;
  read: boolean;
  orderNumber?: string;
  orderId?: number;
  statusBadge?: string;
  linkUrl?: string;
  iconType: 'truck' | 'shopping-bag' | 'check-circle' | 'cash' | 'alert' | 'user' | 'bell';
  accentColor: 'orange' | 'emerald' | 'blue' | 'purple' | 'rose' | 'amber';
}

@Injectable({ providedIn: 'root' })
export class NotificationCenterService {
  private readonly auth = inject(AuthService);
  private readonly ordersService = inject(OrdersService);
  private readonly complaintsService = inject(ComplaintsService);
  private readonly catalogService = inject(CatalogService);
  private readonly router = inject(Router);

  readonly notifications = signal<AppNotification[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly lastUpdated = signal<Date | null>(null);

  readonly unreadCount = computed(() => {
    return this.notifications().filter((n) => !n.read).length;
  });

  readonly unreadStockAlertsCount = computed(() => {
    return this.notifications().filter((n) => n.category === 'STOCK_ALERT' && !n.read).length;
  });

  readonly totalStockAlertsCount = computed(() => {
    return this.notifications().filter((n) => n.category === 'STOCK_ALERT').length;
  });

  private pollTimer: any = null;

  /** Ventana máxima de retención para notificaciones operativas (14 días) */
  private static readonly MAX_ACTIVE_DAYS = 14;
  /** Ventana máxima para pedidos ya entregados o cancelados (7 días) */
  private static readonly COMPLETED_ORDER_TTL_DAYS = 7;
  /** Ventana máxima para notificaciones ya leídas de pedidos finalizados (24 horas) */
  private static readonly READ_COMPLETED_TTL_HOURS = 24;
  /** Limpieza automática de metadatos en localStorage (30 días) */
  private static readonly STORAGE_PURGE_DAYS = 30;

  constructor() {
    this.initService();
  }

  initService(): void {
    // Initial fetch
    this.refresh();

    // Auto-refresh every 25 seconds if in browser
    if (typeof window !== 'undefined') {
      this.pollTimer = setInterval(() => {
        if (this.auth.isAuthenticated()) {
          this.refresh(true);
        }
      }, 25000);
    }
  }

  refresh(isSilent = false): void {
    if (!isSilent) {
      this.isLoading.set(true);
    }

    const user = this.auth.currentUser();
    const isAdminOrStaff = this.auth.hasAnyRole(['ADMIN', 'VENDEDOR']);

    if (isAdminOrStaff) {
      this.fetchAdminNotifications();
    } else if (user) {
      this.fetchClientNotifications();
    } else {
      this.fetchGuestNotifications();
    }
  }

  private getReadMap(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      const stored = localStorage.getItem(`asuncion_read_notifs_v2_${email}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const cutoff = Date.now() - NotificationCenterService.STORAGE_PURGE_DAYS * 86400_000;
        const cleaned: Record<string, number> = {};
        for (const [k, ts] of Object.entries(parsed)) {
          if (typeof ts === 'number' && ts >= cutoff) {
            cleaned[k] = ts;
          }
        }
        return cleaned;
      }
      // Migrate legacy array format if present
      const legacy = localStorage.getItem(`asuncion_read_notifs_${email}`);
      if (legacy) {
        const arr = JSON.parse(legacy);
        if (Array.isArray(arr)) {
          const now = Date.now();
          const migrated: Record<string, number> = {};
          arr.forEach((id: string) => (migrated[id] = now));
          localStorage.removeItem(`asuncion_read_notifs_${email}`);
          this.saveReadMap(migrated);
          return migrated;
        }
      }
    } catch (e) {}
    return {};
  }

  private saveReadMap(map: Record<string, number>): void {
    if (typeof window === 'undefined') return;
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      localStorage.setItem(`asuncion_read_notifs_v2_${email}`, JSON.stringify(map));
    } catch (e) {}
  }

  private getDismissedMap(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      const stored = localStorage.getItem(`asuncion_dismissed_notifs_${email}`);
      if (stored) {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const cutoff = Date.now() - NotificationCenterService.STORAGE_PURGE_DAYS * 86400_000;
        const cleaned: Record<string, number> = {};
        for (const [k, ts] of Object.entries(parsed)) {
          if (typeof ts === 'number' && ts >= cutoff) {
            cleaned[k] = ts;
          }
        }
        return cleaned;
      }
    } catch (e) {}
    return {};
  }

  private saveDismissedMap(map: Record<string, number>): void {
    if (typeof window === 'undefined') return;
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      localStorage.setItem(`asuncion_dismissed_notifs_${email}`, JSON.stringify(map));
    } catch (e) {}
  }

  /**
   * Determina si una notificación ha expirado por antigüedad para evitar que se acumulen
   * notificaciones de hace meses o un año.
   */
  private isNotificationExpired(
    dateStr: string | undefined,
    isCompletedOrder: boolean,
    readTimestamp?: number
  ): boolean {
    if (!dateStr) return false;
    const eventTime = new Date(dateStr).getTime();
    if (Number.isNaN(eventTime)) return false;

    const now = Date.now();
    const ageMs = now - eventTime;

    // 1. Ninguna notificación de pedido/venta mayor a 14 días permanece en la campana
    if (ageMs > NotificationCenterService.MAX_ACTIVE_DAYS * 86400_000) {
      return true;
    }

    // 2. Si el pedido ya está ENTREGADO o CANCELADO:
    if (isCompletedOrder) {
      // Expira a los 7 días de haberse entregado/cancelado
      if (ageMs > NotificationCenterService.COMPLETED_ORDER_TTL_DAYS * 86400_000) {
        return true;
      }
      // Si además el usuario ya leyó la notificación hace más de 24 horas, se auto-archiva
      if (
        readTimestamp &&
        now - readTimestamp > NotificationCenterService.READ_COMPLETED_TTL_HOURS * 3600_000
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Las compras presenciales en caja (Mostrador) no generan notificaciones en la campana;
   * las notificaciones son exclusivamente para pedidos online.
   */
  private isCounterSaleOrder(ord: Order): boolean {
    const pm = (ord.paymentMethod || '').toUpperCase();
    const notes = (ord.notes || '').toUpperCase();
    const addr = (ord.deliveryAddress || '').toUpperCase();
    const client = (ord.customerName || ord.recipientName || '').toUpperCase();
    const delType = (ord.deliveryType || '').toUpperCase();
    return (
      delType === 'MOSTRADOR' ||
      pm.startsWith('MOSTRADOR') ||
      notes.includes('MOSTRADOR') ||
      notes.includes('PRESENCIAL') ||
      addr.includes('MOSTRADOR') ||
      addr.includes('VENTA PRESENCIAL') ||
      client === 'CLIENTE DE MOSTRADOR'
    );
  }

  private fetchAdminNotifications(): void {
    const readMap = this.getReadMap();
    const dismissedMap = this.getDismissedMap();

    forkJoin({
      orders: this.ordersService.getAllOrders().pipe(catchError(() => of([] as Order[]))),
      lowStockParts: this.catalogService.getAdminParts(true).pipe(catchError(() => of([] as Part[]))),
    }).subscribe({
      next: ({ orders, lowStockParts }) => {
        const notifs: AppNotification[] = [];

        // 1. Process Low Stock Alerts FIRST (High priority red emergency notifications)
        for (const part of lowStockParts) {
          const isAgotado = (part.stockQuantity ?? 0) <= 0;
          const stockId = `stock-alert-${part.id}-${part.stockQuantity}`;
          if (dismissedMap[stockId]) continue;
          notifs.push({
            id: stockId,
            category: 'STOCK_ALERT',
            title: isAgotado ? `🚨 Stock Agotado: ${part.name}` : `⚠️ Stock Crítico: ${part.name}`,
            message: `${part.sku}${part.oemCode ? ' (OEM: ' + part.oemCode + ')' : ''}: cuenta con ${part.stockQuantity} un. en almacén (mínimo de seguridad: ${part.minStockLevel || 5} un.). Requiere reposición inmediata.`,
            timestamp: new Date().toISOString(),
            relativeTime: isAgotado ? 'Inmediato' : 'Atención hoy',
            read: Boolean(readMap[stockId]),
            statusBadge: isAgotado ? 'AGOTADO (0 UND)' : `QUEDAN ${part.stockQuantity} UND`,
            linkUrl: '/admin?tab=parts&lowStock=true',
            iconType: 'alert',
            accentColor: 'rose',
          });
        }

        // 2. Process ONLINE orders for sales, payments, dispatch and driver delivery (filtered by TTL)
        const onlineOrders = orders.filter((o) => !this.isCounterSaleOrder(o));
        const sortedOrders = [...onlineOrders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        for (const ord of sortedOrders.slice(0, 15)) {
          const isCompleted = ord.status === 'ENTREGADO' || ord.status === 'CANCELADO';
          const totalVal = (ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0).toFixed(2);
          const clientName = ord.customerName || ord.recipientName || 'Cliente';
          const isFactura = ord.invoiceType === 'FACTURA';

          // A. Venta Registrada
          const saleId = `sale-${ord.id}-${ord.orderNumber}`;
          if (
            !dismissedMap[saleId] &&
            !this.isNotificationExpired(ord.createdAt, isCompleted, readMap[saleId])
          ) {
            notifs.push({
              id: saleId,
              category: 'NEW_SALE',
              title: `Venta: Pedido #${ord.orderNumber}`,
              message: `${clientName} generó una ${isFactura ? 'Factura' : 'Boleta'} por S/ ${totalVal} (${(ord.paymentMethod || 'CONTADO').replace(/_/g, ' ')}).`,
              timestamp: ord.createdAt,
              relativeTime: this.formatRelativeTime(ord.createdAt),
              read: Boolean(readMap[saleId]),
              orderNumber: ord.orderNumber,
              orderId: ord.id,
              statusBadge: ord.status,
              linkUrl: '/admin',
              iconType: 'shopping-bag',
              accentColor: 'orange',
            });
          }

          // B. Pago en línea o confirmado
          if (ord.paymentMethod === 'TARJETA_CREDITO' || ord.paymentMethod === 'TARJETA_DEBITO' || ord.paymentMethod === 'CULQI') {
            const payId = `pay-${ord.id}-${ord.orderNumber}`;
            const payTs = ord.updatedAt || ord.createdAt;
            if (
              !dismissedMap[payId] &&
              !this.isNotificationExpired(payTs, isCompleted, readMap[payId])
            ) {
              notifs.push({
                id: payId,
                category: 'PAYMENT',
                title: `Pago Tarjeta Aprobado: #${ord.orderNumber}`,
                message: `Cobro en línea de S/ ${totalVal} procesado y liquidado vía Culqi Checkout v4.`,
                timestamp: payTs,
                relativeTime: this.formatRelativeTime(payTs),
                read: Boolean(readMap[payId]),
                orderNumber: ord.orderNumber,
                orderId: ord.id,
                statusBadge: 'APROBADO',
                linkUrl: '/admin',
                iconType: 'cash',
                accentColor: 'emerald',
              });
            }
          }

          // C. Repartidor asignado o en camino
          if (ord.assignedDriverName) {
            const driverId = `driver-${ord.id}-${ord.status}`;
            const drvTs = ord.updatedAt || ord.createdAt;
            if (
              !dismissedMap[driverId] &&
              !this.isNotificationExpired(drvTs, isCompleted, readMap[driverId])
            ) {
              const isEnRuta = ord.status === 'EN_RUTA';
              const isEntregado = ord.status === 'ENTREGADO';

              notifs.push({
                id: driverId,
                category: 'DELIVERY',
                title: isEntregado
                  ? `Entrega Concluida: #${ord.orderNumber}`
                  : isEnRuta
                    ? `Motorizado en Ruta: #${ord.orderNumber}`
                    : `Repartidor Asignado: #${ord.orderNumber}`,
                message: isEntregado
                  ? `El repartidor ${ord.assignedDriverName} entregó el pedido exitosamente a ${clientName}.`
                  : isEnRuta
                    ? `${ord.assignedDriverName} va en camino a ${ord.deliveryAddress || 'dirección de entrega'}.`
                    : `Se asignó a ${ord.assignedDriverName} para preparar el reparto.`,
                timestamp: drvTs,
                relativeTime: this.formatRelativeTime(drvTs),
                read: Boolean(readMap[driverId]),
                orderNumber: ord.orderNumber,
                orderId: ord.id,
                statusBadge: ord.status,
                linkUrl: isEnRuta || isEntregado ? `/track?order=${ord.orderNumber}` : '/admin',
                iconType: isEntregado ? 'check-circle' : 'truck',
                accentColor: isEntregado ? 'emerald' : isEnRuta ? 'purple' : 'blue',
              });
            }
          }
        }

        // 3. Process complaints from Complaints Book (only PENDIENTE complaints stay active in bell)
        try {
          const complaints = this.complaintsService.complaints();
          for (const c of complaints.filter((item) => item.status === 'PENDIENTE').slice(0, 5)) {
            const compId = `complaint-${c.sheetNumber}`;
            if (dismissedMap[compId]) continue;
            notifs.push({
              id: compId,
              category: 'COMPLAINT',
              title: `Reclamación Pendiente: ${c.sheetNumber}`,
              message: `Reclamo de ${c.fullName} sobre ${c.goodDescription} (${c.status}).`,
              timestamp: new Date().toISOString(),
              relativeTime: c.createdAt || 'Pendiente',
              read: Boolean(readMap[compId]),
              linkUrl: '/admin?tab=claims',
              iconType: 'alert',
              accentColor: 'rose',
            });
          }
        } catch (e) {}

        // Sort with unread stock alerts prioritised at top, followed by chronological
        notifs.sort((a, b) => {
          if (a.category === 'STOCK_ALERT' && !a.read && (b.category !== 'STOCK_ALERT' || b.read)) return -1;
          if (b.category === 'STOCK_ALERT' && !b.read && (a.category !== 'STOCK_ALERT' || a.read)) return 1;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        this.notifications.set(notifs);
        this.isLoading.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private fetchClientNotifications(): void {
    const readMap = this.getReadMap();
    const dismissedMap = this.getDismissedMap();

    this.ordersService.getMyOrders().subscribe({
      next: (orders) => {
        const notifs: AppNotification[] = [];

        const onlineOrders = orders.filter((o) => !this.isCounterSaleOrder(o));
        const sortedOrders = [...onlineOrders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        for (const ord of sortedOrders) {
          const totalVal = (ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0).toFixed(2);
          const status = ord.status;
          const isCompleted = status === 'ENTREGADO' || status === 'CANCELADO';
          const eventTs = ord.updatedAt || ord.createdAt;

          // Notification for current status
          const notifId = `client-order-${ord.id}-${status}`;
          if (dismissedMap[notifId]) continue;
          if (this.isNotificationExpired(eventTs, isCompleted, readMap[notifId])) continue;

          let title = `Pedido #${ord.orderNumber}`;
          let message = `Estado actual: ${status}`;
          let iconType: AppNotification['iconType'] = 'shopping-bag';
          let accentColor: AppNotification['accentColor'] = 'orange';

          switch (status) {
            case 'RESERVADO':
              title = `Stock Reservado #${ord.orderNumber}`;
              message = `Tus repuestos están reservados por S/ ${totalVal} en espera de confirmación de pago.`;
              iconType = 'shopping-bag';
              accentColor = 'amber';
              break;
            case 'CONFIRMADO':
              title = `¡Pedido Confirmado! #${ord.orderNumber}`;
              message = `Tu compra por S/ ${totalVal} ha sido confirmada. En breve pasará al área de preparación.`;
              iconType = 'shopping-bag';
              accentColor = 'orange';
              break;
            case 'EN_PREPARACION':
              title = `En Preparación #${ord.orderNumber}`;
              message = `Estamos alistando tus repuestos en nuestro almacén central Santa Anita.`;
              iconType = 'shopping-bag';
              accentColor = 'amber';
              break;
            case 'LISTO_PARA_DESPACHO':
              title = `Listo para Entrega #${ord.orderNumber}`;
              message =
                ord.deliveryType === 'DELIVERY'
                  ? `Tus repuestos están empacados y listos para ser recogidos por el repartidor.`
                  : `Tus repuestos están listos para ser retirados en almacén Santa Anita.`;
              iconType = 'truck';
              accentColor = 'blue';
              break;
            case 'EN_RUTA':
              title = `¡Tu Pedido está en Camino! #${ord.orderNumber}`;
              message = ord.assignedDriverName
                ? `El repartidor ${ord.assignedDriverName} se encuentra en camino a tu dirección.`
                : `Tu pedido va en camino a tu dirección con navegación GPS en vivo.`;
              iconType = 'truck';
              accentColor = 'purple';
              break;
            case 'ENTREGADO':
              title = `¡Pedido Entregado! #${ord.orderNumber}`;
              message = `Tu pedido fue entregado conforme. ¡Gracias por confiar en Autopartes Asunción!`;
              iconType = 'check-circle';
              accentColor = 'emerald';
              break;
            case 'CANCELADO':
              title = `Pedido Cancelado #${ord.orderNumber}`;
              message = `Tu pedido ha sido cancelado. Puedes contactarnos si necesitas ayuda.`;
              iconType = 'alert';
              accentColor = 'rose';
              break;
          }

          notifs.push({
            id: notifId,
            category: 'ORDER_STATUS',
            title,
            message,
            timestamp: eventTs,
            relativeTime: this.formatRelativeTime(eventTs),
            read: Boolean(readMap[notifId]),
            orderNumber: ord.orderNumber,
            orderId: ord.id,
            statusBadge: status,
            linkUrl: `/track?order=${ord.orderNumber}`,
            iconType,
            accentColor,
          });
        }

        notifs.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );

        this.notifications.set(notifs);
        this.isLoading.set(false);
        this.lastUpdated.set(new Date());
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  private fetchGuestNotifications(): void {
    // If not authenticated, clear or show general welcome info
    this.notifications.set([]);
    this.isLoading.set(false);
  }

  markAsRead(id: string): void {
    const list = this.notifications().map((n) =>
      n.id === id ? { ...n, read: true } : n
    );
    this.notifications.set(list);

    const readMap = this.getReadMap();
    readMap[id] = Date.now();
    this.saveReadMap(readMap);
  }

  markAllAsRead(): void {
    const list = this.notifications().map((n) => ({ ...n, read: true }));
    this.notifications.set(list);

    const readMap = this.getReadMap();
    const now = Date.now();
    list.forEach((n) => (readMap[n.id] = now));
    this.saveReadMap(readMap);
  }

  dismissNotification(id: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    const dismissedMap = this.getDismissedMap();
    dismissedMap[id] = Date.now();
    this.saveDismissedMap(dismissedMap);
    this.notifications.set(this.notifications().filter((n) => n.id !== id));
  }

  clearAll(): void {
    const readMap = this.getReadMap();
    const dismissedMap = this.getDismissedMap();
    const now = Date.now();
    this.notifications().forEach((n) => {
      readMap[n.id] = now;
      dismissedMap[n.id] = now;
    });
    this.saveReadMap(readMap);
    this.saveDismissedMap(dismissedMap);
    this.notifications.set([]);
  }

  handleNotificationClick(item: AppNotification): void {
    this.markAsRead(item.id);
    if (item.linkUrl) {
      void this.router.navigateByUrl(item.linkUrl);
    }
  }

  private formatRelativeTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

      if (diffSec < 60) return 'Hace un momento';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `Hace ${diffMin} min`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return `Hace ${diffDays} d`;
      return date.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' });
    } catch {
      return 'Reciente';
    }
  }
}
