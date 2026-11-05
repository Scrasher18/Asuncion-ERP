import { inject, Injectable, signal } from '@angular/core';
import { ToastService } from './toast.service';

export interface DriverRatingItem {
  id: string;
  orderNumber: string;
  driverName: string;
  driverEmail: string;
  customerName: string;
  stars: number; // 1 to 5
  tags: string[];
  comment?: string;
  createdAt: string;
}

export interface DriverRatingStats {
  driverName: string;
  averageRating: number;
  totalReviews: number;
  starDistribution: { [key: number]: number };
}

const STORAGE_KEY = 'asuncion_driver_ratings';

// No se incluyen calificaciones ni comentarios ficticios.
// Todas las opiniones deben provenir exclusivamente de clientes reales al recibir su entrega.
const INITIAL_RATINGS: DriverRatingItem[] = [];

@Injectable({
  providedIn: 'root',
})
export class DriverRatingService {
  private readonly toast = inject(ToastService);
  readonly ratings = signal<DriverRatingItem[]>([]);

  constructor() {
    this.loadRatings();
  }

  loadRatings(): void {
    if (typeof window === 'undefined') {
      this.ratings.set([]);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtrar y purgar cualquier calificación ficticia o de prueba inicial
          const realRatings = parsed.filter(
            (r: DriverRatingItem) =>
              r &&
              r.id &&
              !r.id.startsWith('rate-1') &&
              !r.id.startsWith('rate-2') &&
              !r.id.startsWith('rate-3') &&
              !r.id.startsWith('rate-4') &&
              r.orderNumber &&
              !r.orderNumber.startsWith('ASN-HIST-') &&
              r.customerName !== 'Ing. Marco Antonio Vera' &&
              r.customerName !== 'Roberto Vargas Sánchez' &&
              r.customerName !== 'Luis Alberto Huerta' &&
              r.customerName !== 'Pedro Pablo Quispe'
          );
          this.ratings.set(realRatings);
          this.persist(realRatings);
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading driver ratings from localStorage:', e);
    }
    this.ratings.set([]);
    this.persist([]);
  }

  submitRating(data: Omit<DriverRatingItem, 'id' | 'createdAt'>): DriverRatingItem {
    const date = new Date();
    const formattedDate = date.toLocaleDateString('es-PE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const newRating: DriverRatingItem = {
      ...data,
      id: `rate-${Date.now()}`,
      createdAt: formattedDate,
    };

    const updated = [newRating, ...this.ratings()];
    this.ratings.set(updated);
    this.persist(updated);
    this.toast.success('¡Gracias por tu calificación!', `Has calificado la entrega de ${data.driverName} con ${data.stars} estrellas ⭐.`);
    return newRating;
  }

  hasRated(orderNumber: string): boolean {
    return this.ratings().some((r) => r.orderNumber === orderNumber);
  }

  getRatingByOrder(orderNumber: string): DriverRatingItem | undefined {
    return this.ratings().find((r) => r.orderNumber === orderNumber);
  }

  getRatingsForDriver(driverName: string = 'Miguel Ángel Flores'): DriverRatingItem[] {
    return this.ratings().filter(
      (r) => !driverName || r.driverName.toLowerCase().includes(driverName.toLowerCase())
    );
  }

  getTopTagsForDriver(driverName: string = 'Miguel Ángel Flores'): string[] {
    const driverReviews = this.getRatingsForDriver(driverName);
    const tagCounts: { [tag: string]: number } = {};
    for (const r of driverReviews) {
      if (Array.isArray(r.tags)) {
        for (const t of r.tags) {
          tagCounts[t] = (tagCounts[t] || 0) + 1;
        }
      }
    }
    return Object.entries(tagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag);
  }

  getDriverStats(driverName: string = 'Miguel Ángel Flores'): DriverRatingStats {
    const driverReviews = this.getRatingsForDriver(driverName);

    if (driverReviews.length === 0) {
      return {
        driverName,
        averageRating: 0.0,
        totalReviews: 0,
        starDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    const starDistribution: { [key: number]: number } = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    let sum = 0;

    for (const r of driverReviews) {
      const s = Math.min(5, Math.max(1, Math.round(r.stars)));
      starDistribution[s] = (starDistribution[s] || 0) + 1;
      sum += r.stars;
    }

    const averageRating = Number((sum / driverReviews.length).toFixed(1));

    return {
      driverName,
      averageRating,
      totalReviews: driverReviews.length,
      starDistribution,
    };
  }

  private persist(records: DriverRatingItem[]): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      } catch (e) {
        console.warn('Error saving ratings to localStorage:', e);
      }
    }
  }
}
