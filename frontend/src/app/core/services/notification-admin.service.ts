import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MailConfigResponse,
  MailConfigUpdateRequest,
  MailTestResponse,
  NotificationLogItem,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class NotificationAdminService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  getConfig(): Observable<MailConfigResponse> {
    return this.http.get<MailConfigResponse>(
      `${this.apiConfig.apiUrl}/admin/notifications/config`
    );
  }

  updateConfig(payload: MailConfigUpdateRequest): Observable<MailConfigResponse> {
    return this.http.put<MailConfigResponse>(
      `${this.apiConfig.apiUrl}/admin/notifications/config`,
      payload
    );
  }

  sendTestEmail(recipientEmail: string): Observable<MailTestResponse> {
    return this.http.post<MailTestResponse>(`${this.apiConfig.apiUrl}/admin/notifications/test`, {
      recipientEmail: recipientEmail.trim(),
    });
  }

  getLogs(): Observable<NotificationLogItem[]> {
    return this.http.get<NotificationLogItem[]>(
      `${this.apiConfig.apiUrl}/admin/notifications/logs`
    );
  }

  clearLogs(): Observable<void> {
    return this.http.delete<void>(
      `${this.apiConfig.apiUrl}/admin/notifications/logs`
    );
  }
}
