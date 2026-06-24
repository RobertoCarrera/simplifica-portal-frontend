import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ClientPortalService,
  PortalService,
  PortalContractedService,
  PortalServiceVariant,
} from '../../../core/services/client-portal.service';

@Component({
  selector: 'app-portal-services',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header: solo título + descripción. Las pills viven dentro de la toolbar del pane. -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div class="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div class="min-w-0">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Servicios</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Catálogo de servicios disponibles de tu empresa y los que tienes contratados.
            </p>
          </div>
          <div class="relative">
            <input
              type="search"
              [ngModel]="availableSearch()"
              (ngModelChange)="availableSearch.set($event)"
              placeholder="Filtrar por nombre o categoría…"
              class="pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg w-64 focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
            />
            <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
            @if (availableSearch()) {
              <button
                type="button"
                (click)="availableSearch.set('')"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Limpiar filtro"
              >
                <i class="fas fa-times text-xs"></i>
              </button>
            }
          </div>
        </div>
      </div>

      <div class="flex-1 min-h-0 p-3 flex flex-col gap-3 relative">
        @if (loading()) {
          <div class="p-8 text-center text-gray-500">Cargando servicios…</div>
        } @else {
          <!-- AVAILABLE SERVICIOS PANE -->
          <section class="flex-1 min-h-0 flex flex-col bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <div class="flex-1 min-h-0 overflow-y-auto p-4">
              @if (available().length === 0) {
                <div class="p-8 text-center text-gray-500">
                  No hay servicios disponibles para contratar en este momento.
                </div>
              } @else if (filteredAvailable().length === 0) {
                <div class="p-8 text-center text-gray-500">
                  Ningún servicio coincide con «<b>{{ availableSearch() }}</b>».
                </div>
              } @else {
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  @for (s of filteredAvailable(); track s.id) {
                  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow">
                    <header class="mb-3">
                      @if (categoryLabel(s); as catName) {
                        <div
                          class="text-[10px] uppercase tracking-wider font-semibold mb-1.5 flex items-center gap-1.5"
                          [style.color]="categoryColor(s) || '#6b7280'"
                        >
                          @if (categoryIcon(s)) {
                            <i [class]="categoryIcon(s)!"></i>
                          }
                          {{ catName }}
                        </div>
                      }
                      <h3 class="text-base font-semibold text-gray-900 dark:text-white leading-snug">{{ s.name }}</h3>
                      @if (s.description) {
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1.5 line-clamp-3" [innerHTML]="s.description"></p>
                      } @else {
                        <p class="text-sm text-gray-400 dark:text-gray-500 mt-1.5 italic">Sin descripción</p>
                      }
                    </header>

                    @if (!s.has_variants) {
                      <div class="mb-3 flex items-baseline gap-1">
                        @if (s.display_price != null || s.base_price != null) {
                          <span class="text-2xl font-bold text-gray-900 dark:text-white">
                            {{ formatPrice(s.display_price ?? s.base_price) }} {{ currencyFor(s) }}
                          </span>
                          @if (s.display_price_label) {
                            <span class="text-xs text-gray-500 ml-1">{{ s.display_price_label }}</span>
                          }
                        } @else {
                          <span class="text-sm text-gray-400 italic">Consultar precio</span>
                        }
                      </div>
                    }

                    @if (s.duration_minutes || s.estimated_hours) {
                      <div class="mb-3 flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                        @if (s.duration_minutes) {
                          <span class="inline-flex items-center gap-1">
                            <i class="far fa-clock"></i>
                            {{ formatDuration(s.duration_minutes) }}
                          </span>
                        }
                        @if (s.estimated_hours) {
                          <span class="inline-flex items-center gap-1">
                            <i class="far fa-hourglass"></i>
                            {{ s.estimated_hours }} h estimadas
                          </span>
                        }
                      </div>
                    }

                    @if (s.features) {
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 italic line-clamp-2">{{ s.features }}</p>
                    }

                    @if (tagsFor(s) && tagsFor(s)!.length > 0) {
                      <div class="flex flex-wrap gap-1 mb-3">
                        @for (tag of tagsFor(s)!; track tag) {
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {{ tag }}
                          </span>
                        }
                      </div>
                    }

                    @if (s.has_variants) {
                      <details
                        class="mt-2 mb-3 group"
                        [attr.open]="selectedVariantId(s) ? '' : null"
                      >
                        <summary
                          class="cursor-pointer text-xs font-medium select-none flex items-center justify-between gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blue-400 transition-colors"
                          [class.text-blue-600]="selectedVariantId(s)"
                          [class.dark:text-blue-400]="selectedVariantId(s)"
                          [class.border-blue-300]="selectedVariantId(s)"
                        >
                          <span class="flex items-center gap-1.5">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                            @if (selectedVariantId(s)) {
                              Opción: <strong class="font-semibold">{{ selectedVariantName(s) }}</strong>
                            } @else {
                              Elegir opción
                            }
                          </span>
                          @if (selectedVariantId(s)) {
                            <i class="fas fa-check-circle text-blue-500"></i>
                          }
                        </summary>
                        <div class="mt-2 flex flex-col gap-1.5">
                          @if (variantsLoading(s)) {
                            <div class="col-span-2 text-xs text-gray-400 py-2">Cargando opciones…</div>
                          } @else if (getVariantsFor(s).length === 0) {
                            <div class="col-span-2 text-xs text-gray-400 py-2">No hay opciones disponibles.</div>
                          } @else {
                            @for (v of getVariantsFor(s); track v.id) {
                              <button
                                type="button"
                                (click)="selectVariant(s, v)"
                                [class.border-blue-500]="selectedVariantId(s) === v.id"
                                [class.bg-blue-50]="selectedVariantId(s) === v.id"
                                [class.dark:bg-blue-900]="selectedVariantId(s) === v.id"
                                [class.dark:border-blue-400]="selectedVariantId(s) === v.id"
                                [class.border-gray-200]="selectedVariantId(s) !== v.id"
                                [class.dark:border-gray-700]="selectedVariantId(s) !== v.id"
                                class="text-left p-2.5 border rounded-md transition-colors hover:border-blue-400"
                              >
                                <div class="flex items-baseline justify-between gap-1">
                                  <span class="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {{ v.variant_name }}
                                  </span>
                                  @if (variantFirstPrice(v); as p) {
                                    <span class="text-sm font-semibold text-gray-900 dark:text-white flex-shrink-0">
                                      {{ formatPrice(p.price) }} €
                                    </span>
                                  }
                                </div>
                                @if (variantFirstPrice(v); as p) {
                                  <div class="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                                    {{ variantPeriodLabel(p.period) }}
                                  </div>
                                }
                                @if (v.display_config?.badge) {
                                  <span class="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium mt-1 inline-block">
                                    {{ v.display_config?.badge }}
                                  </span>
                                }
                              </button>
                            }
                          }
                        </div>
                      </details>
                    }

                    <div class="mt-auto pt-3 flex items-center gap-2 border-t border-gray-100 dark:border-gray-700">
                      @if (s.has_variants && !selectedVariantId(s)) {
                        <div class="w-full text-center text-xs text-gray-500 dark:text-gray-400 italic py-2">
                          Selecciona una opción arriba para continuar
                        </div>
                      } @else if (s.allow_direct_contracting && s.is_bookable) {
                        <div class="flex gap-2 w-full">
                          <button
                            (click)="openContractModal(s, selectedVariant(s))"
                            [disabled]="contracting() === s.id"
                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                          >
                            @if (contracting() === s.id) {
                              <span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                            }
                            Contratar
                          </button>
                          <button
                            type="button"
                            disabled
                            class="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white opacity-70 cursor-not-allowed flex items-center justify-center gap-1.5"
                            title="Reservar (Próximamente)"
                          >
                            <i class="fas fa-calendar-plus"></i>
                            Reservar
                          </button>
                        </div>
                      } @else if (s.allow_direct_contracting) {
                        <button
                          (click)="openContractModal(s, selectedVariant(s))"
                          [disabled]="contracting() === s.id"
                          class="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          @if (contracting() === s.id) {
                            <span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                          }
                          Contratar
                        </button>
                      } @else if (s.is_bookable) {
                        <button
                          type="button"
                          disabled
                          class="flex-1 px-3 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white opacity-70 cursor-not-allowed flex items-center justify-center gap-1.5"
                          title="Reservar (Próximamente)"
                        >
                          <i class="fas fa-calendar-plus"></i>
                          Reservar
                        </button>
                      } @else {
                        <span class="text-xs text-gray-400">Consultanos si te interesa</span>
                      }
                    </div>
                  </article>
                }
              </div>
            }
            </div>
            <!-- Sticky bottom trigger for the contracted-services sheet -->
            <div class="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 p-2 flex justify-center bg-gray-50 dark:bg-gray-900/30">
              <button
                type="button"
                (click)="contractedSheetOpen.set(true)"
                class="w-full md:w-auto px-4 py-2 text-sm font-medium rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 flex items-center justify-center gap-2 transition-colors"
              >
                <i class="fas fa-briefcase"></i>
                Ver mis servicios contratados
                <span class="px-2 py-0.5 text-xs rounded-full bg-emerald-600 text-white font-semibold">
                  {{ contracted().length }}
                </span>
              </button>
            </div>
          </section>
        }
      </div>
    </div>

    <!-- CONTRACTED SERVICES BOTTOM SHEET (mobile-first, slides up from bottom) -->
    @if (contractedSheetOpen()) {
      <div
        class="fixed inset-0 z-[1200] flex items-end justify-center"
        (click)="contractedSheetOpen.set(false)"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
        <div
          class="relative w-full md:max-w-5xl bg-white dark:bg-gray-800 rounded-t-2xl md:rounded-t-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] md:max-h-[88vh] animate-[slideUp_0.25s_ease-out]"
          (click)="$event.stopPropagation()"
        >
          <!-- Drag handle for mobile visual cue -->
          <div class="flex justify-center pt-3 pb-2">
            <div class="w-12 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          </div>
          <div class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-3">
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <span class="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-briefcase text-emerald-600 dark:text-emerald-400"></i>
              </span>
              <div class="min-w-0">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Mis servicios contratados</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">
                  {{ filteredContracted().length }} de {{ contracted().length }} contratados
                </p>
              </div>
            </div>
            <div class="relative">
              <input
                type="search"
                [ngModel]="contractedSearch()"
                (ngModelChange)="contractedSearch.set($event)"
                placeholder="Filtrar contratados…"
                class="pl-8 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg w-56 focus:ring-2 focus:ring-emerald-500 outline-none text-gray-700 dark:text-gray-200"
              />
              <i class="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              @if (contractedSearch()) {
                <button
                  type="button"
                  (click)="contractedSearch.set('')"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  title="Limpiar filtro"
                >
                  <i class="fas fa-times text-xs"></i>
                </button>
              }
            </div>
            <button
              type="button"
              (click)="contractedSheetOpen.set(false)"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-2 flex-shrink-0 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto">
            @if (contracted().length === 0) {
              <div class="p-12 text-center text-gray-500">
                <i class="fas fa-briefcase text-4xl text-gray-300 dark:text-gray-600 mb-3"></i>
                <p>Aún no tienes servicios contratados.</p>
                <p class="text-sm mt-1">Contrata uno desde la sección superior.</p>
              </div>
            } @else if (filteredContracted().length === 0) {
              <div class="p-12 text-center text-gray-500">
                Ningún servicio coincide con «<b>{{ contractedSearch() }}</b>».
              </div>
            } @else {
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead class="bg-gray-50 dark:bg-gray-900/50 sticky top-0">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Servicio</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inicio</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recurrencia</th>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  @for (c of filteredContracted(); track c.id) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-900/30">
                      <td class="px-6 py-4 text-sm">
                        <div class="font-medium text-gray-900 dark:text-white">{{ c.name }}</div>
                        @if (c.description) {
                          <div class="text-xs text-gray-500 line-clamp-1 mt-0.5">{{ c.description }}</div>
                        }
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {{ c.start_date | date: 'mediumDate' }}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-700 dark:text-gray-300">
                          @if (c.recurrence_type) {
                            <div class="flex flex-col text-xs">
                              <span class="font-medium">
                                @switch (c.recurrence_type) {
                                  @case ('monthly') { Mensual }
                                  @case ('weekly') { Semanal }
                                  @case ('yearly') { Anual }
                                  @default { {{ c.recurrence_type }} }
                                }
                              </span>
                            @if (c.recurrence_day) {
                              <span class="text-gray-500">día {{ c.recurrence_day }}</span>
                            }
                            @if (c.recurrence_start && c.recurrence_start !== c.start_date) {
                              <span class="text-gray-500">desde {{ c.recurrence_start | date: 'mediumDate' }}</span>
                            }
                          </div>
                        } @else {
                          <span class="text-gray-400">Puntual</span>
                        }
                      </td>
                      <td class="px-6 py-4 text-sm">
                        <span [class]="statusClass(c.status)">
                          {{ statusLabel(c.status) }}
                        </span>
                      </td>
                      <td class="px-6 py-4 text-sm text-right font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                        {{ formatPrice(c.price) }} {{ c.currency }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
          <!-- Sticky footer with summary + close action -->
          <div class="flex-shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between gap-3">
            <span class="text-xs text-gray-500 dark:text-gray-400">
              <i class="fas fa-info-circle mr-1"></i>
              Arrastra hacia abajo o pulsa fuera para cerrar
            </span>
            <button
              type="button"
              (click)="contractedSheetOpen.set(false)"
              class="px-4 py-1.5 text-sm font-medium rounded-md bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    }

    <!-- CASH PAYMENT PENDING CONFIRMATION -->
    @if (cashPendingOpen()) {
      <div
        class="fixed inset-0 z-[1200] flex items-end justify-center p-0 md:p-4"
        (click)="cashPendingOpen.set(false)"
      >
        <div class="absolute inset-0 bg-black/50"></div>
        <div
          class="relative bg-white dark:bg-gray-800 w-full max-w-md rounded-t-2xl md:rounded-2xl shadow-2xl p-6 space-y-4 animate-[slideUp_0.25s_ease-out]"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center gap-3">
            <span class="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <i class="fas fa-hourglass-half text-amber-600 dark:text-amber-400 text-xl"></i>
            </span>
            <div class="flex-1 min-w-0">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Solicitud registrada</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400">Pago en efectivo · pendiente de confirmación</p>
            </div>
            <button
              type="button"
              (click)="cashPendingOpen.set(false)"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <p class="text-sm text-gray-600 dark:text-gray-300">
            Hemos registrado tu solicitud. El equipo de Simplifica confirmará el pago en cuanto se haga
            efectivo y entonces verás el servicio en tu lista de contratados.
          </p>

          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300">
            <i class="fas fa-info-circle mr-1"></i>
            Si ya realizaste el pago, contáctanos para acelerar la confirmación.
          </div>

          <button
            type="button"
            (click)="cashPendingOpen.set(false)"
            class="w-full px-4 py-2 text-sm font-medium rounded-md bg-amber-600 text-white hover:bg-amber-700"
          >
            Entendido
          </button>
        </div>
      </div>
    }

    <!-- CONTRACT / PAYMENT MODAL -->
    @if (contractModalOpen() && contractModalService(); as svc) {
      <div
        class="fixed inset-0 z-[1200] flex items-end justify-center p-0 md:p-4"
        (click)="closeContractModal()"
      >
        <div class="absolute inset-0 bg-black/50"></div>
        <div
          class="relative bg-white dark:bg-gray-800 w-full max-w-lg rounded-t-2xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] animate-[slideUp_0.25s_ease-out]"
          (click)="$event.stopPropagation()"
        >
          <!-- Drag handle (mobile) -->
          <div class="flex justify-center pt-2 md:hidden">
            <div class="w-10 h-1 rounded-full bg-gray-300 dark:bg-gray-600"></div>
          </div>

          <header class="flex-shrink-0 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-3">
            <div class="flex items-center gap-2 flex-1 min-w-0">
              <span class="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <i class="fas fa-credit-card text-blue-600 dark:text-blue-400"></i>
              </span>
              <div class="min-w-0">
                <h3 class="text-base font-semibold text-gray-900 dark:text-white">Contratar y pagar</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {{ svc.name }}@if (contractModalVariant()) { · {{ contractModalVariant()!.variant_name }} }
                </p>
              </div>
            </div>
            <button
              type="button"
              (click)="closeContractModal()"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1.5 flex-shrink-0"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
            <!-- Order summary -->
            <div class="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 space-y-2 text-sm">
              <div class="flex items-baseline justify-between">
                <span class="text-gray-500 dark:text-gray-400">Servicio</span>
                <span class="text-gray-900 dark:text-white font-medium truncate ml-2">{{ svc.name }}</span>
              </div>
              @if (contractModalVariant()) {
                <div class="flex items-baseline justify-between">
                  <span class="text-gray-500 dark:text-gray-400">Modalidad</span>
                  <span class="text-gray-900 dark:text-white font-medium truncate ml-2">
                    {{ contractModalVariant()!.variant_name }}
                  </span>
                </div>
              }
              <div class="flex items-baseline justify-between">
                <span class="text-gray-500 dark:text-gray-400">Fecha de inicio</span>
                <span class="text-gray-900 dark:text-white font-medium">{{ today() }}</span>
              </div>
              <div class="border-t border-gray-200 dark:border-gray-700 pt-2 flex items-baseline justify-between">
                <span class="text-gray-900 dark:text-white font-semibold">Total a pagar</span>
                <span class="text-2xl font-bold text-gray-900 dark:text-white">
                  {{ formatPrice(orderTotal()) }} {{ currencyFor(svc) }}
                </span>
              </div>
            </div>

            <!-- Payment methods -->
            <div>
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Método de pago
              </p>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                @for (m of paymentMethods; track m.id) {
                  <button
                    type="button"
                    (click)="paymentMethod.set(m.id)"
                    [class.border-blue-500]="paymentMethod() === m.id"
                    [class.bg-blue-50]="paymentMethod() === m.id"
                    [class.dark:bg-blue-900/20]="paymentMethod() === m.id"
                    [class.dark:border-blue-400]="paymentMethod() === m.id"
                    [class.border-gray-200]="paymentMethod() !== m.id"
                    [class.dark:border-gray-700]="paymentMethod() !== m.id"
                    class="flex items-center gap-3 p-3 border rounded-lg text-left hover:border-blue-400 transition-colors"
                  >
                    <span
                      class="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0"
                      [style.backgroundColor]="m.color + '20'"
                      [style.color]="m.color"
                    >
                      <i [class]="m.icon + ' text-base'"></i>
                    </span>
                    <span class="flex-1 min-w-0">
                      <span class="block text-sm font-medium text-gray-900 dark:text-white">{{ m.label }}</span>
                      <span class="block text-[11px] text-gray-500 dark:text-gray-400">{{ m.hint }}</span>
                    </span>
                    @if (paymentMethod() === m.id) {
                      <i class="fas fa-check-circle text-blue-500"></i>
                    }
                  </button>
                }
              </div>
              @if (paymentMethod() === 'cash') {
                <p class="mt-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                  <i class="fas fa-info-circle mt-0.5"></i>
                  <span>
                    El pago en efectivo queda <b>pendiente de confirmación</b> por el equipo de
                    Simplifica. Tu servicio se activará en cuanto se confirme el pago.
                  </span>
                </p>
              }
            </div>

            @if (errorMessage()) {
              <p class="text-sm text-red-600 dark:text-red-400 flex items-start gap-1.5">
                <i class="fas fa-exclamation-circle mt-0.5"></i>
                <span>{{ errorMessage() }}</span>
              </p>
            }
          </div>

          <footer class="flex-shrink-0 px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30 flex items-center gap-3">
            <button
              type="button"
              (click)="closeContractModal()"
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmContract()"
              [disabled]="contracting() === svc.id || !paymentMethod()"
              class="flex-1 px-5 py-2.5 text-sm font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              @if (contracting() === svc.id) {
                <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                Procesando pago…
              } @else {
                <i class="fas fa-lock text-xs"></i>
                Pagar {{ formatPrice(orderTotal()) }} {{ currencyFor(svc) }}
              }
            </button>
          </footer>
        </div>
      </div>
    }
  `,
})
export class PortalServicesComponent implements OnInit {
  private portal = inject(ClientPortalService);

  loading = signal<boolean>(true);
  available = signal<PortalService[]>([]);
  contracted = signal<PortalContractedService[]>([]);
  contracting = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  // Contract / payment modal state
  contractModalOpen = signal<boolean>(false);
  contractModalService = signal<PortalService | null>(null);
  contractModalVariant = signal<PortalServiceVariant | null>(null);
  contractModalPricingPeriod = signal<'one-time' | 'monthly' | 'annually' | 'custom' | null>(null);
  paymentMethod = signal<'stripe' | 'paypal' | 'cash' | 'redsys' | null>(null);

  /** Today in YYYY-MM-DD — used as the start_date of every contract. */
  today(): string {
    return new Date().toISOString().slice(0, 10);
  }

  /** Total to charge for the current order, considering variant + period. */
  orderTotal(): number {
    const variant = this.contractModalVariant();
    if (variant) {
      const p = this.variantFirstPrice(variant);
      if (p) return p.price;
    }
    const svc = this.contractModalService();
    if (!svc) return 0;
    return svc.display_price ?? svc.base_price ?? 0;
  }

  /** Payment methods available to the client (cash requires owner confirmation). */
  paymentMethods: Array<{
    id: 'stripe' | 'paypal' | 'cash' | 'redsys';
    label: string;
    hint: string;
    icon: string;
    color: string;
  }> = [
    { id: 'stripe',  label: 'Stripe',  hint: 'Pago con tarjeta · inmediato',    icon: 'fab fa-cc-stripe',   color: '#635bff' },
    { id: 'paypal',  label: 'PayPal',  hint: 'Cuenta o tarjeta · inmediato',    icon: 'fab fa-cc-paypal',   color: '#003087' },
    { id: 'redsys',  label: 'RedSys',  hint: 'Tarjeta · pasarela española',     icon: 'fas fa-credit-card', color: '#d52b1e' },
    { id: 'cash',    label: 'Efectivo',hint: 'A convenir · confirmación manual', icon: 'fas fa-money-bill-wave', color: '#16a34a' },
  ];

  // Variants cache: serviceId → { loading, list, error }
  variantsByService = signal<Record<string, { loading: boolean; list: PortalServiceVariant[]; error?: string }>>({});

  // Category lookup: categoryId → { name, color, icon }
  categoriesById = signal<Record<string, { name: string | null; color: string | null; icon: string | null }>>({});

  // Selected variant per service: serviceId → variantId
  selectedVariantByService = signal<Record<string, string>>({});

  // Filter inputs (toolbar search)
  availableSearch = signal<string>('');
  contractedSearch = signal<string>('');

  // Bottom-sheet toggle for the contracted-services panel
  contractedSheetOpen = signal<boolean>(false);

  /** Cash payment confirmation sheet (shown after the user picks "Efectivo"). */
  cashPendingOpen = signal<boolean>(false);

  // Filtered lists (computed from raw + search)
  filteredAvailable = computed(() => {
    const term = this.availableSearch().trim().toLowerCase();
    if (!term) return this.available();
    return this.available().filter((s) => {
      const cat = this.categoryLabel(s)?.toLowerCase() ?? '';
      return (
        s.name?.toLowerCase().includes(term) ||
        cat.includes(term) ||
        s.description?.toLowerCase().includes(term)
      );
    });
  });

  filteredContracted = computed(() => {
    const term = this.contractedSearch().trim().toLowerCase();
    if (!term) return this.contracted();
    return this.contracted().filter((c) => {
      return (
        c.name?.toLowerCase().includes(term) ||
        c.description?.toLowerCase().includes(term)
      );
    });
  });

  async ngOnInit() {
    this.loading.set(true);
    const { data, error } = await this.portal.listServices();
    if (data) {
      this.available.set(data.available ?? []);
      this.contracted.set(data.contracted ?? []);
      const map: Record<string, { name: string | null; color: string | null; icon: string | null }> = {};
      for (const c of data.categories ?? []) {
        map[c.id] = { name: c.name, color: c.color, icon: c.icon };
      }
      this.categoriesById.set(map);

      // Eager-load variants for any service that has them, so the user
      // sees the options immediately without having to click to expand.
      const withVariants = (data.available ?? []).filter((s) => s.has_variants);
      for (const s of withVariants) {
        this.loadVariants(s);
      }
    }
    if (error) this.errorMessage.set(error.message);
    this.loading.set(false);
  }

  openContractModal(s: PortalService, variant?: PortalServiceVariant, pricingPeriod?: 'one-time' | 'monthly' | 'annually' | 'custom') {
    if (!s.allow_direct_contracting) return;
    this.contractModalService.set(s);
    this.contractModalVariant.set(variant ?? null);
    this.contractModalPricingPeriod.set(pricingPeriod ?? null);
    this.paymentMethod.set(null);
    this.errorMessage.set(null);
    this.contractModalOpen.set(true);
  }

  closeContractModal() {
    this.contractModalOpen.set(false);
    this.contractModalService.set(null);
    this.contractModalVariant.set(null);
    this.contractModalPricingPeriod.set(null);
    this.paymentMethod.set(null);
  }

  async confirmContract() {
    const s = this.contractModalService();
    if (!s) return;
    const method = this.paymentMethod();
    if (!method) return;
    this.contracting.set(s.id);
    this.errorMessage.set(null);

    // 1) Always create the contract in the DB first (status:
    //    pending_payment for online, pending_confirmation for cash).
    //    The gateway notify / owner confirmation flips it to 'active'.
    const variant = this.contractModalVariant();
    const { data, error } = await this.portal.contractService({
      service_id: s.id,
      variant_id: variant?.id ?? null,
      pricing_period: this.contractModalPricingPeriod() ?? null,
      start_date: this.today(),
      recurrence_type: null,
      recurrence_day: null,
      recurrence_start: null,
      recurrence_end: null,
      payment_method: method,
    });
    if (error || !data) {
      this.contracting.set(null);
      this.errorMessage.set(error?.message || 'No se pudo iniciar la contratación');
      return;
    }

    // 2) Dispatch to the gateway.
    if (method === 'redsys') {
      await this.openRedsysGateway(data.id);
      // The user is now on Redsys' hosted page. When they come back to
      // /portal/redsys-return we'll refresh the contracted list.
      return;
    }
    if (method === 'cash') {
      this.contracted.set([]); // re-fetch on next load
      this.contracting.set(null);
      this.closeContractModal();
      this.cashPendingOpen.set(true);
      return;
    }
    // Stripe / PayPal: same flow as Redsys but no BFF endpoint yet;
    // show "coming soon" and let the contract sit in pending_payment.
    this.contracting.set(null);
    this.errorMessage.set(
      `El pago con ${method} aún no está disponible. Tu solicitud quedó registrada como pendiente.`,
    );
  }

  /** Redirects the browser to the Redsys hosted payment page. */
  private async openRedsysGateway(contractId: string): Promise<void> {
    try {
      this.contracting.set(this.contractModalService()?.id ?? null);
      const res = await this.portal.initRedsysPayment(contractId);
      if (!res || !res.form) {
        this.contracting.set(null);
        this.errorMessage.set('No se pudo iniciar el pago con Redsys');
        return;
      }
      // Build and auto-submit a hidden form to Redsys.
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = res.redirect_url;
      form.style.display = 'none';
      for (const [k, v] of Object.entries(res.form)) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = k;
        input.value = String(v);
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch (e: any) {
      this.contracting.set(null);
      this.errorMessage.set(e?.message || 'Error iniciando el pago con Redsys');
    }
  }

  getVariantsFor(s: PortalService): PortalServiceVariant[] {
    return this.variantsByService()[s.id]?.list ?? [];
  }

  variantsLoading(s: PortalService): boolean {
    return this.variantsByService()[s.id]?.loading ?? false;
  }

  async loadVariants(s: PortalService) {
    if (!s.has_variants) return;
    const current = this.variantsByService()[s.id];
    if (current && (current.list.length > 0 || current.loading)) return;
    this.variantsByService.set({
      ...this.variantsByService(),
      [s.id]: { loading: true, list: [] },
    });
    const { data } = await this.portal.listServiceVariants(s.id);
    this.variantsByService.set({
      ...this.variantsByService(),
      [s.id]: { loading: false, list: data?.variants ?? [] },
    });
  }

  variantPrice(v: PortalServiceVariant, period?: 'one-time' | 'monthly' | 'annually' | 'custom' | null): number | null {
    if (Array.isArray(v.pricing) && v.pricing.length > 0) {
      const match = period ? v.pricing.find((p) => p?.period === period) : v.pricing[0];
      if (match && typeof match.price !== 'undefined') return match.price;
      if (v.pricing[0] && typeof v.pricing[0].price !== 'undefined') return v.pricing[0].price;
    }
    return null;
  }

  /** First pricing entry of a variant (used for the variant button display). */
  variantFirstPrice(v: PortalServiceVariant): { price: number; period: string } | null {
    if (Array.isArray(v.pricing) && v.pricing.length > 0) {
      const p = v.pricing[0];
      if (typeof p?.price === 'number' && p.period) {
        return { price: p.price, period: p.period };
      }
    }
    return null;
  }

  firstPricingPeriod(v: PortalServiceVariant): 'one-time' | 'monthly' | 'annually' | 'custom' | undefined {
    if (Array.isArray(v.pricing) && v.pricing.length > 0 && v.pricing[0]?.period) {
      return v.pricing[0].period as 'one-time' | 'monthly' | 'annually' | 'custom';
    }
    return undefined;
  }

  /** Mark a variant as selected for a service. */
  selectVariant(s: PortalService, v: PortalServiceVariant) {
    this.selectedVariantByService.set({
      ...this.selectedVariantByService(),
      [s.id]: v.id,
    });
  }

  selectedVariantId(s: PortalService): string | null {
    return this.selectedVariantByService()[s.id] ?? null;
  }

  selectedVariantName(s: PortalService): string | null {
    const id = this.selectedVariantId(s);
    if (!id) return null;
    return this.getVariantsFor(s).find((v) => v.id === id)?.variant_name ?? null;
  }

  /** Returns the currently-selected variant for a service, or undefined. */
  selectedVariant(s: PortalService): PortalServiceVariant | undefined {
    const id = this.selectedVariantId(s);
    if (!id) return undefined;
    return this.getVariantsFor(s).find((v) => v.id === id);
  }

  variantPeriodLabel(p: string): string {
    if (!p) return '';
    const k = p.toLowerCase();
    if (k === 'one-time' || k === 'one_time' || k === 'puntual' || k === 'único' || k === 'unico') return 'Pago único';
    if (k === 'monthly' || k === 'mensual') return 'Mensual';
    if (k === 'annually' || k === 'annual' || k === 'anual' || k === 'yearly') return 'Anual';
    if (k === 'weekly' || k === 'semanal') return 'Semanal';
    if (k === 'custom' || k === 'personalizado') return 'Personalizado';
    return p;
  }

  formatPrice(p?: number | null): string {
    if (p == null) return '—';
    return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p);
  }

  currencyFor(s: PortalService): string {
    return (s as any).currency || 'EUR';
  }

  formatDuration(min: number): string {
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }

  tagsFor(s: PortalService): string[] | null {
    return Array.isArray((s as any).tags) && (s as any).tags.length > 0 ? (s as any).tags : null;
  }

  categoryLabel(s: PortalService): string | null {
    if (!s.category) return null;
    const fromMap = this.categoriesById()[s.category]?.name;
    if (fromMap) return fromMap;
    // If the category is not a UUID, treat it as already-resolved text
    if (!this.isLikelyUuid(s.category)) return s.category;
    // Fallback: short UUID prefix
    return s.category.slice(0, 8);
  }

  categoryColor(s: PortalService): string | null {
    if (!s.category) return null;
    return this.categoriesById()[s.category]?.color ?? null;
  }

  categoryIcon(s: PortalService): string | null {
    if (!s.category) return null;
    return this.categoriesById()[s.category]?.icon ?? null;
  }

  private isLikelyUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
  }

  statusLabel(s: string): string {
    switch (s) {
      case 'active': return 'Activo';
      case 'paused': return 'Pausado';
      case 'cancelled': return 'Cancelado';
      default: return s;
    }
  }

  statusClass(s: string): string {
    const base = 'text-xs px-2 py-0.5 rounded-full font-medium';
    switch (s) {
      case 'active': return `${base} bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300`;
      case 'paused': return `${base} bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300`;
      case 'cancelled': return `${base} bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300`;
      default: return `${base} bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300`;
    }
  }
}
