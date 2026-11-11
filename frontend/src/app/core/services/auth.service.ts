import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  RoleName,
  UserProfile,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';

const TOKEN_KEY = 'asuncion_jwt_token';
const USER_KEY = 'asuncion_user_profile';

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
  deliveryChannel?: 'EMAIL' | 'IDENTITY_VERIFICATION' | 'CONTACT_ADMIN' | 'NOT_FOUND';
  emailSent?: boolean;
  canVerifyIdentity?: boolean;
  requiresDocument?: boolean;
  requiresPhone?: boolean;
  maskedDocument?: string;
  maskedPhone?: string;
}

export interface ResetPasswordPayload {
  email: string;
  code?: string;
  documentNumber?: string;
  phone?: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly token = signal<string | null>(this.loadStoredToken());
  readonly currentUser = signal<UserProfile | null>(this.loadStoredUser());

  readonly isAuthenticated = computed(() => Boolean(this.token() && this.currentUser()));

  readonly normalizedRoles = computed<RoleName[]>(() => {
    const user = this.currentUser();
    if (!user || !Array.isArray(user.roles)) return [];
    return user.roles.map((r) => r.replace(/^ROLE_/i, '').toUpperCase() as RoleName);
  });

  readonly primaryRole = computed<RoleName | null>(() => {
    const roles = this.normalizedRoles();
    const priority: RoleName[] = ['ADMIN', 'VENDEDOR', 'MOTORIZADO', 'CLIENTE'];
    for (const p of priority) {
      if (roles.includes(p)) return p;
    }
    return roles[0] ?? null;
  });

  readonly canAccessAdmin = computed(() => this.hasAnyRole(['ADMIN', 'VENDEDOR']));
  readonly canAccessDelivery = computed(() => this.hasAnyRole(['MOTORIZADO']));

  // Strict role segregation for delivery drivers
  readonly isDeliveryDriverOnly = computed(() => {
    const roles = this.normalizedRoles();
    return roles.includes('MOTORIZADO') && !roles.includes('ADMIN');
  });

  readonly isOperationalStaff = computed(() => this.isDeliveryDriverOnly());

  readonly canAccessCatalog = computed(() => !this.isOperationalStaff());
  readonly canAccessCart = computed(() => !this.isOperationalStaff());
  readonly canAccessTracking = computed(() => !this.isOperationalStaff() || this.hasAnyRole(['ADMIN', 'VENDEDOR']));
  readonly canAccessMyOrders = computed(() => this.isAuthenticated() && !this.isOperationalStaff());

  readonly brandHomeLink = computed(() => {
    if (this.isDeliveryDriverOnly()) return '/delivery';
    if (this.hasAnyRole(['ADMIN', 'VENDEDOR'])) return '/admin';
    return '/';
  });

  login(payload: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiConfig.apiUrl}/auth/login`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  register(payload: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.apiConfig.apiUrl}/auth/register`, payload)
      .pipe(tap((res) => this.persistSession(res)));
  }

  forgotPassword(email: string): Observable<ForgotPasswordResponse> {
    return this.http.post<ForgotPasswordResponse>(
      `${this.apiConfig.apiUrl}/auth/forgot-password`,
      { email }
    );
  }

  resetPassword(
    payloadOrEmail: ResetPasswordPayload | string,
    code?: string,
    newPassword?: string
  ): Observable<{ success: boolean; message: string }> {
    const body: ResetPasswordPayload =
      typeof payloadOrEmail === 'string'
        ? { email: payloadOrEmail, code, newPassword: newPassword || '' }
        : payloadOrEmail;
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiConfig.apiUrl}/auth/reset-password`,
      body
    );
  }

  updateProfile(payload: {
    fullName: string;
    phone?: string;
    documentType?: string;
    documentNumber?: string;
  }): Observable<UserProfile> {
    return this.http
      .put<UserProfile>(`${this.apiConfig.apiUrl}/auth/profile`, payload)
      .pipe(
        tap((updated) => {
          this.currentUser.set(updated);
          if (typeof window !== 'undefined') {
            localStorage.setItem(USER_KEY, JSON.stringify(updated));
          }
        })
      );
  }

  hasAnyRole(allowed: RoleName[]): boolean {
    const current = this.normalizedRoles();
    return allowed.some((role) => current.includes(role));
  }

  defaultHomeForUser(): string {
    const role = this.primaryRole();
    switch (role) {
      case 'ADMIN':
      case 'VENDEDOR':
        return '/admin';
      case 'MOTORIZADO':
        return '/delivery';
      default:
        return '/';
    }
  }

  logout(redirect = true): void {
    if (typeof window !== 'undefined') {
      try {
        const sessId = localStorage.getItem('asuncion_reservation_session_id');
        if (sessId) {
          fetch(`${this.apiConfig.apiUrl}/catalog/reservations/${encodeURIComponent(sessId)}`, {
            method: 'DELETE',
            keepalive: true,
          }).catch(() => {});
        }
        localStorage.removeItem('asuncion_online_active_holds');
        localStorage.removeItem('asuncion_cart_expires_at');
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      } catch {
        // ignore
      }
    }
    this.token.set(null);
    this.currentUser.set(null);
    this.toast.info('Sesión finalizada', 'Has cerrado sesión correctamente.');
    if (redirect) {
      void this.router.navigate(['/login']);
    }
  }

  clearInvalidSession(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.token.set(null);
    this.currentUser.set(null);
  }

  private persistSession(res: AuthResponse): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TOKEN_KEY, res.token);
      localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    }
    this.token.set(res.token);
    this.currentUser.set(res.user);
  }

  private loadStoredToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
  }

  private loadStoredUser(): UserProfile | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserProfile;
    } catch {
      return null;
    }
  }
}
