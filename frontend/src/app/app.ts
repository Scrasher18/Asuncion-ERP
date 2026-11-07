import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { ApiConfigService } from './core/services/api-config.service';
import { CartDrawerComponent } from './shared/components/cart-drawer/cart-drawer.component';
import { FloatingCartComponent } from './shared/components/floating-cart/floating-cart.component';
import { ChatbotWidgetComponent } from './shared/components/chatbot-widget/chatbot-widget.component';
import { NavbarComponent } from './shared/components/navbar/navbar.component';
import { ToastContainerComponent } from './shared/components/toast-container/toast-container.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    NavbarComponent,
    CartDrawerComponent,
    FloatingCartComponent,
    ChatbotWidgetComponent,
    ToastContainerComponent,
  ],
  template: `
    <div class="min-h-screen flex flex-col bg-[#F8F9FA] text-gray-900">
      <app-navbar />

      <main class="flex-1">
        <router-outlet />
      </main>

      <!-- Professional E-Commerce Footer with Trust Strip & Full INDECOPI Compliance -->
      <footer class="border-t border-gray-200 bg-white text-gray-600 pb-24 lg:pb-12 mt-auto">
        <!-- 4-Pillar Trust & Value Proposition Strip -->
        <div class="border-b border-gray-100 bg-gray-50/70 py-6 px-4 sm:px-6 lg:px-8">
          <div class="mx-auto max-w-7xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-gray-200/70 shadow-2xs">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs font-extrabold text-gray-900">Compatibilidad OEM Garantizada</h5>
                <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">Repuestos certificados para flota pesada y vehículos livianos.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-gray-200/70 shadow-2xs">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.25V4.5A2.25 2.25 0 0012 2.25H4.5A2.25 2.25 0 002.25 4.5v9.75m12 0H2.25" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs font-extrabold text-gray-900">Despacho Express en Lima</h5>
                <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">Seguimiento satelital y constancia digital de recepción.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-gray-200/70 shadow-2xs">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs font-extrabold text-gray-900">Facturación Electrónica SUNAT</h5>
                <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">Emisión inmediata de Factura Comercial o Boleta en PDF.</p>
              </div>
            </div>

            <div class="flex items-start gap-3 rounded-xl bg-white p-3.5 border border-gray-200/70 shadow-2xs">
              <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-100">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
                </svg>
              </div>
              <div>
                <h5 class="text-xs font-extrabold text-gray-900">Tarifa Mayorista Automática</h5>
                <p class="text-[11px] text-gray-500 mt-0.5 leading-snug">Descuento directo para talleres llevando desde 4 unidades.</p>
              </div>
            </div>
          </div>
        </div>

        <div class="mx-auto max-w-7xl space-y-10 pt-10 px-4 sm:px-6 lg:px-8">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8 text-xs">
            
            <!-- Columna 1: Empresa e Identidad con Logo Real -->
            <div class="lg:col-span-4 space-y-3">
              <div class="flex items-center gap-3">
                <img
                  src="/images/logos/logo.jpg"
                  alt="Autopartes Asunción"
                  class="h-12 w-auto object-contain rounded-lg border border-gray-100 shadow-2xs"
                />
                <div>
                  <span class="block text-sm font-black text-gray-950">Autopartes Asunción</span>
                  <span class="block text-[11px] font-semibold text-orange-600">Camiones y Vehículos Automotores</span>
                </div>
              </div>

              <p class="text-gray-600 leading-relaxed">
                Venta mayorista y minorista de repuestos automotrices originales y alternativos garantizados. Especialistas en camiones, transporte pesado y vehículos livianos en Lima y todo el Perú.
              </p>

              <div class="space-y-1 text-gray-700 font-medium">
                <p><strong>RUC:</strong> <span class="font-mono">20608899114</span></p>
                <p><strong>Razón Social:</strong> REPUESTOS AUTOMOTRICES ASUNCIÓN S.A.C.</p>
                <p><strong>Dirección:</strong> Av. Sta. Ana 441, Lima 15011 (Santa Anita) - Perú</p>
              </div>
            </div>

            <!-- Columna 2: Atención al Cliente y Contacto -->
            <div class="lg:col-span-3 space-y-3">
              <h4 class="text-xs font-bold text-gray-950 uppercase tracking-wider">Atención al Cliente</h4>
              <ul class="space-y-2 text-gray-600">
                <li class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                  </svg>
                  <span>Central: <strong>(01) 424-8900</strong></span>
                </li>
                <li class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                  </svg>
                  <span>WhatsApp: <strong class="text-emerald-700">+51 987 654 321</strong></span>
                </li>
                <li class="flex items-center gap-2">
                  <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                  <span>Email: <strong>ventas&#64;asuncion.pe</strong></span>
                </li>
                <li class="pt-1 text-gray-500">
                  <span>Horario: Lunes a Sábado 8:00 AM - 6:00 PM</span>
                </li>
              </ul>

              <!-- Redes Sociales Activas -->
              <div class="pt-2">
                <span class="block text-[11px] font-semibold text-gray-700 mb-1.5">Síguenos en redes:</span>
                <div class="flex items-center gap-2">
                  <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white p-1 hover:border-blue-400 hover:shadow-xs transition" aria-label="Facebook">
                    <img src="/images/icons/facebook.png" alt="Facebook" width="22" height="22" loading="lazy" class="h-5.5 w-5.5 object-contain" />
                  </a>
                  <a href="https://instagram.com" target="_blank" rel="noopener noreferrer" class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white p-1 hover:border-pink-400 hover:shadow-xs transition" aria-label="Instagram">
                    <img src="/images/icons/instagram.jpg" alt="Instagram" width="22" height="22" loading="lazy" class="h-5.5 w-5.5 object-contain rounded-md" />
                  </a>
                  <a href="https://wa.me/51987654321" target="_blank" rel="noopener noreferrer" class="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white p-1 hover:border-emerald-400 hover:shadow-xs transition" aria-label="WhatsApp">
                    <img src="/images/icons/whatsapp.png" alt="WhatsApp" width="22" height="22" loading="lazy" class="h-5.5 w-5.5 object-contain" />
                  </a>
                </div>
              </div>
            </div>

            <!-- Columna 3: Información Legal Obligatoria -->
            <div class="lg:col-span-2 space-y-3">
              <h4 class="text-xs font-bold text-gray-950 uppercase tracking-wider">Legal y Políticas</h4>
              <ul class="space-y-2">
                <li>
                  <a routerLink="/terminos-y-condiciones" class="text-gray-600 hover:text-orange-600 font-medium transition block">
                    Términos y Condiciones
                  </a>
                </li>
                <li>
                  <a routerLink="/politica-devoluciones" class="text-gray-600 hover:text-orange-600 font-medium transition block">
                    Políticas de Cambios y Garantía
                  </a>
                </li>
                <li>
                  <a routerLink="/track" class="text-gray-600 hover:text-orange-600 font-medium transition block">
                    Seguimiento de Pedidos
                  </a>
                </li>
                <li>
                  <a routerLink="/login" class="text-gray-600 hover:text-orange-600 font-medium transition block">
                    Acceso de Clientes y Talleres
                  </a>
                </li>
              </ul>
            </div>

            <!-- Columna 4: Libro de Reclamaciones INDECOPI Oficial con Imagen Real -->
            <div class="lg:col-span-3 space-y-3">
              <h4 class="text-xs font-bold text-gray-950 uppercase tracking-wider">Libro de Reclamaciones</h4>
              
              <!-- Official INDECOPI Emblem Card -->
              <a
                routerLink="/libro-de-reclamaciones"
                class="group block rounded-xl overflow-hidden shadow-xs hover:shadow-md transition-all duration-200 active:scale-[0.98]"
              >
                <img
                  src="/images/icons/libro_reclamaciones.png"
                  alt="Libro de Reclamaciones Oficial INDECOPI"
                  class="w-full h-auto object-contain rounded-xl hover:brightness-105 transition duration-200"
                />
              </a>

              <p class="text-[10px] text-gray-500 leading-snug">
                Protección al consumidor garantizada. Respuestas formales dentro de los 15 días hábiles legales.
              </p>
            </div>

          </div>

          <!-- Bottom Row: Real Payment Logos (User's Exact Assets) & Copyright -->
          <div class="border-t border-gray-100 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-500">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <span class="font-medium text-gray-600">Medios de pago 100% seguros:</span>
              <img src="/images/logos/culqi-logo.png" alt="Culqi Checkout" width="56" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/visa.png" alt="Visa" width="48" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/mastercard.svg" alt="Mastercard" width="40" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/yape.jpg" alt="Yape" width="24" height="24" loading="lazy" class="h-6 w-auto object-contain rounded-md shadow-2xs hover:scale-105 transition" />
              <img src="/images/logos/plin.png" alt="Plin" width="42" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/bcp.png" alt="BCP" width="48" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/bbva.jpg" alt="BBVA" width="48" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
              <img src="/images/logos/interbank.png" alt="Interbank" width="48" height="24" loading="lazy" class="h-6 w-auto object-contain shadow-2xs rounded hover:scale-105 transition" />
            </div>

            <p class="text-center sm:text-right">
              &copy; 2026 Repuestos Automotrices Asunción S.A.C. · Todos los derechos reservados.
            </p>
          </div>
        </div>
      </footer>

      <app-floating-cart />
      <app-cart-drawer />
      <app-chatbot-widget />
      <app-toast-container />
    </div>
  `,
})
export class App {
  private readonly router = inject(Router);
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  constructor() {
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) {
        const url = evt.urlAfterRedirects || evt.url;
        if (typeof document !== 'undefined') {
          if (url.startsWith('/admin') || url.startsWith('/delivery') || url.startsWith('/pos')) {
            document.body.classList.add('hide-recaptcha');
          } else {
            document.body.classList.remove('hide-recaptcha');
          }
        }
      }
    });

    if (typeof window !== 'undefined') {
      // Proactive cloud backend keep-alive ping to prevent cold-start spin-down while browsing
      const pingBackend = () => {
        this.http.get(`${this.apiConfig.apiUrl}/catalog/categories`).subscribe({ error: () => {} });
      };
      setTimeout(pingBackend, 500);
      setInterval(pingBackend, 4 * 60 * 1000);
      // Toggle expansion when clicking/pulsando on the reCAPTCHA badge iframe
      window.addEventListener('blur', () => {
        const badge = document.querySelector('.grecaptcha-badge');
        if (badge && document.activeElement && badge.contains(document.activeElement)) {
          badge.classList.toggle('expanded');
        }
      });
      document.addEventListener('click', (e) => {
        const badge = document.querySelector('.grecaptcha-badge');
        if (badge && !badge.contains(e.target as Node)) {
          badge.classList.remove('expanded');
        }
      });
    }
  }
}
