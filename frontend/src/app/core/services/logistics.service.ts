import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Branch,
  CoverageValidationRequest,
  CoverageValidationResponse,
} from '../models/api.models';
import { ApiConfigService } from './api-config.service';

@Injectable({ providedIn: 'root' })
export class LogisticsService {
  private readonly http = inject(HttpClient);
  private readonly apiConfig = inject(ApiConfigService);

  getBranches(): Observable<Branch[]> {
    return this.http.get<Branch[]>(`${this.apiConfig.apiUrl}/logistics/branches`);
  }

  updateBranch(id: number, branch: Partial<Branch>): Observable<Branch> {
    return this.http.put<Branch>(`${this.apiConfig.apiUrl}/admin/branches/${id}`, branch);
  }

  validateCoverage(payload: CoverageValidationRequest): Observable<CoverageValidationResponse> {
    return this.http.post<CoverageValidationResponse>(
      `${this.apiConfig.apiUrl}/logistics/validate-coverage`,
      payload
    );
  }
}
