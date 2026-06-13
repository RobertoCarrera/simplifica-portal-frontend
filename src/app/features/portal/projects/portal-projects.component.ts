import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';
import {
  PortalProjectCardComponent,
  PortalProjectCardData,
} from './portal-project-card.component';

type ViewMode = 'kanban' | 'list' | 'timeline';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  is_archived?: boolean | null;
  created_at: string;
  updated_at: string;
}

interface Stage {
  id: string;
  name: string;
  position: number;
}

@Component({
  selector: 'app-portal-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule, PortalProjectCardComponent],
  template: `
    <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      <!-- Header -->
      <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div class="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center space-x-4">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Proyectos</h1>
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                (click)="setView('kanban')"
                [class.bg-white]="view() === 'kanban'"
                [class.text-blue-600]="view() === 'kanban'"
                [class.shadow-sm]="view() === 'kanban'"
                [class.dark:bg-gray-600]="view() === 'kanban'"
                [class.dark:text-blue-400]="view() === 'kanban'"
                class="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all"
              >Tablero</button>
              <button
                (click)="setView('list')"
                [class.bg-white]="view() === 'list'"
                [class.text-blue-600]="view() === 'list'"
                [class.shadow-sm]="view() === 'list'"
                [class.dark:bg-gray-600]="view() === 'list'"
                [class.dark:text-blue-400]="view() === 'list'"
                class="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all"
              >Tabla</button>
              <button
                (click)="setView('timeline')"
                [class.bg-white]="view() === 'timeline'"
                [class.text-blue-600]="view() === 'timeline'"
                [class.shadow-sm]="view() === 'timeline'"
                [class.dark:bg-gray-600]="view() === 'timeline'"
                [class.dark:text-blue-400]="view() === 'timeline'"
                class="px-3 py-1.5 text-xs font-medium rounded-md text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all"
              >Cronograma</button>
            </div>
          </div>
          <div class="flex items-center space-x-2">
            <!-- Filter triggers moved to filter bar -->
          </div>
        </div>

        <!-- Filter bar -->
        <div class="px-6 pb-4 flex items-center space-x-4">
          <div class="relative w-full md:w-64">
            <input
              type="text"
              [ngModel]="searchText()"
              (ngModelChange)="onSearch($event)"
              placeholder="Buscar por nombre..."
              class="w-full pl-9 pr-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 placeholder-gray-400 transition-colors"
            />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            </svg>
          </div>
          <div class="relative w-full md:w-40">
            <select
              [ngModel]="priorityFilter()"
              (ngModelChange)="onPriority($event)"
              class="w-full pl-3 pr-8 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-gray-700 dark:text-gray-200 appearance-none cursor-pointer transition-colors"
            >
              <option [ngValue]="null">Prioridad: Todas</option>
              <option value="low">Baja</option>
              <option value="medium">Media</option>
              <option value="high">Alta</option>
              <option value="critical">Crítica</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Content area (with FAB anchored to bottom-right, like the CRM) -->
      <div class="flex-1 overflow-hidden relative">
        @if (loading()) {
          <div class="p-6 text-gray-600 dark:text-gray-400">Cargando proyectos…</div>
        } @else if (filtered().length === 0 && !showCreate()) {
          <div class="p-10 text-center text-gray-500 dark:text-gray-400">
            @if (searchText() || priorityFilter()) {
              No hay proyectos que coincidan con los filtros.
            } @else {
              No tienes proyectos todavía. Crea uno con el botón "+" arriba.
            }
          </div>
        } @else {
          @if (view() === 'kanban') {
            <div class="flex-1 overflow-x-auto p-4 h-full">
              <div class="flex gap-4 h-full">
                @for (stage of stages(); track stage.id) {
                  <div class="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex flex-col max-h-full">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wide">
                        {{ stage.name }}
                      </h3>
                      <span class="text-xs text-gray-500 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full">
                        {{ countAtStage(stage.id) }}
                      </span>
                    </div>
                    <div class="flex-1 overflow-y-auto space-y-2">
                      @for (p of projectsByStage(stage.id); track p.id) {
                        <a [routerLink]="['/projects', p.id]" class="block">
                          <app-portal-project-card [project]="p"></app-portal-project-card>
                        </a>
                      } @empty {
                        <p class="text-xs text-gray-400 text-center py-4">Sin proyectos</p>
                      }
                    </div>
                  </div>
                }
                <!-- Unassigned column -->
                @if (countAtStage(null) > 0) {
                  <div class="flex-shrink-0 w-72 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 flex flex-col max-h-full">
                    <div class="flex items-center justify-between mb-3">
                      <h3 class="font-semibold text-sm text-gray-700 dark:text-gray-200 uppercase tracking-wide">Sin etapa</h3>
                      <span class="text-xs text-gray-500 bg-white dark:bg-gray-700 px-2 py-0.5 rounded-full">{{ countAtStage(null) }}</span>
                    </div>
                    <div class="flex-1 overflow-y-auto space-y-2">
                      @for (p of projectsByStage(null); track p.id) {
                        <a [routerLink]="['/projects', p.id]" class="block">
                          <app-portal-project-card [project]="p"></app-portal-project-card>
                        </a>
                      }
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          @if (view() === 'list') {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th class="text-left px-6 py-3">Nombre</th>
                    <th class="text-left px-6 py-3">Etapa</th>
                    <th class="text-left px-6 py-3">Prioridad</th>
                    <th class="text-left px-6 py-3">Inicio</th>
                    <th class="text-left px-6 py-3">Fin</th>
                    <th class="text-left px-6 py-3">Creado</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 dark:divide-gray-700">
                  @for (p of filtered(); track p.id) {
                    <tr class="bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer" [routerLink]="['/projects', p.id]">
                      <td class="px-6 py-3 font-medium text-gray-900 dark:text-white">{{ p.name }}</td>
                      <td class="px-6 py-3 text-gray-600 dark:text-gray-400">{{ stageName(p.stage_id) }}</td>
                      <td class="px-6 py-3">
                        <span [class]="priorityClass(p.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                          {{ priorityLabel(p.priority) }}
                        </span>
                      </td>
                      <td class="px-6 py-3 text-gray-600 dark:text-gray-400">{{ p.start_date | date }}</td>
                      <td class="px-6 py-3 text-gray-600 dark:text-gray-400">{{ p.end_date | date }}</td>
                      <td class="px-6 py-3 text-gray-500">{{ p.created_at | date: 'short' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          @if (view() === 'timeline') {
            <div class="p-6 h-full">
              @if (filtered().length === 0) {
                <div class="text-center text-gray-500 py-12">No hay proyectos con fechas para mostrar.</div>
              } @else {
                <div class="relative pl-6">
                  <div class="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700"></div>
                  <div class="space-y-4">
                    @for (p of filtered(); track p.id) {
                      <a [routerLink]="['/projects', p.id]" class="relative block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-shadow">
                        <div class="absolute -left-[1.6rem] top-4 w-3 h-3 rounded-full" [class]="dotClass(p.priority)"></div>
                        <div class="flex items-center justify-between">
                          <h4 class="font-medium text-gray-900 dark:text-white">{{ p.name }}</h4>
                          <span class="text-xs text-gray-500">
                            @if (p.start_date && p.end_date) {
                              {{ p.start_date | date }} → {{ p.end_date | date }}
                            } @else if (p.start_date) {
                              Desde {{ p.start_date | date }}
                            } @else if (p.end_date) {
                              Hasta {{ p.end_date | date }}
                            } @else {
                              Sin fechas
                            }
                          </span>
                        </div>
                        @if (p.description) {<p class="text-xs text-gray-500 mt-1 line-clamp-2">{{ p.description }}</p>}
                      </a>
                    }
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- Floating Action Button: Nuevo Proyecto (matches the CRM style) -->
        <button
          (click)="toggleCreate()"
          class="absolute bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 hover:shadow-xl active:scale-95 transition-all flex items-center justify-center z-30"
          title="Nuevo Proyecto"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/>
          </svg>
        </button>
      </div>

      <!-- Create project modal -->
      @if (showCreate()) {
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" (click)="toggleCreate()">
          <form
            (ngSubmit)="onCreate(); $event.stopPropagation()"
            (click)="$event.stopPropagation()"
            class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-full max-w-lg space-y-3"
          >
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Nuevo proyecto</h2>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nombre *</label>
              <input
                type="text"
                [(ngModel)]="form.name"
                name="name"
                required
                maxlength="200"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Ej. Reforma cocina"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Descripción</label>
              <textarea [(ngModel)]="form.description" name="description" rows="3"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                placeholder="Detalles del proyecto"></textarea>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prioridad</label>
                <select [(ngModel)]="form.priority" name="priority" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
                  <option value="low">Baja</option><option value="medium">Media</option>
                  <option value="high">Alta</option><option value="critical">Crítica</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Inicio</label>
                <input type="date" [(ngModel)]="form.start_date" name="start_date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fin</label>
                <input type="date" [(ngModel)]="form.end_date" name="end_date" class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white" />
              </div>
            </div>
            @if (createError()) {
              <p class="text-sm text-red-600">{{ createError() }}</p>
            }
            <div class="flex justify-end gap-2 pt-2">
              <button type="button" (click)="toggleCreate()" class="px-3 py-2 text-sm rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">Cancelar</button>
              <button type="submit" [disabled]="creating() || !form.name.trim()" class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                {{ creating() ? 'Creando…' : 'Crear' }}
              </button>
            </div>
          </form>
        </div>
      }
    </div>
  `,
})
export class PortalProjectsComponent implements OnInit {
  private portal = inject(ClientPortalService);

