import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { jsPDF } from 'jspdf';
import { ApiConfigService } from './api-config.service';
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

const DEFAULT_COMPLAINTS: ComplaintRecord[] = [
  {
    id: 'rec-2026-0001',
    sheetNumber: 'LR-2026-0001',
    createdAt: '05/11/2026, 09:30',
    docType: 'DNI',
    docNumber: '45892103',
    fullName: 'Jorge Luis Huamán Quispe',
    address: 'Av. Tomás Valle 1420, San Martín de Porres, Lima',
    phone: '987451230',
    email: 'jhuaman.taller@gmail.com',
    goodType: 'PRODUCTO',
    claimedAmount: 185.0,
    goodDescription: 'Pastillas de freno delanteras cerámicas Toyota Hilux (SKU: BRK-001)',
    claimType: 'RECLAMO',
    claimDetail: 'Solicité pastillas para modelo 2022 y la caja recibida corresponde a la versión anterior 2015.',
    claimRequest: 'Solicito el cambio inmediato por el código OEM compatible con Toyota Hilux 2022 sin costo de envío adicional.',
    status: 'PENDIENTE',
  },
  {
    id: 'rec-2026-0002',
    sheetNumber: 'LR-2026-0002',
    createdAt: '03/11/2026, 16:15',
    docType: 'RUC',
    docNumber: '20604518291',
    fullName: 'Transportes y Logística Del Norte S.A.C.',
    address: 'Av. Argentina 2840, Callao',
    phone: '994102384',
    email: 'compras@logicanorte.pe',
    goodType: 'SERVICIO',
    claimedAmount: 420.0,
    goodDescription: 'Despacho express motorizado Pedido #ORD-20261103',
    claimType: 'QUEJA',
    claimDetail: 'El motorizado demoró 35 minutos adicionales respecto al tiempo estimado por tráfico en Av. Faucett.',
    claimRequest: 'Mayor precisión en la notificación de ventana horaria para recepción en almacén de flota.',
    status: 'ATENDIDO',
    adminResponseNote: 'Estimado cliente, lamentamos el retraso ocasionado por el cierre vial en Av. Faucett. Hemos bonificado su cuenta con envío prioritario gratuito para su próximo pedido.',
    resolvedAt: '04/11/2026, 11:20',
  },
];

@Injectable({
  providedIn: 'root',
})
export class ComplaintsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);
  readonly complaints = signal<ComplaintRecord[]>(DEFAULT_COMPLAINTS);

  constructor() {
    this.loadComplaints();
  }

  loadComplaints(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.complaints.set(parsed);
          } else {
            this.complaints.set(DEFAULT_COMPLAINTS);
            this.persist(DEFAULT_COMPLAINTS);
          }
        } else {
          this.complaints.set(DEFAULT_COMPLAINTS);
          this.persist(DEFAULT_COMPLAINTS);
        }
      } catch (e) {
        console.warn('Error loading complaints from localStorage:', e);
        this.complaints.set(DEFAULT_COMPLAINTS);
      }
    }

    // Sincronizar en tiempo real con el backend PostgreSQL (/api/v1/complaints)
    this.http.get<any[]>(`${this.apiConfig.apiUrl}/complaints`).subscribe({
      next: (remoteRecords) => {
        if (Array.isArray(remoteRecords) && remoteRecords.length > 0) {
          const mapped: ComplaintRecord[] = remoteRecords.map((r) => ({
            id: String(r.id ?? `rec-${r.sheetNumber}`),
            sheetNumber: r.sheetNumber,
            createdAt: r.createdAtLabel || r.createdAt || '',
            docType: r.docType || 'DNI',
            docNumber: r.docNumber || '',
            fullName: r.fullName || '',
            address: r.address || '',
            phone: r.phone || '',
            email: r.email || '',
            goodType: (r.goodType === 'SERVICIO' ? 'SERVICIO' : 'PRODUCTO') as 'PRODUCTO' | 'SERVICIO',
            claimedAmount: Number(r.claimedAmount ?? 0),
            goodDescription: r.goodDescription || '',
            claimType: (r.claimType === 'QUEJA' ? 'QUEJA' : 'RECLAMO') as 'RECLAMO' | 'QUEJA',
            claimDetail: r.claimDetail || '',
            claimRequest: r.claimRequest || '',
            status: (r.status === 'ATENDIDO' ? 'ATENDIDO' : 'PENDIENTE') as 'PENDIENTE' | 'ATENDIDO',
            adminResponseNote: r.adminResponseNote || undefined,
            resolvedAt: r.resolvedAt || undefined,
          }));

          // Combinar con registros locales que aún no estén en el servidor por sheetNumber
          const remoteSheets = new Set(mapped.map((m) => m.sheetNumber));
          const localOnly = this.complaints().filter(
            (local) => local.sheetNumber && !remoteSheets.has(local.sheetNumber)
          );
          const merged = [...localOnly, ...mapped];
          this.complaints.set(merged);
          this.persist(merged);
        }
      },
      error: () => {
        // Si el backend está despertando o sin red, conservamos la copia local / por defecto
      },
    });
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

    this.http
      .post<any>(`${this.apiConfig.apiUrl}/complaints`, {
        sheetNumber: newRecord.sheetNumber,
        createdAtLabel: newRecord.createdAt,
        docType: newRecord.docType,
        docNumber: newRecord.docNumber,
        fullName: newRecord.fullName,
        address: newRecord.address,
        phone: newRecord.phone,
        email: newRecord.email,
        goodType: newRecord.goodType,
        claimedAmount: newRecord.claimedAmount,
        goodDescription: newRecord.goodDescription,
        claimType: newRecord.claimType,
        claimDetail: newRecord.claimDetail,
        claimRequest: newRecord.claimRequest,
      })
      .subscribe({
        next: () => this.loadComplaints(),
        error: () => {},
      });

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

    this.http
      .put<any>(`${this.apiConfig.apiUrl}/complaints/${encodeURIComponent(sheetNumber)}/resolve`, {
        adminResponseNote: responseNote,
        resolvedAt,
      })
      .subscribe({
        next: () => {},
        error: () => {},
      });

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
      doc.text('RUC: 10414686867', 14, 32);
      doc.text('Razón Social: REPUESTOS AUTOMOTRICES ASUNCIÓN', 14, 37);
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
