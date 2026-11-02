import { CommonModule } from '@angular/common';
import { Component, computed, Input, signal } from '@angular/core';
import { SalesTimelinePoint } from '../../../core/models/api.models';

export type ChartGranularity = 'day' | 'week' | 'year';

@Component({
  selector: 'app-sales-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 shadow-2xs space-y-5">
      <!-- Header with Granularity Mode Switcher -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            <h3 class="text-base font-bold text-gray-900">
              Evolución de ventas y facturación
            </h3>
          </div>
          <p class="text-xs text-gray-500 mt-0.5">
            {{ chartDescription() }}
          </p>
        </div>

        <!-- Mode Switcher Tabs (Día / Semana / Año) -->
        <div class="inline-flex rounded-xl border border-gray-200 bg-gray-50/80 p-1 shadow-2xs self-start sm:self-auto">
          <button
            type="button"
            (click)="granularity.set('day')"
            [class]="
              granularity() === 'day'
                ? 'bg-white text-orange-600 font-bold shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 font-medium'
            "
            class="min-h-[34px] rounded-lg px-3 py-1 text-xs transition"
          >
            Por Día
          </button>
          <button
            type="button"
            (click)="granularity.set('week')"
            [class]="
              granularity() === 'week'
                ? 'bg-white text-orange-600 font-bold shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 font-medium'
            "
            class="min-h-[34px] rounded-lg px-3 py-1 text-xs transition"
          >
            Por Semana
          </button>
          <button
            type="button"
            (click)="granularity.set('year')"
            [class]="
              granularity() === 'year'
                ? 'bg-white text-orange-600 font-bold shadow-xs border border-gray-200/60'
                : 'text-gray-600 hover:text-gray-900 font-medium'
            "
            class="min-h-[34px] rounded-lg px-3 py-1 text-xs transition"
          >
            Por Año (Meses)
          </button>
        </div>
      </div>

      <!-- Quick Metrics Strip -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <span class="text-gray-500 font-medium">Facturación periodo</span>
          <p class="mt-1 text-base sm:text-lg font-bold text-gray-900 tabular-nums">
            S/ {{ totalPeriodSales() | number: '1.2-2' }}
          </p>
        </div>

        <div class="rounded-xl border border-gray-100 bg-gray-50/70 p-3">
          <span class="text-gray-500 font-medium">Promedio por intervalo</span>
          <p class="mt-1 text-base sm:text-lg font-bold text-gray-900 tabular-nums">
            S/ {{ averageSales() | number: '1.2-2' }}
          </p>
        </div>

        <div class="rounded-xl border border-orange-100 bg-orange-50/40 p-3">
          <span class="text-orange-700 font-medium">Pico máximo registrado</span>
          <p class="mt-1 text-base sm:text-lg font-bold text-orange-600 tabular-nums truncate">
            S/ {{ peakPoint()?.totalSales ?? 0 | number: '1.2-2' }}
          </p>
          <span class="text-[11px] text-orange-800 font-mono">
            {{ peakPoint()?.label }}
          </span>
        </div>

        <div class="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3">
          <span class="text-emerald-700 font-medium">Ganancia bruta est.</span>
          <p class="mt-1 text-base sm:text-lg font-bold text-emerald-700 tabular-nums">
            S/ {{ totalGrossProfit() | number: '1.2-2' }}
          </p>
        </div>
      </div>

      <!-- Interactive SVG Chart Area -->
      <div class="relative w-full overflow-hidden rounded-xl border border-gray-100 bg-linear-to-b from-gray-50/50 to-white p-3 pt-6">
        @if (activePoints().length === 0) {
          <div class="flex h-56 items-center justify-center text-xs text-gray-400">
            Sin datos suficientes para graficar el periodo.
          </div>
        } @else {
          <div class="h-64 sm:h-72 w-full">
            <svg
              viewBox="0 0 1000 320"
              preserveAspectRatio="none"
              class="h-full w-full overflow-visible"
            >
              <defs>
                <linearGradient id="barOrangeGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#EA580C" stop-opacity="0.95" />
                  <stop offset="100%" stop-color="#FB923C" stop-opacity="0.65" />
                </linearGradient>
                <linearGradient id="peakBarGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#C2410C" stop-opacity="1" />
                  <stop offset="100%" stop-color="#EA580C" stop-opacity="0.85" />
                </linearGradient>
                <linearGradient id="areaGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#EA580C" stop-opacity="0.18" />
                  <stop offset="100%" stop-color="#EA580C" stop-opacity="0.0" />
                </linearGradient>
              </defs>

              <!-- Horizontal Grid Lines -->
              <line x1="40" y1="40" x2="980" y2="40" stroke="#E5E7EB" stroke-dasharray="3 3" stroke-width="1" />
              <line x1="40" y1="105" x2="980" y2="105" stroke="#E5E7EB" stroke-dasharray="3 3" stroke-width="1" />
              <line x1="40" y1="170" x2="980" y2="170" stroke="#E5E7EB" stroke-dasharray="3 3" stroke-width="1" />
              <line x1="40" y1="235" x2="980" y2="235" stroke="#E5E7EB" stroke-dasharray="3 3" stroke-width="1" />
              <line x1="40" y1="270" x2="980" y2="270" stroke="#D1D5DB" stroke-width="1.5" />

              <!-- Average Reference Line -->
              @if (averageY() > 40 && averageY() < 270) {
                <line
                  x1="40"
                  [attr.y1]="averageY()"
                  x2="980"
                  [attr.y2]="averageY()"
                  stroke="#F97316"
                  stroke-dasharray="4 4"
                  stroke-width="1.5"
                />
                <text
                  x="975"
                  [attr.y]="averageY() - 5"
                  text-anchor="end"
                  class="text-[9px] fill-orange-700 font-mono font-semibold"
                >
                  Promedio: S/ {{ averageSales() | number: '1.0-0' }}
                </text>
              }

              <!-- Area Under Trend Line -->
              @if (trendAreaPath()) {
                <path [attr.d]="trendAreaPath()" fill="url(#areaGlow)" />
                <path [attr.d]="trendLinePath()" fill="none" stroke="#EA580C" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              }

              <!-- Data Bars -->
              @for (pt of activePoints(); track $index; let idx = $index) {
                <g
                  class="cursor-pointer group transition-all duration-200"
                  (mouseenter)="hoveredPoint.set(pt)"
                  (mouseleave)="hoveredPoint.set(null)"
                  (click)="hoveredPoint.set(pt)"
                >
                  <!-- Transparent Hover Receptor Pillar -->
                  <rect
                    [attr.x]="barX(idx) - (barWidth() * 0.4)"
                    y="30"
                    [attr.width]="barWidth() * 1.8"
                    height="240"
                    fill="transparent"
                  />

                  <!-- Actual Bar -->
                  <rect
                    [attr.x]="barX(idx)"
                    [attr.y]="barY(pt.totalSales)"
                    [attr.width]="barWidth()"
                    [attr.height]="barHeight(pt.totalSales)"
                    rx="4"
                    [attr.fill]="isPeak(pt) ? 'url(#peakBarGradient)' : 'url(#barOrangeGradient)'"
                    [class.opacity-100]="!hoveredPoint() || hoveredPoint() === pt"
                    [class.opacity-50]="hoveredPoint() && hoveredPoint() !== pt"
                    class="transition-opacity duration-150 group-hover:filter group-hover:brightness-110"
                  />

                  <!-- Point Dot on Trend Line -->
                  <circle
                    [attr.cx]="barX(idx) + barWidth() / 2"
                    [attr.cy]="barY(pt.totalSales)"
                    r="3.5"
                    [attr.fill]="isPeak(pt) ? '#C2410C' : '#EA580C'"
                    stroke="#FFFFFF"
                    stroke-width="2"
                    class="group-hover:scale-125 transition-transform origin-center"
                  />

                  <!-- Peak Indicator Star -->
                  @if (isPeak(pt)) {
                    <g [attr.transform]="'translate(' + (barX(idx) + barWidth() / 2 - 6) + ', ' + (barY(pt.totalSales) - 16) + ')'">
                      <polygon points="6,0 7.8,4.5 12,4.8 8.8,7.8 9.8,12 6,9.5 2.2,12 3.2,7.8 0,4.8 4.2,4.5" fill="#EA580C" />
                    </g>
                  }

                  <!-- X-Axis Labels (Filtered to prevent crowding) -->
                  @if (shouldShowXLabel(idx)) {
                    <text
                      [attr.x]="barX(idx) + barWidth() / 2"
                      y="290"
                      text-anchor="middle"
                      class="text-[10px] sm:text-[11px] fill-gray-500 font-medium"
                    >
                      {{ pt.label }}
                    </text>
                  }
                </g>
              }
            </svg>
          </div>
        }

        <!-- Interactive Floating Tooltip (Shows when hovered) -->
        @if (hoveredPoint(); as active) {
          <div class="mt-3 rounded-xl border border-orange-200 bg-orange-50/90 p-3 sm:p-4 shadow-sm backdrop-blur-xs flex flex-wrap items-center justify-between gap-3 text-xs animate-in fade-in duration-200">
            <div class="space-y-0.5">
              <span class="inline-flex items-center gap-1 rounded font-mono text-[10px] font-bold text-orange-700 bg-orange-100 px-1.5 py-0.5">
                {{ active.periodKey }} · {{ active.subLabel }}
              </span>
              <p class="font-bold text-gray-900 text-sm">
                {{ active.label }}
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-4 sm:gap-6">
              <div>
                <span class="block text-[10px] text-gray-500 uppercase tracking-wider">Ventas</span>
                <span class="font-bold text-sm text-gray-900 tabular-nums">
                  S/ {{ active.totalSales | number: '1.2-2' }}
                </span>
              </div>

              @if (active.grossProfit) {
                <div>
                  <span class="block text-[10px] text-emerald-700 uppercase tracking-wider">Ganancia Bruta</span>
                  <span class="font-bold text-sm text-emerald-700 tabular-nums">
                    S/ {{ active.grossProfit | number: '1.2-2' }}
                  </span>
                </div>
              }

              <div>
                <span class="block text-[10px] text-gray-500 uppercase tracking-wider">Pedidos</span>
                <span class="font-bold text-sm text-gray-900 tabular-nums">
                  {{ active.ordersCount }}
                </span>
              </div>

              <div>
                <span class="block text-[10px] text-gray-500 uppercase tracking-wider">Repuestos</span>
                <span class="font-bold text-sm text-orange-600 tabular-nums">
                  {{ active.unitsSold }} un.
                </span>
              </div>
            </div>
          </div>
        } @else {
          <p class="mt-2 text-center text-[11px] text-gray-400">
            Pasa el cursor o pulsa sobre una barra para ver el desglose financiero exacto.
          </p>
        }
      </div>
    </div>
  `,
})
export class SalesChartComponent {
  @Input() dailySales: SalesTimelinePoint[] = [];
  @Input() weeklySales: SalesTimelinePoint[] = [];
  @Input() monthlySales: SalesTimelinePoint[] = [];

  readonly granularity = signal<ChartGranularity>('day');
  readonly hoveredPoint = signal<SalesTimelinePoint | null>(null);

  readonly activePoints = computed<SalesTimelinePoint[]>(() => {
    switch (this.granularity()) {
      case 'day':
        return this.dailySales || [];
      case 'week':
        return this.weeklySales || [];
      case 'year':
        return this.monthlySales || [];
    }
  });

  readonly maxSales = computed<number>(() => {
    const list = this.activePoints();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((p) => p.totalSales));
    return max > 0 ? max * 1.15 : 100;
  });

  readonly totalPeriodSales = computed<number>(() => {
    return this.activePoints().reduce((acc, p) => acc + (p.totalSales || 0), 0);
  });

  readonly totalGrossProfit = computed<number>(() => {
    return this.activePoints().reduce((acc, p) => acc + (p.grossProfit || 0), 0);
  });

  readonly averageSales = computed<number>(() => {
    const pts = this.activePoints();
    return pts.length > 0 ? this.totalPeriodSales() / pts.length : 0;
  });

  readonly peakPoint = computed<SalesTimelinePoint | null>(() => {
    const pts = this.activePoints();
    if (pts.length === 0) return null;
    return pts.reduce((prev, curr) => (curr.totalSales > prev.totalSales ? curr : prev), pts[0]);
  });

  readonly chartDescription = computed<string>(() => {
    switch (this.granularity()) {
      case 'day':
        return 'Comportamiento diario de ingresos en soles por boletas y facturas comerciales.';
      case 'week':
        return 'Tendencia consolidada semana a semana con margen de utilidad bruta.';
      case 'year':
        return 'Desempeño mensual a lo largo del año calendario con estacionalidad.';
    }
  });

  // Chart Geometry Math for 1000 x 320 SVG ViewBox
  private readonly leftMargin = 55;
  private readonly rightMargin = 960;
  private readonly topMargin = 45;
  private readonly bottomMargin = 265;
  private readonly chartHeight = this.bottomMargin - this.topMargin;

  barWidth(): number {
    const count = this.activePoints().length;
    if (count <= 7) return 48;
    if (count <= 14) return 32;
    if (count <= 31) return 18;
    return 12;
  }

  barX(index: number): number {
    const count = this.activePoints().length;
    if (count <= 1) return this.leftMargin;
    const availableWidth = this.rightMargin - this.leftMargin;
    const step = availableWidth / (count - 1);
    return this.leftMargin + index * step - this.barWidth() / 2;
  }

  barY(sales: number): number {
    const ratio = Math.min(1.0, Math.max(0.0, sales / this.maxSales()));
    return this.bottomMargin - ratio * this.chartHeight;
  }

  barHeight(sales: number): number {
    const ratio = Math.min(1.0, Math.max(0.0, sales / this.maxSales()));
    return Math.max(4, ratio * this.chartHeight);
  }

  averageY(): number {
    return this.barY(this.averageSales());
  }

  isPeak(pt: SalesTimelinePoint): boolean {
    const peak = this.peakPoint();
    return Boolean(peak && peak.periodKey === pt.periodKey && pt.totalSales > 0);
  }

  shouldShowXLabel(index: number): boolean {
    const count = this.activePoints().length;
    if (count <= 12) return true;
    if (count <= 20) return index % 2 === 0;
    return index % 3 === 0 || index === count - 1;
  }

  trendLinePath(): string {
    const pts = this.activePoints();
    if (pts.length < 2) return '';
    const coords = pts.map((pt, i) => `${this.barX(i) + this.barWidth() / 2},${this.barY(pt.totalSales)}`);
    return 'M ' + coords.join(' L ');
  }

  trendAreaPath(): string {
    const pts = this.activePoints();
    if (pts.length < 2) return '';
    const firstX = this.barX(0) + this.barWidth() / 2;
    const lastX = this.barX(pts.length - 1) + this.barWidth() / 2;
    const line = this.trendLinePath();
    return `${line} L ${lastX},${this.bottomMargin} L ${firstX},${this.bottomMargin} Z`;
  }
}
