import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { retry } from 'rxjs';
import {
  Category,
  Part,
  PartCompatibility,
  VehicleMake,
  VehicleModel,
} from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PromotionService } from '../../core/services/promotion.service';

const CATALOG_CACHE_KEY = 'asuncion_catalog_snapshot_v3';
const CATALOG_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

interface CatalogLocalSnapshot {
  savedAt: number;
  categories: Category[];
  makes: VehicleMake[];
  allModels: VehicleModel[];
  parts: Part[];
}

@Component({
  selector: 'app-catalog-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="min-h-screen bg-[#F8F9FA] pb-24 lg:pb-14">
      <!-- High-End Automotive Workshop Hero + Vehicle Fitment Selector -->
      <section class="relative bg-gray-950 text-white overflow-hidden border-b border-gray-800 shadow-md">
        <!-- Genuine Automotive Workshop Photography Backdrop -->
        <div class="absolute inset-0 z-0">
          <img
            src="/images/banners/hero-workshop.jpg"
            alt="Taller y repuestos automotrices Asunción"
            class="h-full w-full object-cover object-center filter brightness-50 contrast-125"
          />
          <div class="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-gray-900/70"></div>
        </div>

        <div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
          <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div class="space-y-3 max-w-2xl">
              <div class="inline-flex items-center gap-2 rounded-full border border-orange-500/40 bg-orange-500/20 px-3.5 py-1 text-xs sm:text-[13px] font-bold text-orange-200 backdrop-blur-md">
                <span class="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></span>
                <span>Repuestos Originales y Alternativos Garantizados · Asunción S.A.C.</span>
              </div>
              <h1 class="text-3xl sm:text-4xl lg:text-[42px] font-black tracking-tight text-white leading-tight">
                Encuentra el repuesto exacto para tu vehículo
              </h1>
              <p class="text-sm sm:text-base text-gray-200 leading-relaxed max-w-xl font-medium">
                Filtra al instante por marca, modelo, año y sistema con compatibilidad verificada OEM, precios mayoristas desde 4 unidades y despacho express.
              </p>
            </div>

            <!-- Predictive Search Box -->
            <div class="relative w-full lg:w-[420px]">
              <label class="block text-xs font-extrabold uppercase tracking-wide text-orange-200 mb-1.5">
                Búsqueda directa por Pieza, Código OEM, SKU o Marca
              </label>
              <div class="relative">
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchInputChange()"
                  (focus)="showSuggestions.set(true)"
                  (blur)="hideSuggestionsDelayed()"
                  placeholder="Ej: Pastilla de freno, Hilux, 04465, 15W-40..."
                  class="w-full min-h-[50px] rounded-xl border-2 border-white/80 bg-white pl-11 pr-10 py-2.5 text-base font-semibold text-gray-950 placeholder-gray-500 shadow-xl focus:border-orange-500 focus:ring-3 focus:ring-orange-500/30 focus:outline-none"
                />
                <svg class="absolute left-3.5 top-3.5 h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                @if (searchQuery) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="absolute right-2.5 top-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-950 cursor-pointer"
                    aria-label="Limpiar búsqueda"
                  >
                    <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.3">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              <!-- Predictive Suggestions Popover -->
              @if (showSuggestions() && searchQuery.trim().length >= 2 && predictiveResults().length > 0) {
                <div class="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-gray-300 bg-white shadow-2xl overflow-hidden divide-y divide-gray-100">
                  @for (item of predictiveResults(); track item.id) {
                    <button
                      type="button"
                      (mousedown)="goToPart(item.id)"
                      class="w-full px-4 py-3 text-left hover:bg-orange-50/80 flex items-center justify-between gap-3 transition cursor-pointer"
                    >
                      <div class="min-w-0">
                        <p class="truncate text-sm font-extrabold text-gray-950">{{ item.name }}</p>
                        <p class="text-xs font-semibold text-gray-600 tabular-nums mt-0.5">
                          @if (item.oemCode) {
                            <span>OEM {{ item.oemCode }} · </span>
                          }
                          <span>SKU {{ item.sku }}</span>
                        </p>
                      </div>
                      <span class="shrink-0 text-sm font-black text-orange-700 tabular-nums">
                        S/ {{ item.salePrice | number: '1.2-2' }}
                      </span>
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Horizontal Vehicle Selector Card -->
          <div class="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-2xl text-gray-950">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3.5 border-b border-gray-200">
              <div class="flex items-center gap-2.5">
                <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-600 text-white text-sm font-black shadow-2xs">
                  ✓
                </span>
                <span class="text-sm sm:text-base font-extrabold text-gray-950">
                  Selector de Compatibilidad Vehicular Instantáneo
                </span>
              </div>
              <span class="text-xs sm:text-[13px] text-gray-600 font-semibold">
                Combina marca, modelo, año y sistema sin tiempos de espera
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3.5 items-end">
              <!-- 1. Marca -->
              <div class="lg:col-span-2">
                <label class="block text-xs font-extrabold uppercase tracking-wide text-gray-800 mb-1.5">
                  1. Marca
                </label>
                <select
                  [(ngModel)]="selectedMakeId"
                  (ngModelChange)="onMakeChange()"
                  class="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-950 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/25 focus:outline-none cursor-pointer"
                >
                  <option [ngValue]="null">Todas las marcas</option>
                  @for (make of makes(); track make.id) {
                    <option [ngValue]="make.id">{{ make.name }}</option>
                  }
                </select>
              </div>

              <!-- 2. Modelo -->
              <div class="lg:col-span-3">
                <label class="block text-xs font-extrabold uppercase tracking-wide text-gray-800 mb-1.5">
                  2. Modelo
                </label>
                <select
                  [(ngModel)]="selectedModelId"
                  (ngModelChange)="onModelChange()"
                  class="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-950 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/25 focus:outline-none cursor-pointer"
                >
                  <option [ngValue]="null">Todos los modelos</option>
                  @for (model of models(); track model.id) {
                    <option [ngValue]="model.id">
                      {{ !selectedMakeId && model.makeName ? model.makeName + ' ' : '' }}{{ model.name }}{{ model.vehicleType ? ' (' + model.vehicleType + ')' : '' }}
                    </option>
                  }
                </select>
              </div>

              <!-- 3. Año -->
              <div class="lg:col-span-2">
                <label class="block text-xs font-extrabold uppercase tracking-wide text-gray-800 mb-1.5">
                  3. Año
                </label>
                <select
                  [(ngModel)]="selectedYear"
                  (ngModelChange)="applyFilters()"
                  class="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-950 tabular-nums focus:border-orange-600 focus:ring-2 focus:ring-orange-500/25 focus:outline-none cursor-pointer"
                >
                  <option [ngValue]="null">Cualquier año</option>
                  @for (yr of years; track yr) {
                    <option [ngValue]="yr">{{ yr }}</option>
                  }
                </select>
              </div>

              <!-- 4. Categoría -->
              <div class="lg:col-span-2">
                <label class="block text-xs font-extrabold uppercase tracking-wide text-gray-800 mb-1.5">
                  4. Sistema
                </label>
                <select
                  [(ngModel)]="selectedCategoryId"
                  (ngModelChange)="onCategoryFilterChange()"
                  class="w-full min-h-[46px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-950 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/25 focus:outline-none cursor-pointer"
                >
                  <option [ngValue]="null">Todos los sistemas</option>
                  @for (cat of categories(); track cat.id) {
                    <option [ngValue]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>

              <!-- Stock & Action Buttons -->
              <div class="sm:col-span-2 lg:col-span-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <label class="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3.5 cursor-pointer select-none text-sm font-bold text-gray-900 hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    [(ngModel)]="onlyInStock"
                    (ngModelChange)="applyFilters()"
                    class="h-4 w-4 rounded border-gray-400 accent-orange-600"
                  />
                  <span>En stock</span>
                </label>

                <button
                  type="button"
                  (click)="applyFilters()"
                  class="flex-1 min-h-[46px] rounded-xl bg-orange-600 py-2 px-4 text-sm font-extrabold text-white shadow-sm hover:bg-orange-700 active:scale-[0.98] transition-all duration-150 ease-out select-none cursor-pointer"
                >
                  Filtrar
                </button>

                @if (hasActiveFilters()) {
                  <button
                    type="button"
                    (click)="resetAllFilters()"
                    class="min-h-[46px] rounded-xl border border-gray-300 bg-white py-2 px-3.5 text-sm font-bold text-gray-800 hover:bg-gray-100 transition cursor-pointer"
                    title="Limpiar todos los filtros"
                  >
                    Limpiar
                  </button>
                }
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Marcas Principales de Camiones y Vehículos (Logos Oficiales) -->
      <section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        <div class="flex items-center justify-between gap-4 mb-3.5">
          <div>
            <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-gray-950 flex items-center gap-2">
              <svg class="h-5 w-5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <span>Marcas Principales de Camiones y Vehículos</span>
            </h2>
            <p class="text-xs sm:text-sm text-gray-600 font-medium">
              Selecciona una marca para ver sus repuestos compatibles de inmediato.
            </p>
          </div>
          @if (selectedMakeId !== null) {
            <button
              type="button"
              (click)="selectedMakeId = null; onMakeChange()"
              class="text-xs sm:text-sm font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Quitar filtro de marca</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 sm:gap-3">
          @for (brand of featuredBrands; track brand.name) {
            <button
              type="button"
              (click)="selectBrandByName(brand.name)"
              [class]="
                isBrandActive(brand.name)
                  ? 'border-orange-600 bg-orange-50 ring-2 ring-orange-500/30 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-xs'
              "
              class="group flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer"
            >
              <div class="h-10 w-full flex items-center justify-center mb-1.5 overflow-hidden">
                <img
                  [src]="brand.logo"
                  [alt]="brand.name"
                  (error)="onBrandImageError($event)"
                  class="max-h-9 max-w-[82px] object-contain transition duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <span class="text-sm font-extrabold text-gray-950 group-hover:text-orange-600 transition">
                {{ brand.name }}
              </span>
              <span class="text-xs font-medium text-gray-600 line-clamp-1">
                {{ brand.type }}
              </span>
            </button>
          }
        </div>
      </section>

      <!-- Visual Automotive Systems Category Showcase (Genuine Photography) -->
      <section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8">
        <div class="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 class="text-lg sm:text-xl font-extrabold tracking-tight text-gray-950">
              Explorar por Sistema del Vehículo
            </h2>
            <p class="text-xs sm:text-sm text-gray-600 font-medium">
              Haz clic en cualquier sistema automotriz para filtrar el catálogo instantáneamente.
            </p>
          </div>
          @if (selectedCategoryId !== null) {
            <button
              type="button"
              (click)="selectCategoryPill(null)"
              class="text-xs sm:text-sm font-extrabold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todos los sistemas</span>
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          }
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          @for (cat of featuredCategories; track cat.code) {
            <div
              (click)="selectCategoryByCode(cat.code)"
              [class]="isCategoryActive(cat.code) ? 'ring-3 ring-orange-500 border-transparent shadow-md' : 'border-gray-200 hover:border-orange-300 hover:shadow-md'"
              class="group relative overflow-hidden rounded-xl border bg-gray-900 cursor-pointer shadow-2xs hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 ease-out select-none"
            >
              <div class="aspect-16/10 sm:aspect-16/9 overflow-hidden">
                <img
                  [src]="cat.image"
                  [alt]="cat.name"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108 filter brightness-85 group-hover:brightness-95"
                />
              </div>

              <div class="absolute inset-0 bg-gradient-to-t from-gray-950/95 via-gray-950/45 to-transparent flex flex-col justify-end p-3.5 sm:p-4 text-white">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    @if (cat.icon) {
                      <img [src]="cat.icon" [alt]="cat.name" class="h-5 w-5 object-contain rounded bg-white/20 p-0.5 shrink-0" />
                    }
                    <h3 class="text-sm sm:text-[15px] font-extrabold text-white group-hover:text-orange-300 transition tracking-tight truncate">
                      {{ cat.name }}
                    </h3>
                  </div>
                  @if (isCategoryActive(cat.code)) {
                    <span class="h-2.5 w-2.5 rounded-full bg-orange-400 ring-4 ring-orange-400/35 shrink-0"></span>
                  }
                </div>
                <p class="text-xs text-gray-200 line-clamp-1 mt-0.5 hidden sm:block font-medium">
                  {{ cat.desc }}
                </p>
              </div>
            </div>
          }
        </div>
      </section>

      <!-- Main Catalog Content -->
      <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-8 space-y-5">
        <!-- Quick Category Pills -->
        @if (categories().length > 0) {
          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              (click)="selectCategoryPill(null)"
              [class]="
                selectedCategoryId === null
                  ? 'bg-orange-600 text-white border-orange-600 font-extrabold shadow-2xs'
                  : 'bg-white text-gray-800 border-gray-300 hover:border-orange-400 hover:text-gray-950 font-bold'
              "
              class="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs sm:text-[13px] transition cursor-pointer select-none"
            >
              <span>Todas las categorías</span>
            </button>
            @for (cat of categories(); track cat.id) {
              <button
                type="button"
                (click)="selectCategoryPill(cat.id)"
                [class]="
                  selectedCategoryId === cat.id
                    ? 'bg-orange-600 text-white border-orange-600 font-extrabold shadow-2xs'
                    : 'bg-white text-gray-800 border-gray-300 hover:border-orange-400 hover:text-gray-950 font-bold'
                "
                class="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs sm:text-[13px] transition cursor-pointer select-none"
              >
                <span>{{ cat.name }}</span>
              </button>
            }
          </div>
        }

        <!-- SAE Viscosity Filter Bar (Aceites, Lubricantes y Filtros) -->
        @if (shouldShowViscosityFilter()) {
          <div class="flex flex-wrap items-center gap-2 p-3.5 rounded-xl border border-amber-300 bg-amber-50/70 shadow-2xs">
            <div class="flex items-center gap-1.5 mr-1 text-xs sm:text-sm font-extrabold text-amber-950 shrink-0">
              <span>🛢️</span>
              <span>Grado de Viscosidad SAE:</span>
            </div>
            <button
              type="button"
              (click)="selectViscosity(null)"
              [class]="
                selectedViscosity() === null
                  ? 'bg-amber-600 text-white border-amber-600 font-extrabold shadow-2xs'
                  : 'bg-white text-gray-800 border-gray-300 hover:border-amber-400 font-bold'
              "
              class="rounded-lg border px-3 py-1.5 text-xs sm:text-[13px] transition cursor-pointer"
            >
              Todos los grados
            </button>
            @for (v of commonViscosities; track v) {
              <button
                type="button"
                (click)="selectViscosity(v)"
                [class]="
                  selectedViscosity() === v
                    ? 'bg-amber-600 text-white border-amber-600 font-extrabold shadow-2xs'
                    : 'bg-white text-gray-800 border-gray-300 hover:border-amber-400 hover:bg-amber-100/60 font-bold'
                "
                class="rounded-lg border px-3 py-1.5 text-xs sm:text-[13px] tabular-nums transition cursor-pointer"
              >
                {{ v }}
              </button>
            }
          </div>
        }

        <!-- High-Legibility Results Summary & Active Filter Chips Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-300/90 bg-white px-4 py-3.5 shadow-2xs">
          <div class="flex flex-wrap items-center gap-2.5 text-sm font-semibold text-gray-800">
            @if (isLoading()) {
              <span class="inline-flex items-center gap-2 text-sm font-bold text-gray-700">
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-orange-600 border-t-transparent"></span>
                Cargando catálogo de repuestos...
              </span>
            } @else if (displayedParts().length === 0) {
              <span class="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1 text-sm font-extrabold text-red-700">
                <span>Sin coincidencias</span>
                <span class="text-xs font-bold text-red-600">(ningún repuesto coincide con la búsqueda actual)</span>
              </span>
            } @else {
              <span class="inline-flex items-center gap-2">
                <span>Mostrando</span>
                <strong class="inline-flex items-center justify-center rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-0.5 text-base font-black text-orange-700 tabular-nums">
                  {{ displayedParts().length }}
                </strong>
                <span>{{ displayedParts().length === 1 ? 'repuesto disponible' : 'repuestos disponibles' }}</span>
              </span>
            }

            @if (activeMakeName(); as makeLabel) {
              <button
                type="button"
                (click)="selectedMakeId = null; onMakeChange()"
                class="inline-flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs font-extrabold text-orange-800 hover:bg-orange-100 cursor-pointer"
              >
                <span>Marca: {{ makeLabel }}</span>
                <span>✕</span>
              </button>
            }
            @if (activeModelName(); as modelLabel) {
              <button
                type="button"
                (click)="selectedModelId = null; applyFilters()"
                class="inline-flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs font-extrabold text-orange-800 hover:bg-orange-100 cursor-pointer"
              >
                <span>Modelo: {{ modelLabel }}</span>
                <span>✕</span>
              </button>
            }
            @if (selectedYear) {
              <button
                type="button"
                (click)="selectedYear = null; applyFilters()"
                class="inline-flex items-center gap-1 rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1 text-xs font-extrabold text-orange-800 tabular-nums hover:bg-orange-100 cursor-pointer"
              >
                <span>Año: {{ selectedYear }}</span>
                <span>✕</span>
              </button>
            }
            @if (selectedViscosity()) {
              <button
                type="button"
                (click)="selectViscosity(null)"
                class="inline-flex items-center gap-1 rounded-lg bg-amber-50 border border-amber-300 px-2.5 py-1 text-xs font-extrabold text-amber-900 tabular-nums hover:bg-amber-100 cursor-pointer"
              >
                <span>SAE {{ selectedViscosity() }}</span>
                <span>✕</span>
              </button>
            }
          </div>

          <div class="flex items-center gap-3">
            @if (backendOffline()) {
              <div class="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-800">
                <span class="h-2 w-2 rounded-full bg-orange-500 animate-ping"></span>
                <span>Sincronizando con servidor en la nube...</span>
              </div>
            }

            <div class="flex items-center gap-2 text-xs sm:text-sm">
              <label class="text-gray-700 font-bold hidden sm:inline">Ordenar por:</label>
              <select
                [ngModel]="sortBy()"
                (ngModelChange)="sortBy.set($event)"
                class="min-h-[38px] rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs sm:text-sm font-bold text-gray-900 focus:border-orange-500 focus:outline-none cursor-pointer"
              >
                <option value="RELEVANCE">Relevancia</option>
                <option value="PRICE_ASC">Precio: Menor a Mayor</option>
                <option value="PRICE_DESC">Precio: Mayor a Menor</option>
                <option value="STOCK_DESC">Mayor Stock Disponible</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Loading Skeleton (Only on first uncached cold boot) -->
        @if (isLoading()) {
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            @for (s of [1, 2, 3, 4, 5, 6, 7, 8]; track s) {
              <div class="rounded-2xl border border-gray-200 bg-white p-4 space-y-3 animate-pulse">
                <div class="aspect-4/3 rounded-xl bg-gray-100"></div>
                <div class="h-4 w-2/3 rounded bg-gray-100"></div>
                <div class="h-3 w-full rounded bg-gray-100"></div>
                <div class="h-10 w-full rounded-xl bg-gray-100"></div>
              </div>
            }
          </div>
        } @else if (displayedParts().length === 0) {
          <div class="rounded-2xl border border-gray-300 bg-white p-12 text-center space-y-3.5 shadow-xs">
            <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-orange-600">
              <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 class="text-lg font-extrabold text-gray-950">
              No encontramos repuestos con ese criterio de búsqueda
            </h3>
            <p class="text-sm text-gray-600 max-w-md mx-auto leading-relaxed font-medium">
              Revisa la ortografía del código buscado o restablece los filtros para visualizar todos los repuestos en stock.
            </p>
            <button
              type="button"
              (click)="resetAllFilters()"
              class="rounded-xl bg-orange-600 px-6 py-3 text-sm font-extrabold text-white hover:bg-orange-700 transition cursor-pointer shadow-xs"
            >
              Mostrar todo el catálogo
            </button>
          </div>
        } @else {
          <!-- Spare Parts Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            @for (part of displayedParts(); track part.id) {
              <article class="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs hover:border-orange-400 hover:shadow-md transition-all duration-200">
                <!-- Product Image Container -->
                <a [routerLink]="['/part', part.id]" class="relative aspect-4/3 overflow-hidden bg-gray-50 border-b border-gray-200/80 block">
                  <img
                    [src]="resolveImage(part)"
                    [alt]="part.name"
                    (error)="onPartImageError($event, part)"
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  <!-- Manufacturer Brand Pill -->
                  @if (part.manufacturerBrand) {
                    <span class="absolute top-2.5 left-2.5 rounded-lg border border-gray-300 bg-white/95 px-2.5 py-1 text-xs font-extrabold text-gray-950 shadow-2xs">
                      {{ part.manufacturerBrand }}
                    </span>
                  }

                  <!-- Promo Badge -->
                  @if (promotionService.getPromotion(part.sku); as promo) {
                    <span class="absolute bottom-2.5 left-2.5 rounded-full border border-red-500 bg-red-600 px-2.5 py-1 text-xs font-extrabold text-white shadow-md z-10 tabular-nums">
                      🏷️ {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                    </span>
                  }

                  <!-- Clear High-Contrast Stock & Reservation Badge -->
                  <div class="absolute top-2.5 right-2.5 flex flex-col items-end gap-1">
                    <span
                      [class]="
                        cart.getRemainingStockToAdd(part) <= 0
                          ? 'bg-red-50 text-red-800 border-red-300'
                          : part.lowStockAlert || cart.getRemainingStockToAdd(part) <= 5
                            ? 'bg-orange-50 text-orange-800 border-orange-300'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      "
                      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-extrabold shadow-2xs tabular-nums"
                    >
                      <span
                        class="h-2 w-2 rounded-full"
                        [class]="cart.getRemainingStockToAdd(part) <= 0 ? 'bg-red-600' : (part.lowStockAlert || cart.getRemainingStockToAdd(part) <= 5) ? 'bg-orange-500' : 'bg-emerald-600'"
                      ></span>
                      @if (cart.getRemainingStockToAdd(part) <= 0) {
                        @if (cart.getTotalReservedDisplay(part) > 0) {
                          En reserva ({{ cart.getTotalReservedDisplay(part) }})
                        } @else if (cart.getMyCartQuantity(part.id) > 0) {
                          En carrito ({{ cart.getMyCartQuantity(part.id) }})
                        } @else {
                          Sin stock
                        }
                      } @else if (part.lowStockAlert || cart.getRemainingStockToAdd(part) <= 5) {
                        Últimas {{ cart.getRemainingStockToAdd(part) }} und.
                      } @else {
                        Stock: {{ cart.getRemainingStockToAdd(part) }} und.
                      }
                    </span>

                    @if (cart.getTotalReservedDisplay(part) > 0 && cart.getRemainingStockToAdd(part) > 0) {
                      <span class="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50/95 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900 shadow-2xs tabular-nums">
                        ⏳ {{ cart.getTotalReservedDisplay(part) }} en reserva
                      </span>
                    }
                  </div>
                </a>

                <!-- Card Body -->
                <div class="flex flex-1 flex-col p-4 space-y-2.5">
                  <div class="flex items-center justify-between gap-2">
                    @if (part.categoryName) {
                      <span class="text-xs font-extrabold uppercase tracking-wide text-orange-700 truncate">
                        {{ part.categoryName }}
                      </span>
                    }
                    @if (getPartViscosity(part); as visc) {
                      <span class="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-extrabold text-amber-950 shrink-0 tabular-nums">
                        🛢️ SAE {{ visc }}
                      </span>
                    }
                  </div>

                  <a
                    [routerLink]="['/part', part.id]"
                    [title]="part.name"
                    class="text-[15px] sm:text-base font-extrabold text-gray-950 line-clamp-2 leading-snug group-hover:text-orange-600 transition min-h-[2.75rem]"
                  >
                    {{ part.name }}
                  </a>

                  <!-- High-Legibility OEM & SKU Codes -->
                  <div class="flex flex-wrap items-center gap-1.5">
                    @if (part.oemCode) {
                      <span class="rounded-md border border-gray-300 bg-gray-100 px-2 py-0.5 text-xs font-bold text-gray-900 tabular-nums">
                        OEM {{ part.oemCode }}
                      </span>
                    }
                    @if (part.sku) {
                      <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-semibold text-gray-700 tabular-nums">
                        {{ part.sku }}
                      </span>
                    }
                  </div>

                  <!-- Combo Badge Banner -->
                  @if (promotionService.getPromotion(part.sku); as promo) {
                    @if (promo.promoType === 'COMBO_SUGERIDO' && promo.comboComplementName) {
                      <div class="rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-xs text-orange-950 flex items-center justify-between gap-1">
                        <span class="font-bold">📦 Combo: + {{ promo.comboComplementName }}</span>
                        <span class="text-orange-700 font-extrabold tabular-nums">Ahorro S/ {{ ((promo.originalPrice + (promo.comboComplementPrice || 0)) - (promo.comboTotalPromoPrice || (promo.promoPrice + (promo.comboComplementPrice || 0) * 0.85))) | number: '1.2-2' }}</span>
                      </div>
                    }
                  }

                  <!-- Smart Vehicle Compatibility Preview -->
                  <div class="rounded-lg bg-gray-50 border border-gray-200 px-2.5 py-1.5 text-xs text-gray-800 truncate">
                    <span class="font-extrabold text-gray-900">Aplica:</span>
                    <span class="font-medium ml-1">{{ formatFirstCompatibility(part) }}</span>
                    @if (part.compatibilities && part.compatibilities.length > 1) {
                      <span class="font-extrabold text-orange-700 ml-1 tabular-nums">
                        +{{ part.compatibilities.length - 1 }} modelos
                      </span>
                    }
                  </div>

                  <!-- Pricing & CTA Footer -->
                  <div class="mt-auto pt-3 border-t border-gray-200/80 space-y-3">
                    <div class="flex items-stretch justify-between gap-2">
                      <div>
                        @if (promotionService.getPromotion(part.sku); as promo) {
                          <span class="block text-[11px] font-extrabold text-red-600 uppercase tracking-wide">
                            {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                          </span>
                          <div class="flex items-baseline gap-1.5">
                            <span class="text-xl font-black tracking-tight text-red-600 tabular-nums">
                              S/ {{ promo.promoPrice | number: '1.2-2' }}
                            </span>
                            <span class="text-xs font-semibold text-gray-500 line-through tabular-nums">
                              S/ {{ part.salePrice | number: '1.2-2' }}
                            </span>
                          </div>
                        } @else {
                          <span class="block text-[11px] font-bold uppercase tracking-wide text-gray-600">Precio Unitario</span>
                          <span class="text-xl font-black tracking-tight text-gray-950 tabular-nums">
                            S/ {{ part.salePrice | number: '1.2-2' }}
                          </span>
                        }
                      </div>
                      @if (part.wholesalePrice) {
                        <div class="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-right flex flex-col justify-center">
                          <span class="block text-[11px] font-extrabold text-emerald-900">Mayorista (4+)</span>
                          <span class="text-sm font-black text-emerald-800 tabular-nums">
                            S/ {{ part.wholesalePrice | number: '1.2-2' }}
                          </span>
                        </div>
                      }
                    </div>

                    <div class="grid grid-cols-5 gap-2">
                      <a
                        [routerLink]="['/part', part.id]"
                        class="col-span-2 min-h-[44px] flex items-center justify-center rounded-xl border border-gray-300 bg-white px-2 text-[13px] font-extrabold text-gray-800 hover:border-gray-400 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 ease-out select-none"
                      >
                        Ver ficha
                      </a>
                      <button
                        type="button"
                        [disabled]="cart.getRemainingStockToAdd(part) <= 0"
                        (click)="cart.addPart(part, 1, true)"
                        class="col-span-3 min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 text-[13px] font-extrabold text-white shadow-2xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-500 transition-all duration-150 ease-out select-none cursor-pointer"
                      >
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>{{ cart.getRemainingStockToAdd(part) <= 0 ? (cart.getTotalReservedDisplay(part) > 0 ? 'En reserva' : (cart.getMyCartQuantity(part.id) > 0 ? 'Máx. carrito' : 'Sin stock')) : 'Agregar' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            }
          </div>
        }
      </div>

      <!-- Trust & Logistics Operational Assurance Grid (Real Photography) -->
      <section class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-delivery.jpg"
                alt="Despacho express motorizado con rastreo en vivo"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-extrabold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>Despacho Express en Lima</span>
              </div>
              <h3 class="text-base font-extrabold text-gray-950">Envíos Motorizados y Constancia Digital</h3>
              <p class="text-sm text-gray-700 leading-relaxed">
                Seguimiento de tu pedido en ruta y constancia fotográfica de entrega en tu taller o domicilio.
              </p>
            </div>
          </div>

          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-warehouse.jpg"
                alt="Almacén de repuestos automotrices Asunción"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-extrabold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Stock Físico Inmediato</span>
              </div>
              <h3 class="text-base font-extrabold text-gray-950">Almacén Central en Santa Anita</h3>
              <p class="text-sm text-gray-700 leading-relaxed">
                Inventario sincronizado para compras al por menor y mayor (4+ unidades con descuento por volumen automático).
              </p>
            </div>
          </div>

          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-expert.jpg"
                alt="Asesoría técnica automotriz garantizada"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-extrabold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Garantía de Fábrica</span>
              </div>
              <h3 class="text-base font-extrabold text-gray-950">Asesoría Técnica y Calidad Comprobada</h3>
              <p class="text-sm text-gray-700 leading-relaxed">
                Verificación de compatibilidad con número VIN o código OEM por especialistas mecánicos certificados.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class CatalogPageComponent implements OnInit, OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly cart = inject(CartService);
  readonly promotionService = inject(PromotionService);
  private stockRefreshInterval: ReturnType<typeof setInterval> | null = null;
  private pendingQueryCategory: string | null = null;

  readonly categories = signal<Category[]>([]);
  readonly makes = signal<VehicleMake[]>([]);
  readonly allModels = signal<VehicleModel[]>([]);
  readonly allParts = signal<Part[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly backendOffline = signal<boolean>(false);
  readonly showSuggestions = signal<boolean>(false);
  readonly sortBy = signal<'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'STOCK_DESC'>('RELEVANCE');

  // Reactive filter state signals for 0ms synchronous filtering
  private readonly searchQuerySig = signal<string>('');
  private readonly selectedCategoryIdSig = signal<number | null>(null);
  private readonly selectedMakeIdSig = signal<number | null>(null);
  private readonly selectedModelIdSig = signal<number | null>(null);
  private readonly selectedYearSig = signal<number | null>(null);
  private readonly onlyInStockSig = signal<boolean>(false);

  get searchQuery(): string {
    return this.searchQuerySig();
  }
  set searchQuery(val: string) {
    this.searchQuerySig.set(val ?? '');
  }

  get selectedCategoryId(): number | null {
    return this.selectedCategoryIdSig();
  }
  set selectedCategoryId(val: number | null) {
    this.selectedCategoryIdSig.set(val);
  }

  get selectedMakeId(): number | null {
    return this.selectedMakeIdSig();
  }
  set selectedMakeId(val: number | null) {
    this.selectedMakeIdSig.set(val);
  }

  get selectedModelId(): number | null {
    return this.selectedModelIdSig();
  }
  set selectedModelId(val: number | null) {
    this.selectedModelIdSig.set(val);
  }

  get selectedYear(): number | null {
    return this.selectedYearSig();
  }
  set selectedYear(val: number | null) {
    this.selectedYearSig.set(val);
  }

  get onlyInStock(): boolean {
    return this.onlyInStockSig();
  }
  set onlyInStock(val: boolean) {
    this.onlyInStockSig.set(Boolean(val));
  }

  readonly models = computed<VehicleModel[]>(() => {
    const makeId = this.selectedMakeIdSig();
    const list = this.allModels();
    if (!makeId) {
      return list;
    }
    return list.filter((m) => m.makeId === makeId);
  });

  readonly activeMakeName = computed<string | null>(() => {
    const id = this.selectedMakeIdSig();
    if (!id) return null;
    return this.makes().find((m) => m.id === id)?.name ?? null;
  });

  readonly activeModelName = computed<string | null>(() => {
    const id = this.selectedModelIdSig();
    if (!id) return null;
    return this.allModels().find((m) => m.id === id)?.name ?? null;
  });

  readonly featuredCategories: {
    code: string;
    name: string;
    desc: string;
    image: string;
    icon?: string | null;
  }[] = [
    {
      code: 'FRENOS',
      name: 'Sistema de Frenos',
      desc: 'Pastillas cerámicas, discos ventilados y zapatas',
      image: '/images/categories/frenos.jpg',
      icon: '/images/categories/frenos.png',
    },
    {
      code: 'FILTROS',
      name: 'Filtros y Lubricación',
      desc: 'Filtros de aceite, aire de motor y lubricantes sintéticos',
      image: '/images/categories/filtros.jpg',
      icon: null,
    },
    {
      code: 'SUSPENSION',
      name: 'Suspensión y Dirección',
      desc: 'Amortiguadores a gas, terminales, rótulas y trapecios',
      image: '/images/categories/suspension.jpg',
      icon: '/images/categories/suspension.png',
    },
    {
      code: 'MOTOR',
      name: 'Motor y Distribución',
      desc: 'Kits de distribución, bombas de aceite y fajas',
      image: '/images/categories/motor.jpg',
      icon: '/images/categories/motor.png',
    },
    {
      code: 'TRANSMISION',
      name: 'Embrague y Transmisión',
      desc: 'Platos de embrague, discos, collarines y palieres',
      image: '/images/categories/transmision.jpg',
      icon: null,
    },
    {
      code: 'ELECTRICO',
      name: 'Sistema Eléctrico e Iluminación',
      desc: 'Alternadores, arrancadores, focos halógenos y LED',
      image: '/images/categories/electrico.jpg',
      icon: null,
    },
    {
      code: 'REFRIGERACION',
      name: 'Refrigeración y Climatización',
      desc: 'Radiadores, termostatos y bombas de refrigerante',
      image: '/images/categories/refrigeracion.jpg',
      icon: null,
    },
    {
      code: 'CARROCERIA',
      name: 'Carrocería y Faros Exteriores',
      desc: 'Faros delanteros, biseles, espejos y parachoques',
      image: '/images/categories/carroceria.jpg',
      icon: null,
    },
  ];

  readonly featuredBrands = [
    { name: 'Toyota', logo: '/images/brands/toyota.jpg', type: 'Autos y Pickups' },
    { name: 'Hyundai', logo: '/images/brands/hyundai.png', type: 'Autos y Comerciales' },
    { name: 'Nissan', logo: '/images/brands/nissan.png', type: 'Pickups y Sedanes' },
    { name: 'Kia', logo: '/images/brands/kia.png', type: 'Autos y SUVs' },
    { name: 'Mitsubishi', logo: '/images/brands/mitsubishi.png', type: 'Pickups 4x4' },
    { name: 'Hino', logo: '/images/brands/hino.png', type: 'Camiones y Carga' },
    { name: 'Isuzu', logo: '/images/brands/isuzu.png', type: 'Camiones y Chasis' },
    { name: 'Scania', logo: '/images/brands/scania.jpg', type: 'Transporte Pesado' },
  ];

  readonly commonViscosities = [
    '0W-20',
    '5W-30',
    '5W-40',
    '10W-30',
    '10W-40',
    '15W-40',
    '20W-50',
    '75W-90',
    '80W-90',
  ];
  readonly selectedViscosity = signal<string | null>(null);
  readonly years: number[] = Array.from({ length: 33 }, (_, i) => 2026 - i);

  // Instant 0ms in-memory filtered and sorted parts
  readonly displayedParts = computed<Part[]>(() => {
    const catId = this.selectedCategoryIdSig();
    const makeId = this.selectedMakeIdSig();
    const modelId = this.selectedModelIdSig();
    const year = this.selectedYearSig();
    const inStockOnly = this.onlyInStockSig();
    const visc = this.selectedViscosity();
    const queryTokens = this.tokenizeSearch(this.searchQuerySig());
    const hasVehicleFilter = Boolean(makeId || modelId || year);

    let list = this.allParts().filter((part) => {
      if (part.active === false) return false;
      if (catId !== null && part.categoryId !== catId) return false;
      if (inStockOnly && this.cart.getRemainingStockToAdd(part) <= 0) return false;
      if (!this.matchesFitment(part, makeId, modelId, year)) return false;
      if (visc) {
        const targetVisc = visc.replace('-', '').toUpperCase();
        const partText = `${part.name} ${part.technicalDescription || ''}`
          .replace(/-/g, '')
          .toUpperCase();
        if (!partText.includes(targetVisc)) return false;
      }
      if (queryTokens.length > 0 && !this.matchesQueryTokens(part, queryTokens)) {
        return false;
      }
      return true;
    });

    const sort = this.sortBy();
    if (sort === 'PRICE_ASC') {
      list = [...list].sort((a, b) => a.salePrice - b.salePrice);
    } else if (sort === 'PRICE_DESC') {
      list = [...list].sort((a, b) => b.salePrice - a.salePrice);
    } else if (sort === 'STOCK_DESC') {
      list = [...list].sort(
        (a, b) => this.cart.getRemainingStockToAdd(b) - this.cart.getRemainingStockToAdd(a)
      );
    } else if (hasVehicleFilter) {
      // Prioritize exact vehicle mechanical fitments ahead of universal fluids
      list = [...list].sort((a, b) => {
        const aExact = this.hasDirectCompatibility(a, makeId, modelId, year) ? 0 : 1;
        const bExact = this.hasDirectCompatibility(b, makeId, modelId, year) ? 0 : 1;
        return aExact - bExact;
      });
    }

    return list;
  });

  readonly predictiveResults = computed<Part[]>(() => {
    const tokens = this.tokenizeSearch(this.searchQuerySig());
    if (tokens.length === 0) return [];
    return this.allParts()
      .filter((p) => p.active !== false && this.matchesQueryTokens(p, tokens))
      .slice(0, 6);
  });

  ngOnInit(): void {
    this.hydrateSnapshotFromStorage();
    this.cart.refreshPosHoldsAndReconcile();

    this.route.queryParamMap.subscribe((params) => {
      const catParam = params.get('category');
      if (catParam) {
        const normalized = catParam.toUpperCase().includes('LUBRIC') ? 'FILTROS' : catParam;
        if (this.categories().length > 0) {
          this.selectCategoryByCode(normalized);
        } else {
          this.pendingQueryCategory = normalized;
        }
      }
    });

    this.loadCatalogBundle();

    if (typeof window !== 'undefined') {
      this.stockRefreshInterval = setInterval(() => {
        this.cart.refreshPosHoldsAndReconcile();
        this.silentRefreshParts();
      }, 12000);
    }
  }

  ngOnDestroy(): void {
    if (this.stockRefreshInterval) {
      clearInterval(this.stockRefreshInterval);
      this.stockRefreshInterval = null;
    }
  }

  private hydrateSnapshotFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(CATALOG_CACHE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CatalogLocalSnapshot;
      if (!parsed || Date.now() - parsed.savedAt > CATALOG_CACHE_MAX_AGE_MS) return;
      if (Array.isArray(parsed.categories) && parsed.categories.length > 0) {
        this.categories.set(parsed.categories);
      }
      if (Array.isArray(parsed.makes) && parsed.makes.length > 0) {
        this.makes.set(parsed.makes);
      }
      if (Array.isArray(parsed.allModels) && parsed.allModels.length > 0) {
        this.allModels.set(parsed.allModels);
      }
      if (Array.isArray(parsed.parts) && parsed.parts.length > 0) {
        this.allParts.set(parsed.parts);
        this.isLoading.set(false);
      }
    } catch {
      // Ignore storage corruption
    }
  }

  private persistSnapshotToStorage(): void {
    if (typeof window === 'undefined') return;
    const parts = this.allParts();
    if (parts.length === 0) return;
    try {
      const snapshot: CatalogLocalSnapshot = {
        savedAt: Date.now(),
        categories: this.categories(),
        makes: this.makes(),
        allModels: this.allModels(),
        parts,
      };
      localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify(snapshot));
    } catch {
      // Ignore quota errors
    }
  }

  private loadCatalogBundle(): void {
    if (this.allParts().length === 0) {
      this.isLoading.set(true);
    }

    this.catalogService
      .getCategories()
      .pipe(retry({ count: 4, delay: 2500 }))
      .subscribe({
        next: (cats) => {
          this.categories.set(cats);
          if (this.pendingQueryCategory) {
            const code = this.pendingQueryCategory;
            this.pendingQueryCategory = null;
            this.selectCategoryByCode(code);
          }
          this.persistSnapshotToStorage();
        },
        error: () => {},
      });

    this.catalogService
      .getVehicleMakes()
      .pipe(retry({ count: 4, delay: 2500 }))
      .subscribe({
        next: (makes) => {
          this.makes.set(makes);
          this.persistSnapshotToStorage();
        },
        error: () => {},
      });

    this.catalogService
      .getVehicleModels(null)
      .pipe(retry({ count: 4, delay: 2500 }))
      .subscribe({
        next: (models) => {
          this.allModels.set(models);
          this.persistSnapshotToStorage();
        },
        error: () => {},
      });

    this.catalogService
      .searchParts({})
      .pipe(retry({ count: 4, delay: 2500 }))
      .subscribe({
        next: (parts) => {
          this.backendOffline.set(false);
          this.allParts.set(parts);
          this.isLoading.set(false);
          this.persistSnapshotToStorage();
        },
        error: () => {
          this.isLoading.set(false);
          if (this.allParts().length === 0) {
            this.backendOffline.set(true);
          }
        },
      });
  }

  private silentRefreshParts(): void {
    this.catalogService.searchParts({}).subscribe({
      next: (data) => {
        this.backendOffline.set(false);
        this.allParts.set(data);
        this.persistSnapshotToStorage();
      },
      error: () => {},
    });
  }

  private isUniversalPart(part: Part): boolean {
    if (!part.compatibilities || part.compatibilities.length === 0) {
      return true;
    }
    const text = `${part.name} ${part.technicalDescription || ''}`.toLowerCase();
    return text.includes('universal');
  }

  private hasDirectCompatibility(
    part: Part,
    makeId: number | null,
    modelId: number | null,
    year: number | null
  ): boolean {
    if (!part.compatibilities || part.compatibilities.length === 0) return false;
    return part.compatibilities.some((c) => {
      const makeOk = makeId === null || c.makeId === makeId;
      const modelOk = modelId === null || c.modelId === modelId;
      const yearOk = year === null || (c.yearStart <= year && c.yearEnd >= year);
      return makeOk && modelOk && yearOk;
    });
  }

  private matchesFitment(
    part: Part,
    makeId: number | null,
    modelId: number | null,
    year: number | null
  ): boolean {
    if (makeId === null && modelId === null && year === null) {
      return true;
    }
    if (this.hasDirectCompatibility(part, makeId, modelId, year)) {
      return true;
    }
    return this.isUniversalPart(part);
  }

  private normalizeSearchText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private tokenizeSearch(raw: string): string[] {
    const clean = this.normalizeSearchText(raw).trim();
    if (!clean) return [];
    return clean.split(/\s+/).filter(Boolean);
  }

  private matchesQueryTokens(part: Part, tokens: string[]): boolean {
    const compatStr = (part.compatibilities || [])
      .map((c) => `${c.makeName || ''} ${c.modelName || ''} ${c.yearStart}-${c.yearEnd}`)
      .join(' ');
    const haystack = this.normalizeSearchText(
      `${part.sku || ''} ${part.oemCode || ''} ${part.name || ''} ${part.manufacturerBrand || ''} ${part.categoryName || ''} ${part.technicalDescription || ''} ${compatStr}`
    );
    const compactHaystack = haystack.replace(/[-\s]/g, '');

    return tokens.every((token) => {
      if (haystack.includes(token)) return true;
      const compactToken = token.replace(/[-\s]/g, '');
      return compactToken.length > 0 && compactHaystack.includes(compactToken);
    });
  }

  selectBrandByName(brandName: string): void {
    const found = this.makes().find((m) => m.name.toLowerCase() === brandName.toLowerCase());
    if (found) {
      this.selectedMakeId = this.selectedMakeId === found.id ? null : found.id;
      this.onMakeChange();
    } else {
      this.searchQuery = this.searchQuery === brandName ? '' : brandName;
      this.applyFilters();
    }
  }

  isBrandActive(brandName: string): boolean {
    if (this.selectedMakeId) {
      const found = this.makes().find((m) => m.name.toLowerCase() === brandName.toLowerCase());
      if (found && this.selectedMakeId === found.id) return true;
    }
    return this.searchQuery.toLowerCase() === brandName.toLowerCase();
  }

  selectViscosity(v: string | null): void {
    this.selectedViscosity.set(this.selectedViscosity() === v ? null : v);
  }

  getPartViscosity(part: Part): string | null {
    const text = `${part.name} ${part.technicalDescription || ''}`;
    const match = text.match(
      /\b(0W-20|5W-20|5W-30|5W-40|10W-30|10W-40|15W-40|20W-50|75W-90|80W-90|85W-140|0W20|5W30|5W40|10W30|10W40|15W40|20W50)\b/i
    );
    if (!match) return null;
    const raw = match[1].toUpperCase();
    if (!raw.includes('-')) {
      return raw.replace(/(\d{1,2}W)(\d{2})/, '$1-$2');
    }
    return raw;
  }

  onBrandImageError(event: Event): void {
    const img = event.target as HTMLElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  onMakeChange(): void {
    const makeId = this.selectedMakeIdSig();
    const currentModelId = this.selectedModelIdSig();
    if (makeId && currentModelId) {
      const currentModel = this.allModels().find((m) => m.id === currentModelId);
      if (currentModel && currentModel.makeId !== makeId) {
        this.selectedModelId = null;
      }
    } else if (!makeId) {
      this.selectedModelId = null;
    }
    this.applyFilters();
  }

  onModelChange(): void {
    const modelId = this.selectedModelIdSig();
    if (modelId && !this.selectedMakeIdSig()) {
      const foundModel = this.allModels().find((m) => m.id === modelId);
      if (foundModel?.makeId) {
        this.selectedMakeId = foundModel.makeId;
      }
    }
    this.applyFilters();
  }

  onSearchInputChange(): void {
    this.applyFilters();
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  shouldShowViscosityFilter(): boolean {
    const catId = this.selectedCategoryIdSig();
    if (catId !== null) {
      const cat = this.categories().find((c) => c.id === catId);
      if (cat) {
        const catText = `${cat.name} ${cat.code || ''}`.toLowerCase();
        return (
          catText.includes('aceite') ||
          catText.includes('lubric') ||
          catText.includes('filtro') ||
          catText.includes('filter')
        );
      }
      return false;
    }

    const q = this.searchQuerySig().toLowerCase();
    return (
      q.includes('aceite') ||
      q.includes('lubric') ||
      q.includes('filtro') ||
      q.includes('filter') ||
      /\b\d{1,2}w-?\d{2}\b/i.test(q)
    );
  }

  onCategoryFilterChange(): void {
    if (!this.shouldShowViscosityFilter()) {
      this.selectedViscosity.set(null);
    }
    this.applyFilters();
  }

  selectCategoryPill(categoryId: number | null): void {
    this.selectedCategoryId = categoryId;
    if (!this.shouldShowViscosityFilter()) {
      this.selectedViscosity.set(null);
    }
    this.applyFilters();
  }

  hasActiveFilters(): boolean {
    return Boolean(
      this.searchQuerySig().trim() ||
        this.selectedCategoryIdSig() ||
        this.selectedMakeIdSig() ||
        this.selectedModelIdSig() ||
        this.selectedYearSig() ||
        this.onlyInStockSig() ||
        this.selectedViscosity()
    );
  }

  resetAllFilters(): void {
    this.searchQuery = '';
    this.selectedCategoryId = null;
    this.selectedMakeId = null;
    this.selectedModelId = null;
    this.selectedYear = null;
    this.onlyInStock = false;
    this.selectedViscosity.set(null);
  }

  applyFilters(): void {
    if (!this.shouldShowViscosityFilter()) {
      this.selectedViscosity.set(null);
    }
    // If initial bundle failed while backend was waking up, retry seamlessly without blocking UI
    if (this.allParts().length === 0 && !this.isLoading()) {
      this.loadCatalogBundle();
    }
  }

  resolveImage(part: Part): string {
    return this.apiConfig.resolvePartPrimaryImage(part);
  }

  onPartImageError(event: Event, part: Part): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const fallback = this.apiConfig.getCategoryFallback(part.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }

  formatFirstCompatibility(part: Part): string {
    const makeId = this.selectedMakeIdSig();
    const modelId = this.selectedModelIdSig();
    const year = this.selectedYearSig();
    const comps: PartCompatibility[] = part.compatibilities || [];

    if (comps.length > 0) {
      const exactMatch =
        comps.find(
          (c) =>
            (makeId === null || c.makeId === makeId) &&
            (modelId === null || c.modelId === modelId) &&
            (year === null || (c.yearStart <= year && c.yearEnd >= year))
        ) ||
        comps.find((c) => modelId !== null && c.modelId === modelId) ||
        comps.find((c) => makeId !== null && c.makeId === makeId) ||
        comps[0];

      const vehicle = [exactMatch.makeName, exactMatch.modelName].filter(Boolean).join(' ');
      return `${vehicle} (${exactMatch.yearStart}-${exactMatch.yearEnd})`;
    }

    const activeVehicle = [this.activeMakeName(), this.activeModelName()].filter(Boolean).join(' ');
    if (activeVehicle) {
      return `Compatible con ${activeVehicle} · Multimarca`;
    }
    return 'Aplicación Universal Multimarca';
  }

  goToPart(id: number): void {
    this.showSuggestions.set(false);
    void this.router.navigate(['/part', id]);
  }

  private normalizeCategoryText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  private readonly categoryCodeMap: Record<string, string[]> = {
    FRENOS: ['freno', 'frenos', 'pastilla', 'disco', 'zapata', 'catfrenos'],
    FILTROS: ['filtro', 'filtros', 'lubric', 'aceite', 'catfiltros'],
    SUSPENSION: ['susp', 'suspens', 'direccion', 'amortiguador', 'catsusp'],
    MOTOR: ['motor', 'distribuc', 'faja', 'cadena', 'catmotor'],
    TRANSMISION: ['transm', 'embrague', 'clutch', 'caja', 'cattransm'],
    ELECTRICO: ['elec', 'electr', 'iluminac', 'encendido', 'bujia', 'catelec'],
    REFRIGERACION: ['refrig', 'climatiz', 'radiador', 'bombaagua', 'termostato', 'catrefrig'],
    CARROCERIA: ['carroc', 'faro', 'retrovisor', 'parachoque', 'plumilla', 'catcarroc'],
  };

  selectCategoryByCode(code: string): void {
    const key = code.toUpperCase();
    const tokens = this.categoryCodeMap[key] || [this.normalizeCategoryText(code)];

    const matching = this.categories().find((c) => {
      const norm = this.normalizeCategoryText(`${c.code} ${c.name}`);
      return tokens.some((t) => norm.includes(t));
    });

    if (matching) {
      this.selectCategoryPill(this.selectedCategoryId === matching.id ? null : matching.id);
    } else {
      this.searchQuery = code;
      this.applyFilters();
    }
  }

  isCategoryActive(code: string): boolean {
    const activeCatId = this.selectedCategoryIdSig();
    if (activeCatId === null) return false;
    const activeCat = this.categories().find((c) => c.id === activeCatId);
    if (!activeCat) return false;

    const key = code.toUpperCase();
    const tokens = this.categoryCodeMap[key] || [this.normalizeCategoryText(code)];
    const activeNorm = this.normalizeCategoryText(`${activeCat.code} ${activeCat.name}`);

    return tokens.some((t) => activeNorm.includes(t));
  }

  hideSuggestionsDelayed(): void {
    setTimeout(() => this.showSuggestions.set(false), 180);
  }
}
