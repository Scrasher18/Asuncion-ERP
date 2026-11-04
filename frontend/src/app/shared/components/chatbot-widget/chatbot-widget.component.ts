import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { Order, Part } from '../../../core/models/api.models';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../core/services/cart.service';
import { ChatbotService } from '../../../core/services/chatbot.service';

interface ChatMessageItem {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  intent?: string;
  engineUsed?: string;
  suggestedParts?: Part[];
  trackedOrder?: Order | null;
  timestamp: Date;
}

@Component({
  selector: 'app-chatbot-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (shouldShow()) {
    <div class="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 flex flex-col items-end">
      <!-- Chat Window -->
      @if (isOpen()) {
        <div class="mb-3 w-[calc(100vw-2rem)] sm:w-[380px] max-h-[70vh] sm:max-h-[540px] flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
          <!-- Orange Top Accent Bar -->
          <div class="h-1 w-full bg-orange-600"></div>

          <!-- Header -->
          <div class="border-b border-gray-200 bg-white px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <div class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-orange-50 text-orange-600 border border-orange-200">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
                <span class="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500"></span>
              </div>
              <div>
                <h3 class="text-xs font-bold text-gray-900">
                  Asistente Asunción
                </h3>
                <p class="text-[11px] text-gray-500">
                  Consultas de stock y pedidos
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="isOpen.set(false)"
              class="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
              aria-label="Cerrar asistente"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Messages Feed -->
          <div
            #scrollContainer
            class="flex-1 overflow-y-auto bg-[#F8F9FA] p-3.5 space-y-3 max-h-[340px]"
          >
            @for (msg of messages(); track msg.id) {
              <div [class]="msg.sender === 'user' ? 'flex justify-end' : 'flex justify-start'">
                <div
                  [class]="
                    msg.sender === 'user'
                      ? 'bg-orange-600 text-white rounded-2xl rounded-br-xs'
                      : 'bg-white text-gray-800 border border-gray-200 rounded-2xl rounded-bl-xs shadow-2xs'
                  "
                  class="max-w-[88%] px-3.5 py-2.5 text-xs space-y-2"
                >
                  <div class="whitespace-pre-line leading-relaxed text-xs" [innerHTML]="formatMessageText(msg.text)"></div>

                  <!-- Inline Suggested Spare Parts Cards -->
                  @if (msg.suggestedParts && msg.suggestedParts.length > 0) {
                    <div class="space-y-1.5 pt-1">
                      @for (part of msg.suggestedParts; track part.id) {
                        <div class="flex items-center justify-between gap-2 rounded-xl border border-gray-200 bg-gray-50 p-2.5">
                          <div
                            (click)="openPart(part.id)"
                            class="min-w-0 flex-1 cursor-pointer hover:text-orange-600 transition"
                          >
                            <p class="font-semibold text-gray-900 text-[11px] line-clamp-3 leading-snug" [title]="part.name">
                              {{ part.name }}
                            </p>
                            <div class="flex items-center gap-1.5 text-[10px] text-gray-500">
                              @if (part.oemCode) {
                                <span class="font-mono">OEM {{ part.oemCode }}</span>
                                <span>·</span>
                              }
                              <span
                                [class]="
                                  part.stockQuantity > 0 ? 'text-emerald-700 font-medium' : 'text-red-600'
                                "
                              >
                                {{ part.stockQuantity > 0 ? 'Stock: ' + part.stockQuantity : 'Agotado' }}
                              </span>
                            </div>
                          </div>
                          <div class="text-right shrink-0">
                            <span class="block text-xs font-bold text-gray-900">
                              S/ {{ part.salePrice | number: '1.2-2' }}
                            </span>
                            <button
                              type="button"
                              [disabled]="part.stockQuantity <= 0"
                              (click)="cart.addPart(part, 1)"
                              class="mt-1 rounded-md bg-orange-600 px-2 py-1 text-[10px] font-semibold text-white hover:bg-orange-700 disabled:opacity-40 transition"
                            >
                              Agregar
                            </button>
                          </div>
                        </div>
                      }
                    </div>
                  }

                  <!-- Inline Tracked Order Status Card -->
                  @if (msg.trackedOrder; as order) {
                    <div class="rounded-xl border border-orange-200 bg-orange-50/60 p-2.5 space-y-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <span class="font-mono text-[11px] font-semibold text-gray-900">
                          {{ order.orderNumber }}
                        </span>
                        <span class="rounded-full border border-orange-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-orange-700">
                          {{ formatOrderStatus(order.status) }}
                        </span>
                      </div>
                      <p class="text-[11px] text-gray-700">
                        Entrega: <strong>{{ order.deliveryType === 'PICKUP' ? 'Recojo en tienda' : 'Envío a domicilio' }}</strong> · Total:
                        <strong>
                          S/ {{ (order.totalAmount ?? order.total ?? order.subtotal) | number: '1.2-2' }}
                        </strong>
                      </p>
                      <button
                        type="button"
                        (click)="openTracker(order.orderNumber)"
                        class="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-700 hover:text-orange-800"
                      >
                        <span>Ver seguimiento completo</span>
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                      </button>
                    </div>
                  }
                </div>
              </div>
            }

            @if (isSending()) {
              <div class="flex justify-start">
                <div class="rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-500 flex items-center gap-2">
                  <span class="inline-block h-2 w-2 animate-pulse rounded-full bg-orange-600"></span>
                  Consultando disponibilidad...
                </div>
              </div>
            }
          </div>

          <!-- Quick Reply Chips -->
          @if (quickReplies().length > 0) {
            <div class="border-t border-gray-200 bg-white px-3 py-2 flex gap-1.5 overflow-x-auto">
              @for (chip of quickReplies(); track chip) {
                <button
                  type="button"
                  (click)="sendQuickReply(chip)"
                  class="shrink-0 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-700 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700 transition"
                >
                  {{ chip }}
                </button>
              }
            </div>
          }

          <!-- Input Box -->
          <form (ngSubmit)="submitMessage()" class="border-t border-gray-200 bg-white p-2.5 flex gap-2">
            <input
              type="text"
              [(ngModel)]="draftMessage"
              name="chatInput"
              placeholder="Ej: Pastillas Hilux 2021 o pedido ASU-..."
              class="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-base sm:text-xs text-gray-900 placeholder-gray-400 focus:border-orange-600 focus:bg-white focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
            />
            <button
              type="submit"
              [disabled]="isSending() || !draftMessage.trim()"
              class="rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-40 transition"
            >
              Enviar
            </button>
          </form>
        </div>
      }

      <!-- Floating Trigger Pill -->
      <button
        type="button"
        (click)="isOpen.set(!isOpen())"
        class="group inline-flex min-h-[44px] items-center gap-2 rounded-full bg-orange-600 px-4 py-2.5 text-white shadow-md hover:bg-orange-700 transition"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.85">
          @if (isOpen()) {
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          } @else {
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          }
        </svg>
        <span class="text-xs font-semibold">
          {{ isOpen() ? 'Cerrar chat' : 'Asistente Asunción' }}
        </span>
      </button>
    </div>
    }
  `,
})
export class ChatbotWidgetComponent {
  readonly currentUrl = signal<string>(typeof window !== 'undefined' ? window.location.pathname : '');

  constructor() {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
      }
    });
  }

  shouldShow(): boolean {
    const url = this.currentUrl() || (typeof window !== 'undefined' ? window.location.pathname : '');
    if (!url) return true;
    if (
      url.startsWith('/admin') ||
      url.startsWith('/delivery') ||
      url.startsWith('/login') ||
      url.startsWith('/register') ||
      url.startsWith('/recuperar-clave') ||
      url.startsWith('/reset-password')
    ) {
      return false;
    }
    if (this.cart.isDrawerOpen()) {
      return false;
    }
    return true;
  }

  readonly auth = inject(AuthService);
  private readonly chatbotService = inject(ChatbotService);
  readonly cart = inject(CartService);
  private readonly router = inject(Router);

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLDivElement>;

  readonly isOpen = signal(false);
  readonly isSending = signal(false);
  draftMessage = '';

  readonly quickReplies = signal<string[]>([
    'Repuestos para Toyota Hilux 2021',
    '¿Tienen pastillas de freno en stock?',
    '¿Cuál es la cobertura de envío?',
    '¿Cómo rastreo mi pedido?',
  ]);

  readonly messages = signal<ChatMessageItem[]>([
    {
      id: 'welcome-1',
      sender: 'bot',
      text: 'Hola, bienvenido a Repuestos Asunción. Puedo ayudarte a encontrar piezas compatibles con tu vehículo, consultar stock disponible o revisar el estado de tu pedido.',
      timestamp: new Date(),
    },
  ]);

  formatOrderStatus(status: string): string {
    switch (status) {
      case 'CONFIRMADO':
        return 'Confirmado';
      case 'EN_PREPARACION':
        return 'En preparación';
      case 'LISTO_PARA_DESPACHO':
        return 'Listo para envío';
      case 'EN_RUTA':
        return 'En camino';
      case 'ENTREGADO':
        return 'Entregado';
      default:
        return status;
    }
  }

  formatMessageText(text: string): string {
    if (!text) return '';
    // Strip unnecessary emojis (microscope, lightbulb, vehicle, package, trophy, star, etc.)
    let formatted = text.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    // Completely remove markdown asterisks (** and *) to present clean text without bolding artifacts
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1');
    formatted = formatted.replace(/\*(.*?)\*/g, '$1');
    formatted = formatted.replace(/\*+/g, '');
    return formatted.trim();
  }

  sendQuickReply(chip: string): void {
    this.draftMessage = chip;
    this.submitMessage();
  }

  submitMessage(): void {
    const text = this.draftMessage.trim();
    if (!text || this.isSending()) return;

    this.draftMessage = '';
    this.messages.update((list) => [
      ...list,
      {
        id: `u-${Date.now()}`,
        sender: 'user',
        text,
        timestamp: new Date(),
      },
    ]);
    this.scrollToBottom();

    const lower = text.toLowerCase();
    if (
      (lower.includes('mis pedido') ||
        lower.includes('mis compra') ||
        lower.includes('mi cuenta') ||
        lower.includes('historial')) &&
      !this.auth.isAuthenticated()
    ) {
      this.messages.update((list) => [
        ...list,
        {
          id: `b-${Date.now()}`,
          sender: 'bot',
          text: 'Para consultar el historial de tus compras y pedidos registrados, debes iniciar sesión con tu cuenta de cliente. Puedes ingresar desde la opción "Iniciar sesión" en el menú superior.',
          timestamp: new Date(),
        },
      ]);
      this.scrollToBottom();
      return;
    }

    this.isSending.set(true);
    this.chatbotService
      .sendMessage(text)
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: (res) => {
          this.messages.update((list) => [
            ...list,
            {
              id: `b-${Date.now()}`,
              sender: 'bot',
              text: res.reply,
              intent: res.intent,
              engineUsed: res.engineUsed,
              suggestedParts: res.suggestedParts,
              trackedOrder: res.trackedOrder,
              timestamp: new Date(),
            },
          ]);
          if (res.quickReplies && res.quickReplies.length > 0) {
            this.quickReplies.set(res.quickReplies);
          }
          this.scrollToBottom();
        },
        error: () => {
          this.messages.update((list) => [
            ...list,
            {
              id: `err-${Date.now()}`,
              sender: 'bot',
              text: 'En este momento no pudimos procesar tu consulta. Por favor, verifica tu conexión e inténtalo nuevamente.',
              timestamp: new Date(),
            },
          ]);
          this.scrollToBottom();
        },
      });
  }

  openPart(partId: number): void {
    void this.router.navigate(['/part', partId]);
  }

  openTracker(orderNumber: string): void {
    void this.router.navigate(['/track'], { queryParams: { order: orderNumber } });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.scrollContainer?.nativeElement;
      if (el) {
        el.scrollTop = el.scrollHeight;
      }
    }, 40);
  }
}
