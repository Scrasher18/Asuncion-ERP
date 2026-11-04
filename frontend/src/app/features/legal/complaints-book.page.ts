import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { RecaptchaV3Service } from '../../core/services/recaptcha-v3.service';
import { ComplaintsService, ComplaintRecord } from '../../core/services/complaints.service';

// ComplaintRecord interface is provided by ComplaintsService

@Component({
  selector: 'app-complaints-book-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] py-10 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-4xl space-y-8">
        <!-- Breadcrumb & Official Banner -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
          <nav class="flex items-center gap-2 text-xs font-medium text-gray-500">
            <a routerLink="/" class="hover:text-orange-600 transition">Inicio</a>
            <span>/</span>
            <span class="text-gray-900 font-semibold">Libro de Reclamaciones Virtual</span>
          </nav>

          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
            <div class="flex items-center gap-4">
              <!-- Official Real INDECOPI Logo Image -->
              <img
                src="/images/icons/libro_reclamaciones.png"
                alt="Libro de Reclamaciones Oficial INDECOPI"
                width="64"
                height="64"
                loading="lazy"
                class="h-16 w-16 object-contain rounded-lg shadow-xs shrink-0"
              />
              <div>
                <h1 class="text-xl sm:text-2xl font-black text-gray-950 tracking-tight">
                  LIBRO DE RECLAMACIONES VIRTUAL
                </h1>
                <p class="text-xs text-gray-600">
                  Conforme a la Ley N° 29571 y D.S. 011-2011-PCM del INDECOPI
                </p>
              </div>
            </div>

            <div class="text-left sm:text-right text-xs text-gray-600 space-y-0.5 border-t sm:border-t-0 pt-2 sm:pt-0">
              <p><strong class="text-gray-900">REPUESTOS AUTOMOTRICES ASUNCIÓN S.A.C.</strong></p>
              <p>RUC: <strong class="text-gray-900 font-mono">20608899114</strong></p>
              <p>Av. Sta. Ana 441, Lima 15011 (Santa Anita)</p>
            </div>
          </div>

          <div class="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-950 space-y-1 leading-relaxed">
            <p class="font-bold">Información importante para el consumidor:</p>
            <p>
              • <strong>RECLAMO:</strong> Disconformidad relacionada con los productos o repuestos adquiridos.
            </p>
            <p>
              • <strong>QUEJA:</strong> Malestar o descontento respecto a la atención brindada por el personal.
            </p>
            <p class="text-[11px] text-blue-900 pt-1">
              * La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante INDECOPI. El plazo de atención legal es de máximo <strong>15 días hábiles</strong>.
            </p>
          </div>
        </div>

        @if (submittedRecord(); as rec) {
          <!-- Success Sheet Display -->
          <div class="rounded-2xl border-2 border-emerald-500 bg-white p-6 sm:p-10 shadow-lg space-y-6 animate-scaleIn">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200 pb-5">
              <div class="flex items-center gap-3">
                <div class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <div>
                  <h2 class="text-lg font-bold text-gray-900">¡Hoja de Reclamación Registrada con Éxito!</h2>
                  <p class="text-xs text-gray-500">Se ha enviado una copia en formato digital al correo {{ rec.email }}</p>
                </div>
              </div>

              <div class="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-center">
                <span class="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Hoja de Reclamación N°</span>
                <span class="font-mono text-base font-extrabold text-emerald-950">{{ rec.sheetNumber }}</span>
              </div>
            </div>

            <!-- Summary Table of the Claim -->
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-5 space-y-4 text-xs text-gray-800">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span class="text-gray-500">Fecha y Hora de Registro:</span>
                  <p class="font-semibold text-gray-900">{{ rec.createdAt }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Tipo de Reclamación:</span>
                  <p class="font-bold text-orange-600">{{ rec.claimType }}</p>
                </div>
                <div>
                  <span class="text-gray-500">Consumidor:</span>
                  <p class="font-semibold text-gray-900">{{ rec.fullName }} ({{ rec.docType }}: {{ rec.docNumber }})</p>
                </div>
                <div>
                  <span class="text-gray-500">Contacto:</span>
                  <p class="font-semibold text-gray-900">{{ rec.phone }} · {{ rec.email }}</p>
                </div>
              </div>

              <div class="border-t border-gray-200 pt-3 space-y-1">
                <span class="text-gray-500">Bien Contratado:</span>
                <p class="font-semibold text-gray-900">{{ rec.goodType }} · Monto reclamado: S/ {{ rec.claimedAmount | number: '1.2-2' }}</p>
                <p class="text-gray-700">{{ rec.goodDescription }}</p>
              </div>

              <div class="border-t border-gray-200 pt-3 space-y-1">
                <span class="text-gray-500">Detalle de los hechos:</span>
                <p class="text-gray-800 bg-white p-3 rounded-lg border border-gray-200 font-mono text-[11px] leading-relaxed">{{ rec.claimDetail }}</p>
              </div>

              <div class="border-t border-gray-200 pt-3 space-y-1">
                <span class="text-gray-500">Pedido concreto del consumidor:</span>
                <p class="text-gray-800 bg-white p-3 rounded-lg border border-gray-200 font-mono text-[11px] leading-relaxed">{{ rec.claimRequest }}</p>
              </div>
            </div>

            <!-- Print Actions -->
            <div class="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                (click)="printClaimSheet()"
                class="flex-1 min-h-[44px] rounded-xl bg-gray-900 py-2.5 px-4 text-xs font-semibold text-white hover:bg-black transition flex items-center justify-center gap-2"
              >
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6.72 13.829c-.24-1.076-.672-2.03-1.28-2.829H18.56c-.608.799-1.04 1.753-1.28 2.829m-10.56 0A7.528 7.528 0 016.72 12c0-.573.064-1.13.187-1.666m10.186 3.495A7.528 7.528 0 0017.28 12c0-.573-.064-1.13-.187-1.666m-10.373 0A7.48 7.48 0 0112 9c1.92 0 3.682.72 5.02 1.916" />
                </svg>
                <span>Imprimir / Guardar Hoja de Reclamación</span>
              </button>

              <button
                type="button"
                (click)="resetForm()"
                class="min-h-[44px] rounded-xl border border-gray-200 bg-white py-2.5 px-5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
              >
                Registrar nuevo reclamo
              </button>
            </div>
          </div>
        } @else {
          <!-- Form compliant with INDECOPI -->
          <form (ngSubmit)="submitClaim()" class="space-y-6">
            <!-- Sección 1: Consumidor -->
            <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div class="flex items-center gap-2 border-b border-gray-100 pb-3">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-900 text-white font-bold text-xs">1</span>
                <h2 class="text-sm font-bold text-gray-900">Identificación del Consumidor Reclamante</h2>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div class="sm:col-span-4">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Tipo de Documento *</label>
                  <select
                    [(ngModel)]="formData.docType"
                    name="docType"
                    required
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-900 focus:border-orange-600 focus:outline-none"
                  >
                    <option value="DNI">DNI</option>
                    <option value="CE">Carnet de Extranjería</option>
                    <option value="PASAPORTE">Pasaporte</option>
                    <option value="RUC">RUC</option>
                  </select>
                </div>

                <div class="sm:col-span-8">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Número de Documento *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.docNumber"
                    name="docNumber"
                    required
                    placeholder="Ingresa número de documento"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                <div class="sm:col-span-12">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Nombres y Apellidos / Razón Social *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.fullName"
                    name="fullName"
                    required
                    placeholder="Nombres completos del reclamante"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                <div class="sm:col-span-12">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Domicilio (Dirección completa) *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.address"
                    name="address"
                    required
                    placeholder="Av. / Jr. / Calle, Número, Distrito, Ciudad"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                <div class="sm:col-span-6">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Teléfono o Celular *</label>
                  <input
                    type="tel"
                    [(ngModel)]="formData.phone"
                    name="phone"
                    required
                    placeholder="999 888 777"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>

                <div class="sm:col-span-6">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Correo Electrónico (para envío de copia) *</label>
                  <input
                    type="email"
                    [(ngModel)]="formData.email"
                    name="email"
                    required
                    placeholder="tu-correo@ejemplo.com"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <!-- Sección 2: Bien Contratado -->
            <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div class="flex items-center gap-2 border-b border-gray-100 pb-3">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-900 text-white font-bold text-xs">2</span>
                <h2 class="text-sm font-bold text-gray-900">Identificación del Bien Contratado</h2>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-12 gap-4">
                <div class="sm:col-span-6">
                  <label class="block text-xs font-semibold text-gray-700 mb-2">Tipo de Bien *</label>
                  <div class="flex items-center gap-6 text-xs">
                    <label class="inline-flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                      <input type="radio" [(ngModel)]="formData.goodType" name="goodType" value="PRODUCTO" class="accent-orange-600" />
                      <span>Producto (Repuesto automotriz)</span>
                    </label>
                    <label class="inline-flex items-center gap-2 cursor-pointer font-medium text-gray-800">
                      <input type="radio" [(ngModel)]="formData.goodType" name="goodType" value="SERVICIO" class="accent-orange-600" />
                      <span>Servicio</span>
                    </label>
                  </div>
                </div>

                <div class="sm:col-span-6">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Monto Reclamado (S/.) *</label>
                  <input
                    type="number"
                    step="0.01"
                    [(ngModel)]="formData.claimedAmount"
                    name="claimedAmount"
                    required
                    placeholder="0.00"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none font-mono"
                  />
                </div>

                <div class="sm:col-span-12">
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Descripción del Bien o Número de Pedido *</label>
                  <input
                    type="text"
                    [(ngModel)]="formData.goodDescription"
                    name="goodDescription"
                    required
                    placeholder="Ejemplo: Juego de pastillas de freno cerámicas / Pedido N° ASU-00123"
                    class="w-full min-h-[42px] rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <!-- Sección 3: Detalle de Reclamación -->
            <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-4">
              <div class="flex items-center gap-2 border-b border-gray-100 pb-3">
                <span class="flex h-6 w-6 items-center justify-center rounded-full bg-blue-900 text-white font-bold text-xs">3</span>
                <h2 class="text-sm font-bold text-gray-900">Detalle de la Reclamación y Pedido del Consumidor</h2>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-xs font-semibold text-gray-700 mb-2">Tipo de Reclamación *</label>
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label
                      [class]="formData.claimType === 'RECLAMO' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white'"
                      class="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition"
                    >
                      <input type="radio" [(ngModel)]="formData.claimType" name="claimType" value="RECLAMO" class="mt-0.5 accent-orange-600" />
                      <div class="text-xs">
                        <strong class="block text-gray-900">RECLAMO</strong>
                        <span class="text-gray-500 text-[11px]">Disconformidad relacionada a los productos o repuestos adquiridos.</span>
                      </div>
                    </label>

                    <label
                      [class]="formData.claimType === 'QUEJA' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-200 bg-white'"
                      class="flex items-start gap-3 rounded-xl border p-3.5 cursor-pointer transition"
                    >
                      <input type="radio" [(ngModel)]="formData.claimType" name="claimType" value="QUEJA" class="mt-0.5 accent-orange-600" />
                      <div class="text-xs">
                        <strong class="block text-gray-900">QUEJA</strong>
                        <span class="text-gray-500 text-[11px]">Malestar o descontento respecto a la atención recibida.</span>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Detalle de los hechos (Explicación clara del motivo) *</label>
                  <textarea
                    [(ngModel)]="formData.claimDetail"
                    name="claimDetail"
                    rows="4"
                    required
                    placeholder="Describe de manera detallada los hechos ocurridos..."
                    class="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  ></textarea>
                </div>

                <div>
                  <label class="block text-xs font-semibold text-gray-700 mb-1">Pedido Concreto del Consumidor *</label>
                  <textarea
                    [(ngModel)]="formData.claimRequest"
                    name="claimRequest"
                    rows="3"
                    required
                    placeholder="Indica qué solución o acción solicitas (ejemplo: cambio de repuesto, devolución del dinero, etc.)..."
                    class="w-full rounded-xl border border-gray-200 bg-white p-3.5 text-xs text-gray-900 focus:border-orange-600 focus:outline-none"
                  ></textarea>
                </div>
              </div>
            </div>

            <!-- Declaración Legal y Envío -->
            <div class="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs space-y-4">
              <label class="flex items-start gap-2.5 cursor-pointer text-xs text-gray-700">
                <input type="checkbox" [(ngModel)]="acceptedTerms" name="acceptedTerms" required class="mt-0.5 h-4 w-4 rounded accent-orange-600" />
                <span>
                  Declaro ser el titular del reclamo o queja y que los datos consignados son verdaderos. Acepto que la respuesta formal sea remitida a la dirección de correo electrónico indicada en un plazo máximo de 15 días hábiles conforme a la Ley N° 29571.
                </span>
              </label>

              <!-- Official Google reCAPTCHA v3 Legal Notice -->
              <p class="text-[11px] text-gray-500 text-center leading-relaxed">
                Protegido por Google reCAPTCHA v3. Aplican la
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline font-medium">Privacidad</a> y los
                <a href="https://policies.google.com/terms" target="_blank" rel="noopener noreferrer" class="text-orange-600 underline font-medium">Términos de Servicio</a> de Google.
              </p>

              <button
                type="submit"
                [disabled]="!acceptedTerms || isSubmitting()"
                class="w-full min-h-[46px] rounded-xl bg-orange-600 hover:bg-orange-700 py-3 text-xs font-bold text-white shadow-sm transition disabled:bg-gray-300 disabled:cursor-not-allowed cursor-pointer"
              >
                {{ isSubmitting() ? 'Registrando...' : 'Registrar Hoja de Reclamación en el Libro Virtual' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
})
export class ComplaintsBookPageComponent {
  private readonly recaptchaV3 = inject(RecaptchaV3Service);
  readonly complaintsService = inject(ComplaintsService);

  formData = {
    docType: 'DNI',
    docNumber: '',
    fullName: '',
    address: '',
    phone: '',
    email: '',
    goodType: 'PRODUCTO' as 'PRODUCTO' | 'SERVICIO',
    claimedAmount: 0,
    goodDescription: '',
    claimType: 'RECLAMO' as 'RECLAMO' | 'QUEJA',
    claimDetail: '',
    claimRequest: '',
  };

  acceptedTerms = false;
  readonly isSubmitting = signal(false);
  readonly submittedRecord = signal<ComplaintRecord | null>(null);

  async submitClaim(): Promise<void> {
    if (!this.acceptedTerms || this.isSubmitting()) return;
    this.isSubmitting.set(true);

    try {
      await this.recaptchaV3.execute('complaint');
    } catch (e) {
      console.warn('reCAPTCHA v3 warning:', e);
    }

    const created = this.complaintsService.createComplaint({
      ...this.formData,
    });

    this.submittedRecord.set(created);
    this.isSubmitting.set(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  printClaimSheet(): void {
    const rec = this.submittedRecord();
    if (rec) {
      this.complaintsService.downloadComplaintPdf(rec);
    } else {
      window.print();
    }
  }

  resetForm(): void {
    this.formData = {
      docType: 'DNI',
      docNumber: '',
      fullName: '',
      address: '',
      phone: '',
      email: '',
      goodType: 'PRODUCTO',
      claimedAmount: 0,
      goodDescription: '',
      claimType: 'RECLAMO',
      claimDetail: '',
      claimRequest: '',
    };
    this.acceptedTerms = false;
    this.submittedRecord.set(null);
  }
}
