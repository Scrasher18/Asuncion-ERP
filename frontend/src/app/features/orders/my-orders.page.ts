import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Order } from '../../core/models/api.models';
import { AuthService } from '../../core/services/auth.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { ToastService } from '../../core/services/toast.service';

@Component({
  selector: 'app-my-orders-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pt-6 pb-24 lg:pb-14 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-5xl space-y-6">
        <!-- Header Section -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 tracking-tight">Mi Cuenta</h1>
            <p class="text-xs sm:text-sm text-gray-600">
              Gestiona tus compras, comprobantes electrónicos y actualiza tus datos de cliente.
            </p>
          </div>
          <a
            routerLink="/"
            class="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-orange-700 transition"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Ver repuestos</span>
          </a>
        </div>

        <!-- Navigation Tabs: Mis Pedidos vs Mis Datos -->
        <div class="border-b border-gray-200">
          <nav class="flex space-x-6 text-sm font-medium">
            <button
              type="button"
              (click)="activeTab.set('orders')"
              [class]="
                activeTab() === 'orders'
                  ? 'border-orange-600 text-orange-600 border-b-2 font-bold pb-3'
                  : 'text-gray-500 hover:text-gray-700 pb-3 border-b-2 border-transparent'
              "
              class="inline-flex items-center gap-2 transition"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
              </svg>
              <span>Mis Pedidos</span>
              @if (orders().length > 0) {
                <span class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {{ orders().length }}
                </span>
              }
            </button>

            <button
              type="button"
              (click)="activeTab.set('profile')"
              [class]="
                activeTab() === 'profile'
                  ? 'border-orange-600 text-orange-600 border-b-2 font-bold pb-3'
                  : 'text-gray-500 hover:text-gray-700 pb-3 border-b-2 border-transparent'
              "
              class="inline-flex items-center gap-2 transition"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <span>Mis Datos Personales</span>
            </button>
          </nav>
        </div>

        <!-- TAB 1: MIS PEDIDOS -->
        @if (activeTab() === 'orders') {
          @if (isLoading()) {
            <div class="rounded-2xl border border-gray-200 bg-white p-10 text-center text-xs text-gray-500">
              Cargando historial de pedidos...
            </div>
          } @else if (orders().length === 0) {
            <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-2xs">
              <div class="inline-flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-orange-600 mb-1">
                <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </div>
              <p class="text-base font-bold text-gray-900">Aún no tienes pedidos registrados</p>
              <p class="text-xs text-gray-500 max-w-sm mx-auto">
                Explora nuestro catálogo con compatibilidad para camiones y vehículos livianos con despacho express.
              </p>
              <a
                routerLink="/"
                class="inline-block rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-orange-700 transition"
              >
                Ver catálogo de repuestos
              </a>
            </div>
          } @else {
            <div class="space-y-3">
              @for (ord of orders(); track ord.id) {
                <div class="rounded-xl border border-gray-200 bg-white p-5 shadow-2xs hover:border-orange-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition">
                  <div class="space-y-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-mono text-sm font-bold text-gray-900">
                        {{ ord.orderNumber }}
                      </span>
                      <span [class]="statusBadgeClass(ord.status)" class="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold">
                        {{ formatStatus(ord.status) }}
                      </span>
                      <span class="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                        {{ ord.invoiceType === 'FACTURA' ? 'Factura' : 'Boleta' }} ·
                        {{ ord.deliveryType === 'PICKUP' ? 'Recojo en tienda' : 'Envío a domicilio' }}
                      </span>
                    </div>
                    <p class="text-xs text-gray-500">
                      {{ ord.createdAt | date: 'dd/MM/yyyy HH:mm' }} · {{ ord.items.length }} {{ ord.items.length === 1 ? 'repuesto' : 'repuestos' }} ·
                      {{ ord.deliveryAddress || ord.branchName }}
                    </p>
                  </div>

                  <div class="flex items-center justify-between sm:justify-end gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                    <div class="sm:text-right">
                      <span class="block text-[11px] font-medium text-gray-500">Total</span>
                      <span class="text-base font-bold tracking-tight text-gray-900">
                        S/ {{ (ord.totalAmount ?? ord.total ?? ord.subtotal) | number: '1.2-2' }}
                      </span>
                    </div>

                    <a
                      routerLink="/track"
                      [queryParams]="{ order: ord.orderNumber }"
                      class="inline-flex min-h-[38px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition"
                    >
                      <span>Ver seguimiento</span>
                      <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </a>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- TAB 2: MIS DATOS PERSONALES -->
        @if (activeTab() === 'profile') {
          <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xs space-y-6">
            <div>
              <h2 class="text-base font-bold text-gray-900">Datos del Cliente</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Mantén actualizada tu información para la emisión de comprobantes (Boletas / Facturas) y el contacto del despacho.
              </p>
            </div>

            <!-- Email (Read only) -->
            <div class="rounded-xl border border-gray-100 bg-gray-50/80 p-3.5 flex items-center justify-between">
              <div>
                <span class="block text-[11px] font-medium text-gray-500 uppercase tracking-wider">Correo electrónico registrado</span>
                <span class="font-medium text-sm text-gray-900">{{ auth.currentUser()?.email }}</span>
              </div>
              <span class="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
                Cuenta activa
              </span>
            </div>

            <form (ngSubmit)="saveProfile()" class="space-y-4">
              <!-- Document Selection & Number -->
              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label class="block text-xs font-medium text-gray-700 mb-1">Tipo de documento</label>
                  <select
                    [(ngModel)]="profileDocType"
                    name="profileDocType"
                    class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                  >
                    <option value="DNI">DNI (8 dígitos)</option>
                    <option value="RUC">RUC (11 dígitos)</option>
                    <option value="CE">Carnet de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                  </select>
                </div>

                <div class="sm:col-span-2">
                  <label class="block text-xs font-medium text-gray-700 mb-1">
                    Número de documento
                  </label>
                  <div class="relative flex items-center">
                    <input
                      type="text"
                      [(ngModel)]="profileDocNumber"
                      name="profileDocNumber"
                      (blur)="onProfileDocChange()"
                      [attr.maxlength]="profileDocType === 'RUC' ? 11 : profileDocType === 'DNI' ? 8 : 15"
                      placeholder="Ej: 71156519 o 20608899114"
                      class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white pl-3.5 pr-20 py-2 text-sm font-mono text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                    />
                    <div class="absolute right-1.5 flex items-center">
                      @if (isLookingUpDoc()) {
                        <span class="p-1.5 text-orange-600">
                          <svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                            <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                          </svg>
                        </span>
                      } @else {
                        <button
                          type="button"
                          (click)="lookupProfileDoc()"
                          class="rounded-lg px-2.5 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-50 border border-orange-200 transition"
                          title="Consultar número de documento"
                        >
                          Buscar
                        </button>
                      }
                    </div>
                  </div>
                </div>
              </div>

              <!-- Notice only when lookup error / not found -->
              @if (profileDocNotice()) {
                <div class="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800 flex items-start gap-2">
                  <svg class="h-4 w-4 shrink-0 text-amber-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>No pudimos consultar el documento. Puedes escribir tu nombre directamente en la casilla inferior.</span>
                </div>
              }

              <!-- Full Name / Business Name -->
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  {{ profileDocType === 'RUC' ? 'Razón Social *' : 'Nombre Completo *' }}
                </label>
                <input
                  type="text"
                  [(ngModel)]="profileFullName"
                  name="profileFullName"
                  required
                  placeholder="Nombres y apellidos o razón social"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <!-- Phone Number (9 digits) -->
              <div>
                <label class="block text-xs font-medium text-gray-700 mb-1">
                  Teléfono celular de contacto <span class="text-gray-400 font-normal">(9 dígitos para despacho)</span>
                </label>
                <input
                  type="tel"
                  [(ngModel)]="profilePhone"
                  name="profilePhone"
                  maxlength="9"
                  placeholder="Ej: 987654321"
                  class="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm font-mono text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                />
              </div>

              <!-- Purchase Requirements Recommendation Card -->
              <div class="rounded-xl border border-blue-100 bg-blue-50/60 p-3.5 text-xs text-blue-900 space-y-1">
                <div class="font-semibold flex items-center gap-1.5 text-blue-950">
                  <svg class="h-4 w-4 text-blue-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <span>Requisitos tributarios para tus compras:</span>
                </div>
                <ul class="list-disc list-inside space-y-0.5 text-blue-800 text-[11px] pt-1">
                  <li><strong>Boleta de venta menor a S/ 700:</strong> SUNAT no exige DNI obligatorio.</li>
                  <li><strong>Boleta de venta desde S/ 700:</strong> Es obligatorio consignar DNI o Carnet de Extranjería.</li>
                  <li><strong>Factura electrónica:</strong> Se requiere RUC de 11 dígitos y Razón Social activa en SUNAT.</li>
                </ul>
              </div>

              <!-- Submit button -->
              <div class="pt-2 flex items-center gap-3">
                <button
                  type="submit"
                  [disabled]="isSavingProfile()"
                  class="inline-flex min-h-[42px] items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  @if (isSavingProfile()) {
                    <svg class="mr-2 h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3"></circle>
                      <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z"></path>
                    </svg>
                    <span>Guardando cambios...</span>
                  } @else {
                    <span>Guardar cambios</span>
                  }
                </button>

                <button
                  type="button"
                  (click)="resetProfileForm()"
                  class="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Restablecer
                </button>
              </div>
            </form>
          </div>
        }
      </div>
    </div>
  `,
})
export class MyOrdersPageComponent implements OnInit {
  private readonly ordersService = inject(OrdersService);
  readonly auth = inject(AuthService);
  private readonly lookupService = inject(LookupService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly orders = signal<Order[]>([]);
  readonly isLoading = signal(true);
  readonly activeTab = signal<'orders' | 'profile'>('orders');

  profileFullName = '';
  profileDocType = 'DNI';
  profileDocNumber = '';
  profilePhone = '';

  readonly isSavingProfile = signal(false);
  readonly isLookingUpDoc = signal(false);
  readonly profileDocNotice = signal(false);

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['tab'] === 'profile') {
        this.activeTab.set('profile');
      }
    });

    this.resetProfileForm();

    this.ordersService
      .getMyOrders()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (list) => this.orders.set(list),
        error: () => this.orders.set([]),
      });
  }

  resetProfileForm(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.profileFullName = user.fullName || '';
      this.profileDocType = user.documentType || 'DNI';
      this.profileDocNumber = user.documentNumber || '';
      this.profilePhone = user.phone || '';
    }
    this.profileDocNotice.set(false);
  }

  onProfileDocChange(): void {
    const digits = (this.profileDocNumber || '').replace(/\D/g, '');
    this.profileDocNumber = digits;
    if (this.profileDocType === 'DNI' && digits.length === 11 && (digits.startsWith('10') || digits.startsWith('20'))) {
      this.profileDocType = 'RUC';
    }
  }

  lookupProfileDoc(): void {
    const doc = (this.profileDocNumber || '').trim();
    if (!doc) {
      this.toast.info('Documento', 'Ingresa un número de DNI u RUC para buscar.');
      return;
    }
    this.isLookingUpDoc.set(true);
    this.profileDocNotice.set(false);

    this.lookupService
      .lookupDocument(doc)
      .pipe(finalize(() => this.isLookingUpDoc.set(false)))
      .subscribe({
        next: (res) => {
          const resolved = (res.businessName || res.fullName || '').trim();
          if (res.found && resolved) {
            this.profileFullName = resolved;
            if (res.documentType === 'RUC') this.profileDocType = 'RUC';
            else if (res.documentType === 'DNI') this.profileDocType = 'DNI';
          } else {
            this.profileDocNotice.set(true);
          }
        },
        error: () => {
          this.profileDocNotice.set(true);
        },
      });
  }

  saveProfile(): void {
    const fullName = (this.profileFullName || '').trim();
    if (!fullName) {
      this.toast.error('Nombre requerido', 'Por favor ingresa tu nombre completo o razón social.');
      return;
    }

    const phone = (this.profilePhone || '').trim();
    if (phone && !/^9\d{8}$/.test(phone)) {
      this.toast.error('Celular inválido', 'El celular debe tener 9 dígitos y comenzar con 9.');
      return;
    }

    const docNum = (this.profileDocNumber || '').trim();
    if (docNum) {
      const expLen = this.profileDocType === 'RUC' ? 11 : this.profileDocType === 'DNI' ? 8 : null;
      if (expLen && docNum.length !== expLen) {
        this.toast.error('Documento incompleto', `El número de ${this.profileDocType} debe tener exactamente ${expLen} dígitos.`);
        return;
      }
    }

    this.isSavingProfile.set(true);
    this.auth
      .updateProfile({
        fullName,
        phone: phone || undefined,
        documentType: docNum ? this.profileDocType : undefined,
        documentNumber: docNum || undefined,
      })
      .pipe(finalize(() => this.isSavingProfile.set(false)))
      .subscribe({
        next: () => {
          this.toast.success('Datos actualizados', 'Tu información personal se ha guardado correctamente.');
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudo guardar la información. Inténtalo nuevamente.';
          this.toast.error('Error al actualizar', msg);
        },
      });
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'CONFIRMADO':
        return 'Confirmado';
      case 'EN_PREPARACION':
        return 'En preparación';
      case 'LISTO_PARA_DESPACHO':
        return 'Listo para envío';
      case 'EN_RUTA':
        return 'En camino';
      case 'ENTREGADO':
        return 'Entregado';
      case 'CANCELADO':
        return 'Cancelado';
      default:
        return status;
    }
  }

  statusBadgeClass(status: string): string {
    switch (status) {
      case 'ENTREGADO':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'CANCELADO':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'EN_PREPARACION':
      case 'LISTO_PARA_DESPACHO':
      case 'EN_RUTA':
        return 'bg-orange-50 text-orange-700 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  }
}
