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
    <div class="relative w-full rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-2xs">
      <!-- Top Live Telemetry Overlay Pill -->
      <div class="absolute top-3 left-3 right-3 z-[1000] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div class="inline-flex items-center gap-2 rounded-xl border border-gray-200/80 bg-white/95 px-3 py-1.5 shadow-md backdrop-blur-xs pointer-events-auto">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <span class="text-xs font-bold text-gray-900">
            {{ telemetry?.isLive ? 'Repartidor en tiempo real' : 'Ubicación de despacho' }}
          </span>
          @if (telemetry?.speedKmh && telemetry!.speedKmh > 3) {
            <span class="font-mono text-[11px] font-semibold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
              {{ telemetry?.speedKmh | number: '1.0-0' }} km/h
            </span>
          }
        </div>

        @if (telemetry?.isLive || (telemetry?.orderStatus === 'EN_RUTA') || telemetry?.noSqlEngine) {
          <div class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 shadow-sm pointer-events-auto">
            <span class="relative flex h-2 w-2">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span>Conexión Satelital Activa</span>
          </div>
        }
      </div>

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
              {{ telemetry?.statusMessage || 'Transmisión GPS satelital activa' }}
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
                ✓ Pedido Entregado
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

    // 1. Origin Store Marker
    if (!this.originMarker) {
      const storeIcon = L.divIcon({
        className: 'custom-store-pin',
        html: `
          <div style="background:#0F172A;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:4px 8px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(0,0,0,0.25);white-space:nowrap;">
            <img src="/images/icons/local.png" style="width:14px;height:14px;object-fit:contain;" alt="" />
            <span>${tel.branchName || 'Tienda Asunción'}</span>
          </div>
        `,
        iconSize: [140, 30],
        iconAnchor: [70, 15],
      });
      this.originMarker = L.marker([origLat, origLng], { icon: storeIcon, draggable: false }).addTo(this.map);
    } else {
      this.originMarker.setLatLng([origLat, origLng]);
    }

    // 2. Customer Destination Marker
    if (!this.destMarker) {
      const destIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="background:#16A34A;color:#FFFFFF;border:2px solid #FFFFFF;border-radius:12px;padding:4px 8px;font-size:11px;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 4px 12px rgba(22,163,74,0.3);white-space:nowrap;">
            <img src="/images/icons/casa.png" style="width:14px;height:14px;object-fit:contain;" alt="" />
            <span>Destino Cliente</span>
          </div>
        `,
        iconSize: [110, 30],
        iconAnchor: [55, 15],
      });
      this.destMarker = L.marker([destLat, destLng], { icon: destIcon }).addTo(this.map);
    } else {
      this.destMarker.setLatLng([destLat, destLng]);
    }

    // 3. Driver Motorized Marker (with heading & pulse ring)
    const heading = tel.headingDegrees || 0;
    const driverHtml = `
      <div style="position:relative;width:44px;height:44px;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;width:40px;height:40px;border-radius:50%;background:rgba(234,88,12,0.25);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;"></div>
        <div style="position:relative;width:34px;height:34px;border-radius:50%;background:#EA580C;border:3px solid #FFFFFF;box-shadow:0 4px 14px rgba(234,88,12,0.45);display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);transition:transform 0.4s ease;">
          <img src="/images/icons/en_ruta.png" style="width:18px;height:18px;object-fit:contain;transform:rotate(-${heading}deg);" alt="" />
        </div>
      </div>
    `;

    const driverIcon = L.divIcon({
      className: 'custom-driver-pin',
      html: driverHtml,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });

    if (!this.driverMarker) {
      this.driverMarker = L.marker([curLat, curLng], { icon: driverIcon, zIndexOffset: 1000 }).addTo(this.map);
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
