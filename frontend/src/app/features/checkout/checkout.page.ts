import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
import { ToastService } from '../../core/services/toast.service';
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
  readonly walletConfig = signal<StoreWalletConfig>(DEFAULT_WALLET_CONFIG);

  readonly branches = signal<Branch[]>([]);
  readonly deliveryType = signal<DeliveryType>('DELIVERY');
  readonly invoiceType = signal<InvoiceType>('BOLETA');
  selectedBranchId: number | null = null;

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

  customerDni = '';
  customerTaxId = '';
  customerBusinessName = '';
  deliveryAddress = '';
  deliveryReference = '';
  recipientName = '';
  recipientPhone = '+51 987 654 321';
  paymentMethod = 'TARJETA_CREDITO';
  notes = '';

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

  ngOnInit(): void {
    const user = this.auth.currentUser();
    if (user) {
      this.prefillFromUser();
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
    this.toast.success('Descargando comprobante', 'Generando Boleta / Factura en PDF...');
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
    const digits = (rawValue || '').replace(/\D/g, '');
    if (digits !== rawValue) {
      this.customerDni = digits;
    }

    if (digits.length !== 8) {
      this.dniLookup.set(null);
      if (digits.length < 8) {
        this.lastLookedUpDni = '';
      }
      return;
    }

    if (digits === this.lastLookedUpDni) {
      return;
    }
    this.lastLookedUpDni = digits;
    this.isLookingUpDni.set(true);

    this.lookupService
      .lookupDocument(digits)
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
            if (!this.deliveryAddress.trim() && res.fiscalAddress?.trim()) {
              this.applyFiscalAddress(res);
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

  canSubmitOrder(): boolean {
    if (!this.auth.isAuthenticated()) return false;
    if (!this.recipientName.trim() || !this.recipientPhone.trim()) return false;
    if (this.invoiceType() === 'FACTURA') {
      if (!this.customerTaxId.trim() || !this.customerBusinessName.trim()) return false;
    }
    if (this.deliveryType() === 'DELIVERY') {
      if (!this.deliveryAddress.trim()) return false;
      const cov = this.coverageState();
      if (cov && !cov.covered) {
        return false;
      }
    }

    return true;
  }

  async payWithCulqiCheckoutModal(): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.toast.warning('Inicia sesión primero', 'Ingresa a tu cuenta para confirmar el pedido.');
      return;
    }
    if (!this.recipientName.trim() || !this.recipientPhone.trim()) {
      this.toast.warning('Datos de contacto requeridos', 'Por favor ingresa el nombre y teléfono de quien recibe.');
      return;
    }
    if (this.deliveryType() === 'DELIVERY' && !this.deliveryAddress.trim()) {
      this.toast.warning('Dirección requerida', 'Por favor ingresa la dirección de entrega.');
      return;
    }
    if (this.invoiceType() === 'FACTURA' && (!this.customerTaxId.trim() || !this.customerBusinessName.trim())) {
      this.toast.warning('Datos de facturación requeridos', 'Por favor ingresa tu RUC y Razón Social.');
      return;
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
            this.toast.error('Error al registrar pedido', orderErr?.error?.message || 'No se pudo crear la orden.');
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

  private buildCreateOrderPayload(): CreateOrderRequest {
    const branchId = this.selectedBranch()?.id ?? this.selectedBranchId ?? 1;
    const isFactura = this.invoiceType() === 'FACTURA';
    const docNum = isFactura ? this.customerTaxId.trim() : this.customerDni.trim();

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
      billingDocumentNumber: docNum || undefined,
      customerBusinessName: isFactura ? this.customerBusinessName.trim() : undefined,
      billingBusinessName: isFactura ? this.customerBusinessName.trim() : undefined,
      recipientName: this.recipientName.trim(),
      recipientPhone: this.recipientPhone.trim(),
      paymentMethod: this.paymentMethod,
      notes: this.notes.trim(),
      items: this.cart.items().map((i) => ({
        partId: i.part.id,
        quantity: i.quantity,
      })),
    };
  }

  submitOrder(): void {
    if (!this.auth.isAuthenticated()) {
      this.toast.warning('Inicia sesión primero', 'Ingresa a tu cuenta para confirmar el pedido.');
      return;
    }

    if (this.paymentMethod === 'TARJETA_CREDITO') {
      const cleanNum = this.cardAnalysis().cleanNumber;
      if (cleanNum.length < 14) {
        this.toast.error('Tarjeta inválida', 'Ingresa un número de tarjeta válido de 16 dígitos.');
        return;
      }
      if (!this.cardAnalysis().luhnValid) {
        this.toast.error('Tarjeta no válida', 'El número de tarjeta no supera el algoritmo de verificación bancaria.');
        return;
      }
      if (!this.cardForm.holder.trim()) {
        this.toast.error('Falta el titular', 'Ingresa el nombre del titular de la tarjeta.');
        return;
      }
      if (this.cardForm.expiry.length !== 5) {
        this.toast.error('Fecha inválida', 'Ingresa la fecha de vencimiento en formato MM/AA.');
        return;
      }
      if (this.cardForm.cvv.trim().length < 3) {
        this.toast.error('Código CVV', 'Ingresa el código de seguridad de 3 o 4 dígitos.');
        return;
      }
    }

    this.geospatialRejectionAlert.set('');
    const payload = this.buildCreateOrderPayload();

    this.isSubmitting.set(true);
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
          const emailTarget = this.auth.currentUser()?.email || 'tu correo electrónico';
          this.toast.success(
            `Pedido ${createdOrder.orderNumber} registrado`,
            `Enviamos los detalles de tu compra a ${emailTarget}.`
          );
          void this.router.navigate(['/track'], {
            queryParams: { order: createdOrder.orderNumber, notified: '1' },
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
            this.toast.error('Dirección fuera de cobertura', serverMsg);
          } else {
            this.toast.error('Error al registrar el pedido', serverMsg);
          }
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
