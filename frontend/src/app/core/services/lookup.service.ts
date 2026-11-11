import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AddressLookupSuggestion, DocumentLookupResponse } from '../models/api.models';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class LookupService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  lookupDocument(documentNumber: string): Observable<DocumentLookupResponse> {
    const clean = encodeURIComponent(documentNumber.trim());
    return this.http.get<DocumentLookupResponse>(
      `${this.apiConfig.apiUrl}/lookup/document/${clean}`
    );
  }

  lookupAddress(query: string): Observable<AddressLookupSuggestion[]> {
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<AddressLookupSuggestion[]>(`${this.apiConfig.apiUrl}/lookup/address`, {
      params,
    });
  }

  reverseAddress(lat: number, lng: number): Observable<AddressLookupSuggestion | null> {
    const params = new HttpParams()
      .set('lat', String(lat))
      .set('lng', String(lng));
    return this.http.get<AddressLookupSuggestion | null>(`${this.apiConfig.apiUrl}/lookup/reverse-address`, {
      params,
    });
  }

  autocompleteAddress(query: string): Observable<AddressLookupSuggestion[]> {
    return this.lookupAddress(query);
  }
}
