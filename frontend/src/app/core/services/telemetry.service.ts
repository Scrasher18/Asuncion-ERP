import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiConfigService } from './api-config.service';
import {
  DriverLocationPingRequest,
  LiveTrackingResponse,
  NoSqlDatabaseInfo,
} from '../models/telemetry.models';

@Injectable({ providedIn: 'root' })
export class TelemetryService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  private get baseUrl(): string {
    return `${this.apiConfig.apiUrl}/telemetry`;
  }

  getLiveTracking(orderNumber: string): Observable<LiveTrackingResponse> {
    const clean = encodeURIComponent(orderNumber.trim());
    return this.http.get<LiveTrackingResponse>(`${this.baseUrl}/orders/${clean}/live`);
  }

  getOrderLiveTelemetry(orderNumber: string): Observable<LiveTrackingResponse> {
    return this.getLiveTracking(orderNumber);
  }

  sendDriverPing(req: DriverLocationPingRequest): Observable<any> {
    return this.http.post(`${this.baseUrl}/driver/ping`, req);
  }

  simulateStep(orderNumber: string, progress: number): Observable<LiveTrackingResponse> {
    const clean = encodeURIComponent(orderNumber.trim());
    return this.http.post<LiveTrackingResponse>(
      `${this.baseUrl}/orders/${clean}/simulate-step?progress=${progress}`,
      {}
    );
  }

  getNoSqlStatus(): Observable<NoSqlDatabaseInfo> {
    return this.http.get<NoSqlDatabaseInfo>(`${this.baseUrl}/nosql/status`);
  }

  createSseStream(orderNumber: string): Observable<LiveTrackingResponse> {
    return new Observable<LiveTrackingResponse>((observer) => {
      const clean = encodeURIComponent(orderNumber.trim());
      const eventSource = new EventSource(`${this.baseUrl}/orders/${clean}/stream`);

      eventSource.addEventListener('telemetry', (event: MessageEvent) => {
        try {
          const parsed: LiveTrackingResponse = JSON.parse(event.data);
          observer.next(parsed);
        } catch (e) {
          // ignore malformed data
        }
      });

      eventSource.onerror = (error) => {
        // SSE error, will retry or let subscriber know
        logConsoleError(error);
      };

      return () => {
        eventSource.close();
      };
    });
  }

  streamOrderTracking(orderNumber: string): Observable<LiveTrackingResponse> {
    return this.createSseStream(orderNumber);
  }
}

function logConsoleError(err: any): void {
  // Silent fallback
}
