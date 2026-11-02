import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ExecutiveDashboardResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  getExecutiveDashboard(days = 30): Observable<ExecutiveDashboardResponse> {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<ExecutiveDashboardResponse>(
      `${this.apiConfig.apiUrl}/admin/analytics/dashboard`,
      { params }
    );
  }
}
