import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { ApiConfigService } from './api-config.service';
import {
  CardAnalysisResult,
  CardPaymentRequest,
  CardPaymentResponse,
  CulqiChargeRequest,
  PagoEfectivoCipRequest,
  PagoEfectivoCipResponse,
  PaymentConfigDto,
  PaymentConfigUpdateRequest,
  PaymentTransactionDto,
} from '../models/payment.models';

const PERU_BANKS: Record<
  string,
  {
    name: string;
    shortName: string;
    regex: RegExp;
    isDebit: RegExp;
    theme: CardAnalysisResult['theme'];
  }
> = {
  bcp: {
    name: 'Banco de Crédito del Perú (BCP)',
    shortName: 'BCP',
    regex: /^(4557|4213|4169|4214|4916|4917|4188|4766|5306|5160|5258|5458)/,
    isDebit: /^(4557|4169|4214)/,
    theme: {
      bg: '#002A8F',
      text: '#FFFFFF',
      badgeBg: 'bg-blue-900',
      badgeBorder: 'border-blue-700',
      badgeText: 'text-orange-400',
      gradient: 'from-[#002A8F] via-[#001D66] to-[#0A1931]',
    },
  },
  interbank: {
    name: 'Interbank Perú',
    shortName: 'Interbank',
    regex: /^(4097|4543|4187|4242|4629|5406|5522|5310|5235|3777|3767|3766)/,
    isDebit: /^(4097|4187|4242)/,
    theme: {
      bg: '#0039A6',
      text: '#FFFFFF',
      badgeBg: 'bg-emerald-900',
      badgeBorder: 'border-emerald-600',
      badgeText: 'text-emerald-300',
      gradient: 'from-[#0039A6] via-[#002875] to-[#064E3B]',
    },
  },
  bbva: {
    name: 'BBVA Perú',
    shortName: 'BBVA',
    regex: /^(4551|4919|4098|4280|4729|5282|5488|5125)/,
    isDebit: /^(4551|4098|4280)/,
    theme: {
      bg: '#004481',
      text: '#FFFFFF',
      badgeBg: 'bg-sky-950',
      badgeBorder: 'border-sky-600',
      badgeText: 'text-sky-300',
      gradient: 'from-[#004481] via-[#002A50] to-[#0B1E36]',
    },
  },
  scotiabank: {
    name: 'Scotiabank Perú',
    shortName: 'Scotiabank',
    regex: /^(4532|4286|4040|4177|5126|5470|5287)/,
    isDebit: /^(4532|4040)/,
    theme: {
      bg: '#EC111A',
      text: '#FFFFFF',
      badgeBg: 'bg-red-950',
      badgeBorder: 'border-red-600',
      badgeText: 'text-red-200',
      gradient: 'from-[#B91C1C] via-[#991B1B] to-[#450A0A]',
    },
  },
  falabella: {
    name: 'Banco Falabella / CMR',
    shortName: 'Falabella CMR',
    regex: /^(4218|4742|4547|5107|5322)/,
    isDebit: /^(4547)/,
    theme: {
      bg: '#3F6212',
      text: '#FFFFFF',
      badgeBg: 'bg-lime-950',
      badgeBorder: 'border-lime-600',
      badgeText: 'text-lime-300',
      gradient: 'from-[#3F6212] via-[#2D450B] to-[#1A2E05]',
    },
  },
  ripley: {
    name: 'Banco Ripley',
    shortName: 'Ripley',
    regex: /^(4217|5256|5438)/,
    isDebit: /^$/,
    theme: {
      bg: '#6B21A8',
      text: '#FFFFFF',
      badgeBg: 'bg-purple-950',
      badgeBorder: 'border-purple-600',
      badgeText: 'text-purple-300',
      gradient: 'from-[#6B21A8] via-[#4C1D95] to-[#2E1065]',
    },
  },
  banbif: {
    name: 'BanBif (Banco Interamericano de Finanzas)',
    shortName: 'BanBif',
    regex: /^(4509|4245|4244|5497|5221)/,
    isDebit: /^(4509)/,
    theme: {
      bg: '#0E7490',
      text: '#FFFFFF',
      badgeBg: 'bg-cyan-950',
      badgeBorder: 'border-cyan-600',
      badgeText: 'text-cyan-300',
      gradient: 'from-[#0E7490] via-[#155E75] to-[#083344]',
    },
  },
  bancoNacion: {
    name: 'Banco de la Nación (Multired)',
    shortName: 'Banco de la Nación',
    regex: /^(4214|4169|4917)/,
    isDebit: /^(4214|4169|4917)/,
    theme: {
      bg: '#991B1B',
      text: '#FFFFFF',
      badgeBg: 'bg-red-950',
      badgeBorder: 'border-red-700',
      badgeText: 'text-red-300',
      gradient: 'from-[#7F1D1D] via-[#5A1414] to-[#360808]',
    },
  },
  pichincha: {
    name: 'Banco Pichincha',
    shortName: 'Pichincha',
    regex: /^(4548|5393|4150)/,
    isDebit: /^(4548)/,
    theme: {
      bg: '#1E3A8A',
      text: '#FFFFFF',
      badgeBg: 'bg-blue-950',
      badgeBorder: 'border-yellow-500',
      badgeText: 'text-yellow-300',
      gradient: 'from-[#1E3A8A] via-[#172554] to-[#0F172A]',
    },
  },
};