  view = signal<ViewMode>('kanban');
  searchText = signal<string>('');
  priorityFilter = signal<string | null>(null);
  loading = signal<boolean>(true);
  showCreate = signal<boolean>(false);
  creating = signal<boolean>(false);
  createError = signal<string | null>(null);

  projets = signal<Project[]>([]);
  stages = signal<Stage[]>([]);

  filtered = computed<Project[]>(() => {
    const q = this.searchText().toLowerCase().trim();
    const p = this.priorityFilter();
    return this.projets().filter((proj) => {
      if (q && !proj.name.toLowerCase().includes(q)) return false;
      if (p && proj.priority !== p) return false;
      return true;
    });
  });

  form = {
    name: '',
    description: '' as string | null,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    start_date: '' as string | null,
    end_date: '' as string | null,
  };

  async ngOnInit() {
    await Promise.all([this.loadProjects(), this.loadStages()]);
  }

  private async loadProjects() {
    this.loading.set(true);
    const { data } = await this.portal.listProjects();
    this.projets.set(data ?? []);
    this.loading.set(false);
  }

  private async loadStages() {
    const { data } = await this.portal.getStages();
    this.stages.set(data ?? []);
  }

  setView(v: ViewMode) {
    this.view.set(v);
  }

  onSearch(text: string) {
    this.searchText.set(text);
  }

