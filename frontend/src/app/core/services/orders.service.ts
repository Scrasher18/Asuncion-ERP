import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CreateOrderRequest,
  DriverStatus,
  DriverSummary,
  Order,
  ReadyForDispatchRequest,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';

export interface CompleteDeliveryPayload {
  evidenceImage?: File | null;
  receiverName: string;
  receiverDocument: string;
  deliveryNotes?: string;
  capturedLatitude?: number | null;
  capturedLongitude?: number | null;
  securityCode?: string;
}

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  createOrder(payload: CreateOrderRequest): Observable<Order> {
    return this.http.post<Order>(`${this.apiConfig.apiUrl}/orders`, payload);
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiConfig.apiUrl}/orders/my-orders`);
  }

  trackOrder(orderNumber: string): Observable<Order> {
    return this.http.get<Order>(
      `${this.apiConfig.apiUrl}/orders/track/${encodeURIComponent(orderNumber.trim())}`
    );
  }

  getAllOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiConfig.apiUrl}/orders`);
  }

  // ===================== WAREHOUSE MODULE =====================

  getWarehouseOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiConfig.apiUrl}/warehouse/orders`);
  }

  startPicking(orderId: number): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiConfig.apiUrl}/warehouse/orders/${orderId}/start-picking`,
      {}
    );
  }

  toggleItemPicked(orderId: number, itemId: number): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiConfig.apiUrl}/warehouse/orders/${orderId}/items/${itemId}/toggle-picked`,
      {}
    );
  }

  markReadyForDispatch(orderId: number, payload: ReadyForDispatchRequest): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiConfig.apiUrl}/warehouse/orders/${orderId}/ready-for-dispatch`,
      payload
    );
  }

  // ===================== MOTORIZADO DELIVERY PWA =====================

  getDrivers(): Observable<DriverSummary[]> {
    return this.http.get<DriverSummary[]>(`${this.apiConfig.apiUrl}/delivery/drivers`);
  }

  getDeliveryOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiConfig.apiUrl}/delivery/orders`);
  }

  startRoute(orderId: number): Observable<Order> {
    return this.http.patch<Order>(
      `${this.apiConfig.apiUrl}/delivery/orders/${orderId}/start-route`,
      {}
    );
  }

  completeDelivery(orderId: number, payload: CompleteDeliveryPayload): Observable<Order> {
    const formData = new FormData();
    if (payload.evidenceImage) {
      formData.append('evidenceImage', payload.evidenceImage, payload.evidenceImage.name);
    }
    formData.append('receiverName', payload.receiverName);
    formData.append('receiverDocument', payload.receiverDocument);
    if (payload.deliveryNotes) {
      formData.append('deliveryNotes', payload.deliveryNotes);
    }
    if (payload.capturedLatitude !== undefined && payload.capturedLatitude !== null) {
      formData.append('capturedLatitude', String(payload.capturedLatitude));
    }
    if (payload.capturedLongitude !== undefined && payload.capturedLongitude !== null) {
      formData.append('capturedLongitude', String(payload.capturedLongitude));
    }
    if (payload.securityCode) {
      formData.append('securityCode', payload.securityCode.trim());
    }
    return this.http.post<Order>(
      `${this.apiConfig.apiUrl}/delivery/orders/${orderId}/complete`,
      formData
    );
  }

  updateMyStatus(status: DriverStatus): Observable<DriverSummary> {
    return this.http.patch<DriverSummary>(`${this.apiConfig.apiUrl}/delivery/my-status`, { status });
  }

  updateDriverStatus(driverId: number, status: DriverStatus): Observable<DriverSummary> {
    return this.http.patch<DriverSummary>(`${this.apiConfig.apiUrl}/delivery/drivers/${driverId}/status`, { status });
  }

  cancelOrder(orderId: number, reason?: string): Observable<Order> {
    return this.http.patch<Order>(`${this.apiConfig.apiUrl}/orders/${orderId}/cancel`, {
      reason: reason || 'Cancelado por administración / cliente',
    });
  }

  failDelivery(orderId: number, reason: string): Observable<Order> {
    return this.http.post<Order>(`${this.apiConfig.apiUrl}/delivery/orders/${orderId}/fail`, {
      reason: reason || 'Cliente ausente o rechazó entrega',
    });
  }
}
