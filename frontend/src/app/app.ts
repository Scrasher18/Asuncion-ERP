import { Component, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { CartDrawerComponent } from './shared/components/cart-drawer/cart-drawer.component';
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
    ChatbotWidgetComponent,
    ToastContainerComponent,
  ],
  template: `
    <div class="min-h-screen flex flex-col bg-[#F8F9FA] text-gray-900">
      <app-navbar />

      <main class="flex-1">
        <router-outlet />
      </main>

      <!-- Professional E-Commerce Footer with Full INDECOPI & Legal Compliance -->
      <footer class="border-t border-gray-200 bg-white text-gray-600 pt-12 pb-24 lg:pb-12 px-4 sm:px-6 lg:px-8 mt-auto">
        <div class="mx-auto max-w-7xl space-y-10">
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

      <app-cart-drawer />
      <app-chatbot-widget />
      <app-toast-container />
    </div>
  `,
})
export class App {
  private readonly router = inject(Router);

  constructor() {
    this.router.events.subscribe((evt) => {
      if (evt instanceof NavigationEnd) {
        const url = evt.urlAfterRedirects || evt.url;
        if (typeof document !== 'undefined') {
          if (url.startsWith('/admin') || url.startsWith('/delivery')) {
            document.body.classList.add('hide-recaptcha');
          } else {
            document.body.classList.remove('hide-recaptcha');
          }
        }
      }
    });

    if (typeof window !== 'undefined') {
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
