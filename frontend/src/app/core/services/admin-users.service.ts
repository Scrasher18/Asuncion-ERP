import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AdminUserResponse,
  CreateStaffUserRequest,
  UpdateStaffUserRequest,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  private get baseUrl(): string {
    return `${this.apiConfig.apiUrl}/admin/users`;
  }

  getUsers(): Observable<AdminUserResponse[]> {
    return this.http.get<AdminUserResponse[]>(this.baseUrl);
  }

  createUser(payload: CreateStaffUserRequest): Observable<AdminUserResponse> {
    return this.http.post<AdminUserResponse>(this.baseUrl, payload);
  }

  updateUser(id: number, payload: UpdateStaffUserRequest): Observable<AdminUserResponse> {
    return this.http.put<AdminUserResponse>(`${this.baseUrl}/${id}`, payload);
  }

  toggleStatus(id: number): Observable<AdminUserResponse> {
    return this.http.patch<AdminUserResponse>(`${this.baseUrl}/${id}/toggle-status`, {});
  }

  deleteUser(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
