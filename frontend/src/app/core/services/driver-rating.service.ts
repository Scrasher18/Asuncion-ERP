import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { ToastService } from './toast.service';
import { SyncBusService } from './sync-bus.service';

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

const STORAGE_KEY = 'asuncion_driver_ratings_v2';
const API_URL = '/api/v1/driver-reviews';

@Injectable({
  providedIn: 'root',
})
export class DriverRatingService {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly syncBus = inject(SyncBusService);
  readonly ratings = signal<DriverRatingItem[]>([]);

  constructor() {
    this.loadFromCache();
    this.loadRatings();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (evt) => {
        if (evt.key === STORAGE_KEY) {
          this.loadFromCache();
        }
      });

      this.syncBus.on('REVIEW_CREATED', () => {
        this.loadRatings();
      });
    }
  }

  private loadFromCache(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ratings.set(this.cleanReviews(parsed));
        }
      }
    } catch {
      // ignore
    }
  }

  loadRatings(): void {
    // 1. Fetch persistent reviews from PostgreSQL backend
    this.http.get<DriverRatingItem[]>(API_URL).subscribe({
      next: (serverReviews) => {
        if (Array.isArray(serverReviews) && serverReviews.length > 0) {
          const cleaned = this.cleanReviews(serverReviews);
          this.ratings.set(cleaned);
          this.persist(cleaned);
        } else {
          // If server returned empty, fallback to local cache
          this.loadFromCache();
        }
      },
      error: () => {
        // Fallback to local cache if offline or error
        this.loadFromCache();
      },
    });
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

    // Optimistic update
    const updated = [newRating, ...this.ratings().filter((r) => r.orderNumber !== data.orderNumber)];
    this.ratings.set(updated);
    this.persist(updated);
    this.syncBus.emit('REVIEW_CREATED', { orderNumber: data.orderNumber });
    this.toast.success('¡Gracias por tu calificación!', `Has calificado la entrega de ${data.driverName} con ${data.stars} estrellas ⭐.`);

    // Persist to backend database via REST API
    this.http.post<DriverRatingItem>(API_URL, newRating).subscribe({
      next: (saved) => {
        if (saved && saved.id) {
          const synced = this.ratings().map((r) => (r.orderNumber === data.orderNumber ? saved : r));
          this.ratings.set(synced);
          this.persist(synced);
        }
      },
      error: (err) => {
        console.warn('Review persisted locally, backend sync warning:', err);
      },
    });

    return newRating;
  }

  hasRated(orderNumber: string): boolean {
    return this.ratings().some((r) => r.orderNumber === orderNumber);
  }

  getRatingByOrder(orderNumber: string): DriverRatingItem | undefined {
    return this.ratings().find((r) => r.orderNumber === orderNumber);
  }

  private cleanReviews(list: DriverRatingItem[]): DriverRatingItem[] {
    return list.filter(
      (r) =>
        r &&
        r.orderNumber &&
        !r.orderNumber.startsWith('ASN-HIST-') &&
        r.customerName !== 'Ing. Marco Antonio Vera' &&
        r.customerName !== 'Roberto Vargas Sánchez'
    );
  }

  private normalizeStr(str: string): string {
    return (str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  getRatingsForDriver(driverName: string = 'Miguel Ángel Flores'): DriverRatingItem[] {
    const normSearch = this.normalizeStr(driverName);
    return this.ratings().filter((r) => {
      if (!normSearch) return true;
      const normDriver = this.normalizeStr(r.driverName);
      return normDriver.includes(normSearch) || normSearch.includes(normDriver);
    });
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
