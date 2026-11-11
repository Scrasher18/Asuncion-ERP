import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService } from '../../../core/services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pointer-events-none fixed top-20 right-4 left-4 sm:left-auto z-[10050] flex flex-col gap-2.5 sm:max-w-sm sm:w-full">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          [class]="cardClasses(toast.type)"
          class="pointer-events-auto rounded-xl border bg-white p-3.5 shadow-lg flex items-start gap-3 transition-all"
        >
          <div [class]="iconWrapClasses(toast.type)" class="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg">
            @switch (toast.type) {
              @case ('success') {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              }
              @case ('error') {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              }
              @case ('warning') {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              }
              @default {
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              }
            }
          </div>

          <div class="flex-1 min-w-0 space-y-0.5">
            <p class="text-xs font-semibold text-gray-900">{{ toast.title }}</p>
            <p class="text-xs text-gray-600 leading-snug">{{ toast.message }}</p>
          </div>

          <button
            type="button"
            (click)="toastService.dismiss(toast.id)"
            class="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
            aria-label="Cerrar notificación"
          >
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastContainerComponent {
  readonly toastService = inject(ToastService);

  cardClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'border-emerald-200';
      case 'error':
        return 'border-red-200';
      case 'warning':
        return 'border-orange-200';
      default:
        return 'border-gray-200';
    }
  }

  iconWrapClasses(type: string): string {
    switch (type) {
      case 'success':
        return 'bg-emerald-50 text-emerald-600';
      case 'error':
        return 'bg-red-50 text-red-600';
      case 'warning':
        return 'bg-orange-50 text-orange-600';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  }
}
