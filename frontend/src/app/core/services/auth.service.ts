import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import {
  AuthResponse,
  DemoAccount,
  LoginRequest,
  RegisterRequest,
  RoleName,
  UserProfile,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';
import { ToastService } from './toast.service';

const TOKEN_KEY = 'asuncion_jwt_token';
const USER_KEY = 'asuncion_user_profile';

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    role: 'ADMIN',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    title: 'Administrador General',
    fullName: 'Carlos Mendoza',
    email: 'admin@asuncion.pe',
    password: '',
    targetRoute: '/admin',
    description: 'Gestión comercial, inventario de repuestos, zonas de reparto y supervisión de pedidos.',
  },
  {
    role: 'VENDEDOR',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    title: 'Asesor de Ventas',
    fullName: 'Lucía Paredes',
    email: 'ventas1@asuncion.pe',
    password: '',
    targetRoute: '/admin',
    description: 'Consulta de catálogo, metas de ventas, rotación de inventario y atención de pedidos.',
  },
  {
    role: 'MOTORIZADO',
    badgeColor: 'bg-orange-50 text-orange-700 border-orange-200',
    title: 'Repartidor',
    fullName: 'Miguel Ángel Soto',
    email: 'motorizado@asuncion.pe',
    password: '',
    targetRoute: '/delivery',
    description: 'Entregas asignadas con ruta en Google Maps, contacto al cliente y foto de recepción.',
  },
  {
    role: 'CLIENTE',
    badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
    title: 'Cliente',
    fullName: 'Martín Torres · Flotas Andinas SAC',
    email: 'cliente@empresa.pe',
    password: '',
    targetRoute: '/',
    description: 'Compra de repuestos con boleta o factura, cálculo de envío y seguimiento de pedido.',
  },
];

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

  forgotPassword(email: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiConfig.apiUrl}/auth/forgot-password`,
      { email }
    );
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<{ success: boolean; message: string }> {
    return this.http.post<{ success: boolean; message: string }>(
      `${this.apiConfig.apiUrl}/auth/reset-password`,
      { email, code, newPassword }
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
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
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
