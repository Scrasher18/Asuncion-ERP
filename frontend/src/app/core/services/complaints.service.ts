import { inject, Injectable, signal } from '@angular/core';
import { jsPDF } from 'jspdf';
import { ToastService } from './toast.service';

export interface ComplaintRecord {
  id: string;
  sheetNumber: string;
  createdAt: string;
  docType: string;
  docNumber: string;
  fullName: string;
  address: string;
  phone: string;
  email: string;
  goodType: 'PRODUCTO' | 'SERVICIO';
  claimedAmount: number;
  goodDescription: string;
  claimType: 'RECLAMO' | 'QUEJA';
  claimDetail: string;
  claimRequest: string;
  status: 'PENDIENTE' | 'ATENDIDO';
  adminResponseNote?: string;
  resolvedAt?: string;
}

const STORAGE_KEY = 'asuncion_complaints_book_records';

// No se incluyen reclamaciones ficticias. Las hojas provienen exclusivamente del registro real de clientes.
const INITIAL_COMPLAINTS: ComplaintRecord[] = [];

@Injectable({
  providedIn: 'root',
})
export class ComplaintsService {
  private readonly toast = inject(ToastService);
  readonly complaints = signal<ComplaintRecord[]>([]);

  constructor() {
    this.loadComplaints();
  }

  loadComplaints(): void {
    if (typeof window === 'undefined') {
      this.complaints.set([]);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtrar y purgar registros ficticios de demostración
          const realComplaints = parsed.filter(
            (c: ComplaintRecord) =>
              c &&
              c.id &&
              c.id !== 'rec-001' &&
              c.id !== 'rec-002' &&
              c.sheetNumber !== 'LR-2026-1042' &&
              c.sheetNumber !== 'LR-2026-1088'
          );
          this.complaints.set(realComplaints);
          this.persist(realComplaints);
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading complaints from localStorage:', e);
    }
    this.complaints.set([]);
    this.persist([]);
  }

  createComplaint(data: Omit<ComplaintRecord, 'id' | 'sheetNumber' | 'createdAt' | 'status'>): ComplaintRecord {
    const correlative = Math.floor(1000 + Math.random() * 9000);
    const date = new Date();
    const formattedDate = date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRecord: ComplaintRecord = {
      ...data,
      id: `rec-${Date.now()}`,
      sheetNumber: `LR-2026-${correlative}`,
      createdAt: formattedDate,
      status: 'PENDIENTE',
    };

    const updated = [newRecord, ...this.complaints()];
    this.complaints.set(updated);
    this.persist(updated);
    return newRecord;
  }

  resolveComplaint(sheetNumber: string, responseNote: string): void {
    const date = new Date();
    const resolvedAt = date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const updated = this.complaints().map((c) => {
      if (c.sheetNumber === sheetNumber) {
        return {
          ...c,
          status: 'ATENDIDO' as const,
          adminResponseNote: responseNote,
          resolvedAt,
        };
      }
      return c;
    });

    this.complaints.set(updated);
    this.persist(updated);
    this.toast.success('Reclamación Atendida', `Se registró la respuesta oficial para la hoja ${sheetNumber}.`);
  }

