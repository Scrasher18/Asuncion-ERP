export interface CardPaymentRequest {
  orderId: number;
  cardNumber: string;
  cardholderName: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  documentNumber?: string;
  documentType?: string;
  installments?: number;
  email?: string;
  clientIp?: string;
}

export interface CulqiChargeRequest {
  orderId: number;
  tokenId: string;
  email?: string;
  deviceId?: string;
}

export interface CulqiTestCard {
  title: string;
  description: string;
  brand: 'Visa' | 'Mastercard' | 'Amex';
  cardNumber: string;
  expiry: string;
  cvv: string;
  cardholder: string;
  badgeColor: string;
  simulatedResult: 'Éxito' | 'Rechazo / Fondos' | '3DS Autenticación';
}

export const CULQI_TEST_CARDS: CulqiTestCard[] = [
  {
    title: 'Visa Clásica (Éxito)',
    description: 'Venta exitosa sin fricción autorizada por Culqi',
    brand: 'Visa',
    cardNumber: '4111 1111 1111 1111',
    expiry: '12/30',
    cvv: '123',
    cardholder: 'Luis Oscar Perez Castro',
    badgeColor: 'border-blue-200 bg-blue-50 text-blue-700',
    simulatedResult: 'Éxito',
  },
  {
    title: 'Mastercard Estándar (Éxito)',
    description: 'Cargo único aprobado en soles (PEN)',
    brand: 'Mastercard',
    cardNumber: '5400 0000 0000 0005',
    expiry: '01/30',
    cvv: '492',
    cardholder: 'Luis Oscar Perez Castro',
    badgeColor: 'border-orange-200 bg-orange-50 text-orange-700',
    simulatedResult: 'Éxito',
  },
  {
    title: 'Visa 3DS (Autenticación)',
    description: 'Desafío de seguridad 3DS simulado',
    brand: 'Visa',
    cardNumber: '4111 1100 0000 0013',
    expiry: '12/30',
    cvv: '123',
    cardholder: 'Luis Oscar Perez Castro',
    badgeColor: 'border-purple-200 bg-purple-50 text-purple-700',
    simulatedResult: '3DS Autenticación',
  },
  {
    title: 'Fondos Insuficientes (Rechazo)',
    description: 'Simula denegación bancaria por saldo insuficiente',
    brand: 'Mastercard',
    cardNumber: '5400 0000 0000 0005',
    expiry: '01/30',
    cvv: '492',
    cardholder: 'Luis Oscar Perez Castro',
    badgeColor: 'border-red-200 bg-red-50 text-red-700',
    simulatedResult: 'Rechazo / Fondos',
  },
];

export interface CardPaymentResponse {
  success: boolean;
  status: 'APROBADO' | 'RECHAZADO' | 'ERROR';
  transactionId: string;
  authorizationCode: string;
  message: string;
  cardBrand: string;
  cardBank: string;
  cardType: string;
  cardLastFour: string;
  cardholderName: string;
  installments: number;
  amount: number;
  currency: string;
  orderNumber: string;
  orderId: number;
  processedAt: string;
}

export interface BankInstruction {
  bankName: string;
  channel: string;
  serviceName: string;
  step1: string;
  step2: string;
  step3: string;
  badgeColor: string;
}

export interface PagoEfectivoCipRequest {
  orderId: number;
  expirationHours?: number;
}

export interface PagoEfectivoCipResponse {
  success: boolean;
  cipCode: string;
  qrData: string;
  amount: number;
  currency: string;
  expiresAt: string;
  status: 'PENDIENTE_PAGO' | 'APROBADO' | 'EXPIRADO';
  orderNumber: string;
  orderId: number;
  transactionId: string;
  instructions: BankInstruction[];
}

export interface PaymentConfigDto {
  culqiEnabled: boolean;
  culqiPublicKey: string;
  hasCulqiSecret: boolean;
  pagoefectivoEnabled: boolean;
  pagoefectivoServiceId: string;
  hasPagoefectivoSecret: boolean;
  niubizEnabled: boolean;
  niubizMerchantId?: string;
  hasNiubizPassword: boolean;
  environment: 'SANDBOX' | 'PRODUCTION';
  updatedAt: string;
  yapePhone?: string;
  yapeHolder?: string;
  yapeQrImageUrl?: string;
  plinPhone?: string;
  plinHolder?: string;
  plinQrImageUrl?: string;
  walletInstructions?: string;
}

export interface PaymentConfigUpdateRequest {
  culqiEnabled: boolean;
  culqiPublicKey?: string;
  culqiSecretKey?: string;
  pagoefectivoEnabled: boolean;
  pagoefectivoServiceId?: string;
  pagoefectivoSecretKey?: string;
  niubizEnabled: boolean;
  niubizMerchantId?: string;
  niubizUser?: string;
  niubizPassword?: string;
  environment: string;
  yapePhone?: string;
  yapeHolder?: string;
  yapeQrImageUrl?: string;
  plinPhone?: string;
  plinHolder?: string;
  plinQrImageUrl?: string;
  walletInstructions?: string;
}

export interface PaymentTransactionDto {
  id: number;
  orderId: number;
  orderNumber: string;
  paymentMethod: string;
  gatewayProvider: string;
  transactionId: string;
  amount: number;
  currency: string;
  status: string;
  cardBrand?: string;
  cardBank?: string;
  cardType?: string;
  cardLastFour?: string;
  cardholderName?: string;
  installments?: number;
  cipCode?: string;
  cipExpiresAt?: string;
  authorizationCode?: string;
  gatewayReference?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface BankMetadata {
  id: string;
  name: string;
  shortName: string;
  theme: {
    bg: string;
    text: string;
    badgeBg: string;
    badgeBorder: string;
    badgeText: string;
    gradient: string;
  };
}

export interface CardAnalysisResult {
  brand: string;
  bank: string;
  bankCode: string;
  type: 'DEBITO' | 'CREDITO';
  cleanNumber: string;
  formattedNumber: string;
  lastFour: string;
  luhnValid: boolean;
  theme: BankMetadata['theme'];
}