const DEFAULT_THEME: CardAnalysisResult['theme'] = {
  bg: '#1E293B',
  text: '#FFFFFF',
  badgeBg: 'bg-gray-800',
  badgeBorder: 'border-gray-700',
  badgeText: 'text-orange-300',
  gradient: 'from-[#1E293B] via-[#0F172A] to-[#020617]',
};


export interface StoreWalletConfig {
  yapeEnabled: boolean;
  yapePhone: string;
  yapeHolder: string;
  yapeQrImageUrl?: string;
  plinEnabled: boolean;
  plinPhone: string;
  plinHolder: string;
  plinQrImageUrl?: string;
  walletInstructions: string;
  bcpEnabled: boolean;
  bcpAccount: string;
  bcpCci: string;
  bcpHolder: string;
  bbvaEnabled: boolean;
  bbvaAccount: string;
  bbvaCci: string;
  bbvaHolder: string;
  interbankEnabled: boolean;
  interbankAccount: string;
  interbankCci: string;
  interbankHolder: string;
  codCashEnabled: boolean;
  codPosEnabled: boolean;
  codMaxAmount: number;
}

export const DEFAULT_WALLET_CONFIG: StoreWalletConfig = {
  yapeEnabled: true,
  yapePhone: '922779157',
  yapeHolder: 'Repuestos Automotrices Asunción S.A.C.',
  yapeQrImageUrl: '/images/qr/qr-yape-default.svg',
  plinEnabled: true,
  plinPhone: '922779157',
  plinHolder: 'Repuestos Automotrices Asunción S.A.C.',
  plinQrImageUrl: '/images/qr/qr-plin-default.svg',
  walletInstructions: 'Envía la constancia o captura de tu pago al WhatsApp +51 922779157 indicando tu N° de Pedido.',
  bcpEnabled: true,
  bcpAccount: '193-98765432-0-12',
  bcpCci: '002-193-009876543201-12',
  bcpHolder: 'Repuestos Automotrices Asunción S.A.C.',
  bbvaEnabled: true,
  bbvaAccount: '0011-0123-0100045678',
  bbvaCci: '011-123-000100045678-45',
  bbvaHolder: 'Repuestos Automotrices Asunción S.A.C.',
  interbankEnabled: true,
  interbankAccount: '200-3001234567',
  interbankCci: '003-200-003001234567-89',
  interbankHolder: 'Repuestos Automotrices Asunción S.A.C.',
  codCashEnabled: true,
  codPosEnabled: true,
  codMaxAmount: 1500,
};

