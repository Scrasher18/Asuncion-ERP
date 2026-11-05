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

  private getReadIds(): Set<string> {
    if (typeof window === 'undefined') return new Set();
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      const stored = localStorage.getItem(`asuncion_read_notifs_${email}`);
      if (stored) {
        return new Set(JSON.parse(stored));
      }
    } catch (e) {}
    return new Set();
  }

  private saveReadIds(readIds: Set<string>): void {
    if (typeof window === 'undefined') return;
    const email = this.auth.currentUser()?.email || 'guest';
    try {
      localStorage.setItem(
        `asuncion_read_notifs_${email}`,
        JSON.stringify(Array.from(readIds))
      );
    } catch (e) {}
  }

  private fetchAdminNotifications(): void {
    const readIds = this.getReadIds();

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
          notifs.push({
            id: stockId,
            category: 'STOCK_ALERT',
            title: isAgotado ? `🚨 Stock Agotado: ${part.name}` : `⚠️ Stock Crítico: ${part.name}`,
            message: `${part.sku}${part.oemCode ? ' (OEM: ' + part.oemCode + ')' : ''}: cuenta con ${part.stockQuantity} un. en almacén (mínimo de seguridad: ${part.minStockLevel || 5} un.). Requiere reposición inmediata.`,
            timestamp: new Date().toISOString(),
            relativeTime: isAgotado ? 'Inmediato' : 'Atención hoy',
            read: readIds.has(stockId),
            statusBadge: isAgotado ? 'AGOTADO (0 UND)' : `QUEDAN ${part.stockQuantity} UND`,
            linkUrl: '/admin?tab=parts&lowStock=true',
            iconType: 'alert',
            accentColor: 'rose',
          });
        }

        // 2. Process orders for sales, payments, dispatch and driver delivery
        const sortedOrders = [...orders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        for (const ord of sortedOrders.slice(0, 15)) {
          const totalVal = (ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0).toFixed(2);
          const clientName = ord.customerName || ord.recipientName || 'Cliente';
          const isFactura = ord.invoiceType === 'FACTURA';

          // A. Venta Registrada
          const saleId = `sale-${ord.id}-${ord.orderNumber}`;
          notifs.push({
            id: saleId,
            category: 'NEW_SALE',
            title: `Venta: Pedido #${ord.orderNumber}`,
            message: `${clientName} generó una ${isFactura ? 'Factura' : 'Boleta'} por S/ ${totalVal} (${(ord.paymentMethod || 'CONTADO').replace(/_/g, ' ')}).`,
            timestamp: ord.createdAt,
            relativeTime: this.formatRelativeTime(ord.createdAt),
            read: readIds.has(saleId),
            orderNumber: ord.orderNumber,
            orderId: ord.id,
            statusBadge: ord.status,
            linkUrl: '/admin',
            iconType: 'shopping-bag',
            accentColor: 'orange',
          });

          // B. Pago en línea o confirmado
          if (ord.paymentMethod === 'TARJETA_CREDITO' || ord.paymentMethod === 'TARJETA_DEBITO' || ord.paymentMethod === 'CULQI') {
            const payId = `pay-${ord.id}-${ord.orderNumber}`;
            notifs.push({
              id: payId,
              category: 'PAYMENT',
              title: `Pago Tarjeta Aprobado: #${ord.orderNumber}`,
              message: `Cobro en línea de S/ ${totalVal} procesado y liquidado vía Culqi Checkout v4.`,
              timestamp: ord.updatedAt || ord.createdAt,
              relativeTime: this.formatRelativeTime(ord.updatedAt || ord.createdAt),
              read: readIds.has(payId),
              orderNumber: ord.orderNumber,
              orderId: ord.id,
              statusBadge: 'APROBADO',
              linkUrl: '/admin',
              iconType: 'cash',
              accentColor: 'emerald',
            });
          }

          // C. Repartidor asignado o en camino
          if (ord.assignedDriverName) {
            const driverId = `driver-${ord.id}-${ord.status}`;
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
              timestamp: ord.updatedAt || ord.createdAt,
              relativeTime: this.formatRelativeTime(ord.updatedAt || ord.createdAt),
              read: readIds.has(driverId),
              orderNumber: ord.orderNumber,
              orderId: ord.id,
              statusBadge: ord.status,
              linkUrl: isEnRuta || isEntregado ? `/track?order=${ord.orderNumber}` : '/admin',
              iconType: isEntregado ? 'check-circle' : 'truck',
              accentColor: isEntregado ? 'emerald' : isEnRuta ? 'purple' : 'blue',
            });
          }
        }

        // 3. Process complaints from Complaints Book
        try {
          const complaints = this.complaintsService.complaints();
          for (const c of complaints.slice(0, 3)) {
            const compId = `complaint-${c.sheetNumber}`;
            notifs.push({
              id: compId,
              category: 'COMPLAINT',
              title: `Reclamación: ${c.sheetNumber}`,
              message: `Reclamo de ${c.fullName} sobre ${c.goodDescription} (${c.status}).`,
              timestamp: new Date().toISOString(),
              relativeTime: c.createdAt || 'Hoy',
              read: readIds.has(compId),
              linkUrl: '/complaints-book',
              iconType: 'alert',
              accentColor: c.status === 'PENDIENTE' ? 'rose' : 'emerald',
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
    const readIds = this.getReadIds();

    this.ordersService.getMyOrders().subscribe({
      next: (orders) => {
        const notifs: AppNotification[] = [];

        const sortedOrders = [...orders].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        for (const ord of sortedOrders) {
          const totalVal = (ord.totalAmount ?? ord.total ?? ord.subtotal ?? 0).toFixed(2);
          const status = ord.status;

          // Notification for current status
          const notifId = `client-order-${ord.id}-${status}`;
          let title = `Pedido #${ord.orderNumber}`;
          let message = `Estado actual: ${status}`;
          let iconType: AppNotification['iconType'] = 'shopping-bag';
          let accentColor: AppNotification['accentColor'] = 'orange';

          switch (status) {
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
            timestamp: ord.updatedAt || ord.createdAt,
            relativeTime: this.formatRelativeTime(ord.updatedAt || ord.createdAt),
            read: readIds.has(notifId),
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

    const readIds = this.getReadIds();
    readIds.add(id);
    this.saveReadIds(readIds);
  }

  markAllAsRead(): void {
    const list = this.notifications().map((n) => ({ ...n, read: true }));
    this.notifications.set(list);

    const readIds = this.getReadIds();
    list.forEach((n) => readIds.add(n.id));
    this.saveReadIds(readIds);
  }

  clearAll(): void {
    const readIds = this.getReadIds();
    this.notifications().forEach((n) => readIds.add(n.id));
    this.saveReadIds(readIds);
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
