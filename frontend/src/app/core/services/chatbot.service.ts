import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ChatbotRequest, ChatbotResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';

const SESSION_KEY = 'asuncion_chatbot_session_id';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  readonly sessionId = this.getOrCreateSessionId();

  sendMessage(message: string): Observable<ChatbotResponse> {
    const payload: ChatbotRequest = {
      message: message.trim(),
      sessionId: this.sessionId,
    };
    return this.http.post<ChatbotResponse>(`${this.apiConfig.apiUrl}/chatbot/message`, payload);
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return 'server-session';
    let existing = sessionStorage.getItem(SESSION_KEY);
    if (!existing) {
      existing = `asu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, existing);
    }
    return existing;
  }
}
