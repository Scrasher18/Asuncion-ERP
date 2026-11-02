import { Injectable, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { buildPartPlaceholderDataUri, Part, PartImage } from '../models/api.models';

const GMAPS_STORAGE_KEY = 'asuncion_google_maps_api_key';

@Injectable({ providedIn: 'root' })
export class ApiConfigService {
  private readonly storedMapsKey =
    typeof window !== 'undefined' ? localStorage.getItem(GMAPS_STORAGE_KEY) || '' : '';

  readonly googleMapsApiKey = signal<string>(
    (environment.googleMapsApiKey || this.storedMapsKey || '').trim()
  );

  get apiUrl(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return '/api/v1';
      }
    }
    return environment.apiUrl;
  }

  get backendOrigin(): string {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1') {
        return window.location.origin;
      }
    }
    return environment.backendOrigin || 'http://localhost:8080';
  }

  setGoogleMapsApiKey(key: string): void {
    const trimmed = key.trim();
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem(GMAPS_STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(GMAPS_STORAGE_KEY);
      }
    }
    this.googleMapsApiKey.set(trimmed);
  }

  resolveMediaUrl(rawUrl?: string | null, fallbackSku?: string, fallbackBrand?: string): string {
    if (!rawUrl || !rawUrl.trim()) {
      return buildPartPlaceholderDataUri(fallbackSku || 'OEM', fallbackBrand || 'Asunción');
    }
    const url = rawUrl.trim();
    if (
      url.startsWith('http://') ||
      url.startsWith('https://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return url;
    }
    if (url.startsWith('/')) {
      return `${this.backendOrigin}${url}`;
    }
    return `${this.backendOrigin}/${url}`;
  }

  resolvePartPrimaryImage(part: Part): string {
    if (part.primaryImageUrl) {
      return this.resolveMediaUrl(part.primaryImageUrl, part.oemCode || part.sku, part.manufacturerBrand);
    }
    if (part.images && part.images.length > 0) {
      const primary = part.images.find((img) => this.isPrimary(img)) || part.images[0];
      return this.resolveMediaUrl(primary.imageUrl, part.oemCode || part.sku, part.manufacturerBrand);
    }

    // High-resolution automotive category photography fallback instead of plain icon
    const cat = (part.categoryName || '').toUpperCase();
    if (cat.includes('FREN')) return '/images/categories/frenos.jpg';
    if (cat.includes('FILTR') || cat.includes('LUBRIC')) return '/images/categories/filtros.jpg';
    if (cat.includes('ELEC') || cat.includes('ILUM') || cat.includes('FOCO')) return '/images/categories/electrico.jpg';
    if (cat.includes('SUSP') || cat.includes('DIREC')) return '/images/categories/suspension.jpg';
    if (cat.includes('MOT') || cat.includes('DISTRIB')) return '/images/categories/motor.jpg';
    if (cat.includes('TRANSM') || cat.includes('EMBRAG')) return '/images/categories/transmision.jpg';
    if (cat.includes('REFRIG') || cat.includes('CLIM')) return '/images/categories/refrigeracion.jpg';
    if (cat.includes('CARROC') || cat.includes('FARO')) return '/images/categories/carroceria.jpg';

    return '/images/categories/frenos.jpg';
  }

  isPrimary(img: PartImage): boolean {
    return Boolean(img.primary ?? img.isPrimary);
  }
}
