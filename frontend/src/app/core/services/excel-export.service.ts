import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';
import { resolveOrderBillingMeta, round2 } from '../constants/company-info.constant';
import { Order } from '../models/api.models';

export interface ExcelSalesExportOptions {
  filenamePrefix: string;
  sheetName?: string;
  includeOperationalColumns?: boolean;
  isCounterSaleFn?: (ord: Order) => boolean;
  formatPaymentMethodFn?: (method?: string) => string;
}

@Injectable({ providedIn: 'root' })
export class ExcelExportService {
  /**
   * Generates a real .xlsx workbook following SUNAT accounting structure:
   * - Group 1 (Cols A-F): Fecha, Tipo Comprobante, Serie-Número, Tipo Doc, N° Doc, Nombre/Razón Social
   * - Group 2 (Cols G-I): Base Imponible (=ROUND(I/1.18,2)), IGV 18% (=ROUND(I-G,2)), Importe Total
   */
  exportSunatSalesWorkbook(orders: Order[], options: ExcelSalesExportOptions): number {
    if (!orders || orders.length === 0) return 0;

    const includeOps = options.includeOperationalColumns ?? false;
    const headers = [
      'Fecha',
      'Tipo de Comprobante',
      'Serie y Número',
      'Tipo de Doc. Cliente',
      'N° Documento',
      'Nombre / Razón Social',
      'Base Imponible (Subtotal)',
      'I.G.V. (18%)',
      'Importe Total',
      ...(includeOps
        ? [
            'Canal de Venta',
            'N° Pedido Interno',
            'Gestión Comprobante SUNAT',
            'Método de Pago',
            'Estado Operativo',
            'Estado Pago',
          ]
        : []),
    ];

    const ws: XLSX.WorkSheet = {};
    XLSX.utils.sheet_add_aoa(ws, [headers], { origin: 'A1' });

    let totalBaseSum = 0;
    let totalIgvSum = 0;
    let totalGrossSum = 0;

    orders.forEach((ord, idx) => {
      const excelRow = idx + 2;
      const meta = resolveOrderBillingMeta(ord);
      const fecha = ord.createdAt
        ? new Date(ord.createdAt).toLocaleDateString('es-PE', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })
        : '';

      totalBaseSum = round2(totalBaseSum + meta.baseImponible);
      totalIgvSum = round2(totalIgvSum + meta.igvAmount);
      totalGrossSum = round2(totalGrossSum + meta.totalAmount);

      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 0 })] = { t: 's', v: fecha };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 1 })] = { t: 's', v: meta.docTypeLabel };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 2 })] = { t: 's', v: meta.fullSeriesNumber };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 3 })] = { t: 's', v: meta.customerDocType };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 4 })] = {
        t: 's',
        v: meta.customerDocNumber || '',
      };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 5 })] = { t: 's', v: meta.customerDisplayName };

      // Dynamic Excel formulas deriving Base Imponible (Subtotal) and I.G.V. (18%) from Importe Total
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 6 })] = {
        t: 'n',
        f: `ROUND(I${excelRow}/1.18,2)`,
        v: meta.baseImponible,
        z: '#,##0.00',
      };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 7 })] = {
        t: 'n',
        f: `ROUND(I${excelRow}-G${excelRow},2)`,
        v: meta.igvAmount,
        z: '#,##0.00',
      };
      ws[XLSX.utils.encode_cell({ r: idx + 1, c: 8 })] = {
        t: 'n',
        v: meta.totalAmount,
        z: '#,##0.00',
      };

      if (includeOps) {
        const isPos = options.isCounterSaleFn ? options.isCounterSaleFn(ord) : false;
        const canal = isPos
          ? 'CAJA_POS'
          : ord.deliveryType === 'PICKUP'
            ? 'ONLINE_RECOJO'
            : 'ONLINE_DELIVERY';
        const pmLabel = options.formatPaymentMethodFn
          ? options.formatPaymentMethodFn(ord.paymentMethod)
          : ord.paymentMethod || 'CONTADO';
        const pmUpper = (ord.paymentMethod || '').toUpperCase();
        const isPaid =
          ord.status === 'ENTREGADO' ||
          pmUpper.includes('TARJETA') ||
          pmUpper.includes('CULQI') ||
          pmUpper.includes('CARD') ||
          pmUpper === 'PAGO_ONLINE';

        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 9 })] = { t: 's', v: canal };
        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 10 })] = { t: 's', v: ord.orderNumber || '' };
        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 11 })] = {
          t: 's',
          v: meta.isFactura ? 'Proforma → Factura SUNAT vía WhatsApp' : 'Boleta interna',
        };
        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 12 })] = { t: 's', v: pmLabel };
        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 13 })] = { t: 's', v: ord.status || 'CONFIRMADO' };
        ws[XLSX.utils.encode_cell({ r: idx + 1, c: 14 })] = {
          t: 's',
          v: isPaid ? 'PAGADO' : 'FALTA COBRAR',
        };
      }
    });

    const lastDataRow = orders.length + 1;
    const totalsRowIdx = orders.length + 1;
    const totalsExcelRow = totalsRowIdx + 1;

    ws[XLSX.utils.encode_cell({ r: totalsRowIdx, c: 5 })] = { t: 's', v: 'TOTALES GENERALES' };
    ws[XLSX.utils.encode_cell({ r: totalsRowIdx, c: 6 })] = {
      t: 'n',
      f: `SUM(G2:G${lastDataRow})`,
      v: totalBaseSum,
      z: '#,##0.00',
    };
    ws[XLSX.utils.encode_cell({ r: totalsRowIdx, c: 7 })] = {
      t: 'n',
      f: `SUM(H2:H${lastDataRow})`,
      v: totalIgvSum,
      z: '#,##0.00',
    };
    ws[XLSX.utils.encode_cell({ r: totalsRowIdx, c: 8 })] = {
      t: 'n',
      f: `SUM(I2:I${lastDataRow})`,
      v: totalGrossSum,
      z: '#,##0.00',
    };

    ws['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: totalsExcelRow - 1, c: headers.length - 1 },
    });

    ws['!cols'] = [
      { wch: 13 }, // Fecha
      { wch: 19 }, // Tipo Comprobante
      { wch: 17 }, // Serie y Número
      { wch: 18 }, // Tipo Doc Cliente
      { wch: 15 }, // N° Documento
      { wch: 36 }, // Nombre / Razón Social
      { wch: 24 }, // Base Imponible
      { wch: 16 }, // I.G.V. (18%)
      { wch: 16 }, // Importe Total
      ...(includeOps
        ? [{ wch: 18 }, { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 20 }, { wch: 15 }]
        : []),
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (options.sheetName || 'Registro Ventas').slice(0, 31));
    const dateStamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `${options.filenamePrefix}_${dateStamp}.xlsx`);
    return orders.length;
  }
}
