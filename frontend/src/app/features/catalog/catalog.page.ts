import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { Category, Part, VehicleMake, VehicleModel } from '../../core/models/api.models';
import { ApiConfigService } from '../../core/services/api-config.service';
import { CartService } from '../../core/services/cart.service';
import { CatalogService } from '../../core/services/catalog.service';
import { PromotionService } from '../../core/services/promotion.service';

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
          <div class="absolute inset-0 bg-gradient-to-r from-gray-950/95 via-gray-950/85 to-gray-900/65"></div>
        </div>

        <div class="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 sm:py-11 space-y-6">
          <div class="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div class="space-y-3 max-w-2xl">
              <div class="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/20 px-3.5 py-1 text-xs font-bold text-orange-300 backdrop-blur-md">
                <span class="h-2 w-2 rounded-full bg-orange-400 animate-pulse"></span>
                <span>Repuestos Originales y Alternativos Garantizados · Asunción S.A.C.</span>
              </div>
              <h1 class="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
                Encuentra el repuesto exacto para tu vehículo
              </h1>
              <p class="text-sm sm:text-base text-gray-300 leading-relaxed max-w-xl">
                Filtra por marca, modelo y año con compatibilidad verificada OEM, precios mayoristas automáticos desde 4 unidades y despacho express en Lima.
              </p>
            </div>

            <!-- Predictive Search Box -->
            <div class="relative w-full lg:w-96">
              <label class="block text-[11px] font-bold uppercase tracking-wider text-orange-300 mb-1.5">
                Búsqueda rápida por Código OEM, SKU o Pieza
              </label>
              <div class="relative">
                <input
                  type="text"
                  [(ngModel)]="searchQuery"
                  (ngModelChange)="onSearchInputChange()"
                  (focus)="showSuggestions.set(true)"
                  (blur)="hideSuggestionsDelayed()"
                  placeholder="Ej: Pastilla de freno, 04465, 15W-40..."
                  class="w-full min-h-[48px] rounded-xl border border-gray-300 bg-white/95 backdrop-blur-md pl-10 pr-9 py-2.5 text-base sm:text-sm font-medium text-gray-900 placeholder-gray-500 shadow-xl focus:border-orange-600 focus:ring-2 focus:ring-orange-500/30 focus:outline-none"
                />
                <svg class="absolute left-3.5 top-3.5 h-4 w-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                </svg>
                @if (searchQuery) {
                  <button
                    type="button"
                    (click)="clearSearch()"
                    class="absolute right-2.5 top-2.5 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Limpiar búsqueda"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                }
              </div>

              <!-- Predictive Suggestions Popover -->
              @if (showSuggestions() && searchQuery.trim().length >= 2 && predictiveResults().length > 0) {
                <div class="absolute left-0 right-0 mt-1.5 z-30 rounded-xl border border-gray-200 bg-white shadow-2xl overflow-hidden divide-y divide-gray-100">
                  @for (item of predictiveResults(); track item.id) {
                    <button
                      type="button"
                      (mousedown)="goToPart(item.id)"
                      class="w-full px-3.5 py-2.5 text-left hover:bg-orange-50/60 flex items-center justify-between gap-3 transition cursor-pointer"
                    >
                      <div class="min-w-0">
                        <p class="truncate text-xs font-bold text-gray-900">{{ item.name }}</p>
                        <p class="font-mono text-[11px] text-gray-500">
                          @if (item.oemCode) {
                            OEM {{ item.oemCode }} ·
                          }
                          {{ item.sku }}
                        </p>
                      </div>
                      <span class="shrink-0 font-mono text-xs font-extrabold text-orange-600">
                        S/ {{ item.salePrice | number: '1.2-2' }}
                      </span>
                    </button>
                  }
                </div>
              }
            </div>
          </div>

          <!-- Horizontal Vehicle Selector Card -->
          <div class="rounded-2xl border border-white/20 bg-white/95 backdrop-blur-md p-4 sm:p-5 shadow-2xl text-gray-900">
            <div class="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-gray-200/80">
              <div class="flex items-center gap-2">
                <span class="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-600 text-white text-xs font-extrabold">
                  ✓
                </span>
                <span class="text-xs sm:text-sm font-extrabold text-gray-900">
                  Selector de Compatibilidad Vehicular
                </span>
              </div>
              <span class="text-[11px] text-gray-500 font-medium">
                Filtra repuestos exactos para camiones, pickups y autos livianos
              </span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 items-end">
              <!-- 1. Marca -->
              <div class="lg:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  1. Marca
                </label>
                <select
                  [(ngModel)]="selectedMakeId"
                  (ngModelChange)="onMakeChange()"
                  class="w-full min-h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-base sm:text-xs font-semibold text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                >
                  <option [ngValue]="null">Todas las marcas</option>
                  @for (make of makes(); track make.id) {
                    <option [ngValue]="make.id">{{ make.name }}</option>
                  }
                </select>
              </div>

              <!-- 2. Modelo -->
              <div class="lg:col-span-3">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  2. Modelo
                </label>
                <select
                  [(ngModel)]="selectedModelId"
                  (ngModelChange)="applyFilters()"
                  [disabled]="!selectedMakeId && models().length === 0"
                  class="w-full min-h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-base sm:text-xs font-semibold text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option [ngValue]="null">Todos los modelos</option>
                  @for (model of models(); track model.id) {
                    <option [ngValue]="model.id">
                      {{ model.name }}{{ model.vehicleType ? ' (' + model.vehicleType + ')' : '' }}
                    </option>
                  }
                </select>
              </div>

              <!-- 3. Año -->
              <div class="lg:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  3. Año
                </label>
                <select
                  [(ngModel)]="selectedYear"
                  (ngModelChange)="applyFilters()"
                  class="w-full min-h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-base sm:text-xs font-semibold text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                >
                  <option [ngValue]="null">Cualquier año</option>
                  @for (yr of years; track yr) {
                    <option [ngValue]="yr">{{ yr }}</option>
                  }
                </select>
              </div>

              <!-- 4. Categoría -->
              <div class="lg:col-span-2">
                <label class="block text-[11px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                  4. Sistema
                </label>
                <select
                  [(ngModel)]="selectedCategoryId"
                  (ngModelChange)="onCategoryFilterChange()"
                  class="w-full min-h-[42px] rounded-xl border border-gray-300 bg-white px-3 py-2 text-base sm:text-xs font-semibold text-gray-900 focus:border-orange-600 focus:ring-2 focus:ring-orange-500/20 focus:outline-none"
                >
                  <option [ngValue]="null">Todos los sistemas</option>
                  @for (cat of categories(); track cat.id) {
                    <option [ngValue]="cat.id">{{ cat.name }}</option>
                  }
                </select>
              </div>

              <!-- Stock & Action Buttons -->
              <div class="sm:col-span-2 lg:col-span-3 flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                <label class="inline-flex min-h-[42px] items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 cursor-pointer select-none text-xs font-bold text-gray-700 hover:bg-gray-100 transition">
                  <input
                    type="checkbox"
                    [(ngModel)]="onlyInStock"
                    (ngModelChange)="applyFilters()"
                    class="h-4 w-4 rounded border-gray-300 accent-orange-600"
                  />
                  <span>En stock</span>
                </label>

                <button
                  type="button"
                  (click)="applyFilters()"
                  class="flex-1 min-h-[42px] rounded-xl bg-orange-600 py-2 px-4 text-xs font-bold text-white shadow-sm hover:bg-orange-700 active:scale-[0.98] transition-all duration-150 ease-out select-none cursor-pointer"
                >
                  Filtrar repuestos
                </button>

                @if (hasActiveFilters()) {
                  <button
                    type="button"
                    (click)="resetAllFilters()"
                    class="min-h-[42px] rounded-xl border border-gray-300 bg-white py-2 px-3 text-xs font-bold text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                    title="Limpiar filtros"
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
        <div class="flex items-center justify-between gap-4 mb-3">
          <div>
            <h2 class="text-base sm:text-lg font-extrabold tracking-tight text-gray-950 flex items-center gap-2">
              <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
              <span>Marcas Principales de Camiones y Vehículos</span>
            </h2>
            <p class="text-xs text-gray-500">
              Filtra repuestos específicos para tu marca con un solo clic.
            </p>
          </div>
          @if (selectedMakeId !== null || searchQuery) {
            <button
              type="button"
              (click)="selectedMakeId = null; searchQuery = ''; onMakeChange()"
              class="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Quitar filtro de marca</span>
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
                  ? 'border-orange-500 bg-orange-50/70 ring-2 ring-orange-500/30 shadow-xs'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:shadow-xs'
              "
              class="group flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-150 cursor-pointer"
            >
              <div class="h-10 w-full flex items-center justify-center mb-1.5 overflow-hidden">
                <img
                  [src]="brand.logo"
                  [alt]="brand.name"
                  (error)="onBrandImageError($event, brand.name)"
                  class="max-h-9 max-w-[80px] object-contain transition duration-200 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              <span class="text-xs font-bold text-gray-900 group-hover:text-orange-600 transition">
                {{ brand.name }}
              </span>
              <span class="text-[10px] text-gray-400 line-clamp-1">
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
            <h2 class="text-base sm:text-lg font-extrabold tracking-tight text-gray-950">
              Explorar por Sistema del Vehículo
            </h2>
            <p class="text-xs text-gray-500">
              Componentes reales de cada sistema automotriz. Haz clic en cualquiera para filtrar el inventario al instante.
            </p>
          </div>
          @if (selectedCategoryId !== null) {
            <button
              type="button"
              (click)="selectCategoryPill(null)"
              class="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Ver todas las categorías</span>
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
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
              <!-- Real Category Photo -->
              <div class="aspect-16/10 sm:aspect-16/9 overflow-hidden">
                <img
                  [src]="cat.image"
                  [alt]="cat.name"
                  class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108 filter brightness-85 group-hover:brightness-95"
                />
              </div>

              <!-- Gradient Overlay & Labels -->
              <div class="absolute inset-0 bg-gradient-to-t from-gray-950/95 via-gray-950/40 to-transparent flex flex-col justify-end p-3 sm:p-4 text-white">
                <div class="flex items-center justify-between gap-2">
                  <div class="flex items-center gap-1.5 min-w-0">
                    @if (cat.icon) {
                      <img [src]="cat.icon" [alt]="cat.name" class="h-5 w-5 object-contain rounded bg-white/20 p-0.5 shrink-0" />
                    }
                    <h3 class="text-xs sm:text-sm font-bold text-white group-hover:text-orange-400 transition tracking-tight truncate">
                      {{ cat.name }}
                    </h3>
                  </div>
                  @if (isCategoryActive(cat.code)) {
                    <span class="h-2 w-2 rounded-full bg-orange-400 ring-4 ring-orange-400/30 shrink-0"></span>
                  }
                </div>
                <p class="text-[11px] text-gray-300 line-clamp-1 mt-0.5 hidden sm:block">
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
                  ? 'bg-orange-50 text-orange-700 border-orange-300 font-bold shadow-2xs'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-gray-900 font-medium'
              "
              class="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition cursor-pointer select-none"
            >
              @if (selectedCategoryId === null) {
                <span class="h-2 w-2 rounded-full bg-orange-500 ring-4 ring-orange-500/25 shrink-0 animate-pulse"></span>
              }
              <span>Todas las categorías</span>
            </button>
            @for (cat of categories(); track cat.id) {
              <button
                type="button"
                (click)="selectCategoryPill(cat.id)"
                [class]="
                  selectedCategoryId === cat.id
                    ? 'bg-orange-50 text-orange-700 border-orange-300 font-bold shadow-2xs'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-orange-300 hover:text-gray-900 font-medium'
                "
                class="shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs transition cursor-pointer select-none"
              >
                @if (selectedCategoryId === cat.id) {
                  <span class="h-2 w-2 rounded-full bg-orange-500 ring-4 ring-orange-500/25 shrink-0 animate-pulse"></span>
                }
                <span>{{ cat.name }}</span>
              </button>
            }
          </div>
        }

        <!-- SAE Viscosity Filter Bar (Aceites, Lubricantes y Filtros) -->
        @if (shouldShowViscosityFilter()) {
          <div class="flex flex-wrap items-center gap-1.5 p-3 rounded-xl border border-amber-200/90 bg-amber-50/50 shadow-2xs">
            <div class="flex items-center gap-1.5 mr-1 text-xs font-bold text-amber-950 shrink-0">
              <span>🛢️</span>
              <span>Viscosidad SAE / Lubricantes y Filtros:</span>
            </div>
            <button
              type="button"
              (click)="selectViscosity(null)"
              [class]="
                selectedViscosity() === null
                  ? 'bg-amber-600 text-white font-bold shadow-2xs'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300 font-medium'
              "
              class="rounded-lg border px-2.5 py-1 text-xs transition cursor-pointer"
            >
              Todos
            </button>
            @for (v of commonViscosities; track v) {
              <button
                type="button"
                (click)="selectViscosity(v)"
                [class]="
                  selectedViscosity() === v
                    ? 'bg-amber-600 text-white font-bold shadow-2xs'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-amber-400 hover:bg-amber-100/50 font-medium'
                "
                class="rounded-lg border px-2.5 py-1 text-xs transition cursor-pointer"
              >
                {{ v }}
              </button>
            }
          </div>
        }

        <!-- Results Summary & Sort Toolbar -->
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200/80 bg-white px-4 py-3 shadow-2xs">
          <div class="text-xs text-gray-600 flex flex-wrap items-center gap-2">
            <span>
              Mostrando <strong class="font-mono font-extrabold text-gray-900">{{ displayedParts().length }}</strong> repuestos disponibles
            </span>
            @if (selectedViscosity()) {
              <span class="rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 font-bold text-amber-900">
                SAE {{ selectedViscosity() }}
              </span>
            }
            @if (selectedYear) {
              <span class="rounded-md bg-orange-50 border border-orange-200 px-2 py-0.5 font-bold text-orange-800">
                Año {{ selectedYear }}
              </span>
            }
          </div>

          <div class="flex items-center gap-3">
            @if (backendOffline()) {
              <div class="inline-flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-800">
                <svg class="h-4 w-4 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
                <span>Conectando con el servidor de catálogo...</span>
              </div>
            }

            <div class="flex items-center gap-2 text-xs">
              <label class="text-gray-500 font-semibold hidden sm:inline">Ordenar por:</label>
              <select
                [ngModel]="sortBy()"
                (ngModelChange)="sortBy.set($event)"
                class="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-bold text-gray-800 focus:border-orange-500 focus:outline-none"
              >
                <option value="RELEVANCE">Relevancia</option>
                <option value="PRICE_ASC">Precio: Menor a Mayor</option>
                <option value="PRICE_DESC">Precio: Mayor a Menor</option>
                <option value="STOCK_DESC">Mayor Stock Disponible</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Loading Skeleton -->
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
          <div class="rounded-2xl border border-gray-200 bg-white p-12 text-center space-y-3 shadow-xs">
            <div class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-400">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <h3 class="text-base font-extrabold text-gray-900">
              No encontramos repuestos con esos filtros
            </h3>
            <p class="text-xs text-gray-500 max-w-md mx-auto leading-relaxed">
              Prueba quitando algún filtro del vehículo o escríbenos en el asistente técnico para ayudarte a ubicar la pieza por código OEM.
            </p>
            <button
              type="button"
              (click)="resetAllFilters()"
              class="rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-700 transition cursor-pointer"
            >
              Ver todo el catálogo
            </button>
          </div>
        } @else {
          <!-- Spare Parts Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            @for (part of displayedParts(); track part.id) {
              <article class="group flex flex-col overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-xs hover:border-orange-300 hover:shadow-md transition-all duration-200">
                <!-- Product Image Container -->
                <a [routerLink]="['/part', part.id]" class="relative aspect-4/3 overflow-hidden bg-gray-50 border-b border-gray-100 block">
                  <img
                    [src]="resolveImage(part)"
                    [alt]="part.name"
                    (error)="onPartImageError($event, part)"
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />

                  <!-- Manufacturer Brand Pill -->
                  @if (part.manufacturerBrand) {
                    <span class="absolute top-2.5 left-2.5 rounded-lg border border-gray-200/80 bg-white/95 px-2.5 py-0.5 text-[11px] font-extrabold text-gray-800 shadow-2xs">
                      {{ part.manufacturerBrand }}
                    </span>
                  }

                  <!-- Promo Badge -->
                  @if (promotionService.getPromotion(part.sku); as promo) {
                    <span class="absolute bottom-2.5 left-2.5 rounded-full border border-red-500 bg-red-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white shadow-md animate-pulse z-10">
                      🏷️ {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                    </span>
                  }

                  <!-- Calm Light-Mode Stock Badge -->
                  <span
                    [class]="
                      part.stockQuantity <= 0
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : part.lowStockAlert
                          ? 'bg-orange-50 text-orange-700 border-orange-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    "
                    class="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-2xs"
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      [class]="part.stockQuantity <= 0 ? 'bg-red-500' : part.lowStockAlert ? 'bg-orange-500' : 'bg-emerald-500'"
                    ></span>
                    @if (part.stockQuantity <= 0) {
                      Agotado
                    } @else if (part.lowStockAlert) {
                      Últimas {{ part.stockQuantity }} und.
                    } @else {
                      Stock: {{ part.stockQuantity }}
                    }
                  </span>
                </a>

                <!-- Card Body -->
                <div class="flex flex-1 flex-col p-4 space-y-2.5">
                  <div class="flex items-center justify-between gap-2">
                    @if (part.categoryName) {
                      <span class="text-[11px] font-bold uppercase tracking-wider text-orange-600 truncate">
                        {{ part.categoryName }}
                      </span>
                    }
                    @if (getPartViscosity(part); as visc) {
                      <span class="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-900 shrink-0">
                        🛢️ SAE {{ visc }}
                      </span>
                    }
                  </div>

                  <a
                    [routerLink]="['/part', part.id]"
                    [title]="part.name"
                    class="text-sm font-extrabold text-gray-900 line-clamp-2 leading-snug group-hover:text-orange-600 transition min-h-[2.5rem]"
                  >
                    {{ part.name }}
                  </a>

                  <!-- Discreet OEM & SKU Codes -->
                  <div class="flex flex-wrap items-center gap-1.5">
                    @if (part.oemCode) {
                      <span class="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-700">
                        OEM {{ part.oemCode }}
                      </span>
                    }
                    @if (part.sku) {
                      <span class="font-mono text-[10px] text-gray-400">
                        {{ part.sku }}
                      </span>
                    }
                  </div>

                  <!-- Combo Badge Banner -->
                  @if (promotionService.getPromotion(part.sku); as promo) {
                    @if (promo.promoType === 'COMBO_SUGERIDO' && promo.comboComplementName) {
                      <div class="rounded-lg bg-orange-50 border border-orange-200 px-2.5 py-1.5 text-[11px] text-orange-950 flex items-center justify-between gap-1">
                        <span class="font-bold">📦 Combo: + {{ promo.comboComplementName }}</span>
                        <span class="text-orange-700 font-extrabold text-[10px]">Ahorro S/ {{ ((promo.originalPrice + (promo.comboComplementPrice || 0)) - (promo.comboTotalPromoPrice || (promo.promoPrice + (promo.comboComplementPrice || 0) * 0.85))) | number: '1.2-2' }}</span>
                      </div>
                    }
                  }

                  <!-- Vehicle Compatibility Preview -->
                  @if (part.compatibilities && part.compatibilities.length > 0) {
                    <div class="rounded-lg bg-gray-50 border border-gray-200/70 px-2.5 py-1.5 text-[11px] text-gray-600 truncate">
                      <span class="font-semibold text-gray-700">Aplica:</span>
                      {{ formatFirstCompatibility(part) }}
                      @if (part.compatibilities.length > 1) {
                        <span class="font-bold text-orange-600">
                          +{{ part.compatibilities.length - 1 }}
                        </span>
                      }
                    </div>
                  }

                  <!-- Pricing & CTA Footer -->
                  <div class="mt-auto pt-3 border-t border-gray-100 space-y-3">
                    <div class="flex items-stretch justify-between gap-2">
                      <div>
                        @if (promotionService.getPromotion(part.sku); as promo) {
                          <span class="block text-[10px] font-bold text-red-600 uppercase tracking-wide">
                            {{ promo.badgeLabel || 'OFERTA' }} -{{ promo.discountPercentage }}%
                          </span>
                          <div class="flex items-baseline gap-1.5">
                            <span class="font-mono text-lg font-black tracking-tight text-red-600">
                              S/ {{ promo.promoPrice | number: '1.2-2' }}
                            </span>
                            <span class="font-mono text-xs text-gray-400 line-through">
                              S/ {{ part.salePrice | number: '1.2-2' }}
                            </span>
                          </div>
                        } @else {
                          <span class="block text-[10px] font-bold uppercase tracking-wider text-gray-400">Unitario</span>
                          <span class="font-mono text-lg font-extrabold tracking-tight text-gray-900">
                            S/ {{ part.salePrice | number: '1.2-2' }}
                          </span>
                        }
                      </div>
                      @if (part.wholesalePrice) {
                        <div class="rounded-lg border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 text-right flex flex-col justify-center">
                          <span class="block text-[10px] font-bold text-emerald-800">Mayorista (4+)</span>
                          <span class="font-mono text-xs font-extrabold text-emerald-700">
                            S/ {{ part.wholesalePrice | number: '1.2-2' }}
                          </span>
                        </div>
                      }
                    </div>

                    <div class="grid grid-cols-5 gap-2">
                      <a
                        [routerLink]="['/part', part.id]"
                        class="col-span-2 min-h-[40px] flex items-center justify-center rounded-xl border border-gray-200 bg-white px-2 text-xs font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 ease-out select-none"
                      >
                        Ver ficha
                      </a>
                      <button
                        type="button"
                        [disabled]="part.stockQuantity <= 0"
                        (click)="cart.addPart(part, 1, true)"
                        class="col-span-3 min-h-[40px] flex items-center justify-center gap-1.5 rounded-xl bg-orange-600 px-3 text-xs font-bold text-white shadow-2xs hover:bg-orange-700 active:scale-[0.98] disabled:bg-gray-200 disabled:text-gray-400 transition-all duration-150 ease-out select-none cursor-pointer"
                      >
                        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        <span>Agregar</span>
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
          <!-- Card 1: Motorized Express Delivery with Real GPS -->
          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-delivery.jpg"
                alt="Despacho express motorizado con rastreo en vivo"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span>Despacho Express en Lima</span>
              </div>
              <h3 class="text-sm font-bold text-gray-900">Envíos Motorizados y Constancia Digital</h3>
              <p class="text-xs text-gray-600 leading-relaxed">
                Seguimiento de tu pedido en ruta y constancia fotográfica de entrega en tu taller o domicilio.
              </p>
            </div>
          </div>

          <!-- Card 2: Centralized Warehouse & Immediate Stock -->
          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-warehouse.jpg"
                alt="Almacén de repuestos automotrices Asunción"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
                <span>Stock Físico Inmediato</span>
              </div>
              <h3 class="text-sm font-bold text-gray-900">Almacén Central en Santa Anita</h3>
              <p class="text-xs text-gray-600 leading-relaxed">
                Inventario sincronizado para compras al por menor y mayor (4+ unidades con descuento por volumen automático).
              </p>
            </div>
          </div>

          <!-- Card 3: Technical Specialist & Factory Warranty -->
          <div class="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs hover:shadow-md transition">
            <div class="h-40 overflow-hidden">
              <img
                src="/images/banners/banner-expert.jpg"
                alt="Asesoría técnica automotriz garantizada"
                class="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            </div>
            <div class="p-4 sm:p-5 space-y-1.5">
              <div class="flex items-center gap-1.5 text-xs font-bold text-orange-600">
                <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Garantía de Fábrica</span>
              </div>
              <h3 class="text-sm font-bold text-gray-900">Asesoría Técnica y Calidad Comprobada</h3>
              <p class="text-xs text-gray-600 leading-relaxed">
                Verificación de compatibilidad con número VIN o código OEM por especialistas mecánicos certificados.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class CatalogPageComponent implements OnInit {
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly router = inject(Router);
  readonly cart = inject(CartService);
  readonly promotionService = inject(PromotionService);

  readonly categories = signal<Category[]>([]);
  readonly makes = signal<VehicleMake[]>([]);
  readonly models = signal<VehicleModel[]>([]);
  readonly parts = signal<Part[]>([]);
  readonly isLoading = signal<boolean>(true);
  readonly backendOffline = signal<boolean>(false);
  readonly showSuggestions = signal<boolean>(false);
  readonly sortBy = signal<'RELEVANCE' | 'PRICE_ASC' | 'PRICE_DESC' | 'STOCK_DESC'>('RELEVANCE');

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

  selectBrandByName(brandName: string): void {
    const list = this.makes();
    const found = list.find((m) => m.name.toLowerCase() === brandName.toLowerCase());
    if (found) {
      if (this.selectedMakeId === found.id) {
        this.selectedMakeId = null;
      } else {
        this.selectedMakeId = found.id;
      }
      this.onMakeChange();
    } else {
      if (this.searchQuery === brandName) {
        this.searchQuery = '';
      } else {
        this.searchQuery = brandName;
      }
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

  searchQuery = '';
  selectedCategoryId: number | null = null;
  selectedMakeId: number | null = null;
  selectedModelId: number | null = null;
  selectedYear: number | null = null;
  onlyInStock = false;

  readonly commonViscosities = ['0W-20', '5W-30', '5W-40', '10W-30', '10W-40', '15W-40', '20W-50', '75W-90', '80W-90'];
  readonly selectedViscosity = signal<string | null>(null);

  readonly displayedParts = computed(() => {
    let list = [...this.parts()];
    const v = this.selectedViscosity();
    if (v) {
      const target = v.replace('-', '').toUpperCase();
      list = list.filter((p) => {
        const text = `${p.name} ${p.technicalDescription || ''}`.replace('-', '').toUpperCase();
        return text.includes(target);
      });
    }

    const sort = this.sortBy();
    if (sort === 'PRICE_ASC') {
      list.sort((a, b) => a.salePrice - b.salePrice);
    } else if (sort === 'PRICE_DESC') {
      list.sort((a, b) => b.salePrice - a.salePrice);
    } else if (sort === 'STOCK_DESC') {
      list.sort((a, b) => b.stockQuantity - a.stockQuantity);
    }
    return list;
  });

  readonly years: number[] = Array.from({ length: 33 }, (_, i) => 2026 - i);
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  readonly predictiveResults = computed(() => this.parts().slice(0, 6));

  ngOnInit(): void {
    this.loadMetadata();
    this.applyFilters();
  }

  selectViscosity(v: string | null): void {
    if (this.selectedViscosity() === v) {
      this.selectedViscosity.set(null);
    } else {
      this.selectedViscosity.set(v);
    }
  }

  getPartViscosity(part: Part): string | null {
    const text = `${part.name} ${part.technicalDescription || ''}`;
    const match = text.match(/\b(0W-20|5W-20|5W-30|5W-40|10W-30|10W-40|15W-40|20W-50|75W-90|80W-90|85W-140|0W20|5W30|5W40|10W30|10W40|15W40|20W50)\b/i);
    if (!match) return null;
    const raw = match[1].toUpperCase();
    if (!raw.includes('-')) {
      return raw.replace(/(\d{1,2}W)(\d{2})/, '$1-$2');
    }
    return raw;
  }

  onBrandImageError(event: Event, brandName: string): void {
    const img = event.target as HTMLElement;
    if (img) {
      img.style.display = 'none';
    }
  }

  private loadMetadata(): void {
    this.catalogService.getCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
    this.catalogService.getVehicleMakes().subscribe({
      next: (makes) => this.makes.set(makes),
      error: () => {},
    });
  }

  onMakeChange(): void {
    this.selectedModelId = null;
    if (this.selectedMakeId) {
      this.catalogService.getVehicleModels(this.selectedMakeId).subscribe({
        next: (m) => this.models.set(m),
        error: () => this.models.set([]),
      });
    } else {
      this.models.set([]);
    }
    this.applyFilters();
  }

  onSearchInputChange(): void {
    if (this.searchDebounce) {
      clearTimeout(this.searchDebounce);
    }
    this.searchDebounce = setTimeout(() => {
      this.applyFilters();
    }, 250);
  }

  clearSearch(): void {
    this.searchQuery = '';
    this.applyFilters();
  }

  shouldShowViscosityFilter(): boolean {
    if (this.selectedCategoryId !== null) {
      const cat = this.categories().find((c) => c.id === this.selectedCategoryId);
      if (cat) {
        const catText = `${cat.name} ${cat.code || ''}`.toLowerCase();
        return (
          catText.includes('aceite') ||
          catText.includes('lubricante') ||
          catText.includes('filtro') ||
          catText.includes('filter')
        );
      }
      return false;
    }

    const q = (this.searchQuery || '').toLowerCase();
    return (
      q.includes('aceite') ||
      q.includes('lubricante') ||
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
      this.searchQuery.trim() ||
        this.selectedCategoryId ||
        this.selectedMakeId ||
        this.selectedModelId ||
        this.selectedYear ||
        this.onlyInStock ||
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
    this.models.set([]);
    this.applyFilters();
  }

  applyFilters(): void {
    if (!this.shouldShowViscosityFilter()) {
      this.selectedViscosity.set(null);
    }
    this.isLoading.set(true);
    this.catalogService
      .searchParts({
        q: this.searchQuery,
        categoryId: this.selectedCategoryId,
        makeId: this.selectedMakeId,
        modelId: this.selectedModelId,
        year: this.selectedYear,
        onlyInStock: this.onlyInStock,
      })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (data) => {
          this.backendOffline.set(false);
          this.parts.set(data);
        },
        error: (err) => {
          if (err?.status === 0) {
            this.backendOffline.set(true);
          }
          this.parts.set([]);
        },
      });
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
    const first = part.compatibilities?.[0];
    if (!first) return '';
    const vehicle = [first.makeName, first.modelName].filter(Boolean).join(' ');
    return `${vehicle} (${first.yearStart}-${first.yearEnd})`;
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
      if (this.selectedCategoryId === matching.id) {
        this.selectCategoryPill(null);
      } else {
        this.selectCategoryPill(matching.id);
      }
    } else {
      this.searchQuery = code;
      this.applyFilters();
    }
  }

  isCategoryActive(code: string): boolean {
    if (this.selectedCategoryId === null) return false;
    const activeCat = this.categories().find((c) => c.id === this.selectedCategoryId);
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
