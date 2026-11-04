import { Injectable } from '@angular/core';
import { jsPDF } from 'jspdf';
import { Order } from '../models/api.models';
import { COMPANY_LOGO_BASE64 } from '../constants/company-logo.constant';

@Injectable({ providedIn: 'root' })
export class PdfInvoiceService {
  generateInvoicePdf(order: Order, download = true): jsPDF {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const isFactura = order.invoiceType === 'FACTURA';
    const docTitle = isFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const docSeries = (isFactura ? 'F001-' : 'B001-') + order.orderNumber.replace(/^[A-Z]+-/, '');

    // Top Header Banner
    doc.setFillColor(15, 23, 42); // #0F172A
    doc.rect(0, 0, 210, 6, 'F');

    // 1. Company Logo (Top-Left)
    try {
      doc.addImage(COMPANY_LOGO_BASE64, 'JPEG', 14, 11, 24, 24);
    } catch (e) {
      console.warn('Could not render logo in PDF:', e);
    }

    // 2. Company Brand Name & Info (Next to logo, carefully aligned to never collide with RUC box)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12.5);
    doc.setTextColor(234, 88, 12); // #EA580C
    doc.text('REPUESTOS AUTOMOTRICES', 41, 17);
    doc.text('ASUNCIÓN S.A.C.', 41, 22.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text('Venta de Autopartes, Filtros, Bujías y Repuestos Multimarca', 41, 27);
    doc.text('Sede Central: Av. Sta. Ana 441, Santa Anita, Lima - Perú', 41, 31);
    doc.text('Teléfonos: +51 922 779 157 / (01) 362-8900  |  ventas@asuncion.pe', 41, 35);
    doc.text('Portal Web: https://asucionfrontend.vercel.app', 41, 39);

    // 3. Document Box (RUC & Tipo de comprobante)
    doc.setDrawColor(234, 88, 12);
    doc.setLineWidth(0.8);
    doc.setFillColor(255, 247, 237); // Orange 50
    doc.roundedRect(132, 11, 64, 29, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42);
    doc.text('R.U.C. 20601234567', 164, 18, { align: 'center' });

    doc.setFillColor(234, 88, 12);
    doc.rect(132, 21.5, 64, 7.5, 'F');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(docTitle, 164, 26.5, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(234, 88, 12);
    doc.text(docSeries, 164, 35.5, { align: 'center' });

    // Horizontal separator
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(14, 44, 196, 44);

    // Customer & Transaction Details Box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 47, 182, 34, 1.5, 1.5, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 47, 182, 34, 1.5, 1.5, 'D');

    const customerName = order.recipientName || order.customerName || 'Cliente General';
    const docNumber = isFactura
      ? (order.customerTaxId || order.billingDocumentNumber || 'No especificado')
      : (order.customerTaxId || order.billingDocumentNumber || 'No especificado');

    const formattedDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
      : new Date().toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Señor(es):', 18, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(customerName, 36, 54);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(isFactura ? 'RUC:' : 'DNI / Doc:', 18, 60);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(docNumber, 36, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Dirección:', 18, 66);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const addr = order.deliveryAddress || 'Recojo en Almacén Central Santa Anita';
    doc.text(doc.splitTextToSize(addr, 95), 36, 66);

    // Right Column in customer box
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Fecha Emisión:', 135, 54);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(formattedDate, 162, 54);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Moneda:', 135, 60);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text('SOLES (PEN / S/)', 162, 60);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Forma de Pago:', 135, 66);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    const methodClean = (order.paymentMethod || 'CONTADO').replace(/_/g, ' ');
    doc.text(methodClean, 162, 66);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text('Modalidad:', 135, 72);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(51, 65, 85);
    doc.text(order.deliveryType === 'DELIVERY' ? 'Envío a Domicilio' : 'Recojo en Mostrador', 162, 72);

    // Table Header
    let yPos = 86;
    doc.setFillColor(234, 88, 12);
    doc.roundedRect(14, yPos, 182, 7.5, 1, 1, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Ítem', 18, yPos + 5);
    doc.text('Código SKU / OEM', 28, yPos + 5);
    doc.text('Descripción del Repuesto', 65, yPos + 5);
    doc.text('Cant.', 142, yPos + 5, { align: 'center' });
    doc.text('P. Unit.', 164, yPos + 5, { align: 'right' });
    doc.text('Subtotal', 190, yPos + 5, { align: 'right' });

    // Table Rows
    yPos += 8;
    const items = order.items || [];
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    let rowIdx = 1;
    for (const it of items) {
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }

      // Alternating background
      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, yPos - 1, 182, 8, 'F');
      }

