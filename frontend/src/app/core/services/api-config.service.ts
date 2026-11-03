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

  getCategoryFallback(categoryName?: string | null): string {
    const cat = (categoryName || '').toUpperCase();
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

  resolveMediaUrl(rawUrl?: string | null, fallbackSku?: string, fallbackBrand?: string): string {
    const sku = (fallbackSku || '').trim().toLowerCase();

    // If rawUrl is missing, check if we have a known SKU or return placeholder
    if (!rawUrl || !rawUrl.trim()) {
      if (sku && sku.startsWith('asu-')) {
        return `/uploads/parts/${sku}.webp`;
      }
      return buildPartPlaceholderDataUri(fallbackSku || 'OEM', fallbackBrand || 'Asunción');
    }

    const url = rawUrl.trim();

    // Clean up local development MinIO / localhost URLs that trigger browser PNA security prompts
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      if (url.includes('/parts/')) {
        const partsMatch = url.match(/\/parts\/([^\/\?]+)/i);
        if (partsMatch && partsMatch[1]) {
          return `/uploads/parts/${partsMatch[1].toLowerCase().replace(/\.webp$/i, '')}.webp`;
        }
      }
      if (sku && sku.startsWith('asu-')) {
        return `/uploads/parts/${sku}.webp`;
      }
      return this.getCategoryFallback(fallbackBrand);
    }

    // Static assets hosted on Vercel frontend root
    if (url.startsWith('/uploads/') || url.startsWith('/images/') || url.startsWith('/icons/')) {
      return url;
    }

    // Fully qualified external URLs (HTTPS or data/blob)
    if (
      url.startsWith('https://') ||
      url.startsWith('http://') ||
      url.startsWith('data:') ||
      url.startsWith('blob:')
    ) {
      return url;
    }

    // Relative backend URLs
    if (url.startsWith('/')) {
      return `${this.backendOrigin}${url}`;
    }
    return `${this.backendOrigin}/${url}`;
  }

  resolvePartPrimaryImage(part: Part): string {
    const sku = (part.sku || '').trim().toLowerCase();

    // 1. If part has an explicit primaryImageUrl
    if (part.primaryImageUrl && part.primaryImageUrl.trim()) {
      const resolved = this.resolveMediaUrl(part.primaryImageUrl, part.sku, part.manufacturerBrand);
      if (resolved && !resolved.includes('localhost')) {
        return resolved;
      }
    }

    // 2. If part has gallery images
    if (part.images && part.images.length > 0) {
      const primary = part.images.find((img) => this.isPrimary(img)) || part.images[0];
      if (primary && primary.imageUrl) {
        const resolved = this.resolveMediaUrl(primary.imageUrl, part.sku, part.manufacturerBrand);
        if (resolved && !resolved.includes('localhost')) {
          return resolved;
        }
      }
    }

    // 3. Directly map to standard SKU WebP if available
    if (sku && sku.startsWith('asu-')) {
      return `/uploads/parts/${sku}.webp`;
    }

    // 4. Fallback to category photo
    return this.getCategoryFallback(part.categoryName);
  }

  isPrimary(img: PartImage): boolean {
    return Boolean(img.primary ?? img.isPrimary);
  }
}
