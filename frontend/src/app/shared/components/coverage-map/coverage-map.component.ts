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
  userInteracted?: boolean;
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
              <span class="h-2 w-2 rounded-full bg-orange-600"></span>
              <span>Sede Central Fija</span>
            </span>
            <span class="text-xs font-medium text-gray-600 truncate hidden sm:inline flex items-center gap-1">
              <span>Santa Anita (Ubicación oficial fija de despacho y almacén)</span>
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
    code: 'SEDE-CENTRAL',
    name: 'Repuestos Asunción - Sede Santa Anita',
    address: 'Av. Sta. Ana 441, Lima 15011',
    phone: '+51 922 779 157',
    latitude: -12.043004,
    longitude: -76.956621,
    coverageRadiusMeters: 4500,
    baseDeliveryFee: 3.5,
    perKmFee: 0.8,
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

  readonly customerLat = signal<number>(-12.045000);
  readonly customerLng = signal<number>(-76.952000);
  readonly isLocatingGps = signal<boolean>(false);
  readonly isCovered = signal<boolean>(true);
  readonly customerDistanceMeters = signal<number>(550);
  readonly estimatedFee = signal<number>(3.50);

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
    if (this.adminMode && typeof this.initialLatitude === 'number' && !Number.isNaN(this.initialLatitude)) {
      return this.initialLatitude;
    }
    return this.effectiveBranch.latitude || -12.043004;
  }

  get currentStoreLng(): number {
    if (this.adminMode && typeof this.initialLongitude === 'number' && !Number.isNaN(this.initialLongitude)) {
      return this.initialLongitude;
    }
    return this.effectiveBranch.longitude || -76.956621;
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
      if (!this.adminMode) {
        this.handleCustomerSelection(lat, lng, undefined, true);
      }
      // En modo admin el local permanece 100% fijo e inamovible
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

    // 1. Branch Store Marker (Icono local.png oficial)
    const storeIcon = L.divIcon({
      className: 'store-pin-wrapper',
      html: `
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);cursor:default;">
          <div style="position:relative;width:48px;height:48px;border-radius:50%;background:#FFFFFF;border:3px solid #EA580C;box-shadow:0 4px 14px rgba(234,88,12,0.35);display:flex;align-items:center;justify-content:center;padding:4px;">
            <img src="/local.png" onerror="this.src='/images/icons/local.png'" style="width:34px;height:34px;object-fit:contain;" alt="Tienda Asuncion" />
          </div>
          <div style="background:#FFFFFF;color:#EA580C;border:1.5px solid #EA580C;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.18);white-space:nowrap;margin-top:3px;display:flex;align-items:center;gap:4px;">
            <img src="/images/icons/tienda-recojo.png" style="width:12px;height:12px;object-fit:contain;" alt="" />
            <span>${this.effectiveBranch.name || 'Local Asunción'}</span>
          </div>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!this.branchMarker) {
      this.branchMarker = L.marker([storeLat, storeLng], { icon: storeIcon, draggable: false }).addTo(this.map);

      // Sede central fija: no drag listener
    } else {
      this.branchMarker.setLatLng([storeLat, storeLng]);
      this.branchMarker.setIcon(storeIcon);
      this.branchMarker.dragging?.disable();
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
        <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
          <div style="position:relative;width:48px;height:48px;border-radius:50%;background:#FFFFFF;border:3px solid #16A34A;box-shadow:0 4px 14px rgba(22,163,74,0.35);display:flex;align-items:center;justify-content:center;padding:4px;">
            <img src="/casa.png" onerror="this.src='/images/icons/casa.png'" style="width:34px;height:34px;object-fit:contain;" alt="Casa Destino" />
          </div>
          <div style="background:#FFFFFF;color:#16A34A;border:1.5px solid #16A34A;border-radius:8px;padding:2px 8px;font-size:11px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;margin-top:3px;display:flex;align-items:center;gap:4px;">
            <img src="/images/icons/casa.png" style="width:12px;height:12px;object-fit:contain;" alt="" />
            <span>Dirección de Entrega</span>
          </div>
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
        this.handleCustomerSelection(pos.lat, pos.lng, undefined, true);
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

  public setGpsLocation(lat: number, lng: number, address = 'Mi ubicación GPS actual'): void {
    this.handleCustomerSelection(lat, lng, address, true);
    this.map?.flyTo([lat, lng], 15, { duration: 1.0 });
  }

  public handleCustomerSelection(
    lat: number,
    lng: number,
    address?: string,
    userInteracted = false
  ): void {
    this.customerLat.set(lat);
    this.customerLng.set(lng);
    this.updateCustomerMarkerAndRoute();
    this.recalculateDeliveryCoverage(address, userInteracted);
  }

  private recalculateDeliveryCoverage(suggestedAddress?: string, userInteracted = false): void {
    const storeLat = this.currentStoreLat;
    const storeLng = this.currentStoreLng;
    const custLat = this.customerLat();
    const custLng = this.customerLng();
    const maxRadius = this.currentCoverageRadiusMeters;

    const distMeters = haversineDistanceMeters(storeLat, storeLng, custLat, custLng);
    this.customerDistanceMeters.set(distMeters);

    const covered = distMeters <= maxRadius;
    this.isCovered.set(covered);

    const baseFee = (this.effectiveBranch.baseDeliveryFee != null && this.effectiveBranch.baseDeliveryFee <= 5.0)
      ? this.effectiveBranch.baseDeliveryFee
      : 3.50;
    const perKm = (this.effectiveBranch.perKmFee != null && this.effectiveBranch.perKmFee <= 1.0)
      ? this.effectiveBranch.perKmFee
      : 0.80;
    const distKm = distMeters / 1000.0;
    const calculatedFee = Number((baseFee + distKm * perKm).toFixed(2));
    this.estimatedFee.set(calculatedFee);

    const point: SelectedGeoPoint = {
      latitude: Number(custLat.toFixed(6)),
      longitude: Number(custLng.toFixed(6)),
      suggestedAddress: suggestedAddress || undefined,
      userInteracted,
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
        this.handleCustomerSelection(latitude, longitude, 'Mi ubicación GPS actual', true);
        this.map?.flyTo([latitude, longitude], 15, { duration: 1.0 });
      },
      () => {
        this.isLocatingGps.set(false);
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }
}