      doc.setTextColor(51, 65, 85);
      doc.text(String(rowIdx), 18, yPos + 4);

      const code = it.partSku || it.sku || it.partOemCode || it.oemCode || '-';
      doc.setFont('courier', 'bold');
      doc.text(code.substring(0, 18), 28, yPos + 4);
      doc.setFont('helvetica', 'normal');

      const desc = it.partName || it.name || 'Repuesto Automotriz';
      doc.text(desc.substring(0, 48), 65, yPos + 4);

      const itemSubtotal = it.subtotal ?? (it.lineTotal ?? ((it.unitPrice || 0) * (it.quantity || 1)));
      doc.text(String(it.quantity), 142, yPos + 4, { align: 'center' });
      doc.text(`S/ ${(it.unitPrice || 0).toFixed(2)}`, 164, yPos + 4, { align: 'right' });
      doc.text(`S/ ${itemSubtotal.toFixed(2)}`, 190, yPos + 4, { align: 'right' });

      // Subtle row line
      doc.setDrawColor(241, 245, 249);
      doc.line(14, yPos + 7, 196, yPos + 7);

      yPos += 8;
      rowIdx++;
    }

    // Totals Section
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    } else {
      yPos += 4;
    }

    const subtotal = order.subtotal || 0;
    const igv = order.igvAmount ?? (order.taxAmount ?? Number((subtotal * 0.18).toFixed(2)));
    const deliveryFee = order.deliveryFee || 0;
    const grandTotal = (order.totalAmount ?? order.total ?? (subtotal + deliveryFee));

    // Summary Box
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(120, yPos, 76, 36, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);

    doc.text('Op. Gravada (sin IGV):', 124, yPos + 6);
    doc.text(`S/ ${(subtotal - igv > 0 ? subtotal - igv : subtotal * 0.82).toFixed(2)}`, 192, yPos + 6, { align: 'right' });

    doc.text('I.G.V. (18%):', 124, yPos + 13);
    doc.text(`S/ ${igv.toFixed(2)}`, 192, yPos + 13, { align: 'right' });

    doc.text('Costo de Envío / Flete:', 124, yPos + 20);
    doc.text(`S/ ${deliveryFee.toFixed(2)}`, 192, yPos + 20, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.line(124, yPos + 24, 192, yPos + 24);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(234, 88, 12);
    doc.text('TOTAL A PAGAR:', 124, yPos + 31);
    doc.text(`S/ ${Number(grandTotal).toFixed(2)}`, 192, yPos + 31, { align: 'right' });

    // Additional Notes / Legend
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text('Son: SOLES con garantía de fábrica para repuestos automotrices.', 14, yPos + 6);
    doc.text('Garantía: 6 a 12 meses según fabricante con presentación de este comprobante.', 14, yPos + 11);
    doc.text('Estado del pedido: ' + order.status, 14, yPos + 16);
    if (order.assignedDriverName) {
      doc.text('Repartidor asignado: ' + order.assignedDriverName, 14, yPos + 21);
    }

    // Legal Footer
    const footerY = 272;
    doc.setDrawColor(226, 232, 240);
    doc.line(14, footerY, 196, footerY);

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Representación impresa de la ' + docTitle + ' generada por Repuestos Automotrices Asunción S.A.C.', 105, footerY + 5, { align: 'center' });
    doc.text('Consulte la validez de este comprobante electrónico con su código de pedido en: https://asucionfrontend.vercel.app/track', 105, footerY + 9, { align: 'center' });
    doc.text('¡Gracias por confiar en Repuestos Asunción! Su aliado en ruta y taller.', 105, footerY + 13, { align: 'center' });

    if (download) {
      const fileName = `${isFactura ? 'Factura' : 'Boleta'}_${order.orderNumber}.pdf`;
      doc.save(fileName);
    }

    return doc;
  }
}
