import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Category,
  Part,
  PartAutocompleteSuggestion,
  PartUpsertRequest,
  ReservationSyncResponse,
  VehicleMake,
  VehicleModel,
  VehicleModelSuggestion,
  VehicleQuickImportRequest,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';

export interface CatalogFilterParams {
  q?: string;
  categoryId?: number | null;
  makeId?: number | null;
  modelId?: number | null;
  year?: number | null;
  onlyInStock?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  getCategories(): Observable<Category[]> {
    return this.http.get<Category[]>(`${this.apiConfig.apiUrl}/catalog/categories`);
  }

  getVehicleMakes(): Observable<VehicleMake[]> {
    return this.http.get<VehicleMake[]>(`${this.apiConfig.apiUrl}/catalog/vehicle-makes`);
  }

  getVehicleModels(makeId?: number | null): Observable<VehicleModel[]> {
    let params = new HttpParams();
    if (makeId) {
      params = params.set('makeId', String(makeId));
    }
    return this.http.get<VehicleModel[]>(`${this.apiConfig.apiUrl}/catalog/vehicle-models`, {
      params,
    });
  }

  searchParts(filters: CatalogFilterParams = {}): Observable<Part[]> {
    let params = new HttpParams();
    if (filters.q && filters.q.trim()) {
      params = params.set('q', filters.q.trim());
    }
    if (filters.categoryId) {
      params = params.set('categoryId', String(filters.categoryId));
    }
    if (filters.makeId) {
      params = params.set('makeId', String(filters.makeId));
    }
    if (filters.modelId) {
      params = params.set('modelId', String(filters.modelId));
    }
    if (filters.year) {
      params = params.set('year', String(filters.year));
    }
    if (filters.onlyInStock) {
      params = params.set('onlyInStock', 'true');
    }
    return this.http.get<Part[]>(`${this.apiConfig.apiUrl}/catalog/parts`, { params });
  }

  getPartById(id: number): Observable<Part> {
    return this.http.get<Part>(`${this.apiConfig.apiUrl}/catalog/parts/${id}`);
  }

  syncReservations(
    sessionId: string,
    items: { partId: number; quantity: number }[]
  ): Observable<ReservationSyncResponse> {
    return this.http.post<ReservationSyncResponse>(
      `${this.apiConfig.apiUrl}/catalog/reservations/sync`,
      { sessionId, items }
    );
  }

  getReservationsStatus(): Observable<Record<number, number>> {
    return this.http.get<Record<number, number>>(
      `${this.apiConfig.apiUrl}/catalog/reservations/status`
    );
  }

  // ===================== ADMIN ERP ENDPOINTS =====================

  getAdminParts(lowStockOnly = false): Observable<Part[]> {
    let params = new HttpParams();
    if (lowStockOnly) {
      params = params.set('lowStockOnly', 'true');
    }
    return this.http.get<Part[]>(`${this.apiConfig.apiUrl}/admin/parts`, { params });
  }

  createPart(payload: PartUpsertRequest): Observable<Part> {
    return this.http.post<Part>(`${this.apiConfig.apiUrl}/admin/parts`, payload);
  }

  updatePart(id: number, payload: PartUpsertRequest): Observable<Part> {
    return this.http.put<Part>(`${this.apiConfig.apiUrl}/admin/parts/${id}`, payload);
  }

  deletePart(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiConfig.apiUrl}/admin/parts/${id}`);
  }

  uploadPartImages(partId: number, files: File[], primaryIndex?: number | null): Observable<Part> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    if (primaryIndex !== undefined && primaryIndex !== null && primaryIndex >= 0) {
      formData.append('primaryIndex', String(primaryIndex));
    }
    return this.http.post<Part>(`${this.apiConfig.apiUrl}/admin/parts/${partId}/images`, formData);
  }

  setPrimaryPartImage(partId: number, imageId: number): Observable<Part> {
    return this.http.put<Part>(
      `${this.apiConfig.apiUrl}/admin/parts/${partId}/images/${imageId}/primary`,
      {}
    );
  }

  deletePartImage(partId: number, imageId: number): Observable<Part> {
    return this.http.delete<Part>(
      `${this.apiConfig.apiUrl}/admin/parts/${partId}/images/${imageId}`
    );
  }

  createVehicleMake(name: string): Observable<VehicleMake> {
    return this.http.post<VehicleMake>(`${this.apiConfig.apiUrl}/admin/vehicles/makes`, { name });
  }

  createVehicleModel(payload: {
    makeId: number;
    name: string;
    vehicleType: string;
  }): Observable<VehicleModel> {
    return this.http.post<VehicleModel>(`${this.apiConfig.apiUrl}/admin/vehicles/models`, payload);
  }

  // ===================== SMART AUTOCOMPLETE & VEHICLE QUICK IMPORT =====================

  autocompleteParts(query = ''): Observable<PartAutocompleteSuggestion[]> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<PartAutocompleteSuggestion[]>(
      `${this.apiConfig.apiUrl}/admin/autocomplete/parts`,
      { params }
    );
  }

  autocompleteBrands(query = ''): Observable<string[]> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<string[]>(`${this.apiConfig.apiUrl}/admin/autocomplete/brands`, {
      params,
    });
  }

  autocompleteVehicleMakes(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiConfig.apiUrl}/admin/autocomplete/vehicle-makes`);
  }

  autocompleteVehicleModels(makeName: string): Observable<VehicleModelSuggestion[]> {
    const params = new HttpParams().set('make', makeName.trim());
    return this.http.get<VehicleModelSuggestion[]>(
      `${this.apiConfig.apiUrl}/admin/autocomplete/vehicle-models`,
      { params }
    );
  }

  quickImportVehicles(payload: VehicleQuickImportRequest): Observable<VehicleModel[]> {
    return this.http.post<VehicleModel[]>(
      `${this.apiConfig.apiUrl}/admin/vehicles/quick-import`,
      payload
    );
  }
}
