import { Order } from '../models/api.models';

export const COMPANY_RUC = '10414686867';
export const COMPANY_NAME = 'REPUESTOS AUTOMOTRICES ASUNCIÓN';
export const COMPANY_TAGLINE = 'Venta de Autopartes, Filtros, Bujías, Lubricantes y Repuestos Multimarca';
export const COMPANY_ADDRESS = 'Av. Sta. Ana 441, Santa Anita, Lima - Perú';
export const COMPANY_PHONES = '+51 922 779 157 / (01) 362-8900';
export const COMPANY_EMAIL = 'ventas@asuncion.pe';
export const COMPANY_PORTAL = 'https://asucionfrontend.vercel.app';
export const BOLETA_DNI_REQUIRED_THRESHOLD = 700;

export interface ResolvedOrderBillingMeta {
  isFactura: boolean;
  docTypeLabel: 'FACTURA' | 'BOLETA';
  docTitle: 'FACTURA ELECTRÓNICA' | 'BOLETA DE VENTA ELECTRÓNICA';
  serie: 'F001' | 'B001';
  correlativo: string;
  fullSeriesNumber: string;
  customerDocType: 'RUC' | 'DNI' | 'C.E.' | '-';
  customerDocNumber: string;
  customerDisplayName: string;
  fiscalAddress: string;
  totalAmount: number;
  baseImponible: number;
  igvAmount: number;
}

export function round2(value: number): number {
  return Number((Number.isFinite(value) ? value : 0).toFixed(2));
}

export function isAnonymousBillingName(name?: string | null): boolean {
  const clean = (name || '').trim().toUpperCase();
  if (!clean) return true;
  return (
    clean === 'CLIENTES VARIOS' ||
    clean === 'CLIENTE EN CAJA' ||
    clean === 'CLIENTE GENERAL' ||
    clean === 'CLIENTE DE MOSTRADOR' ||
    clean === 'CONSUMIDOR FINAL'
  );
}

export function extractVoucherCorrelative(orderNumber?: string, orderId?: number): string {
  const match = (orderNumber || '').trim().match(/(\d+)$/);
  const numericSeq = match ? Number.parseInt(match[1], 10) : (orderId ?? 1);
  const safeSeq = Number.isFinite(numericSeq) && numericSeq > 0 ? numericSeq : 1;
  return String(safeSeq).padStart(8, '0');
}

/**
 * Resolves SUNAT-compliant voucher classification, series, customer identity,
 * and IGV-included totals consistently across PDFs, UI previews, and Excel exports.
 */
export function resolveOrderBillingMeta(order: Order): ResolvedOrderBillingMeta {
  const rawDoc = (order.customerTaxId || order.billingDocumentNumber || '').trim();
  const cleanDoc = /^0+$/.test(rawDoc) ? '' : rawDoc;
  const digits = cleanDoc.replace(/\D/g, '');

  const isFactura =
    digits.length === 11 || (order.invoiceType === 'FACTURA' && digits.length !== 8);
  const docTypeLabel: 'FACTURA' | 'BOLETA' = isFactura ? 'FACTURA' : 'BOLETA';
  const docTitle = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
  const serie: 'F001' | 'B001' = isFactura ? 'F001' : 'B001';
  const correlativo = extractVoucherCorrelative(order.orderNumber, order.id);
  const fullSeriesNumber = `${serie}-${correlativo}`;

  let customerDocType: 'RUC' | 'DNI' | 'C.E.' | '-' = '-';
  if (isFactura && digits.length === 11) {
    customerDocType = 'RUC';
  } else if (digits.length === 8) {
    customerDocType = 'DNI';
  } else if (cleanDoc.length > 0) {
    customerDocType = 'C.E.';
  }

  const rawPartyName = (
    order.billingBusinessName ||
    order.customerBusinessName ||
    order.recipientName ||
    order.customerName ||
    ''
  ).trim();

  const totalAmount = round2(Number(order.totalAmount ?? order.total ?? order.subtotal ?? 0));
  const customerDisplayName =
    !isFactura && isAnonymousBillingName(rawPartyName)
      ? 'CLIENTES VARIOS'
      : rawPartyName || 'CLIENTES VARIOS';

  const fiscalAddress = isFactura
    ? (
        order.billingAddress ||
        order.deliveryAddress ||
        order.branchAddress ||
        'Domicilio Fiscal Registrado'
      ).trim()
    : order.deliveryType === 'DELIVERY'
      ? (order.deliveryAddress || '').trim()
      : '';

  const baseImponible = round2(totalAmount / 1.18);
  const igvAmount = round2(totalAmount - baseImponible);

  return {
    isFactura,
    docTypeLabel,
    docTitle,
    serie,
    correlativo,
    fullSeriesNumber,
    customerDocType,
    customerDocNumber: isFactura ? digits : cleanDoc,
    customerDisplayName,
    fiscalAddress,
    totalAmount,
    baseImponible,
    igvAmount,
  };
}
