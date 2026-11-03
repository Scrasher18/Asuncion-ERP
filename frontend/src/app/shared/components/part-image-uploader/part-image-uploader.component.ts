import { CommonModule } from '@angular/common';
import {
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnDestroy,
  Output,
  signal,
} from '@angular/core';
import { finalize } from 'rxjs';
import { Part, PartImage } from '../../../core/models/api.models';
import { ApiConfigService } from '../../../core/services/api-config.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { ToastService } from '../../../core/services/toast.service';

export interface StagedImageItem {
  uid: string;
  file: File;
  previewUrl: string;
  originalSizeKb: number;
  estimatedWebpKb: number;
  isPrimary: boolean;
}

export interface StagedUploadBundle {
  files: File[];
  primaryIndex: number | null;
}

@Component({
  selector: 'app-part-image-uploader',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 class="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <svg class="w-4 h-4 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
            </svg>
            Fotografías del repuesto
          </h4>
          <p class="text-xs text-gray-500">
            Arrastra una o varias fotos del producto y elige cuál se mostrará como portada en el catálogo.
          </p>
        </div>

        <span class="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700">
          <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
          Optimización automática
        </span>
      </div>

      <!-- Drag and Drop Zone -->
      <div
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDropFiles($event)"
        (click)="fileInput.click()"
        [class]="
          isDraggingOver()
            ? 'border-orange-500 bg-orange-50/60 ring-2 ring-orange-500/20'
            : 'border-gray-300 bg-gray-50/60 hover:border-orange-500 hover:bg-orange-50/25'
        "
        class="relative cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all duration-150"
      >
        <input
          #fileInput
          type="file"
          multiple
          accept="image/png,image/jpeg,image/jpg,image/webp"
          (change)="onFileInputChange($event)"
          class="hidden"
        />

        <div class="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-orange-200 bg-orange-50 text-orange-600">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>

        <p class="mt-3 text-sm font-medium text-gray-900">
          Arrastra tus fotos aquí o <span class="font-semibold text-orange-600 underline">selecciona archivos</span>
        </p>
        <p class="mt-1 text-xs text-gray-500">
          Formatos admitidos: JPG y PNG · Compresión ligera automática para carga rápida
        </p>
      </div>

      <!-- Existing Persisted Images on Server -->
      @if (existingImages().length > 0) {
        <div class="space-y-2.5">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-gray-700">
              Fotos guardadas ({{ existingImages().length }})
            </span>
            <span class="text-[11px] text-gray-500">Selecciona cuál será la imagen principal</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            @for (img of existingImages(); track img.id) {
              <div
                [class]="
                  isPrimaryPersisted(img)
                    ? 'ring-2 ring-orange-500 border-orange-300 bg-white'
                    : 'border-gray-200 bg-white'
                "
                class="group relative overflow-hidden rounded-xl border shadow-2xs transition hover:shadow-sm"
              >
                <div class="aspect-4/3 w-full overflow-hidden bg-gray-50">
                  <img
                    [src]="resolveUrl(img.imageUrl)"
                    alt="Imagen del repuesto"
                    (error)="onImageError($event)"
                    class="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>

                <!-- Top Badges -->
                <div class="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                  @if (isPrimaryPersisted(img)) {
                    <span class="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-0.5 text-[10px] font-semibold text-white shadow-xs">
                      <svg class="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                      Portada
                    </span>
                  } @else {
                    <button
                      type="button"
                      [disabled]="isUploading()"
                      (click)="makePersistedPrimary(img); $event.stopPropagation()"
                      class="rounded-md border border-gray-200 bg-white/95 px-2 py-0.5 text-[10px] font-medium text-gray-700 shadow-2xs hover:border-orange-300 hover:text-orange-700 transition"
                      title="Usar como imagen principal"
                    >
                      Usar de portada
                    </button>
                  }

                  <button
                    type="button"
                    [disabled]="isUploading()"
                    (click)="removePersistedImage(img); $event.stopPropagation()"
                    class="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 shadow-2xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                    title="Eliminar imagen"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- Footer Info -->
                <div class="flex items-center justify-between px-2.5 py-1.5 text-[11px] bg-white border-t border-gray-100">
                  <span class="font-medium text-emerald-700">Optimizada</span>
                  @if (img.fileSizeBytes) {
                    <span class="text-gray-500 font-mono text-[10px]">{{ (img.fileSizeBytes / 1024) | number: '1.0-0' }} KB</span>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Client-Side Staged Previews BEFORE Upload -->
      @if (stagedItems().length > 0) {
        <div class="rounded-xl border border-orange-200 bg-orange-50/35 p-4 space-y-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span class="text-xs font-semibold text-gray-900">
                Fotos seleccionadas ({{ stagedItems().length }})
              </span>
              <p class="text-[11px] text-gray-600">
                Arrastra las tarjetas para cambiar el orden o elige la foto de portada.
              </p>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="clearStaged()"
                [disabled]="isUploading()"
                class="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
              >
                Descartar
              </button>

              @if (part?.id) {
                <button
                  type="button"
                  (click)="uploadStagedNow()"
                  [disabled]="isUploading()"
                  class="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-orange-700 disabled:opacity-50 transition"
                >
                  @if (isUploading()) {
                    <span class="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                    Subiendo fotos...
                  } @else {
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                    Subir fotos ({{ stagedItems().length }})
                  }
                </button>
              }
            </div>
          </div>

          @if (isUploading()) {
            <div class="w-full overflow-hidden rounded-full bg-gray-200 h-1.5">
              <div
                class="bg-orange-600 h-1.5 transition-all duration-300"
                [style.width.%]="uploadProgress()"
              ></div>
            </div>
          }

          <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            @for (item of stagedItems(); track item.uid; let idx = $index) {
              <div
                draggable="true"
                (dragstart)="onCardDragStart(idx)"
                (dragover)="onCardDragOver($event)"
                (drop)="onCardDrop(idx, $event)"
                [class]="
                  item.isPrimary
                    ? 'ring-2 ring-orange-500 border-orange-300 bg-white'
                    : 'border-gray-200 bg-white'
                "
                class="relative cursor-move overflow-hidden rounded-xl border shadow-2xs transition hover:shadow-sm"
              >
                <div class="aspect-4/3 w-full overflow-hidden bg-gray-50">
                  <img
                    [src]="item.previewUrl"
                    [alt]="item.file.name"
                    class="h-full w-full object-cover"
                  />
                </div>

                <!-- Primary & Remove Controls -->
                <div class="absolute top-2 left-2 right-2 flex items-center justify-between gap-1">
                  <button
                    type="button"
                    (click)="markStagedPrimary(idx); $event.stopPropagation()"
                    [class]="
                      item.isPrimary
                        ? 'bg-orange-600 text-white border-orange-600 font-semibold'
                        : 'bg-white/95 text-gray-700 border-gray-200 hover:border-orange-300 hover:text-orange-700 font-medium'
                    "
                    class="rounded-md border px-2 py-0.5 text-[10px] shadow-2xs transition"
                  >
                    {{ item.isPrimary ? 'Portada' : 'Elegir portada' }}
                  </button>

                  <button
                    type="button"
                    (click)="removeStaged(idx); $event.stopPropagation()"
                    class="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white/95 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition"
                    title="Quitar imagen"
                  >
                    <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <!-- File size preview -->
                <div class="p-2.5 space-y-1.5 text-[11px]">
                  <p class="truncate font-medium text-gray-800" [title]="item.file.name">
                    {{ item.file.name }}
                  </p>
                  <div class="flex items-center justify-between text-[10px]">
                    <span class="font-mono text-gray-400 line-through">{{ item.originalSizeKb }} KB</span>
                    <span class="rounded bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 font-mono font-medium text-emerald-700">
                      ~{{ item.estimatedWebpKb }} KB
                    </span>
                  </div>
                  <div class="flex items-center justify-between pt-1 border-t border-gray-100">
                    <span class="text-[10px] text-gray-400">Orden #{{ idx + 1 }}</span>
                    <div class="flex gap-1">
                      <button
                        type="button"
                        [disabled]="idx === 0"
                        (click)="moveStaged(idx, -1); $event.stopPropagation()"
                        class="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        aria-label="Mover a la izquierda"
                      >
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        [disabled]="idx === stagedItems().length - 1"
                        (click)="moveStaged(idx, 1); $event.stopPropagation()"
                        class="inline-flex h-5 w-5 items-center justify-center rounded border border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
                        aria-label="Mover a la derecha"
                      >
                        <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>

          @if (!part?.id) {
            <p class="text-[11px] font-medium text-orange-800 flex items-center gap-1.5">
              <svg class="h-4 w-4 shrink-0 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <span>Al guardar el nuevo repuesto, estas fotografías se subirán automáticamente.</span>
            </p>
          }
        </div>
      }
    </div>
  `,
})
export class PartImageUploaderComponent implements OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly apiConfig = inject(ApiConfigService);
  private readonly toast = inject(ToastService);

  private _part = signal<Part | null>(null);

  @Input()
  set part(value: Part | null) {
    this._part.set(value);
  }
  get part(): Part | null {
    return this._part();
  }

  @Output() readonly partUpdated = new EventEmitter<Part>();
  @Output() readonly stagedFilesChange = new EventEmitter<StagedUploadBundle>();

  readonly isDraggingOver = signal(false);
  readonly stagedItems = signal<StagedImageItem[]>([]);
  readonly isUploading = signal(false);
  readonly uploadProgress = signal(0);

  private draggedCardIndex: number | null = null;

  readonly existingImages = computed<PartImage[]>(() => {
    const p = this._part();
    return p?.images ?? [];
  });

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
  }

  onDropFiles(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.isDraggingOver.set(false);
    if (event.dataTransfer?.files?.length) {
      this.ingestFiles(Array.from(event.dataTransfer.files));
    }
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files?.length) {
      this.ingestFiles(Array.from(input.files));
      input.value = '';
    }
  }

  private ingestFiles(files: File[]): void {
    const validImages = files.filter((f) => f.type.startsWith('image/'));
    if (validImages.length === 0) {
      this.toast.warning('Formato no válido', 'Selecciona archivos de imagen JPG o PNG.');
      return;
    }

    const hadNoneBefore = this.stagedItems().length === 0 && this.existingImages().length === 0;

    const newItems: StagedImageItem[] = validImages.map((file, index) => {
      const originalSizeKb = Math.max(1, Math.round(file.size / 1024));
      const ratio = file.type === 'image/webp' ? 0.85 : 0.36;
      const estimatedWebpKb = Math.max(1, Math.round(originalSizeKb * ratio));
      return {
        uid: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        originalSizeKb,
        estimatedWebpKb,
        isPrimary: hadNoneBefore && index === 0,
      };
    });

    this.stagedItems.update((prev) => [...prev, ...newItems]);
    this.emitStagedBundle();
  }

  markStagedPrimary(index: number): void {
    this.stagedItems.update((list) =>
      list.map((item, idx) => ({
        ...item,
        isPrimary: idx === index ? !item.isPrimary : false,
      }))
    );
    this.emitStagedBundle();
  }

  removeStaged(index: number): void {
    this.stagedItems.update((list) => {
      const target = list[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      const next = list.filter((_, idx) => idx !== index);
      if (target?.isPrimary && next.length > 0 && this.existingImages().length === 0) {
        next[0] = { ...next[0], isPrimary: true };
      }
      return next;
    });
    this.emitStagedBundle();
  }

  moveStaged(index: number, delta: number): void {
    const targetIdx = index + delta;
    this.stagedItems.update((list) => {
      if (targetIdx < 0 || targetIdx >= list.length) return list;
      const copy = [...list];
      const [moved] = copy.splice(index, 1);
      copy.splice(targetIdx, 0, moved);
      return copy;
    });
    this.emitStagedBundle();
  }

  onCardDragStart(index: number): void {
    this.draggedCardIndex = index;
  }

  onCardDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onCardDrop(targetIndex: number, event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.draggedCardIndex === null || this.draggedCardIndex === targetIndex) {
      this.draggedCardIndex = null;
      return;
    }
    const fromIdx = this.draggedCardIndex;
    this.draggedCardIndex = null;
    this.stagedItems.update((list) => {
      const copy = [...list];
      const [moved] = copy.splice(fromIdx, 1);
      copy.splice(targetIndex, 0, moved);
      return copy;
    });
    this.emitStagedBundle();
  }

  clearStaged(): void {
    this.stagedItems().forEach((item) => URL.revokeObjectURL(item.previewUrl));
    this.stagedItems.set([]);
    this.emitStagedBundle();
  }

  uploadStagedNow(): void {
    const currentPart = this._part();
    const items = this.stagedItems();
    if (!currentPart?.id || items.length === 0) return;

    const files = items.map((i) => i.file);
    const primaryIdx = items.findIndex((i) => i.isPrimary);

    this.isUploading.set(true);
    this.uploadProgress.set(35);

    const progressTimer = setInterval(() => {
      this.uploadProgress.update((v) => (v < 88 ? v + 12 : v));
    }, 180);

    this.catalogService
      .uploadPartImages(currentPart.id, files, primaryIdx >= 0 ? primaryIdx : null)
      .pipe(
        finalize(() => {
          clearInterval(progressTimer);
          this.isUploading.set(false);
          this.uploadProgress.set(0);
        })
      )
      .subscribe({
        next: (updatedPart) => {
          this.uploadProgress.set(100);
          this.clearStaged();
          this._part.set(updatedPart);
          this.partUpdated.emit(updatedPart);
          this.toast.success(
            'Fotografías guardadas',
            `Se agregaron ${files.length} foto(s) al repuesto ${updatedPart.sku}.`
          );
        },
        error: (err) => {
          const msg = err?.error?.message || 'No se pudieron subir las fotografías.';
          this.toast.error('Error al subir fotos', msg);
        },
      });
  }

  makePersistedPrimary(img: PartImage): void {
    const currentPart = this._part();
    if (!currentPart?.id) return;

    this.isUploading.set(true);
    this.catalogService
      .setPrimaryPartImage(currentPart.id, img.id)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: (updatedPart) => {
          this._part.set(updatedPart);
          this.partUpdated.emit(updatedPart);
          this.toast.success('Portada actualizada', 'Se definió la nueva imagen principal.');
        },
        error: (err) => {
          this.toast.error(
            'No se pudo actualizar',
            err?.error?.message || 'Error al cambiar la imagen principal.'
          );
        },
      });
  }

  removePersistedImage(img: PartImage): void {
    const currentPart = this._part();
    if (!currentPart?.id) return;

    this.isUploading.set(true);
    this.catalogService
      .deletePartImage(currentPart.id, img.id)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: (updatedPart) => {
          this._part.set(updatedPart);
          this.partUpdated.emit(updatedPart);
          this.toast.info('Imagen eliminada', 'La fotografía fue retirada del producto.');
        },
        error: (err) => {
          this.toast.error(
            'Error al eliminar',
            err?.error?.message || 'No se pudo eliminar la imagen.'
          );
        },
      });
  }

  isPrimaryPersisted(img: PartImage): boolean {
    return this.apiConfig.isPrimary(img);
  }

  resolveUrl(url: string): string {
    const p = this._part();
    return this.apiConfig.resolveMediaUrl(url, p?.oemCode || p?.sku, p?.manufacturerBrand);
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img) {
      const p = this._part();
      const fallback = this.apiConfig.getCategoryFallback(p?.categoryName);
      if (img.src !== fallback && !img.src.endsWith(fallback)) {
        img.src = fallback;
      }
    }
  }

  private emitStagedBundle(): void {
    const items = this.stagedItems();
    const primaryIdx = items.findIndex((i) => i.isPrimary);
    this.stagedFilesChange.emit({
      files: items.map((i) => i.file),
      primaryIndex: primaryIdx >= 0 ? primaryIdx : null,
    });
  }

  ngOnDestroy(): void {
    this.stagedItems().forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }
}
