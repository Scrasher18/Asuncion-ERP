import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import * as L from 'leaflet';
import { LiveTrackingResponse } from '../../../core/models/telemetry.models';

@Component({
  selector: 'app-live-driver-map',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-2xs z-0" style="isolation: isolate;">

<!-- Map Container -->
      <div #mapContainer class="h-80 sm:h-96 w-full z-0 bg-[#F8F9FA]"></div>

      <!-- Bottom Floating Route Bar -->
      <div class="border-t border-gray-100 bg-white p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50 border border-orange-200">
            <img src="/images/icons/repartidor.png" alt="Repartidor" class="h-5 w-5 object-contain" />
          </div>
          <div class="min-w-0">
            <p class="font-bold text-gray-900 truncate">
              {{ telemetry?.driverName || 'Repartidor Motorizado Asunción' }}
            </p>
            <p class="text-[11px] text-gray-500 truncate">
              {{ telemetry?.statusMessage || 'Ruta de entrega activa' }}
            </p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          @if (telemetry?.isLive || telemetry?.orderStatus === 'EN_RUTA') {
            @if ((telemetry?.etaMinutes ?? 0) > 0) {
              <div class="text-right">
                <span class="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Llegada estimada</span>
                <span class="font-bold text-sm tabular-nums text-gray-900">
                  ~{{ telemetry?.etaMinutes }} min
                </span>
              </div>
            }
            @if ((telemetry?.distanceRemainingMeters ?? 0) > 0) {
              <div class="text-right border-l border-gray-200 pl-3">
                <span class="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Distancia</span>
                <span class="font-bold text-sm tabular-nums text-orange-600">
                  {{ ((telemetry?.distanceRemainingMeters ?? 0) / 1000) | number: '1.1-1' }} km
                </span>
              </div>
            }
          } @else if (telemetry?.orderStatus === 'ENTREGADO') {
            <div class="text-right">
              <span class="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span>Pedido Entregado</span>
              </span>
            </div>
          } @else {
            <div class="text-right">
              <span class="block text-[10px] text-gray-400 font-medium uppercase tracking-wider">Tiempo estimado</span>
              <span class="font-bold text-xs tabular-nums text-gray-800">
                25 - 45 min (En almacén)
              </span>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class LiveDriverMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer', { static: false }) mapContainer!: ElementRef<HTMLDivElement>;
  @Input() telemetry: LiveTrackingResponse | null = null;

  private map: L.Map | null = null;
  private driverMarker: L.Marker | null = null;
  private originMarker: L.Marker | null = null;
  private destMarker: L.Marker | null = null;
  private routeLine: L.Polyline | null = null;
  private historyLine: L.Polyline | null = null;

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['telemetry'] && this.map && this.telemetry) {
      this.updateMarkersAndRoute();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
      this.map = null;
    }
  }

  private initMap(): void {
    if (!this.mapContainer || typeof window === 'undefined') return;

    const defaultLat = this.telemetry?.currentLatitude ?? -12.0685;
    const defaultLng = this.telemetry?.currentLongitude ?? -77.0182;

    this.map = L.map(this.mapContainer.nativeElement, {
      center: [defaultLat, defaultLng],
      zoom: 14,
      zoomControl: true,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(this.map);

    this.updateMarkersAndRoute();
  }

  private updateMarkersAndRoute(): void {
    if (!this.map || !this.telemetry) return;

    const tel = this.telemetry;
    const curLat = tel.currentLatitude;
    const curLng = tel.currentLongitude;
    const origLat = tel.originLatitude ?? -12.042941;
    const origLng = tel.originLongitude ?? -76.956697;
    const destLat = tel.destinationLatitude ?? curLat + 0.015;
    const destLng = tel.destinationLongitude ?? curLng + 0.015;

    // 1. Origin Store Marker (Icono oficial de tienda Asuncion - sin circulo negro)
    if (!this.originMarker) {
      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
            <div style="position:relative;width:44px;height:44px;border-radius:50%;background:#FFFFFF;border:3px solid #EA580C;box-shadow:0 4px 14px rgba(234,88,12,0.35);display:flex;align-items:center;justify-content:center;padding:4px;" title="${tel.branchName || 'Sede Santa Anita'}">
              <img src="/local.png" onerror="this.src='/images/icons/local.png'" style="width:30px;height:30px;object-fit:contain;" alt="Tienda Asuncion" />
            </div>
            <div style="background:#FFFFFF;color:#EA580C;border:1.5px solid #EA580C;border-radius:8px;padding:2px 8px;font-size:10px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;margin-top:2px;display:flex;align-items:center;gap:3px;">
              <img src="/images/icons/tienda-recojo.png" style="width:11px;height:11px;object-fit:contain;" alt="" />
              <span>Tienda Asunción</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      this.originMarker = L.marker([origLat, origLng], { icon: storeIcon, draggable: false }).addTo(this.map);
    } else {
      this.originMarker.setLatLng([origLat, origLng]);
    }

    // 2. Customer Destination Marker (Icono oficial casa.png - alta resolucion y contraste)
    if (!this.destMarker) {
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -100%);">
            <div style="position:relative;width:48px;height:48px;border-radius:50%;background:#FFFFFF;border:3px solid #16A34A;box-shadow:0 4px 14px rgba(22,163,74,0.35);display:flex;align-items:center;justify-content:center;padding:4px;">
              <img src="/casa.png" onerror="this.src='/images/icons/casa.png'" style="width:34px;height:34px;object-fit:contain;" alt="Casa Destino" />
            </div>
            <div style="background:#FFFFFF;color:#16A34A;border:1.5px solid #16A34A;border-radius:8px;padding:2px 8px;font-size:10px;font-weight:800;box-shadow:0 2px 6px rgba(0,0,0,0.18);white-space:nowrap;margin-top:3px;display:flex;align-items:center;gap:3px;">
              <img src="/images/icons/casa.png" style="width:11px;height:11px;object-fit:contain;" alt="" />
              <span>Casa / Destino</span>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      });
      this.destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(this.map);
    } else {
      this.destMarker.setLatLng([destLat, destLng]);
    }

    // 3. Driver Motorized Marker (Icono oficial repartidor.png con sonar pulse)
    const heading = tel.headingDegrees || 0;
    const driverHtml = `
      <div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%, -50%);">
        <div style="position:relative;width:56px;height:56px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:54px;height:54px;border-radius:50%;background:rgba(234,88,12,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
          <div style="position:relative;width:48px;height:48px;border-radius:50%;background:#FFFFFF;border:3px solid #EA580C;box-shadow:0 4px 14px rgba(234,88,12,0.5);display:flex;align-items:center;justify-content:center;padding:4px;">
            <img src="/repartidor.png" onerror="this.src='/images/icons/repartidor.png'" style="width:34px;height:34px;object-fit:contain;" alt="Motorizado en ruta" />
          </div>
        </div>
        <div style="background:#EA580C;color:#FFFFFF;border:1.5px solid #FFFFFF;border-radius:8px;padding:2px 8px;font-size:10px;font-weight:800;box-shadow:0 2px 8px rgba(0,0,0,0.25);white-space:nowrap;margin-top:-2px;display:flex;align-items:center;gap:3px;">
          <img src="/images/icons/moto-delivery.png" style="width:12px;height:12px;object-fit:contain;" alt="" />
          <span>Motorizado en ruta</span>
        </div>
      </div>
    `;

    const driverIcon = L.divIcon({
      className: 'custom-driver-pin',
      html: driverHtml,
      iconSize: [0, 0],
    });

    if (!this.driverMarker) {
      this.driverMarker = L.marker([curLat, curLng], { icon: driverIcon, zIndexOffset: 2500 }).addTo(this.map);
    } else {
      this.driverMarker.setIcon(driverIcon);
      this.driverMarker.setLatLng([curLat, curLng]);
    }

    // 4. Draw route lines
    const waypoints: L.LatLngExpression[] = [
      [origLat, origLng],
      [curLat, curLng],
      [destLat, destLng],
    ];

    if (!this.routeLine) {
      this.routeLine = L.polyline(waypoints, {
        color: '#EA580C',
        weight: 4,
        opacity: 0.85,
        dashArray: '8, 8',
      }).addTo(this.map);
    } else {
      this.routeLine.setLatLngs(waypoints);
    }

    // Fit map bounds to show driver and destination
    try {
      const bounds = L.latLngBounds([[curLat, curLng], [destLat, destLng], [origLat, origLng]]);
      this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    } catch (e) {
      // ignore
    }
  }
}