  onPriority(p: string | null) {
    this.priorityFilter.set(p);
  }

  countAtStage(stageId: string | null | undefined): number {
    return this.filtered().filter((p) => (p.stage_id ?? null) === (stageId ?? null)).length;
  }

  projectsByStage(stageId: string | null | undefined): Project[] {
    return this.filtered().filter((p) => (p.stage_id ?? null) === (stageId ?? null));
  }

  stageName(stageId: string | null | undefined): string {
    if (!stageId) return '—';
    return this.stages().find((s) => s.id === stageId)?.name ?? '—';
  }

  priorityClass(p?: string | null): string {
    switch (p) {
      case 'critical': return 'bg-red-100 text-red-700';
      case 'high': return 'bg-orange-100 text-orange-700';
      case 'low': return 'bg-gray-100 text-gray-600';
      default: return 'bg-blue-100 text-blue-700';
    }
  }

  priorityLabel(p?: string | null): string {
    switch (p) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'low': return 'Baja';
      default: return 'Media';
    }
  }

  dotClass(p?: string | null): string {
    switch (p) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'low': return 'bg-gray-400';
      default: return 'bg-blue-500';
    }
  }

  toggleCreate() {
    this.showCreate.update((v) => !v);
    this.createError.set(null);
    if (!this.showCreate()) this.resetForm();
  }

  private resetForm() {
    this.form = { name: '', description: '', priority: 'medium', start_date: '', end_date: '' };
  }

  async onCreate() {
    if (!this.form.name.trim() || this.creating()) return;
    this.creating.set(true);
    this.createError.set(null);
    const { data, error } = await this.portal.createProject({
      name: this.form.name.trim(),
      description: this.form.description?.trim() || null,
      priority: this.form.priority,
      start_date: this.form.start_date || null,
      end_date: this.form.end_date || null,
    });
    this.creating.set(false);
    if (error || !data) {
      this.createError.set(error?.message || 'No se pudo crear el proyecto');
      return;
    }
    this.showCreate.set(false);
    this.resetForm();
    await this.loadProjects();
  }
}