@Injectable({
  providedIn: 'root',
})
export class PaymentService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  private get baseUrl(): string {
    return `${this.apiConfig.apiUrl}/payments`;
  }

  private get adminUrl(): string {
    return `${this.apiConfig.apiUrl}/admin/payments`;
  }

  /**
   * Real-time BIN analysis for Peruvian banks and card brands.
   */
  analyzeCardRealtime(rawNumber: string): CardAnalysisResult {
    const clean = (rawNumber || '').replace(/\D/g, '');
    const lastFour = clean.length >= 4 ? clean.slice(-4) : clean;
    const luhnValid = this.validateLuhn(clean);

    let brand = 'Tarjeta';
    if (clean.startsWith('4')) {
      brand = 'Visa';
    } else if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(clean)) {
      brand = 'Mastercard';
    } else if (/^(34|37)/.test(clean)) {
      brand = 'American Express';
    } else if (/^(36|38|30[0-5]|3095)/.test(clean)) {
      brand = 'Diners Club';
    } else if (/^(6011|65|64[4-9])/.test(clean)) {
      brand = 'Discover';
    }

    let bank = 'Banco emisor';
    let bankCode = 'general';
    let type: 'DEBITO' | 'CREDITO' = 'CREDITO';
    let theme = DEFAULT_THEME;

    for (const [key, b] of Object.entries(PERU_BANKS)) {
      if (b.regex.test(clean)) {
        bank = b.name;
        bankCode = key;
        type = b.isDebit.test(clean) ? 'DEBITO' : 'CREDITO';
        theme = b.theme;
        break;
      }
    }

    if (bankCode === 'general') {
      if (brand === 'Visa') bank = 'Visa Internacional';
      else if (brand === 'Mastercard') bank = 'Mastercard Internacional';
      else if (brand === 'American Express') bank = 'American Express';
      else if (brand === 'Diners Club') bank = 'Diners Club Internacional';
    }

    // Format card number with groupings
    let formattedNumber = clean;
    if (brand === 'American Express') {
      // 4-6-5
      const p1 = clean.slice(0, 4);
      const p2 = clean.slice(4, 10);
      const p3 = clean.slice(10, 15);
      formattedNumber = [p1, p2, p3].filter(Boolean).join(' ');
    } else {
      // 4-4-4-4
      const parts = clean.match(/.{1,4}/g);
      formattedNumber = parts ? parts.join(' ') : clean;
    }

    return {
      brand,
      bank,
      bankCode,
      type,
      cleanNumber: clean,
      formattedNumber,
      lastFour,
      luhnValid,
      theme,
    };
  }

  /**
   * Format expiry date with automatic slash MM/YY
   */
  formatExpiry(rawValue: string): string {
    const clean = rawValue.replace(/\D/g, '').slice(0, 4);
    if (clean.length <= 2) return clean;
    return `${clean.slice(0, 2)}/${clean.slice(2)}`;
  }

  /**
   * Luhn algorithm validation
   */
  validateLuhn(cardNumber: string): boolean {
    if (!cardNumber || cardNumber.length < 13 || cardNumber.length > 19) {
      return false;
    }
    let sum = 0;
    let alternate = false;
    for (let i = cardNumber.length - 1; i >= 0; i--) {
      let n = parseInt(cardNumber.charAt(i), 10);
      if (isNaN(n)) return false;
      if (alternate) {
        n *= 2;
        if (n > 9) n = (n % 10) + 1;
      }
      sum += n;
      alternate = !alternate;
    }
    return sum % 10 === 0;
  }

  // ===================== HTTP ENDPOINTS =====================

  getPublicConfig(): Observable<PaymentConfigDto> {
    return this.http.get<PaymentConfigDto>(`${this.baseUrl}/config`);
  }

  processCardPayment(req: CardPaymentRequest): Observable<CardPaymentResponse> {
    return this.http.post<CardPaymentResponse>(`${this.baseUrl}/card/process`, req);
  }

  processCulqiCharge(req: CulqiChargeRequest): Observable<CardPaymentResponse> {
    return this.http.post<CardPaymentResponse>(`${this.baseUrl}/culqi/charge`, req);
  }

  /**
   * Opens official Culqi Checkout v4 modal and returns a Promise with token, order, error, or closed state
   */
  openCulqiCheckout(options: {
    title: string;
    currency: string;
    amount: number;
    publicKey: string;
    email?: string;
  }): Promise<{ token?: any; order?: any; error?: any; closed?: boolean }> {
    return new Promise((resolve) => {
      const win = window as any;
      if (typeof win.Culqi === 'undefined') {
        resolve({
          error: {
            user_message:
              'No se pudo inicializar Culqi Checkout. Verifica tu conexión o recarga la página.',
          },
        });
        return;
      }

      const Culqi = win.Culqi;
      Culqi.publicKey = options.publicKey || 'pk_test_E1MAjdXpMaux0f3u';

      Culqi.settings({
        title: options.title || 'Autopartes Asunción',
        currency: options.currency || 'PEN',
        amount: Math.round(options.amount * 100),
      });

      Culqi.options({
        lang: 'es',
        installments: false,
        paymentMethods: {
          tarjeta: true,
          yape: true,
          bancaMovil: true,
          agente: true,
          billetera: true,
          cuotealo: true,
        },
        style: {
          bannerColor: '#ea580c',
          buttonBackground: '#ea580c',
          menuColor: '#ea580c',
          linksColor: '#ea580c',
          buttonTextColor: '#ffffff',
          priceColor: '#ea580c',
        },
      });

      let handled = false;
      let checkInterval: any = null;

      const finishClose = () => {
        if (handled) return;
        handled = true;
        cleanup();
        this.closeCulqiModal();
        resolve({ closed: true });
      };

      const cleanup = () => {
        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
        if (typeof window !== 'undefined') {
          window.removeEventListener('message', onMessage);
          window.removeEventListener('keydown', onKeyDown);
        }
      };

      const onMessage = (event: MessageEvent) => {
        if (handled) return;
        const data = event.data;
        if (!data) return;
        if (typeof data === 'string') {
          const lower = data.toLowerCase();
          if (lower.includes('close') || lower.includes('cerrar') || lower.includes('closed') || lower.includes('cancel')) {
            finishClose();
          }
        } else if (typeof data === 'object') {
          try {
            const str = JSON.stringify(data).toLowerCase();
            if (str.includes('close') || str.includes('cerrar') || lowerStr(str)) {
              finishClose();
            }
          } catch (e) {}
        }
      };

      const lowerStr = (s: string) => s.includes('close') || s.includes('cerrar') || s.includes('checkout_closed');

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          finishClose();
        }
      };

      if (typeof window !== 'undefined') {
        window.addEventListener('message', onMessage);
        window.addEventListener('keydown', onKeyDown);

        let frameAppeared = false;
        checkInterval = setInterval(() => {
          if (handled) {
            cleanup();
            return;
          }
          const frame = document.querySelector(
            '#culqi_checkout_frame, #culqi-container, iframe[src*="culqi.com"], iframe[src*="checkout.culqi.com"], .culqi_overlay'
          ) as HTMLElement | null;

          if (frame) {
            frameAppeared = true;
            try {
              const style = window.getComputedStyle(frame);
              if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
                finishClose();
              }
            } catch (e) {}
          } else if (frameAppeared) {
            finishClose();
          }
        }, 300);
      }

      win.culqi = () => {
        if (handled) return;
        if (Culqi.token) {
          handled = true;
          cleanup();
          this.closeCulqiModal();
          resolve({ token: Culqi.token });
        } else if (Culqi.order) {
          handled = true;
          cleanup();
          this.closeCulqiModal();
          resolve({ order: Culqi.order });
        } else if (Culqi.close) {
          finishClose();
        } else if (Culqi.error) {
          handled = true;
          cleanup();
          resolve({ error: Culqi.error });
        }
      };

      Culqi.open();
    });
  }

  /**
   * Closes and cleans up the Culqi Checkout modal and overlay from the DOM automatically
   */
  closeCulqiModal(): void {
    const win = typeof window !== 'undefined' ? (window as any) : null;
    if (!win) return;
    try {
      if (win.Culqi && typeof win.Culqi.close === 'function') {
        win.Culqi.close();
      }
    } catch (e) {
      console.warn('Culqi.close error:', e);
    }
    const removeCulqiElements = () => {
      try {
        const selectors = [
          '#culqi-container',
          '#culqi_checkout_frame',
          'iframe[src*="culqi.com"]',
          'iframe[src*="checkout.culqi.com"]',
          '.culqi_overlay',
          '.culqi-modal',
          '.culqi-checkout',
          '.culqi-container',
          'div[style*="z-index: 999999"]',
          'div[style*="z-index: 99999"]'
        ];
        selectors.forEach((sel) => {
          document.querySelectorAll(sel).forEach((el) => {
            const h = el as HTMLElement;
            h.style.display = 'none';
            h.style.visibility = 'hidden';
            h.style.pointerEvents = 'none';
            if (h.parentNode) {
              h.parentNode.removeChild(h);
            }
          });
        });
        if (typeof document !== 'undefined' && document.body) {
          document.body.style.overflow = '';
        }
      } catch (e) {}
    };
    removeCulqiElements();
    setTimeout(removeCulqiElements, 40);
    setTimeout(removeCulqiElements, 200);
  }

  generateCip(req: PagoEfectivoCipRequest): Observable<PagoEfectivoCipResponse> {
    return this.http.post<PagoEfectivoCipResponse>(`${this.baseUrl}/pagoefectivo/generate-cip`, req);
  }

  checkCipStatus(orderId: number): Observable<PagoEfectivoCipResponse> {
    return this.http.get<PagoEfectivoCipResponse>(`${this.baseUrl}/pagoefectivo/status/${orderId}`);
  }

  simulateCipPayment(orderId: number): Observable<CardPaymentResponse> {
    return this.http.post<CardPaymentResponse>(`${this.baseUrl}/pagoefectivo/simulate-payment/${orderId}`, {});
  }

  // Admin endpoints
  getAdminConfig(): Observable<PaymentConfigDto> {
    return this.http.get<PaymentConfigDto>(`${this.adminUrl}/config`);
  }

  updateAdminConfig(req: PaymentConfigUpdateRequest): Observable<PaymentConfigDto> {
    return this.http.put<PaymentConfigDto>(`${this.adminUrl}/config`, req);
  }

  getRecentTransactions(): Observable<PaymentTransactionDto[]> {
    return this.http.get<PaymentTransactionDto[]>(`${this.adminUrl}/transactions`);
  }
  private cachedWalletConfig: StoreWalletConfig | null = null;

  getStoreWalletConfig(): StoreWalletConfig {
    if (this.cachedWalletConfig) {
      return this.cachedWalletConfig;
    }
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('asuncion_store_payment_methods');
        if (stored) {
          const parsedCfg = { ...DEFAULT_WALLET_CONFIG, ...JSON.parse(stored) };
          this.cachedWalletConfig = parsedCfg;
          return parsedCfg;
        }
      } catch (e) {}
    }
    return DEFAULT_WALLET_CONFIG;
  }

  saveStoreWalletConfig(cfg: StoreWalletConfig): void {
    this.cachedWalletConfig = cfg;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('asuncion_store_payment_methods', JSON.stringify(cfg));
      } catch (e) {}
    }
  }

  fetchStoreWalletConfig(): Observable<StoreWalletConfig> {
    return this.getPublicConfig().pipe(
      map((cfg) => {
        const current = this.getStoreWalletConfig();
        const updated: StoreWalletConfig = {
          ...current,
          yapePhone: cfg.yapePhone || current.yapePhone,
          yapeHolder: cfg.yapeHolder || current.yapeHolder,
          yapeQrImageUrl: cfg.yapeQrImageUrl || current.yapeQrImageUrl,
          plinPhone: cfg.plinPhone || current.plinPhone,
          plinHolder: cfg.plinHolder || current.plinHolder,
          plinQrImageUrl: cfg.plinQrImageUrl || current.plinQrImageUrl,
          walletInstructions: cfg.walletInstructions || current.walletInstructions,
        };
        this.saveStoreWalletConfig(updated);
        return updated;
      }),
      catchError(() => of(this.getStoreWalletConfig()))
    );
  }
}
