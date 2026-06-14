import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {
  ClientPortalService,
  PortalService,
  PortalContractedService,
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
          <!-- AVAILABLE SERVICES -->
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

                    <div class="mt-auto pt-3 flex items-center justify-between gap-2 border-t border-gray-100 dark:border-gray-700">
                      @if (s.allow_direct_contracting) {
                        <button
                          (click)="contract(s)"
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
  `,
})
export class PortalServicesComponent implements OnInit {
  private portal = inject(ClientPortalService);

  loading = signal<boolean>(true);
  available = signal<PortalService[]>([]);
  contracted = signal<PortalContractedService[]>([]);
  contracting = signal<string | null>(null);
  errorMessage = signal<string | null>(null);

  async ngOnInit() {
    this.loading.set(true);
    const { data, error } = await this.portal.listServices();
    if (data) {
      this.available.set(data.available ?? []);
      this.contracted.set(data.contracted ?? []);
    }
    if (error) this.errorMessage.set(error.message);
    this.loading.set(false);
  }

  async contract(s: PortalService) {
    if (!s.allow_direct_contracting) return;
    if (!confirm(`¿Contratar "${s.name}" desde hoy?`)) return;
    this.contracting.set(s.id);
    this.errorMessage.set(null);
    const { data, error } = await this.portal.contractService({
      service_id: s.id,
      start_date: new Date().toISOString().slice(0, 10),
    });
    this.contracting.set(null);
    if (data) {
      this.contracted.set([data, ...this.contracted()]);
    } else {
      this.errorMessage.set(error?.message || 'No se pudo contratar el servicio');
    }
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
