import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-terms-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] py-10 px-4 sm:px-6 lg:px-8">
      <div class="mx-auto max-w-4xl space-y-8">
        <!-- Header -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-xs space-y-3">
          <nav class="flex items-center gap-2 text-xs font-medium text-gray-500">
            <a routerLink="/" class="hover:text-orange-600 transition">Inicio</a>
            <span>/</span>
            <span class="text-gray-900 font-semibold">Términos y Condiciones</span>
          </nav>
          <div class="flex items-center gap-3 pt-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white font-bold">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Términos y Condiciones de Uso y Contratación
              </h1>
              <p class="text-xs text-gray-500">
                Última actualización: 30 de Octubre de 2026 · Repuestos Automotrices Asunción S.A.C.
              </p>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-xs space-y-6 text-sm text-gray-700 leading-relaxed">
          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">1. Identificación del Comercio</h2>
            <p>
              El presente sitio web es de propiedad y operación exclusiva de <strong>REPUESTOS AUTOMOTRICES ASUNCIÓN S.A.C.</strong>, 
              con RUC N° <strong>10414686867</strong>, con domicilio legal en <strong>Av. Sta. Ana 441, Lima 15011, Santa Anita, Lima, Perú</strong>.
              Correo electrónico de atención comercial: <strong>ventas&#64;asuncion.pe</strong> / Central telefónica: <strong>(01) 362-8900</strong> / WhatsApp: <strong>+51 922 779 157</strong>.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">2. Ámbito y Aceptación</h2>
            <p>
              Las transacciones comerciales y consultas realizadas en esta plataforma electrónica se rigen por la legislación 
              de la República del Perú, en particular por la Ley N° 29571 (Código de Protección y Defensa del Consumidor), las normas 
              del comercio electrónico y las directivas emitidas por el INDECOPI. El acceso y uso del catálogo implica la aceptación 
              plena de los presentes Términos y Condiciones.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">3. Precios, Moneda y Comprobantes</h2>
            <p>
              Todos los precios de los repuestos automotrices figuran en <strong>Soles (PEN - S/.)</strong> e incluyen el 
              Impuesto General a las Ventas (IGV - 18%). Emitimos Boleta de Venta o Factura Comercial en formato digital PDF, validadas con DNI o RUC del comprador al momento de finalizar la compra.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">4. Medios de Pago y Pasarelas Autorizadas</h2>
            <p>
              Aceptamos pagos a través de pasarelas de pago seguras y certificadas con cifrado SSL:
            </p>
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Tarjetas de Crédito y Débito:</strong> Visa, Mastercard, American Express y Diners Club procesadas con seguridad PCI-DSS mediante Culqi (respaldo BCP).</li>
              <li><strong>Pasarela Oficial Culqi:</strong> Procesamiento seguro con validación bancaria inmediata en línea.</li>
              <li><strong>Billeteras Digitales:</strong> Yape y Plin mediante número o código QR dinámico.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">5. Despacho, Envíos y Recojo en Almacén</h2>
            <p>
              Ofrecemos dos modalidades de entrega:
            </p>
            <ul class="list-disc pl-5 space-y-1">
              <li><strong>Recojo gratis en tienda/almacén:</strong> Disponible en Av. Sta. Ana 441, Lima 15011, Santa Anita, Lima, en horario de lunes a sábado de 8:00 a.m. a 6:00 p.m.</li>
              <li><strong>Despacho Express motorizado en Lima Metropolitana:</strong> Con seguimiento GPS en tiempo real y confirmación con firma digital y fotografía del comprobante al momento de la entrega.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">6. Garantía de Compatibilidad y de Fábrica</h2>
            <p>
              Todos los repuestos nuevos cuentan con garantía de fábrica de tres (3) a doce (12) meses según la marca y fabricante (Bosch, Denso, Brembo, Aisin, GMB, Gates, etc.).
              La compatibilidad técnica es verificable a través del número de chasis (VIN) y código OEM en nuestro buscador y con el soporte de nuestros asesores mecánicos.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">7. Protección de Datos Personales</h2>
            <p>
              En cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales del Perú), la información personal ingresada 
              será utilizada estrictamente para el procesamiento de pedidos, emisión de comprobantes comerciales y comunicación logística de entrega.
            </p>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class TermsPageComponent {}
