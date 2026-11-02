import { Injectable, signal } from '@angular/core';
import { ToastMessage } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<ToastMessage[]>([]);

  show(type: ToastMessage['type'], title: string, message: string, durationMs = 5000): void {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.toasts.update((list) => [...list, { id, type, title, message }]);
    if (durationMs > 0) {
      setTimeout(() => this.dismiss(id), durationMs);
    }
  }

  success(title: string, message: string): void {
    this.show('success', title, message, 4200);
  }

  error(title: string, message: string): void {
    this.show('error', title, message, 6500);
  }

  warning(title: string, message: string): void {
    this.show('warning', title, message, 5500);
  }

  info(title: string, message: string): void {
    this.show('info', title, message, 4500);
  }

  dismiss(id: string): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }
}