  downloadComplaintPdf(record: ComplaintRecord): void {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // Header Banner
      doc.setFillColor(234, 88, 12); // Orange #EA580C
      doc.rect(0, 0, 210, 24, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('REPUESTOS AUTOMOTRICES ASUNCIÓN S.A.C.', 14, 11);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('LIBRO DE RECLAMACIONES VIRTUAL — CONFORME A LEY N° 29571 (INDECOPI)', 14, 18);

      // Sheet Badge Box
      doc.setFillColor(254, 242, 242);
      doc.setDrawColor(220, 38, 38);
      doc.roundedRect(135, 28, 62, 22, 2, 2, 'FD');

      doc.setTextColor(185, 28, 28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('HOJA DE RECLAMACIÓN', 140, 35);
      doc.setFontSize(13);
      doc.text(record.sheetNumber, 140, 44);

      // Store Data Box
      doc.setTextColor(30, 41, 59);
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text('RUC: 20608899114', 14, 32);
      doc.text('Razón Social: REPUESTOS AUTOMOTRICES ASUNCIÓN S.A.C.', 14, 37);
      doc.text('Dirección: Av. Sta. Ana 441, Lima 15011 (Santa Anita) - Perú', 14, 42);
      doc.text(`Fecha y hora de registro: ${record.createdAt}`, 14, 47);

      // Section 1: Consumidor Reclamante
      let y = 56;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('1. IDENTIFICACIÓN DEL CONSUMIDOR RECLAMANTE', 16, y + 4.5);

      y += 10;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Nombre Completo: ${record.fullName}`, 16, y);
      doc.text(`Documento: ${record.docType} ${record.docNumber}`, 120, y);
      y += 6;
      doc.text(`Domicilio: ${record.address}`, 16, y);
      y += 6;
      doc.text(`Teléfono / Celular: ${record.phone}`, 16, y);
      doc.text(`Correo Electrónico: ${record.email}`, 120, y);

      // Section 2: Bien Contratado
      y += 10;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('2. IDENTIFICACIÓN DEL BIEN CONTRATADO', 16, y + 4.5);

      y += 10;
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tipo de Bien: ${record.goodType}`, 16, y);
      doc.text(`Monto Reclamado: S/ ${Number(record.claimedAmount || 0).toFixed(2)}`, 120, y);
      y += 6;
      doc.text(`Descripción del Bien / Pedido: ${record.goodDescription}`, 16, y);

      // Section 3: Detalle de Reclamación
      y += 10;
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text(`3. DETALLE DE LA RECLAMACIÓN Y PEDIDO DEL CONSUMIDOR [${record.claimType}]`, 16, y + 4.5);

      y += 10;
      doc.setFont('helvetica', 'bold');
      doc.text(`Tipo: ${record.claimType === 'RECLAMO' ? 'RECLAMO (Disconformidad con producto/repuesto)' : 'QUEJA (Malestar con la atención)'}`, 16, y);

      y += 6;
      doc.setFont('helvetica', 'normal');
      doc.text('Detalle de los hechos:', 16, y);
      y += 5;
      const splitDetail = doc.splitTextToSize(record.claimDetail, 178);
      doc.text(splitDetail, 16, y);
      y += splitDetail.length * 5 + 3;

      doc.setFont('helvetica', 'bold');
      doc.text('Pedido concreto del consumidor:', 16, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      const splitRequest = doc.splitTextToSize(record.claimRequest, 178);
      doc.text(splitRequest, 16, y);
      y += splitRequest.length * 5 + 4;

      // Section 4: Acciones del Proveedor
      doc.setFillColor(241, 245, 249);
      doc.rect(14, y, 182, 6, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('4. ACCIONES ADOPTADAS POR EL PROVEEDOR (RESPUESTA FORMAL)', 16, y + 4.5);

      y += 10;
      doc.setFontSize(8.5);
      if (record.status === 'ATENDIDO' && record.adminResponseNote) {
        doc.setFont('helvetica', 'normal');
        doc.text(`Estado: ATENDIDO — Fecha de respuesta: ${record.resolvedAt || 'Atendido'}`, 16, y);
        y += 5;
        const splitResponse = doc.splitTextToSize(record.adminResponseNote, 178);
        doc.text(splitResponse, 16, y);
        y += splitResponse.length * 5 + 4;
      } else {
        doc.setFont('helvetica', 'italic');
        doc.text('Estado: EN TRÁMITE / PENDIENTE DE ATENCIÓN.', 16, y);
        doc.text('Plazo máximo legal de atención: 15 días hábiles conforme al Art. 24 de la Ley N° 29571.', 16, y + 5);
        y += 14;
      }

      // Legal Footer Note
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text('La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante INDECOPI.', 14, 280);
      doc.text('Copia formal generada electrónicamente por el Sistema E-Commerce & ERP de Autopartes Asunción.', 14, 285);

      doc.save(`Hoja_Reclamacion_${record.sheetNumber}.pdf`);
      this.toast.success('PDF Generado', `Se descargó la Hoja de Reclamación ${record.sheetNumber}`);
    } catch (err) {
      console.error('Error generating complaint PDF:', err);
      this.toast.error('Error al generar PDF', 'No se pudo generar el documento.');
    }
  }

  private persist(records: ComplaintRecord[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.warn('Error saving complaints to localStorage:', e);
      }
    }
  }
}
