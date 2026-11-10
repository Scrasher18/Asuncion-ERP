import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import {
  AddressLookupSuggestion,
  Branch,
  CoverageValidationResponse,
  CreateOrderRequest,
  DeliveryType,
  DocumentLookupResponse,
  InvoiceType,
} from '../../core/models/api.models';
import {
  CardAnalysisResult,
  CardPaymentResponse,
} from '../../core/models/payment.models';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../core/services/cart.service';
import { LogisticsService } from '../../core/services/logistics.service';
import { LookupService } from '../../core/services/lookup.service';
import { OrdersService } from '../../core/services/orders.service';
import { PaymentService, StoreWalletConfig, DEFAULT_WALLET_CONFIG } from '../../core/services/payment.service';
import { PdfInvoiceService } from '../../core/services/pdf-invoice.service';
import {
  BOLETA_DNI_REQUIRED_THRESHOLD,
  isAnonymousBillingName,
} from '../../core/constants/company-info.constant';
import { ToastService } from '../../core/services/toast.service';
import { SyncBusService } from '../../core/services/sync-bus.service';
import {
  CoverageMapComponent,
  SelectedGeoPoint,
} from '../../shared/components/coverage-map/coverage-map.component';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, CoverageMapComponent],
  templateUrl: './checkout.page.html',
})
export class CheckoutPageComponent implements OnInit, OnDestroy {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);
  private readonly logisticsService = inject(LogisticsService);
  private readonly ordersService = inject(OrdersService);
  private readonly lookupService = inject(LookupService);
  readonly paymentService = inject(PaymentService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly pdfInvoiceService = inject(PdfInvoiceService);
  private readonly syncBus = inject(SyncBusService);
  readonly walletConfig = signal<StoreWalletConfig>(DEFAULT_WALLET_CONFIG);

  readonly branches = signal<Branch[]>([]);
  readonly deliveryType = signal<DeliveryType>('DELIVERY');
  readonly invoiceType = signal<InvoiceType>('BOLETA');
  selectedBranchId: number | null = null;

  @ViewChild(CoverageMapComponent) coverageMap?: CoverageMapComponent;
  readonly isLocatingGps = signal<boolean>(false);

  useCurrentLocationGps(): void {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.toast.error('Geolocalización no disponible', 'Tu navegador o dispositivo no soporta detección GPS.');
      return;
    }
    this.isLocatingGps.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocatingGps.set(false);
        const { latitude, longitude } = pos.coords;
        this.deliveryLatitude.set(latitude);
        this.deliveryLongitude.set(longitude);
        this.deliveryAddress = 'Mi ubicación GPS actual';
        if (this.coverageMap) {
          this.coverageMap.setGpsLocation(latitude, longitude, 'Mi ubicación GPS actual');
        }
        this.toast.success('Ubicación GPS fijada', 'Se fijó tu punto de entrega en tiempo real.');
      },
      (err) => {
        this.isLocatingGps.set(false);
        const msg = err.code === 1 ? 'Permiso de ubicación denegado en tu navegador.' : 'No se pudo obtener tu ubicación GPS en este momento.';
        this.toast.warning('Aviso de GPS', msg);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }

  readonly deliveryLatitude = signal<number>(-12.045000);
  readonly deliveryLongitude = signal<number>(-76.952000);
  readonly coverageState = signal<CoverageValidationResponse | null>(null);

  readonly isLookingUpDni = signal(false);
  readonly isLookingUpRuc = signal(false);
  readonly dniLookup = signal<DocumentLookupResponse | null>(null);
  readonly rucLookup = signal<DocumentLookupResponse | null>(null);
  private lastLookedUpDni = '';
  private lastLookedUpRuc = '';

  // Address Suggestions
  addressSuggestions = signal<AddressLookupSuggestion[]>([]);
  showAddressDropdown = signal(false);
  isSearchingAddress = signal(false);
  private addressDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  readonly boletaDniThreshold = BOLETA_DNI_REQUIRED_THRESHOLD;
  customerDni = '';
  customerTaxId = '';
  customerBusinessName = '';
  customerFiscalAddress = '';
  deliveryAddress = '';
  deliveryReference = '';
  recipientName = '';
  recipientPhone = '+51 987 654 321';
  paymentMethod = 'TARJETA_CREDITO';
  cashPaymentSubtype: 'EFECTIVO' | 'POS' = 'EFECTIVO';
  cashAmountToPay: number | null = null;
  formattedCashAmountToPay = '';

  quickCashOptions(): number[] {
    const total = this.grandTotal();
    const denominations = [50, 100, 200, 300, 500, 1000, 2000];
    const opts: number[] = [];
    for (const d of denominations) {
      if (d > total && opts.length < 3) {
        opts.push(d);
      }
    }
    return opts;
  }

  readonly scheduleInfo = computed(() => {
    const now = new Date();
    const limaDateStr = now.toLocaleString('en-US', { timeZone: 'America/Lima' });
    const limaDate = new Date(limaDateStr);
    const hours = limaDate.getHours();
    const minutes = limaDate.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const isOpen = totalMinutes >= 480 && totalMinutes < 1200;
    const isSameDayDelivery = totalMinutes >= 480 && totalMinutes <= 1110;

    let deliveryTimeLabel = '';
    let deliveryEstimatedWindow = '';

    if (isSameDayDelivery) {
      deliveryTimeLabel = 'Despacho HOY mismo';
      const estMinHours = Math.floor((totalMinutes + 45) / 60);
      const estMinMins = (totalMinutes + 45) % 60;
      const formattedMin = `${String(estMinHours).padStart(2, '0')}:${String(estMinMins).padStart(2, '0')}`;
      deliveryEstimatedWindow = `Llegada estimada hoy entre las ${formattedMin} y las 20:00 hrs. Horario de despacho: 08:00 a 20:00 hrs.`;
    } else if (totalMinutes > 1110) {
      deliveryTimeLabel = 'Despacho programado para MAÑANA a primera hora';
      deliveryEstimatedWindow = `Por la hora actual (corte diario de despacho 06:30 p.m., cierre de almacén 08:00 p.m.), tu pedido se despachará mañana entre las 08:30 a.m. y 10:00 a.m.`;
    } else {
      deliveryTimeLabel = 'Despacho HOY en el primer turno';
      deliveryEstimatedWindow = `Nuestra tienda y almacén abren a las 08:00 a.m. Tu pedido saldrá en el primer turno de hoy entre las 08:30 a.m. y 10:00 a.m.`;
    }

    let pickupTimeLabel = isOpen
      ? 'Listo para recojo en tienda en 30 min'
      : 'Listo para recojo mañana desde las 08:30 a.m.';
    let pickupEstimatedWindow = 'Horario de atención en tienda: Lunes a Sábado de 08:00 a.m. a 08:00 p.m. (Sede Central Santa Anita).';
    let pickupExpirationLimit = 'Plazo límite de retiro: Tienes hasta 48 horas (2 días calendario) para recoger tu pedido. Vencido este plazo, la reserva se cancela automáticamente y el stock regresa a almacén.';

    return {
      isDeliveryTimeAllowedSameDay: isSameDayDelivery,
      deliveryTimeLabel,
      deliveryEstimatedWindow,
      pickupTimeLabel,
      pickupEstimatedWindow,
      pickupExpirationLimit,
    };
  });

  setExactCashAmount(val: number): void {
    this.cashAmountToPay = val;
    this.formattedCashAmountToPay = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  }

  onCashAmountInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value || '';

    val = val.replace(/[^0-9.]/g, '');
    const parts = val.split('.');
    let intPart = parts[0] || '';
    let decPart = parts.length > 1 ? parts.slice(1).join('').slice(0, 2) : null;

    if (intPart.length > 1 && intPart.startsWith('0')) {
      intPart = intPart.replace(/^0+/, '') || '0';
    }

    const formattedInt = intPart ? intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : '';

    if (decPart !== null) {
      this.formattedCashAmountToPay = `${formattedInt || '0'}.${decPart}`;
    } else if (val.includes('.')) {
      this.formattedCashAmountToPay = `${formattedInt || '0'}.`;
    } else {
      this.formattedCashAmountToPay = formattedInt;
    }

    input.value = this.formattedCashAmountToPay;

    if (!intPart && decPart === null) {
      this.cashAmountToPay = null;
    } else {
      const cleanNumber = `${intPart || '0'}.${decPart !== null ? decPart : '0'}`;
      const parsed = parseFloat(cleanNumber);
      this.cashAmountToPay = isNaN(parsed) ? null : parsed;
    }
  }
  notes = '';

  readonly cashChangeAmount = computed<number>(() => {
    if (this.paymentMethod !== 'CONTRA_ENTREGA' || this.cashPaymentSubtype !== 'EFECTIVO') return 0;
    if (!this.cashAmountToPay || this.cashAmountToPay <= this.grandTotal()) return 0;
    return Number((this.cashAmountToPay - this.grandTotal()).toFixed(2));
  });

  // Card Payment Form & Dynamic Bank Detection
  cardForm = {
    number: '',
    holder: '',
    expiry: '',
    cvv: '',
    documentNumber: '',
    documentType: 'DNI',
    installments: 1,
  };

  readonly cardAnalysis = signal<CardAnalysisResult>(
    this.paymentService.analyzeCardRealtime('')
  );
  readonly isProcessingPayment = signal(false);
  readonly paymentSuccessReceipt = signal<CardPaymentResponse | null>(null);

  readonly isSubmitting = signal(false);
  readonly geospatialRejectionAlert = signal('');

  readonly selectedBranch = computed<Branch | null>(() => {
    const list = this.branches();
    return list.find((b) => b.id === Number(this.selectedBranchId)) ?? list[0] ?? null;
  });

  readonly shippingFee = computed<number>(() => {
    if (this.deliveryType() === 'PICKUP') return 0;
    const cov = this.coverageState();
    if (cov && cov.covered) {
      return cov.estimatedDeliveryFee ?? 0;
    }
    return 0;
  });

  readonly grandTotal = computed<number>(() =>
    Number((this.cart.subtotal() + this.shippingFee()).toFixed(2))
  );

  readonly requiresBoletaDni = computed<boolean>(
    () => this.invoiceType() === 'BOLETA' && this.grandTotal() >= BOLETA_DNI_REQUIRED_THRESHOLD
  );

  useClientesVariosForBoleta(): void {
    if (this.requiresBoletaDni()) return;
    this.customerDni = '';
    this.dniLookup.set(null);
    this.lastLookedUpDni = '';
    this.recipientName = 'CLIENTES VARIOS';
  }

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.prefillFromUser();
    }

    if (this.cart.items().length > 0) {
      this.cart.refreshPosHoldsAndReconcile();
      this.cart.syncReservationWithServer(true);
    }

    this.walletConfig.set(this.paymentService.getStoreWalletConfig());
    this.paymentService.fetchStoreWalletConfig().subscribe({
      next: (cfg) => this.walletConfig.set(cfg),
    });
    this.logisticsService.getBranches().subscribe({
      next: (list) => {
        if (list.length > 0) {
          this.branches.set(list);
          this.selectedBranchId = list[0].id;
        }
      },
      error: () => {},
    });
  }

  private prefillFromUser(): void {
    const user = this.auth.currentUser();
    if (!user) return;
    if (!this.recipientName) {
      this.recipientName = user.fullName;
      this.cardForm.holder = user.fullName.toUpperCase();
    }
    if (user.phone) {
      this.recipientPhone = user.phone;
    }
    if (user.documentNumber) {
      this.cardForm.documentNumber = user.documentNumber;
    }
    if (user.documentType === 'RUC' && user.documentNumber) {
      this.invoiceType.set('FACTURA');
      this.customerTaxId = user.documentNumber;
      this.onRucChange(user.documentNumber);
    } else if (user.documentType === 'DNI' && user.documentNumber) {
      this.customerDni = user.documentNumber;
      this.onDniChange(user.documentNumber);
    }
  }

  setInvoiceType(type: InvoiceType): void {
    this.invoiceType.set(type);
  }

  setPaymentMethod(method: string): void {
    this.paymentMethod = method;
  }

  // ===================== CARD INPUT HANDLERS =====================

  onCardNumberInput(val: string): void {
    const analysis = this.paymentService.analyzeCardRealtime(val);
    this.cardForm.number = analysis.formattedNumber;
    this.cardAnalysis.set(analysis);
  }

  onCardExpiryInput(val: string): void {
    this.cardForm.expiry = this.paymentService.formatExpiry(val);
  }

  onCardHolderInput(val: string): void {
    this.cardForm.holder = (val || '').toUpperCase();
  }

  
  downloadOrderPdf(order: any): void {
    if (!order) return;
    this.pdfInvoiceService.generateInvoicePdf(order, true);
    this.toast.success(
      'Descargando documento',
      order?.invoiceType === 'FACTURA'
        ? 'Generando Proforma PDF para Factura (SUNAT vía WhatsApp)...'
        : 'Generando Boleta de Venta en PDF...'
    );
  }

  closeReceiptModal(): void {
    const receipt = this.paymentSuccessReceipt();
    this.paymentSuccessReceipt.set(null);
    if (receipt) {
      void this.router.navigate(['/track'], {
        queryParams: { order: receipt.orderNumber, paid: '1' },
      });
    }
  }

  // ===================== LOOKUP & ADDRESS =====================

  isSunatActive(doc: DocumentLookupResponse | null): boolean {
    if (!doc) return false;
    const status = (doc.taxStatus || 'ACTIVO').toUpperCase();
    const cond = (doc.taxCondition || 'HABIDO').toUpperCase();
    return status.includes('ACTIVO') && cond.includes('HABIDO');
  }

  onDniChange(rawValue: string): void {
    const clean = (rawValue || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 12);
    if (clean !== rawValue) {
      this.customerDni = clean;
    }

    const digitsOnly = clean.replace(/\D/g, '');
    if (digitsOnly.length !== 8 || clean !== digitsOnly) {
      this.dniLookup.set(null);
      if (digitsOnly.length < 8) {
        this.lastLookedUpDni = '';
      }
      return;
    }

    if (digitsOnly === this.lastLookedUpDni) {
      return;
    }
    this.lastLookedUpDni = digitsOnly;
    this.isLookingUpDni.set(true);

    this.lookupService
      .lookupDocument(digitsOnly)
      .pipe(finalize(() => this.isLookingUpDni.set(false)))
      .subscribe({
        next: (res) => {
          if (res.found && res.fullName) {
            this.dniLookup.set(res);
            this.recipientName = res.fullName.trim();
            if (!this.cardForm.holder) {
              this.cardForm.holder = res.fullName.trim().toUpperCase();
            }
          } else {
            this.dniLookup.set(null);
          }
        },
        error: () => {
          this.dniLookup.set(null);
        },
      });
  }

  onRucChange(rawValue: string): void {
    const digits = (rawValue || '').replace(/\D/g, '');
    if (digits !== rawValue) {
      this.customerTaxId = digits;
    }

    if (digits.length === 8 && rawValue.length === 8) {
      // Allow graceful handling when 8 digits entered in RUC box: keep user aware or only auto-switch after lookup
    }

    if (digits.length !== 11) {
      this.rucLookup.set(null);
      if (digits.length < 11) {
        this.lastLookedUpRuc = '';
      }
      return;
    }

    if (digits === this.lastLookedUpRuc) {
      return;
    }
    this.lastLookedUpRuc = digits;
    this.isLookingUpRuc.set(true);

    this.lookupService
      .lookupDocument(digits)
      .pipe(finalize(() => this.isLookingUpRuc.set(false)))
      .subscribe({
        next: (res) => {
          if (res.found) {
            this.rucLookup.set(res);
            const company = (res.businessName || res.fullName || '').trim();
            if (company) {
              this.customerBusinessName = company;
            }
            if (res.fiscalAddress?.trim()) {
              this.customerFiscalAddress = res.fiscalAddress.trim();
              if (!this.deliveryAddress.trim()) {
                this.applyFiscalAddress(res);
              }
            }
          } else {
            this.rucLookup.set(null);
          }
        },
        error: () => {
          this.rucLookup.set(null);
        },
      });
  }

  useFiscalAddressForDelivery(): void {
    const ruc = this.rucLookup();
    if (ruc?.fiscalAddress) {
      this.applyFiscalAddress(ruc);
      this.toast.info('Dirección aplicada', 'Se configuró el domicilio fiscal para el reparto.');
    }
  }

  private applyFiscalAddress(doc: DocumentLookupResponse): void {
    if (!doc.fiscalAddress) return;
    this.deliveryAddress = doc.fiscalAddress;
    this.lookupService.lookupAddress(doc.fiscalAddress).subscribe({
      next: (suggestions: AddressLookupSuggestion[]) => {
        if (suggestions.length > 0) {
          this.deliveryLatitude.set(suggestions[0].latitude);
          this.deliveryLongitude.set(suggestions[0].longitude);
        }
      },
      error: () => {},
    });
  }

  onAddressInput(query: string): void {
    if (this.addressDebounceTimer) {
      clearTimeout(this.addressDebounceTimer);
    }
    if (!query || query.trim().length < 3) {
      this.addressSuggestions.set([]);
      this.showAddressDropdown.set(false);
      return;
    }

    this.addressDebounceTimer = setTimeout(() => {
      this.isSearchingAddress.set(true);
      this.lookupService
        .lookupAddress(query)
        .pipe(finalize(() => this.isSearchingAddress.set(false)))
        .subscribe({
          next: (results: AddressLookupSuggestion[]) => {
            this.addressSuggestions.set(results || []);
            this.showAddressDropdown.set((results || []).length > 0);
          },
          error: () => {
            this.addressSuggestions.set([]);
            this.showAddressDropdown.set(false);
          },
        });
    }, 350);
  }

  onAddressFocus(): void {
    if (this.addressSuggestions().length > 0) {
      this.showAddressDropdown.set(true);
    }
  }

  hideAddressDropdownDelayed(): void {
    setTimeout(() => this.showAddressDropdown.set(false), 180);
  }

  selectAddressSuggestion(addr: AddressLookupSuggestion): void {
    this.deliveryAddress = addr.displayName;
    this.deliveryLatitude.set(addr.latitude);
    this.deliveryLongitude.set(addr.longitude);
    this.showAddressDropdown.set(false);
    this.geospatialRejectionAlert.set('');
  }

  setDeliveryType(type: DeliveryType): void {
    this.deliveryType.set(type);
    this.geospatialRejectionAlert.set('');
  }

  onBranchSelectChange(): void {
    this.geospatialRejectionAlert.set('');
  }

  onMapLocationSelected(point: SelectedGeoPoint): void {
    this.deliveryLatitude.set(point.latitude);
    this.deliveryLongitude.set(point.longitude);
    if (point.suggestedAddress) {
      this.deliveryAddress = point.suggestedAddress;
    }
    this.geospatialRejectionAlert.set('');
  }

  onCoverageValidated(res: CoverageValidationResponse): void {
    this.coverageState.set(res);
  }

  private getBillingAndContactValidationError(): { title: string; message: string } | null {
    if (!this.recipientPhone.trim()) {
      return {
        title: 'Teléfono requerido',
        message: 'Por favor ingresa un número celular de contacto para coordinar el pedido.',
      };
    }

    if (this.invoiceType() === 'FACTURA') {
      const rucDigits = this.customerTaxId.replace(/\D/g, '');
      if (rucDigits.length !== 11) {
        return {
          title: 'RUC inválido',
          message: 'Para emitir Factura Electrónica ingresa un R.U.C. válido de 11 dígitos.',
        };
      }
      if (!this.customerBusinessName.trim() || isAnonymousBillingName(this.customerBusinessName)) {
        return {
          title: 'Razón social requerida',
          message: 'Por favor ingresa la Razón Social exacta de la empresa.',
        };
      }
      if (!this.customerFiscalAddress.trim()) {
        return {
          title: 'Dirección fiscal requerida',
          message: 'Para emitir Factura Electrónica ingresa la dirección fiscal de la empresa.',
        };
      }
      if (!this.recipientName.trim()) {
        return {
          title: 'Nombre de quien recibe requerido',
          message: 'Por favor indica quién recibirá el pedido.',
        };
      }
      return null;
    }

    // BOLETA DE VENTA: S/ 700+ exige DNI / CE y nombres completos; < S/ 700 permite Clientes Varios
    if (this.grandTotal() >= BOLETA_DNI_REQUIRED_THRESHOLD) {
      const cleanDoc = this.customerDni.replace(/[^A-Za-z0-9]/g, '');
      if (cleanDoc.length < 8 || /^0+$/.test(cleanDoc)) {
        return {
          title: 'DNI / C.E. obligatorio desde S/ 700',
          message:
            'Por disposición SUNAT, las boletas de S/ 700.00 a más exigen DNI (8 dígitos) o C.E./Pasaporte.',
        };
      }
      if (!this.recipientName.trim() || isAnonymousBillingName(this.recipientName)) {
        return {
          title: 'Nombre completo obligatorio desde S/ 700',
          message:
            'Por disposición SUNAT, las boletas de S/ 700.00 a más no pueden emitirse como Clientes Varios.',
        };
      }
    }

    return null;
  }

  canSubmitOrder(): boolean {
    if (!this.auth.isAuthenticated()) return false;
    if (this.getBillingAndContactValidationError() !== null) return false;
    if (this.deliveryType() === 'DELIVERY') {
      if (!this.deliveryAddress.trim()) return false;
      const cov = this.coverageState();
      if (cov && !cov.covered) {
        return false;
      }
    }

    if (this.paymentMethod === 'CONTRA_ENTREGA' && this.cashPaymentSubtype === 'EFECTIVO') {
      if (this.cashAmountToPay !== null && this.cashAmountToPay > 0 && this.cashAmountToPay < this.grandTotal()) {
        return false;
      }
    }

    return true;
  }

  async payWithCulqiCheckoutModal(): Promise<void> {
    this.cart.refreshPosHoldsAndReconcile();
    if (this.cart.items().length === 0) {
      this.toast.warning('Carrito vacío', 'Los productos seleccionados ya no están disponibles.');
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.toast.warning('Inicia sesión primero', 'Ingresa a tu cuenta para confirmar el pedido.');
      return;
    }
    const billingErr = this.getBillingAndContactValidationError();
    if (billingErr) {
      this.toast.warning(billingErr.title, billingErr.message);
      return;
    }
    if (this.deliveryType() === 'DELIVERY') {
      if (!this.deliveryAddress.trim()) {
        this.toast.warning('Dirección requerida', 'Por favor ingresa la dirección de entrega.');
        return;
      }
      const cov = this.coverageState();
      if (cov && !cov.covered) {
        this.toast.error('Dirección fuera de cobertura', 'Tu ubicación se encuentra fuera del área de reparto autorizada.');
        return;
      }
    }

    this.isProcessingPayment.set(true);
    const email = this.auth.currentUser()?.email || 'cliente@asuncion.pe';

    let activeKey = '';
    try {
      const cfg = await firstValueFrom(this.paymentService.getPublicConfig());
      if (cfg?.culqiPublicKey) {
        activeKey = cfg.culqiPublicKey;
      }
    } catch {
      // Usar clave configurada por defecto
    }

    try {
      // Abrir la pasarela Culqi PRIMERO (sin crear pedido en BD todavía)
      const res = await this.paymentService.openCulqiCheckout({
        title: 'Autopartes Asunción',
        currency: 'PEN',
        amount: this.grandTotal(),
        publicKey: activeKey,
        email: email,
      });

      if (res.token) {
        // ¡TOKEN GENERADO CON ÉXITO! AHORA SÍ CREAMOS EL PEDIDO Y PROCESAMOS EL CARGO
        this.paymentService.closeCulqiModal();
        this.isSubmitting.set(true);
        const payload = this.buildCreateOrderPayload();

        this.ordersService.createOrder(payload).subscribe({
          next: (createdOrder) => {
            this.paymentService
              .processCulqiCharge({
                orderId: createdOrder.id,
                tokenId: res.token.id,
                email: res.token.email || email,
              })
              .subscribe({
                next: (receipt) => {
                  this.paymentService.closeCulqiModal();
                  this.isProcessingPayment.set(false);
                  this.isSubmitting.set(false);
                  this.cart.clear();
                  this.syncBus.notifyOnlineOrder(createdOrder.orderNumber, payload.items.map((i) => i.partId));
                  this.paymentSuccessReceipt.set(receipt);
                  this.toast.success(
                    '¡Pago aprobado con éxito en Culqi!',
                    `Transacción ${receipt.transactionId} confirmada. Pedido #${createdOrder.orderNumber}`
                  );
                  void this.router.navigate(['/track'], {
                    queryParams: { order: createdOrder.orderNumber, paid: '1' },
                  });
                },
                error: (chargeErr) => {
                  this.paymentService.closeCulqiModal();
                  this.isProcessingPayment.set(false);
                  this.isSubmitting.set(false);
                  const msg = chargeErr?.error?.message || 'Culqi no pudo procesar el cargo de tu tarjeta.';
                  this.toast.error('Pago rechazado por Culqi', msg);
                },
              });
          },
          error: (orderErr) => {
            this.paymentService.closeCulqiModal();
            this.isProcessingPayment.set(false);
            this.isSubmitting.set(false);
            const serverMsg = orderErr?.error?.message || orderErr?.error?.detail || 'No se pudo crear la orden.';
            if (orderErr?.status === 422 || orderErr?.status === 400) {
              this.geospatialRejectionAlert.set(serverMsg);
            }
            this.toast.error('Error al registrar pedido', serverMsg);
          },
        });
      } else if (res.error) {
        this.paymentService.closeCulqiModal();
        this.isProcessingPayment.set(false);
        this.isSubmitting.set(false);
        const userMsg = res.error.user_message || res.error.merchant_message || 'Error en pasarela Culqi.';
        this.toast.error('Error en Culqi', userMsg);
      } else {
        // Modal cerrado o cancelado por el usuario
        this.paymentService.closeCulqiModal();
        this.isProcessingPayment.set(false);
        this.isSubmitting.set(false);
        this.toast.info('Pasarela Culqi cerrada', 'No se ha realizado ningún cobro ni se generó ningún pedido.');
      }
    } catch (e: any) {
      this.paymentService.closeCulqiModal();
      this.isProcessingPayment.set(false);
      this.isSubmitting.set(false);
      this.toast.error('Error inesperado', e?.message || 'No se pudo abrir Culqi Checkout.');
    }
  }

  private buildFormattedNotes(): string {
    let finalNotes = (this.notes || '').trim();
    const sched = this.scheduleInfo();
    if (this.deliveryType() === 'DELIVERY') {
      const deliveryTag = sched.isDeliveryTimeAllowedSameDay
        ? '[HORARIO DESPACHO: Mismo día (08:00 - 20:00)]'
        : '[HORARIO DESPACHO: Programado siguiente turno 08:30 AM (Fuera de corte 18:30)]';
      finalNotes = `${deliveryTag} ${finalNotes}`.trim();
    } else {
      const pickupTag = `[RECOJO EN TIENDA: Plazo 48h - Horario Lun-Sáb 08:00 a 20:00]`;
      finalNotes = `${pickupTag} ${finalNotes}`.trim();
    }
    if (this.paymentMethod === 'CONTRA_ENTREGA') {
      if (this.cashPaymentSubtype === 'EFECTIVO') {
        if (this.cashAmountToPay && this.cashAmountToPay > 0) {
          const change = this.cashChangeAmount();
          const tag = change > 0
            ? `[PAGO CONTRAENTREGA EN EFECTIVO: Cliente paga con S/ ${this.cashAmountToPay.toFixed(2)} - Llevar vuelto de S/ ${change.toFixed(2)}]`
            : `[PAGO CONTRAENTREGA EN EFECTIVO: Cliente paga monto exacto S/ ${this.cashAmountToPay.toFixed(2)}]`;
          finalNotes = `${tag} ${finalNotes}`.trim();
        } else {
          finalNotes = `[PAGO CONTRAENTREGA EN EFECTIVO: Monto exacto / Llevar cambio estándar] ${finalNotes}`.trim();
        }
      } else {
        finalNotes = `[PAGO CONTRAENTREGA CON TARJETA: Llevar terminal POS móvil] ${finalNotes}`.trim();
      }
    }
    return finalNotes;
  }

  private buildCreateOrderPayload(): CreateOrderRequest {
    const branchId = this.selectedBranch()?.id ?? this.selectedBranchId ?? 1;
    const isFactura = this.invoiceType() === 'FACTURA';
    const docNum = isFactura ? this.customerTaxId.replace(/\D/g, '') : this.customerDni.trim();
    const isUnder700Anon =
      !isFactura &&
      this.grandTotal() < BOLETA_DNI_REQUIRED_THRESHOLD &&
      isAnonymousBillingName(this.recipientName);
    const resolvedRecipient = isUnder700Anon ? 'CLIENTES VARIOS' : this.recipientName.trim();

    return {
      branchId,
      deliveryType: this.deliveryType(),
      deliveryAddress:
        this.deliveryType() === 'DELIVERY'
          ? this.deliveryAddress.trim()
          : this.selectedBranch()?.address || 'Recojo en tienda',
      deliveryReference: this.deliveryReference.trim(),
      deliveryLatitude: this.deliveryType() === 'DELIVERY' ? this.deliveryLatitude() : null,
      deliveryLongitude: this.deliveryType() === 'DELIVERY' ? this.deliveryLongitude() : null,
      invoiceType: this.invoiceType(),
      customerTaxId: isFactura ? docNum : undefined,
      billingDocumentNumber: docNum,
      customerBusinessName: isFactura ? this.customerBusinessName.trim() : resolvedRecipient,
      billingBusinessName: isFactura ? this.customerBusinessName.trim() : resolvedRecipient,
      billingAddress: isFactura
        ? this.customerFiscalAddress.trim() || this.deliveryAddress.trim()
        : undefined,
      recipientName: resolvedRecipient,
      recipientPhone: this.recipientPhone.trim(),
      paymentMethod: this.paymentMethod,
      notes: this.buildFormattedNotes(),
      reservationSessionId: this.cart.reservationSessionId,
      items: this.cart.items().map((i) => ({
        partId: i.part.id,
        quantity: i.quantity,
      })),
      customCombos: this.cart.customCombos(),
    };
  }

  submitOrder(): void {
    this.cart.refreshPosHoldsAndReconcile();
    if (this.cart.items().length === 0) {
      this.toast.warning('Carrito vacío', 'Los productos seleccionados ya no están disponibles.');
      return;
    }
    if (!this.auth.isAuthenticated()) {
      this.toast.warning('Inicia sesión primero', 'Ingresa a tu cuenta para confirmar el pedido.');
      return;
    }
    const billingErr = this.getBillingAndContactValidationError();
    if (billingErr) {
      this.toast.warning(billingErr.title, billingErr.message);
      return;
    }

    if (this.paymentMethod === 'TARJETA_CREDITO') {
      void this.payWithCulqiCheckoutModal();
      return;
    }

    if (this.paymentMethod === 'CONTRA_ENTREGA' && this.cashPaymentSubtype === 'EFECTIVO') {
      if (this.cashAmountToPay !== null && this.cashAmountToPay > 0 && this.cashAmountToPay < this.grandTotal()) {
        this.toast.error(
          'Monto insuficiente',
          `El monto para pagar en efectivo debe ser igual o mayor al total del pedido (mínimo S/ ${this.grandTotal().toFixed(2)}).`
        );
        return;
      }
    }

    this.geospatialRejectionAlert.set('');
    this.isSubmitting.set(true);

    // Pre-verify concurrent stock reservation before creating the order
    this.cart.syncReservationObservable(true).subscribe({
      next: (syncRes) => {
        if (
          syncRes &&
          syncRes.items.some(
            (it) => it.status === 'AJUSTADO_POR_RESERVA' || it.status === 'AGOTADO_EN_RESERVA' || it.status === 'AGOTADO'
          )
        ) {
          this.isSubmitting.set(false);
          this.geospatialRejectionAlert.set(
            'El stock de uno de tus repuestos cambió porque otro cliente reservó unidades al mismo tiempo. Revisa las cantidades actualizadas en tu resumen antes de confirmar.'
          );
          return;
        }
        if (this.cart.items().length === 0) {
          this.isSubmitting.set(false);
          return;
        }

        const payload = this.buildCreateOrderPayload();
        this.ordersService
          .createOrder(payload)
          .pipe(finalize(() => this.isSubmitting.set(false)))
          .subscribe({
            next: (createdOrder) => {
              // Flow 1: TARJETA DE CREDITO / DEBITO (CULQI)
              if (this.paymentMethod === 'TARJETA_CREDITO') {
                this.executeCardPaymentForOrder(createdOrder.id, createdOrder.orderNumber);
                return;
              }

              // Flow 2: Standard orders (YAPE, TRANSFERENCIA, CONTRA_ENTREGA)
              this.cart.clear();
              this.syncBus.notifyOnlineOrder(createdOrder.orderNumber, payload.items.map((i) => i.partId));
              const isFacturaReq = createdOrder.invoiceType === 'FACTURA';
              this.toast.success(
                `Pedido ${createdOrder.orderNumber} registrado`,
                isFacturaReq
                  ? 'Descarga tu Proforma PDF aquí; emitiremos tu Factura SUNAT y te la enviaremos por WhatsApp.'
                  : 'Ya puedes descargar tu Boleta PDF y seguir tu pedido en vivo.'
              );
              void this.router.navigate(['/track'], {
                queryParams: { order: createdOrder.orderNumber, created: '1' },
              });
            },
            error: (err: HttpErrorResponse) => {
              const serverMsg =
                err?.error?.message ||
                err?.error?.detail ||
                err?.error?.error ||
                'No se pudo procesar el pedido.';
              if (err.status === 422 || err.status === 400) {
                this.geospatialRejectionAlert.set(serverMsg);
                this.toast.error('No se pudo procesar el pedido', serverMsg);
              } else {
                this.toast.error('Error al registrar el pedido', serverMsg);
              }
            },
          });
      },
      error: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  private executeCardPaymentForOrder(orderId: number, orderNumber: string): void {
    const [month, year] = this.cardForm.expiry.split('/');
    this.isProcessingPayment.set(true);

    this.paymentService
      .processCardPayment({
        orderId,
        cardNumber: this.cardAnalysis().cleanNumber,
        cardholderName: this.cardForm.holder.trim(),
        expiryMonth: month,
        expiryYear: year,
        cvv: this.cardForm.cvv.trim(),
        documentNumber: this.cardForm.documentNumber.trim() || this.customerDni.trim(),
        documentType: this.cardForm.documentType,
        installments: 1,
        email: this.auth.currentUser()?.email,
      })
      .pipe(finalize(() => this.isProcessingPayment.set(false)))
      .subscribe({
        next: (receipt) => {
          this.cart.clear();
          this.paymentSuccessReceipt.set(receipt);
          this.toast.success(
            '¡Pago aprobado con éxito!',
            `Transacción ${receipt.transactionId} confirmada. Autorización: ${receipt.authorizationCode}`
          );
        },
        error: (err) => {
          this.toast.error(
            'Error al procesar tarjeta',
            err?.error?.message || 'Tu banco no autorizó la operación. Verifica tus datos o intenta con otra tarjeta.'
          );
          void this.router.navigate(['/track'], {
            queryParams: { order: orderNumber, paymentError: '1' },
          });
        },
      });
  }

  ngOnDestroy(): void {
    if (this.addressDebounceTimer) {
      clearTimeout(this.addressDebounceTimer);
    }
  }
}
