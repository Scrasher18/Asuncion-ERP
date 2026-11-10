import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  COMPANY_ADDRESS,
  COMPANY_EMAIL,
  COMPANY_NAME,
  COMPANY_PHONES,
  COMPANY_PORTAL,
  COMPANY_RUC,
  COMPANY_TAGLINE,
  resolveOrderBillingMeta,
  round2,
} from '../constants/company-info.constant';
import { COMPANY_LOGO_BASE64 } from '../constants/company-logo.constant';
import { Order } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class PdfInvoiceService {
  generateInvoicePdf(order: Order, download = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const meta = resolveOrderBillingMeta(order);
    const isFactura = meta.isFactura;
    const isPickupOrCounter = order.deliveryType !== 'DELIVERY';

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, 210, 6, 'F');

    // 1. Company Logo (Top-Left)
    try {
      doc.addImage(COMPANY_LOGO_BASE64, 'JPEG', 14, 11, 24, 24);
    } catch (e) {
      console.warn('Could not render logo in PDF:', e);
    }

    // 2. Company Brand Name & Info
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(234, 88, 12); // #EA580C
    doc.text('REPUESTOS AUTOMOTRICES', 41, 17);
    doc.text('ASUNCIÓN', 41, 22.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(COMPANY_TAGLINE, 41, 27);
    doc.text(`Sede Central: ${COMPANY_ADDRESS}`, 41, 31);
    doc.text(`Teléfonos: ${COMPANY_PHONES}  |  ${COMPANY_EMAIL}`, 41, 35);
    doc.text(`Portal Web: ${COMPANY_PORTAL}`, 41, 39);

    // 3. Document Box (RUC & Comprobante)
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.setFillColor(255, 247, 237);
    doc.roundedRect(130, 11, 66, 29, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text(`R.U.C. ${COMPANY_RUC}`, 163, 17.5, { align: 'center' });

    doc.setFillColor(isFactura ? 30 : 234, isFactura ? 64 : 88, isFactura ? 175 : 12);
    doc.rect(130, 21, 66, 7.5, 'F');
    doc.setFontSize(8.2);
    doc.setTextColor(255, 255, 255);
    doc.text(meta.docTitle, 163, 26, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(isFactura ? 30 : 234, isFactura ? 64 : 88, isFactura ? 175 : 12);
    doc.text(`N° ${meta.fullSeriesNumber}`, 163, 35.5, { align: 'center' });

    // Horizontal separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 44, 196, 44);

    // Customer & Transaction Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 47, 182, 35, 1.5, 1.5, 'FD');

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
      : new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

    doc.setFontSize(8.2);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isFactura ? 'Señor(es):' : 'Cliente:', 18, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(doc.splitTextToSize(meta.customerDisplayName, 86)[0] || meta.customerDisplayName, 43, 54);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isFactura ? 'R.U.C.:' : 'D.N.I. / C.E.:', 18, 60);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const docDisplay = meta.customerDocNumber
      ? meta.customerDocNumber
      : '--- (No requerido < S/ 700)';
    doc.text(docDisplay, 43, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isFactura ? 'Dirección Fiscal:' : 'Dirección:', 18, 66);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const addrDisplay = meta.fiscalAddress || '(Opcional en boleta)';
    doc.text(doc.splitTextToSize(addrDisplay, 86), 43, 66);

    // Right Column in customer box
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Fecha de Emisión:', 132, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(formattedDate, 162, 54);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Tipo de Moneda:', 132, 60);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('Soles (PEN / S/)', 162, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Forma de Pago:', 132, 66);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const methodClean = (order.paymentMethod || 'CONTADO')
      .replace(/^MOSTRADOR_/, '')
      .replace(/_/g, ' ');
    doc.text(methodClean.slice(0, 22), 162, 66);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Pedido Interno:', 132, 72);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(order.orderNumber || '-', 162, 72);

    // Table Header
    let yPos = 87;
    doc.setFillColor(234, 88, 12);
    doc.roundedRect(14, yPos, 182, 7.5, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Cant.', 19, yPos + 5, { align: 'center' });
    doc.text('Unidad', 31, yPos + 5, { align: 'center' });
    doc.text('Código', 42, yPos + 5);
    doc.text('Descripción', 69, yPos + 5);
    doc.text(isFactura ? 'V. Unit.' : 'P. Unit.', 164, yPos + 5, { align: 'right' });
    doc.text(isFactura ? 'Valor Total' : 'Precio Total', 192, yPos + 5, { align: 'right' });

    const deliveryFee = round2(Number(order.deliveryFee || 0));
    const items = order.items || [];
    const rawItemsSum = round2(
      items.reduce(
        (acc, it) => acc + (it.subtotal ?? it.lineTotal ?? (it.unitPrice || 0) * (it.quantity || 1)),
        0
      )
    );
    const productsGrossTarget = Math.max(0, round2(meta.totalAmount - deliveryFee));
    // Backward compatibility: older orders saved item prices pre-tax (total ≈ itemsSum * 1.18 + fee)
    const isHistoricalPreTaxItems =
      rawItemsSum > 0 && Math.abs(productsGrossTarget - rawItemsSum * 1.18) <= Math.max(0.25, rawItemsSum * 0.02);

    yPos += 8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let rowIdx = 1;
    for (const it of items) {
      if (yPos > 228) {
        doc.addPage();
        yPos = 20;
      }

      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos - 1, 182, 8, 'F');
      }

      const rawUnit = Number(it.unitPrice || 0);
      const rawLine = Number(it.subtotal ?? it.lineTotal ?? rawUnit * (it.quantity || 1));

      const displayUnit = isFactura
        ? isHistoricalPreTaxItems
          ? rawUnit
          : round2(rawUnit / 1.18)
        : isHistoricalPreTaxItems
          ? round2(rawUnit * 1.18)
          : rawUnit;

      const displayLine = isFactura
        ? isHistoricalPreTaxItems
          ? rawLine
          : round2(rawLine / 1.18)
        : isHistoricalPreTaxItems
          ? round2(rawLine * 1.18)
          : rawLine;

      doc.setTextColor(51, 65, 85);
      doc.text(String(it.quantity).padStart(2, '0'), 19, yPos + 4, { align: 'center' });
      doc.text('Unid.', 31, yPos + 4, { align: 'center' });

      const code = it.partSku || it.sku || it.partOemCode || it.oemCode || '-';
      doc.setFont('courier', 'bold');
      doc.text(code.substring(0, 12), 42, yPos + 4);
      doc.setFont('helvetica', 'normal');

      const desc = it.partName || it.name || 'Repuesto Automotriz';
      doc.text(desc.substring(0, 44), 69, yPos + 4);

      doc.text(`S/ ${displayUnit.toFixed(2)}`, 164, yPos + 4, { align: 'right' });
      doc.text(`S/ ${displayLine.toFixed(2)}`, 192, yPos + 4, { align: 'right' });

      doc.setDrawColor(241, 245, 249);
      doc.line(14, yPos + 7, 196, yPos + 7);

      yPos += 8;
      rowIdx++;
    }

    if (deliveryFee > 0) {
      const displayDelivery = isFactura ? round2(deliveryFee / 1.18) : deliveryFee;
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos - 1, 182, 8, 'F');
      }
      doc.setTextColor(51, 65, 85);
      doc.text('01', 19, yPos + 4, { align: 'center' });
      doc.text('Serv.', 31, yPos + 4, { align: 'center' });
      doc.setFont('courier', 'bold');
      doc.text('ENV-DELIV', 42, yPos + 4);
      doc.setFont('helvetica', 'normal');
      doc.text('Servicio de Envío / Despacho a Domicilio', 69, yPos + 4);
      doc.text(`S/ ${displayDelivery.toFixed(2)}`, 164, yPos + 4, { align: 'right' });
      doc.text(`S/ ${displayDelivery.toFixed(2)}`, 192, yPos + 4, { align: 'right' });
      yPos += 8;
    }

    // Totals & QR Section
    if (yPos > 224) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos += 5;
    }

    // Summary Box (Right)
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(118, yPos, 78, 34, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    if (isFactura) {
      doc.text('Op. Gravada (sin IGV):', 122, yPos + 7);
      doc.text(`S/ ${meta.baseImponible.toFixed(2)}`, 192, yPos + 7, { align: 'right' });

      doc.text('I.G.V. (18%):', 122, yPos + 14);
      doc.text(`S/ ${meta.igvAmount.toFixed(2)}`, 192, yPos + 14, { align: 'right' });
    } else {
      doc.text('Op. Gravada:', 122, yPos + 7);
      doc.text('S/ 0.00', 192, yPos + 7, { align: 'right' });

      doc.text('I.G.V. (18% - Incluido):', 122, yPos + 14);
      doc.text('S/ 0.00', 192, yPos + 14, { align: 'right' });
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(122, yPos + 19, 192, yPos + 19);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(234, 88, 12);
    doc.text('IMPORTE TOTAL:', 122, yPos + 27);
    doc.text(`S/ ${meta.totalAmount.toFixed(2)}`, 192, yPos + 27, { align: 'right' });

    // Vector QR Code (Left, SUNAT format payload)
    const isoDate = order.createdAt
      ? new Date(order.createdAt).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const sunatDocCode = isFactura ? '01' : '03';
    const clientDocCode = meta.customerDocType === 'RUC' ? '6' : meta.customerDocType === 'DNI' ? '1' : '0';
    const qrPayload = [
      COMPANY_RUC,
      sunatDocCode,
      meta.serie,
      meta.correlativo,
      isFactura ? meta.igvAmount.toFixed(2) : '0.00',
      meta.totalAmount.toFixed(2),
      isoDate,
      clientDocCode,
      meta.customerDocNumber || '-',
      '',
    ].join('|');

    this.drawQrCode(doc, qrPayload, 14, yPos, 26);

    // Additional Notes next to QR
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.4);
    doc.setTextColor(71, 85, 105);
    if (isFactura) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 64, 175);
      doc.text('PROFORMA PARA FACTURA — ENVÍO SUNAT POR WHATSAPP', 43, yPos + 5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text('No usamos envío automático por correo. Con estos datos emitiremos su', 43, yPos + 10);
      doc.text(`Factura Electrónica en SUNAT y se enviará al WhatsApp ${order.recipientPhone || 'del cliente'}.`, 43, yPos + 15);
      doc.text(`Pedido: ${order.orderNumber || '-'} · Estado: ${order.status || 'CONFIRMADO'} · Moneda: SOLES.`, 43, yPos + 20);
    } else {
      doc.text('El precio publicado y cobrado ya incluye el I.G.V. (18%).', 43, yPos + 5);
      doc.text('Moneda: SOLES · Garantía de fábrica 6 a 12 meses según marca.', 43, yPos + 10);
      doc.text(`Estado operativo: ${order.status || 'CONFIRMADO'}`, 43, yPos + 15);
      doc.text(isPickupOrCounter ? 'Entrega en tienda / mostrador.' : 'Envío a domicilio.', 43, yPos + 20);
    }
    if (!isPickupOrCounter && order.assignedDriverName) {
      doc.text(`Repartidor asignado: ${order.assignedDriverName}`, 43, yPos + 25);
    }

    // Legal Footer
    const footerY = 272;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, footerY, 196, footerY);

    doc.setFontSize(7.2);
    doc.setTextColor(100, 116, 139);
    doc.text(
      isFactura
        ? `Proforma comercial previa a emisión en SUNAT (Factura Electrónica vía WhatsApp) — ${COMPANY_NAME}.`
        : `Representación impresa de Boleta de Venta — ${COMPANY_NAME}.`,
      105,
      footerY + 5,
      { align: 'center' }
    );
    doc.text(
      `Consulte su pedido en línea: ${COMPANY_PORTAL}/track`,
      105,
      footerY + 9.5,
      { align: 'center' }
    );
    doc.text(
      '¡Gracias por confiar en Repuestos Asunción! Su aliado en ruta y taller.',
      105,
      footerY + 14,
      { align: 'center' }
    );

    if (download) {
      const fileName = isFactura
        ? `Proforma_Factura_${meta.fullSeriesNumber}_${order.orderNumber}.pdf`
        : `Boleta_${meta.fullSeriesNumber}_${order.orderNumber}.pdf`;
      doc.save(fileName);
    }

    return doc;
  }

  private drawQrCode(doc: jsPDF, payload: string, startX: number, startY: number, sizeMm: number): void {
    try {
      const qr = QRCode.create(payload, { errorCorrectionLevel: 'M' });
      const modules = qr.modules;
      const count = modules.size;
      const cellSize = sizeMm / count;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX - 1, startY - 1, sizeMm + 2, sizeMm + 2, 'FD');

      doc.setFillColor(15, 23, 42);
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (modules.get(r, c)) {
            doc.rect(startX + c * cellSize, startY + r * cellSize, cellSize, cellSize, 'F');
          }
        }
      }
    } catch {
      doc.setDrawColor(148, 163, 184);
      doc.rect(startX, startY, sizeMm, sizeMm, 'D');
      doc.setFontSize(6.5);
      doc.text('QR', startX + sizeMm / 2, startY + sizeMm / 2, { align: 'center' });
    }
  }
}
