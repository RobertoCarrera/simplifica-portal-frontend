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
    <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900 overflow-y-auto">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="px-6 py-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Servicios</h1>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Catálogo de servicios disponibles de tu empresa y los que tienes contratados.
            </p>
          </div>
          <div class="flex items-center gap-2 text-xs">
            <span class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-medium">
              {{ available().length }} disponibles
            </span>
            <span class="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 font-medium">
              {{ contracted().length }} contratados
            </span>
          </div>
        </div>
      </div>

      <div class="flex-1 p-6 space-y-10">
        @if (loading()) {
          <div class="p-8 text-center text-gray-500">Cargando servicios…</div>
        } @else {
          <!-- DEBUG BANNER (quitar cuando se arregle) -->
          @if (debugShowRaw() && debugRawResponse()) {
            <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 text-xs font-mono text-amber-900 dark:text-amber-200 mb-4">
              <div class="flex items-center justify-between">
                <div>
                  🔧 DEBUG · <b>available del BFF:</b> {{ debugRawResponse()?.availableCount ?? 0 }}
                  · <b>contracted del BFF:</b> {{ debugRawResponse()?.contractedCount ?? 0 }}
                </div>
                <button
                  (click)="debugShowRaw.set(false)"
                  class="text-amber-600 hover:text-amber-800"
                  title="Ocultar"
                >✕</button>
              </div>
              @if (debugRawResponse()?.availableFirst) {
                <pre class="mt-1 text-[10px] whitespace-pre-wrap break-all">{{ debugRawResponse()?.availableFirst | json }}</pre>
              }
            </div>
          }
          <!-- AVAILABLE SERVICIOS -->
          <section>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Servicios disponibles</h2>
            @if (available().length === 0) {
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
                No hay servicios disponibles para contratar en este momento.
              </div>
            } @else {
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                @for (s of available(); track s.id) {
                  <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 flex flex-col hover:shadow-md transition-shadow">
                    <header class="mb-3">
                      <div class="flex items-start justify-between gap-2">
                        <h3 class="text-base font-semibold text-gray-900 dark:text-white">{{ s.name }}</h3>
                        @if (s.category) {
                          <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex-shrink-0">
                            {{ s.category }}
                          </span>
                        }
                      </div>
                      @if (s.description) {
                        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-3">{{ s.description }}</p>
                      }
                    </header>

                    <dl class="grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-300 mb-3">
                      @if (s.display_price != null || s.base_price != null) {
                        <div>
                          <dt class="text-gray-400">Precio</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">
                            {{ formatPrice(s.display_price ?? s.base_price) }} {{ currencyFor(s) }}
                            @if (s.display_price_label) {
                              <span class="text-xs font-normal text-gray-500 ml-1">{{ s.display_price_label }}</span>
                            }
                          </dd>
                        </div>
                      }
                      @if (s.duration_minutes) {
                        <div>
                          <dt class="text-gray-400">Duración</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">{{ formatDuration(s.duration_minutes) }}</dd>
                        </div>
                      }
                      @if (s.estimated_hours) {
                        <div>
                          <dt class="text-gray-400">Horas estimadas</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">{{ s.estimated_hours }} h</dd>
                        </div>
                      }
                      @if (s.display_hourly_rate) {
                        <div>
                          <dt class="text-gray-400">Tarifa / h</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">{{ formatPrice(s.display_hourly_rate) }} {{ currencyFor(s) }}</dd>
                        </div>
                      }
                      @if (s.tax_rate) {
                        <div>
                          <dt class="text-gray-400">IVA</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">{{ s.tax_rate }}%</dd>
                        </div>
                      }
                      @if (s.unit_type) {
                        <div>
                          <dt class="text-gray-400">Unidad</dt>
                          <dd class="font-semibold text-gray-900 dark:text-white">{{ s.unit_type }}</dd>
                        </div>
                      }
                    </dl>

                    @if (s.features) {
                      <p class="text-xs text-gray-500 dark:text-gray-400 mb-3 italic line-clamp-2">{{ s.features }}</p>
                    }

                    @if (s.tags && s.tags.length > 0) {
                      <div class="flex flex-wrap gap-1 mb-3">
                        @for (tag of s.tags; track tag) {
                          <span class="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                            {{ tag }}
                          </span>
                        }
                      </div>
                    }

                    @if (s.has_variants) {
                      <details class="mb-3 group" (toggle)="loadVariants(s)">
                        <summary class="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:underline select-none flex items-center gap-1">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 transition-transform group-open:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                          </svg>
                          Ver opciones disponibles
                        </summary>
                        <div class="mt-2 space-y-2">
                          @if (variantsLoading(s)) {
                            <div class="text-xs text-gray-400 py-2">Cargando opciones…</div>
                          } @else if (getVariantsFor(s).length === 0) {
                            <div class="text-xs text-gray-400 py-2">No hay opciones disponibles.</div>
                          } @else {
                            @for (v of getVariantsFor(s); track v.id) {
                              <div
                                class="p-2.5 border rounded-md transition-colors"
                                [class.border-blue-400]="v.display_config?.highlight"
                                [class.bg-blue-50]="v.display_config?.highlight"
                                [class.dark:bg-blue-900]="v.display_config?.highlight && v.display_config?.highlight"
                                [class.border-gray-200]="!v.display_config?.highlight"
                                [class.dark:border-gray-700]="!v.display_config?.highlight"
                              >
                                <div class="flex items-start justify-between gap-2">
                                  <div class="flex-1 min-w-0">
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                      <span class="text-sm font-medium text-gray-900 dark:text-white">{{ v.variant_name }}</span>
                                      @if (v.display_config?.badge) {
                                        <span class="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-medium">
                                          {{ v.display_config?.badge }}
                                        </span>
                                      }
                                    </div>
                                    @if (v.features?.included && v.features!.included!.length > 0) {
                                      <ul class="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                        @for (feat of v.features!.included!.slice(0, 3); track feat) {
                                          <li class="flex items-start gap-1">
                                            <span class="text-emerald-500">✓</span>
                                            <span class="line-clamp-1">{{ feat }}</span>
                                          </li>
                                        }
                                      </ul>
                                    }
                                  </div>
                                  <div class="text-right flex-shrink-0">
                                    @if (v.pricing && v.pricing.length > 0) {
                                      @for (p of v.pricing; track p.period) {
                                        <div class="text-xs">
                                          <div class="font-semibold text-gray-900 dark:text-white">
                                            {{ formatPrice(p.price) }} EUR
                                          </div>
                                          <div class="text-[10px] text-gray-500">{{ variantPeriodLabel(p.period) }}</div>
                                        </div>
                                      }
                                    } @else if (v.base_price != null) {
                                      <div class="text-xs">
                                        <div class="font-semibold text-gray-900 dark:text-white">
                                          {{ formatPrice(v.base_price) }} EUR
                                        </div>
                                      </div>
                                    }
                                  </div>
                                </div>
                                @if (s.allow_direct_contracting) {
                                  <div class="mt-2 flex flex-wrap gap-1">
                                    @if (v.pricing && v.pricing.length > 1) {
                                      @for (p of v.pricing; track p.period) {
                                        <button
                                          (click)="openContractModal(s, v, p.period)"
                                          [disabled]="contracting() === s.id"
                                          class="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                        >
                                          Contratar ({{ variantPeriodLabel(p.period) }})
                                        </button>
                                      }
                                    } @else {
                                      <button
                                        (click)="openContractModal(s, v, firstPricingPeriod(v))"
                                        [disabled]="contracting() === s.id"
                                        class="text-[10px] px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                                      >
                                        Contratar esta opción
                                      </button>
                                    }
                                  </div>
                                }
                              </div>
                            }
                          }
                        </div>
                      </details>
                    }

                    <div class="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-700">
                      @if (s.allow_direct_contracting) {
                        <button
                          (click)="openContractModal(s)"
                          [disabled]="contracting() === s.id"
                          class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
                        >
                          @if (contracting() === s.id) {
                            <span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                          }
                          Contratar
                        </button>
                      } @else {
                        <span class="text-xs text-gray-400">Sólo visible en el portal</span>
                      }
                      @if (s.booking_color) {
                        <span
                          class="w-4 h-4 rounded-full flex-shrink-0"
                          [style.backgroundColor]="s.booking_color"
                          [title]="'Color: ' + s.booking_color"
                        ></span>
                      }
                    </div>
                  </article>
                }
              </div>
            }
          </section>

          <!-- CONTRACTED SERVICES -->
          <section>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Mis servicios contratados</h2>
            @if (contracted().length === 0) {
              <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center text-gray-500">
                Aún no tienes servicios contratados. Contrata uno desde la sección superior.
              </div>
            } @else {
              <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead class="bg-gray-50 dark:bg-gray-900/50">
                    <tr>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Servicio</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Inicio</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Recurrencia</th>
                      <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Estado</th>
                      <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                    @for (c of contracted(); track c.id) {
                      <tr>
                        <td class="px-4 py-3 text-sm">
                          <div class="font-medium text-gray-900 dark:text-white">{{ c.name }}</div>
                          @if (c.description) {
                            <div class="text-xs text-gray-500 line-clamp-1">{{ c.description }}</div>
                          }
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          {{ c.start_date | date: 'mediumDate' }}
                        </td>
                        <td class="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                          @if (c.recurrence_type) {
                            <div class="flex flex-col text-xs">
                              <span class="font-medium">{{ recurrenceLabel(c.recurrence_type) }}</span>
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
                        <td class="px-4 py-3 text-sm">
                          <span [class]="statusClass(c.status)">
                            {{ statusLabel(c.status) }}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                          {{ formatPrice(c.price) }} {{ c.currency }}
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </section>
        }
      </div>
    </div>

    <!-- CONTRACT MODAL -->
    @if (contractModalOpen() && contractModalService(); as svc) {
      <div
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
        (click)="closeContractModal()"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4"
          (click)="$event.stopPropagation()"
        >
          <header class="flex items-start justify-between gap-3">
            <div class="flex-1 min-w-0">
              <h3 class="text-lg font-bold text-gray-900 dark:text-white">Contratar servicio</h3>
              <p class="text-sm text-gray-500 dark:text-gray-400 truncate">{{ svc.name }}</p>
            </div>
            <button
              (click)="closeContractModal()"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex-shrink-0"
              title="Cerrar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>

          <div class="space-y-4">
            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Fecha de inicio
              </label>
              <input
                type="date"
                [ngModel]="contractStartDate()"
                (ngModelChange)="contractStartDate.set($event)"
                name="contractStartDate"
                class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
              />
            </div>

            <div>
              <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                Recurrencia
              </label>
              <div class="grid grid-cols-2 gap-2">
                @for (opt of recurrenceOptions; track opt.value) {
                  <label
                    class="flex items-center gap-2 px-3 py-2 border rounded-lg cursor-pointer transition-colors"
                    [class.border-blue-500]="contractRecurrence() === opt.value"
                    [class.bg-blue-50]="contractRecurrence() === opt.value"
                    [class.dark:bg-blue-900/20]="contractRecurrence() === opt.value"
                    [class.border-gray-200]="contractRecurrence() !== opt.value"
                    [class.dark:border-gray-700]="contractRecurrence() !== opt.value"
                  >
                    <input
                      type="radio"
                      [value]="opt.value"
                      [checked]="contractRecurrence() === opt.value"
                      (change)="contractRecurrence.set($any(opt.value))"
                      class="text-blue-600 focus:ring-blue-500"
                    />
                    <span class="text-sm text-gray-700 dark:text-gray-200">{{ opt.label }}</span>
                  </label>
                }
              </div>
            </div>

            @if (contractRecurrence() !== 'none') {
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Día de generación
                  </label>
                  <input
                    type="number"
                    [ngModel]="contractRecurrenceDay()"
                    (ngModelChange)="contractRecurrenceDay.set($event ? +$event : null)"
                    name="contractRecurrenceDay"
                    min="1"
                    [max]="contractRecurrence() === 'monthly' ? 31 : contractRecurrence() === 'weekly' ? 7 : 366"
                    placeholder="1-31"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
                  />
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Fin (opcional)
                  </label>
                  <input
                    type="date"
                    [ngModel]="contractRecurrenceEnd()"
                    (ngModelChange)="contractRecurrenceEnd.set($event || null)"
                    name="contractRecurrenceEnd"
                    class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200"
                  />
                </div>
              </div>
            }

            @if (errorMessage()) {
              <p class="text-sm text-red-600">{{ errorMessage() }}</p>
            }
          </div>

          <footer class="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
            <button
              (click)="closeContractModal()"
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100"
            >
              Cancelar
            </button>
            <button
              (click)="confirmContract()"
              [disabled]="contracting() === svc.id"
              class="px-5 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              @if (contracting() === svc.id) {
                <span class="animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full"></span>
              }
              Confirmar contratación
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
  // DEBUG: raw BFF response to inspect in the UI
  debugRawResponse = signal<any>(null);
  debugShowRaw = signal<boolean>(true);

  // Contract modal state
  contractModalOpen = signal<boolean>(false);
  contractModalService = signal<PortalService | null>(null);
  contractModalVariant = signal<PortalServiceVariant | null>(null);
  contractModalPricingPeriod = signal<'one-time' | 'monthly' | 'annually' | 'custom' | null>(null);
  contractStartDate = signal<string>(new Date().toISOString().slice(0, 10));
  contractRecurrence = signal<'none' | 'monthly' | 'weekly' | 'yearly'>('none');
  contractRecurrenceDay = signal<number | null>(null);
  contractRecurrenceEnd = signal<string | null>(null);

  // Variants cache: serviceId → { loading, list, error }
  variantsByService = signal<Record<string, { loading: boolean; list: PortalServiceVariant[]; error?: string }>>({});

  async ngOnInit() {
    this.loading.set(true);
    const { data, error } = await this.portal.listServices();
    if (data) {
      this.available.set(data.available ?? []);
      this.contracted.set(data.contracted ?? []);
      this.debugRawResponse.set({
        availableCount: data.available?.length ?? 0,
        contractedCount: data.contracted?.length ?? 0,
        availableFirst: data.available?.[0] ?? null,
      });
    }
    if (error) this.errorMessage.set(error.message);
    this.loading.set(false);
  }

  openContractModal(s: PortalService, variant?: PortalServiceVariant, pricingPeriod?: 'one-time' | 'monthly' | 'annually' | 'custom') {
    if (!s.allow_direct_contracting) return;
    this.contractModalService.set(s);
    this.contractModalVariant.set(variant ?? null);
    this.contractModalPricingPeriod.set(pricingPeriod ?? null);
    this.contractStartDate.set(new Date().toISOString().slice(0, 10));
    this.contractRecurrence.set('none');
    this.contractRecurrenceDay.set(null);
    this.contractRecurrenceEnd.set(null);
    this.errorMessage.set(null);
    this.contractModalOpen.set(true);
  }

  closeContractModal() {
    this.contractModalOpen.set(false);
    this.contractModalService.set(null);
    this.contractModalVariant.set(null);
    this.contractModalPricingPeriod.set(null);
  }

  async confirmContract() {
    const s = this.contractModalService();
    if (!s) return;
    this.contracting.set(s.id);
    this.errorMessage.set(null);
    const rec = this.contractRecurrence();
    const variant = this.contractModalVariant();
    const { data, error } = await this.portal.contractService({
      service_id: s.id,
      variant_id: variant?.id ?? null,
      pricing_period: this.contractModalPricingPeriod() ?? null,
      start_date: this.contractStartDate(),
      recurrence_type: rec === 'none' ? null : rec,
      recurrence_day: rec === 'none' ? null : this.contractRecurrenceDay(),
      recurrence_start: rec === 'none' ? null : this.contractStartDate(),
      recurrence_end: rec === 'none' ? null : this.contractRecurrenceEnd(),
    });
    this.contracting.set(null);
    if (data) {
      this.contracted.set([data, ...this.contracted()]);
      this.closeContractModal();
    } else {
      this.errorMessage.set(error?.message || 'No se pudo contratar el servicio');
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
    if (typeof v.base_price === 'number') return v.base_price;
    return null;
  }

  firstPricingPeriod(v: PortalServiceVariant): 'one-time' | 'monthly' | 'annually' | 'custom' | undefined {
    if (Array.isArray(v.pricing) && v.pricing.length > 0 && v.pricing[0]?.period) {
      return v.pricing[0].period as 'one-time' | 'monthly' | 'annually' | 'custom';
    }
    return undefined;
  }

  variantPeriodLabel(p: string): string {
    switch (p) {
      case 'one-time': return 'Pago único';
      case 'monthly': return 'Mensual';
      case 'annually': return 'Anual';
      case 'custom': return 'Personalizado';
      default: return p;
    }
  }

  // Legacy direct-contract path kept as fallback in case allow_direct_contracting
  // is true and we want a one-click contract without a modal.
  async contractDirect(s: PortalService) {
    if (!s.allow_direct_contracting) return;
    this.openContractModal(s);
    // Auto-confirm with no recurrence for the legacy one-click path
    this.contractRecurrence.set('none');
    await this.confirmContract();
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

  recurrenceOptions: Array<{ value: 'none' | 'monthly' | 'weekly' | 'yearly'; label: string }> = [
    { value: 'none', label: 'Puntual' },
    { value: 'monthly', label: 'Mensual' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'yearly', label: 'Anual' },
  ];

  recurrenceLabel(t: string): string {
    switch (t) {
      case 'monthly': return 'Mensual';
      case 'weekly': return 'Semanal';
      case 'yearly': return 'Anual';
      default: return t;
    }
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
