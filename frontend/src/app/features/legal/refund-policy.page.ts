import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-refund-policy-page',
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
            <span class="text-gray-900 font-semibold">Políticas de Cambios y Devoluciones</span>
          </nav>
          <div class="flex items-center gap-3 pt-2">
            <div class="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-600 text-white font-bold">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-gray-900">
                Políticas de Cambios, Devoluciones y Garantía
              </h1>
              <p class="text-xs text-gray-500">
                Conforme a la Ley N° 29571 · Repuestos Automotrices Asunción S.A.C.
              </p>
            </div>
          </div>
        </div>

        <!-- Content -->
        <div class="rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-xs space-y-6 text-sm text-gray-700 leading-relaxed">
          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">1. Plazo para Solicitar Cambios o Devoluciones</h2>
            <p>
              El cliente tiene derecho a solicitar el cambio de producto o la devolución de su dinero dentro de un plazo máximo 
              de <strong>siete (7) días calendario</strong> contados a partir de la fecha de entrega del pedido o retiro en almacén.
            </p>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">2. Condiciones del Repuesto para su Aceptación</h2>
            <p>
              Para que proceda el cambio o devolución comercial, el producto debe cumplir con las siguientes condiciones técnicas:
            </p>
            <ul class="list-disc pl-5 space-y-1.5">
              <li>Estar en su <strong>empaque original de fábrica</strong>, limpio, sin roturas, sellos violados ni manchas de grasa/lubricante.</li>
              <li>El repuesto <strong>no debe haber sido instalado</strong>, montado ni manipulado en ningún vehículo.</li>
              <li>Presentar la <strong>Boleta o Factura Electrónica</strong> correspondiente emitida por Repuestos Asunción.</li>
              <li>Incluir todos sus accesorios, manuales y componentes originales.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">3. Casos de Incompatibilidad Mecánica</h2>
            <p>
              Si el cliente adquirió un repuesto que no aplica al modelo, año o motorización de su vehículo:
            </p>
            <ul class="list-disc pl-5 space-y-1">
              <li>Se procederá al cambio inmediato por la pieza correcta previa validación del número de chasis (VIN).</li>
              <li>Si existiera diferencia de precio a favor del cliente, se reembolsará el saldo; si fuera a favor de la empresa, el cliente abonará el monto diferencial.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">4. Garantía Técnica por Falla de Fábrica</h2>
            <p>
              Todos los repuestos automotrices cuentan con garantía de fábrica ante defectos de manufactura:
            </p>
            <ul class="list-disc pl-5 space-y-1.5">
              <li>El plazo de garantía oscila entre <strong>3 a 12 meses</strong> según la marca fabricante (Denso, Bosch, Brembo, Aisin, GMB, etc.).</li>
              <li>La pieza será evaluada por el área técnica de Asunción en un plazo no mayor a tres (3) días hábiles.</li>
              <li>En caso de corroborarse falla de fabricación, se entregará una unidad nueva o se procederá al reembolso total sin costo alguno.</li>
              <li>La garantía no cubre fallas causadas por mala instalación mecánica, negligencia o alteraciones eléctricas/mecánicas del vehículo.</li>
            </ul>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">5. Canales y Procedimiento de Atención</h2>
            <p>
              Para tramitar un cambio o devolución, el cliente puede comunicarse por cualquiera de nuestros canales oficiales:
            </p>
            <div class="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-2 text-xs text-gray-800">
              <p class="flex items-center gap-2">
                <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span><strong>Presencial:</strong> Av. Sta. Ana 441, Lima 15011, Santa Anita (Lunes a Sábado de 8:00 a.m. a 6:00 p.m.)</span>
              </p>
              <p class="flex items-center gap-2">
                <img src="/images/icons/whatsapp.png" alt="WhatsApp" class="h-4 w-4 object-contain shrink-0" />
                <span><strong>WhatsApp Oficial de Atención al Cliente:</strong> +51 922 779 157</span>
              </p>
              <p class="flex items-center gap-2">
                <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <span><strong>Correo de Post-Venta y Garantías:</strong> garantias&#64;asuncion.pe / ventas&#64;asuncion.pe</span>
              </p>
            </div>
          </section>

          <section class="space-y-2">
            <h2 class="text-base font-bold text-gray-900">6. Reembolso de Dinero</h2>
            <p>
              Los reembolsos aprobados se efectuarán mediante el mismo medio de pago utilizado por el cliente (reversión de tarjeta en pasarela o transferencia interbancaria directa) en un plazo máximo de tres (3) a cinco (5) días hábiles bancarios.
            </p>
          </section>
        </div>
      </div>
    </div>
  `,
})
export class RefundPolicyPageComponent {}
