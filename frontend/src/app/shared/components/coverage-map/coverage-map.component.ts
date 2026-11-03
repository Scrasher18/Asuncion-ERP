import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  signal,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import {
  Branch,
  CoverageValidationResponse,
  haversineDistanceMeters,
} from '../../../core/models/api.models';

export interface SelectedGeoPoint {
  latitude: number;
  longitude: number;
  suggestedAddress?: string;
}

@Component({
  selector: 'app-coverage-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="rounded-2xl border border-gray-200 bg-white shadow-2xs overflow-hidden flex flex-col">
      <!-- Top Status & Control Bar -->
      <div class="border-b border-gray-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-2.5 z-10">
        <div class="flex items-center gap-2 min-w-0">
          @if (adminMode) {
            <span class="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800">
              <span class="h-2 w-2 rounded-full bg-orange-600 animate-pulse"></span>
              <span>Ubicación de Tienda / Sede</span>
            </span>
            <span class="text-xs font-medium text-gray-600 truncate hidden sm:inline flex items-center gap-1">
              <span>Arrastra el marcador o haz clic en el mapa para ubicar el local</span>
            </span>
          } @else {
            <span
              [class]="
                isCovered()
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              "
              class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold transition"
            >
              <span
                [class]="isCovered() ? 'bg-emerald-500' : 'bg-red-500'"
                class="h-2 w-2 rounded-full"
              ></span>
              <span>{{ isCovered() ? 'En zona de reparto' : 'Fuera de cobertura' }}</span>
            </span>
            <span class="text-xs font-medium text-gray-500 hidden sm:inline">
              Toca el mapa para indicar tu punto de entrega
            </span>
          }
        </div>

        <div class="flex items-center gap-2">
          @if (!adminMode) {
            <button
              type="button"
              (click)="locateUserGps()"
              [disabled]="isLocatingGps()"
              class="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:border-orange-400 hover:text-orange-700 shadow-2xs transition disabled:opacity-50"
            >
              <svg class="h-3.5 w-3.5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              <span>{{ isLocatingGps() ? 'Ubicando...' : 'Mi ubicación' }}</span>
            </button>
          }
          <div class="rounded-lg bg-gray-50 border border-gray-200/80 px-2.5 py-1 text-xs font-bold tabular-nums text-gray-700">
            Radio: {{ (currentCoverageRadiusMeters / 1000) | number: '1.1-2' }} km
          </div>
        </div>
      </div>

      <!-- Real Leaflet Map Container -->
      <div class="relative w-full h-[360px] sm:h-[420px] bg-gray-100 z-0">
        <div #mapContainer class="h-full w-full"></div>

        <!-- Floating Info Overlay on Map (Top-Right) -->
        <div class="absolute top-3 right-3 z-[400] flex flex-col gap-1.5 pointer-events-none">
          <div class="pointer-events-auto rounded-xl border border-gray-200/90 bg-white/95 px-3 py-1.5 text-xs shadow-md backdrop-blur-xs flex items-center gap-2">
            <svg class="h-4 w-4 text-orange-600 shrink-0" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            <div class="text-[11px] leading-tight">
              <strong class="text-gray-900 block truncate max-w-[200px]">{{ effectiveBranch.name }}</strong>
              <span class="text-gray-500 block truncate max-w-[200px]">{{ effectiveBranch.address }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Status & Summary Footer -->
      <div class="border-t border-gray-100 bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
        @if (adminMode) {
          <div class="flex items-center gap-2 text-gray-600">
            <span class="font-bold text-gray-900">Sede:</span>
            <span class="truncate">{{ effectiveBranch.address }}</span>
          </div>
          <div class="flex items-center gap-3 text-[11px] text-gray-500 font-medium">
            <span>Coordenadas: {{ currentStoreLat | number: '1.4-4' }}, {{ currentStoreLng | number: '1.4-4' }}</span>
            <span>Tarifa base: S/ {{ effectiveBranch.baseDeliveryFee | number: '1.2-2' }}</span>
          </div>
        } @else {
          <div class="flex items-center gap-4 min-w-0">
            <div>
              <span class="block text-[10px] font-medium text-gray-500 uppercase tracking-wider">Distancia</span>
              <span class="text-sm font-bold text-gray-900 tabular-nums">
                {{ (customerDistanceMeters() / 1000) | number: '1.2-2' }} km
              </span>
            </div>
            <div>
              <span class="block text-[10px] font-medium text-gray-500 uppercase tracking-wider">Costo de envío</span>
              <span
                [class]="isCovered() ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'"
                class="text-sm tabular-nums"
              >
                {{ isCovered() ? ('S/ ' + (estimatedFee() | number: '1.2-2')) : 'No disponible' }}
              </span>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: block;
      }
    `,
  ],
})
export class CoverageMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;

  // Fallback branch: Real Store Location (Av. Sta. Ana 441, Lima 15011, Santa Anita)
  private readonly defaultBranch: Branch = {
    id: 1,
    code: 'LIM-CENTRAL',
    name: 'Autopartes Asuncion - Santa Anita',
    address: 'Av. Sta. Ana 441, Lima 15011',
    phone: '+51 987 654 321',
    latitude: -12.042941,
    longitude: -76.956697,
    coverageRadiusMeters: 2500,
    baseDeliveryFee: 10.0,
    perKmFee: 1.5,
    active: true,
  };

  @Input() branch: Branch | null = null;
  @Input() radiusOverrideMeters: number | null = null;
  @Input() initialLatitude: number | null | undefined = null;
  @Input() initialLongitude: number | null | undefined = null;
  @Input() adminMode = false;

  @Output() readonly locationSelected = new EventEmitter<SelectedGeoPoint>();
  @Output() readonly coverageValidated = new EventEmitter<CoverageValidationResponse>();
  @Output() readonly branchLocationChanged = new EventEmitter<{
    latitude: number;
    longitude: number;
    address?: string;
  }>();

  readonly customerLat = signal<number>(-12.0931);
  readonly customerLng = signal<number>(-77.0265);
  readonly isLocatingGps = signal<boolean>(false);
  readonly isCovered = signal<boolean>(true);
  readonly customerDistanceMeters = signal<number>(3100);
  readonly estimatedFee = signal<number>(14.65);

  private map: L.Map | null = null;
  private branchMarker: L.Marker | null = null;
  private customerMarker: L.Marker | null = null;
  private coverageCircle: L.Circle | null = null;
  private routeLine: L.Polyline | null = null;

  get effectiveBranch(): Branch {
    if (this.branch) return this.branch;
    return this.defaultBranch;
  }

  get currentStoreLat(): number {
    if (typeof this.initialLatitude === 'number' && !Number.isNaN(this.initialLatitude)) {
      return this.initialLatitude;
    }
    return this.effectiveBranch.latitude || -12.042941;
  }

  get currentStoreLng(): number {
    if (typeof this.initialLongitude === 'number' && !Number.isNaN(this.initialLongitude)) {
      return this.initialLongitude;
    }
    return this.effectiveBranch.longitude || -76.956697;
  }

  get currentCoverageRadiusMeters(): number {
    if (this.radiusOverrideMeters !== null && this.radiusOverrideMeters > 0) {
      return this.radiusOverrideMeters;
    }
    return this.effectiveBranch.coverageRadiusMeters || 8500;
  }

  ngAfterViewInit(): void {
    this.initLeafletMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.map) return;

    if (changes['branch'] || changes['radiusOverrideMeters'] || changes['adminMode']) {
      this.updateMapLayers();
    }

    if (changes['initialLatitude'] || changes['initialLongitude']) {
      const lat = this.initialLatitude;
      const lng = this.initialLongitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        if (this.adminMode) {
          if (this.branchMarker) {
            this.branchMarker.setLatLng([lat, lng]);
          }
          if (this.coverageCircle) {
            this.coverageCircle.setLatLng([lat, lng]);
          }
          this.map.panTo([lat, lng]);
        } else {
          this.customerLat.set(lat);
          this.customerLng.set(lng);
          this.updateCustomerMarkerAndRoute();
          this.recalculateDeliveryCoverage();
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initLeafletMap(): void {
    if (!this.mapContainer || typeof window === 'undefined') return;

    const centerLat = this.adminMode ? this.currentStoreLat : (this.initialLatitude ?? this.customerLat());
    const centerLng = this.adminMode ? this.currentStoreLng : (this.initialLongitude ?? this.customerLng());

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [centerLat, centerLng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    // High quality OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.updateMapLayers();

    // Map Click Listener
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      if (this.adminMode) {
        this.handleStoreRelocation(lat, lng);
      } else {
        this.handleCustomerSelection(lat, lng);
      }
    });

    // Invalidate size after layout rendering
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 200);
  }

  private updateMapLayers(): void {
    if (!this.map) return;

    const storeLat = this.currentStoreLat;
    const storeLng = this.currentStoreLng;
    const radius = this.currentCoverageRadiusMeters;

    // 1. Branch Store Marker
    const storeIcon = L.divIcon({
      className: 'store-pin-wrapper',
      html: `
        <div style="background:#0F172A;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:6px 12px;font-size:12px;font-weight:700;display:flex;align-items:center;gap:6px;box-shadow:0 4px 14px rgba(0,0,0,0.35);white-space:nowrap;transform:translate(-50%, -100%);cursor:${this.adminMode ? 'grab' : 'default'};">
          <svg style="width:16px;height:16px;color:#EA580C;flex-shrink:0;" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          <span>${this.effectiveBranch.name || 'Local Asunción'}</span>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!this.branchMarker) {
      this.branchMarker = L.marker([storeLat, storeLng], {
        icon: storeIcon,
        draggable: this.adminMode,
      }).addTo(this.map);

      this.branchMarker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        this.handleStoreRelocation(pos.lat, pos.lng);
      });
    } else {
      this.branchMarker.setLatLng([storeLat, storeLng]);
      this.branchMarker.setIcon(storeIcon);
      if (this.adminMode) {
        this.branchMarker.dragging?.enable();
      } else {
        this.branchMarker.dragging?.disable();
      }
    }

    // 2. Coverage Radius Circle
    if (!this.coverageCircle) {
      this.coverageCircle = L.circle([storeLat, storeLng], {
        radius,
        color: '#EA580C',
        weight: 2,
        dashArray: '6, 6',
        fillColor: '#EA580C',
        fillOpacity: 0.1,
      }).addTo(this.map);
    } else {
      this.coverageCircle.setLatLng([storeLat, storeLng]);
      this.coverageCircle.setRadius(radius);
    }

    // 3. Customer Destination Marker (Checkout/Client mode only)
    if (this.adminMode) {
      if (this.customerMarker) {
        this.customerMarker.remove();
        this.customerMarker = null;
      }
      if (this.routeLine) {
        this.routeLine.remove();
        this.routeLine = null;
      }
    } else {
      this.updateCustomerMarkerAndRoute();
      this.recalculateDeliveryCoverage();
    }
  }

  private updateCustomerMarkerAndRoute(): void {
    if (!this.map || this.adminMode) return;

    const custLat = this.customerLat();
    const custLng = this.customerLng();
    const storeLat = this.currentStoreLat;
    const storeLng = this.currentStoreLng;

    const custIcon = L.divIcon({
      className: 'cust-pin-wrapper',
      html: `
        <div style="background:#EA580C;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:5px 10px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(234,88,12,0.4);white-space:nowrap;transform:translate(-50%, -100%);">
          <svg style="width:14px;height:14px;color:#FFFFFF;flex-shrink:0;" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/>
          </svg>
          <span>Entrega aquí</span>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!this.customerMarker) {
      this.customerMarker = L.marker([custLat, custLng], {
        icon: custIcon,
        draggable: true,
      }).addTo(this.map);

      this.customerMarker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        this.handleCustomerSelection(pos.lat, pos.lng);
      });
    } else {
      this.customerMarker.setLatLng([custLat, custLng]);
    }

    // Polyline connecting Store and Customer
    const latlngs: [number, number][] = [
      [storeLat, storeLng],
      [custLat, custLng],
    ];

    if (!this.routeLine) {
      this.routeLine = L.polyline(latlngs, {
        color: '#EA580C',
        weight: 2,
        dashArray: '4, 4',
      }).addTo(this.map);
    } else {
      this.routeLine.setLatLngs(latlngs);
    }
  }

  private handleStoreRelocation(lat: number, lng: number): void {
    const roundedLat = Number(lat.toFixed(6));
    const roundedLng = Number(lng.toFixed(6));

    if (this.branchMarker) {
      this.branchMarker.setLatLng([roundedLat, roundedLng]);
    }
    if (this.coverageCircle) {
      this.coverageCircle.setLatLng([roundedLat, roundedLng]);
    }
    this.branchLocationChanged.emit({
      latitude: roundedLat,
      longitude: roundedLng,
      address: this.effectiveBranch.address,
    });
  }

  private handleCustomerSelection(lat: number, lng: number, address?: string): void {
    this.customerLat.set(lat);
    this.customerLng.set(lng);
    this.updateCustomerMarkerAndRoute();
    this.recalculateDeliveryCoverage(address);
  }

  private recalculateDeliveryCoverage(suggestedAddress?: string): void {
    const storeLat = this.currentStoreLat;
    const storeLng = this.currentStoreLng;
    const custLat = this.customerLat();
    const custLng = this.customerLng();
    const maxRadius = this.currentCoverageRadiusMeters;

    const distMeters = haversineDistanceMeters(storeLat, storeLng, custLat, custLng);
    this.customerDistanceMeters.set(distMeters);

    const covered = distMeters <= maxRadius;
    this.isCovered.set(covered);

    const baseFee = this.effectiveBranch.baseDeliveryFee || 10.0;
    const perKm = this.effectiveBranch.perKmFee || 1.5;
    const distKm = distMeters / 1000.0;
    const calculatedFee = Number((baseFee + distKm * perKm).toFixed(2));
    this.estimatedFee.set(calculatedFee);

    const point: SelectedGeoPoint = {
      latitude: Number(custLat.toFixed(6)),
      longitude: Number(custLng.toFixed(6)),
      suggestedAddress: suggestedAddress || undefined,
    };
    this.locationSelected.emit(point);

    const validation: CoverageValidationResponse = {
      covered,
      branchId: this.effectiveBranch.id,
      branchName: this.effectiveBranch.name,
      branchLatitude: storeLat,
      branchLongitude: storeLng,
      customerLatitude: custLat,
      customerLongitude: custLng,
      distanceMeters: Math.round(distMeters),
      allowedRadiusMeters: maxRadius,
      estimatedDeliveryFee: covered ? calculatedFee : 0,
      message: covered
        ? `Destino a ${(distMeters / 1000).toFixed(1)} km dentro de la zona de reparto de ${this.effectiveBranch.name}.`
        : `Destino a ${(distMeters / 1000).toFixed(1)} km excede el radio máximo (${(maxRadius / 1000).toFixed(1)} km).`,
    };
    this.coverageValidated.emit(validation);
  }

  locateUserGps(): void {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      return;
    }

    this.isLocatingGps.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocatingGps.set(false);
        const { latitude, longitude } = pos.coords;
        this.handleCustomerSelection(latitude, longitude, 'Mi ubicación GPS actual');
        this.map?.flyTo([latitude, longitude], 15, { duration: 1.0 });
      },
      () => {
        this.isLocatingGps.set(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }
}
