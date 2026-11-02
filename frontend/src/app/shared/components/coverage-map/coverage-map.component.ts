import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  inject,
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
import { LogisticsService } from '../../../core/services/logistics.service';
import { ToastService } from '../../../core/services/toast.service';

export interface SelectedGeoPoint {
  latitude: number;
  longitude: number;
  suggestedAddress?: string;
}

export interface PresetLocation {
  label: string;
  tag: string;
  address: string;
  latitude: number;
  longitude: number;
}

export const LIMA_PRESET_LOCATIONS: PresetLocation[] = [
  {
    label: 'Taller Santa Anita',
    tag: 'Cerca · 0.4 km',
    address: 'Av. Santa Ana 320, Santa Anita, Lima',
    latitude: -12.0435,
    longitude: -76.9582,
  },
  {
    label: 'Ate Vitarte',
    tag: 'Cobertura · 1.8 km',
    address: 'Carretera Central Km 4.5, Ate Vitarte, Lima',
    latitude: -12.0485,
    longitude: -76.9442,
  },
  {
    label: 'El Agustino',
    tag: 'Cobertura · 2.4 km',
    address: 'Av. Riva Agüero 1250, El Agustino, Lima',
    latitude: -12.0465,
    longitude: -76.9772,
  },
  {
    label: 'La Victoria',
    tag: 'Límite · 5.8 km',
    address: 'Av. Manco Cápac 620, La Victoria, Lima',
    latitude: -12.0658,
    longitude: -77.0261,
  },
  {
    label: 'Callao Puerto',
    tag: 'Fuera · 16.5 km',
    address: 'Av. Sáenz Peña 1120, Callao',
    latitude: -12.0522,
    longitude: -77.1436,
  },
];

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
              <span>Modo Configuración de Sede</span>
            </span>
            <span class="text-xs font-medium text-gray-600 truncate hidden sm:inline flex items-center gap-1">
              <span>Arrastra el marcador</span>
              <img src="/images/icons/local.png" class="h-3.5 w-3.5 inline object-contain" alt="Tienda" />
              <span>o toca el mapa para ubicar la tienda</span>
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
            <img src="/images/icons/local.png" class="h-4 w-4 object-contain shrink-0" alt="Tienda" />
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
            <span class="font-bold text-gray-900">Sede Asunción:</span>
            <span class="truncate">{{ effectiveBranch.address }}</span>
          </div>
          <div class="text-[11px] text-gray-500 font-medium">
            Tarifa base: S/ {{ effectiveBranch.baseDeliveryFee | number: '1.2-2' }} + S/ {{ effectiveBranch.perKmFee | number: '1.2-2' }}/km
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

        <!-- Quick Landmark Preset Pills -->
        @if (showPresets) {
          <div class="flex flex-wrap items-center gap-1.5">
            <span class="text-[11px] font-medium text-gray-600 mr-1 hidden md:inline">Destinos de prueba:</span>
            @for (loc of presets; track loc.label) {
              <button
                type="button"
                (click)="applyPreset(loc)"
                class="rounded-full border border-gray-200 bg-gray-50 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 px-2 py-0.5 text-[11px] font-medium text-gray-700 transition"
              >
                {{ loc.label }}
              </button>
            }
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
  private readonly logisticsService = inject(LogisticsService);
  private readonly toast = inject(ToastService);

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
  @Input() showPresets = true;

  @Output() readonly locationSelected = new EventEmitter<SelectedGeoPoint>();
  @Output() readonly coverageValidated = new EventEmitter<CoverageValidationResponse>();
  @Output() readonly branchLocationChanged = new EventEmitter<{
    latitude: number;
    longitude: number;
    address?: string;
  }>();

  readonly presets = LIMA_PRESET_LOCATIONS;

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
    return this.effectiveBranch.latitude || -12.0692;
  }

  get currentStoreLng(): number {
    return this.effectiveBranch.longitude || -77.0225;
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

    if (changes['branch'] || changes['radiusOverrideMeters']) {
      this.updateMapLayers();
    }

    if (changes['initialLatitude'] || changes['initialLongitude']) {
      const lat = this.initialLatitude;
      const lng = this.initialLongitude;
      if (typeof lat === 'number' && typeof lng === 'number' && !Number.isNaN(lat) && !Number.isNaN(lng)) {
        this.customerLat.set(lat);
        this.customerLng.set(lng);
        this.updateCustomerMarkerAndRoute();
        this.recalculateDeliveryCoverage();
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
      zoom: 13,
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
        <div style="background:#0F172A;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:4px 9px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(0,0,0,0.3);white-space:nowrap;transform:translate(-50%, -50%);">
          <img src="/images/icons/local.png" style="width:14px;height:14px;object-fit:contain;" alt="" />
          <span>${this.effectiveBranch.name || 'Autopartes Asunción'}</span>
        </div>
      `,
      iconSize: [0, 0],
    });

    if (!this.branchMarker) {
      this.branchMarker = L.marker([storeLat, storeLng], {
        icon: storeIcon,
        draggable: this.adminMode,
      }).addTo(this.map);

      if (this.adminMode) {
        this.branchMarker.on('dragend', (e) => {
          const pos = e.target.getLatLng();
          this.handleStoreRelocation(pos.lat, pos.lng);
        });
      }
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
    if (!this.adminMode) {
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
        <div style="background:#EA580C;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:4px 9px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(234,88,12,0.4);white-space:nowrap;transform:translate(-50%, -50%);">
          <img src="/images/icons/casa.png" style="width:14px;height:14px;object-fit:contain;" alt="" />
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

      this.customerMarker.on('dragend', (e) => {
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
    if (this.branchMarker) {
      this.branchMarker.setLatLng([lat, lng]);
    }
    if (this.coverageCircle) {
      this.coverageCircle.setLatLng([lat, lng]);
    }
    this.branchLocationChanged.emit({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      address: 'Av. Sta. Ana 441, Lima 15011',
    });
    this.toast.info('Sede actualizada', 'Ubicación de tienda actualizada en mapa.');
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

  applyPreset(preset: PresetLocation): void {
    if (this.adminMode) {
      this.handleStoreRelocation(preset.latitude, preset.longitude);
    } else {
      this.handleCustomerSelection(preset.latitude, preset.longitude, preset.address);
    }
    this.map?.flyTo([preset.latitude, preset.longitude], 14, { duration: 0.8 });
  }

  locateUserGps(): void {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      this.toast.error('GPS no disponible', 'Geolocalización no soportada en este navegador.');
      return;
    }

    this.isLocatingGps.set(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        this.isLocatingGps.set(false);
        const { latitude, longitude } = pos.coords;
        this.handleCustomerSelection(latitude, longitude, 'Mi ubicación GPS actual');
        this.map?.flyTo([latitude, longitude], 15, { duration: 1.0 });
        this.toast.success('Ubicación fijada', 'Se detectaron tus coordenadas GPS en Lima.');
      },
      (err) => {
        this.isLocatingGps.set(false);
        this.toast.error('Error GPS', err.message || 'No se pudo obtener la ubicación.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  }
}
