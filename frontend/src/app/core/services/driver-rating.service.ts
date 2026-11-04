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

const INITIAL_RATINGS: DriverRatingItem[] = [
  {
    id: 'rate-1',
    orderNumber: 'ASN-2026-0001',
    driverName: 'Miguel Ángel Flores',
    driverEmail: 'motorizado@asuncion.pe',
    customerName: 'Ing. Marco Antonio Vera',
    stars: 5,
    tags: ['Muy puntual', 'Repuesto sellado', 'Amable'],
    comment: 'Llegó en menos de 20 minutos con el empaque impecable. Excelente servicio motorizado.',
    createdAt: '30/10/2026 18:20',
  },
  {
    id: 'rate-2',
    orderNumber: 'ASN-2026-0002',
    driverName: 'Miguel Ángel Flores',
    driverEmail: 'motorizado@asuncion.pe',
    customerName: 'Roberto Vargas Sánchez',
    stars: 5,
    tags: ['Llegó rápido', 'Cobro con QR fácil'],
    comment: 'Me mostró el QR de Yape desde su celular y pagué en 10 segundos. Muy recomendado.',
    createdAt: '31/10/2026 19:45',
  },
  {
    id: 'rate-3',
    orderNumber: 'ASN-2026-0003',
    driverName: 'Miguel Ángel Flores',
    driverEmail: 'motorizado@asuncion.pe',
    customerName: 'Luis Alberto Huerta',
    stars: 5,
    tags: ['Entrega con cuidado', 'Puntual'],
    comment: 'Cuidó muy bien las piezas pesadas de suspensión. Gran profesional.',
    createdAt: '02/11/2026 15:10',
  },
  {
    id: 'rate-4',
    orderNumber: 'ASN-2026-0004',
    driverName: 'Miguel Ángel Flores',
    driverEmail: 'motorizado@asuncion.pe',
    customerName: 'Pedro Pablo Quispe',
    stars: 4,
    tags: ['Amable', 'Buen trato'],
    comment: 'Buen servicio, el tráfico demoró un poco pero avisó en todo momento.',
    createdAt: '03/11/2026 11:30',
  },
];

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
      this.ratings.set(INITIAL_RATINGS);
      return;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.ratings.set(parsed);
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading driver ratings from localStorage:', e);
    }
    this.ratings.set(INITIAL_RATINGS);
    this.persist(INITIAL_RATINGS);
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

  getDriverStats(driverName: string = 'Miguel Ángel Flores'): DriverRatingStats {
    const driverReviews = this.ratings().filter(
      (r) => !driverName || r.driverName.toLowerCase().includes(driverName.toLowerCase())
    );

    if (driverReviews.length === 0) {
      return {
        driverName,
        averageRating: 5.0,
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
