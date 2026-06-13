import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';

interface Project {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

@Component({
  selector: 'app-portal-projects',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="max-w-6xl mx-auto p-4">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Proyectos</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Tus proyectos en la empresa actual.
          </p>
        </div>
        <button
          (click)="toggleCreate()"
          class="px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          {{ showCreate() ? 'Cancelar' : '+ Nuevo proyecto' }}
        </button>
      </div>

      @if (showCreate()) {
        <form
          (ngSubmit)="onCreate()"
          class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-6 space-y-3"
        >
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Nuevo proyecto</h2>
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Nombre *
            </label>
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
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Descripción
            </label>
            <textarea
              [(ngModel)]="form.description"
              name="description"
              rows="3"
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              placeholder="Detalles del proyecto"
            ></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Prioridad
              </label>
              <select
                [(ngModel)]="form.priority"
                name="priority"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              >
                <option value="low">Baja</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha de inicio
              </label>
              <input
                type="date"
                [(ngModel)]="form.start_date"
                name="start_date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fecha de fin
              </label>
              <input
                type="date"
                [(ngModel)]="form.end_date"
                name="end_date"
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          @if (createError()) {
            <p class="text-sm text-red-600">{{ createError() }}</p>
          }
          <div class="flex justify-end gap-2">
            <button
              type="button"
              (click)="toggleCreate()"
              class="px-3 py-2 text-sm rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              [disabled]="creating() || !form.name.trim()"
              class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {{ creating() ? 'Creando…' : 'Crear' }}
            </button>
          </div>
        </form>
      }

      @if (loading()) {
        <div class="text-gray-600 dark:text-gray-400">Cargando proyectos…</div>
      } @else if (projects().length === 0) {
        <div class="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center">
          <p class="text-gray-600 dark:text-gray-400 mb-2">No tienes proyectos todavía.</p>
          <p class="text-sm text-gray-500 dark:text-gray-500">
            Crea uno con el botón de arriba o espera a que el equipo te asigne uno.
          </p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          @for (p of projects(); track p.id) {
            <a
              [routerLink]="['/projects', p.id]"
              class="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
            >
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-semibold text-gray-900 dark:text-white truncate flex-1">
                  {{ p.name }}
                </h3>
                <span [class]="priorityClass(p.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                  {{ priorityLabel(p.priority) }}
                </span>
              </div>
              @if (p.description) {
                <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mt-1">
                  {{ p.description }}
                </p>
              }
              <div class="flex items-center gap-3 mt-3 text-xs text-gray-500">
                @if (p.start_date) {
                  <span>Inicio: {{ p.start_date | date }}</span>
                }
                @if (p.end_date) {
                  <span>· Fin: {{ p.end_date | date }}</span>
                }
                <span class="ml-auto">Creado {{ p.created_at | date: 'short' }}</span>
              </div>
            </a>
          }
        </div>
      }
    </div>
  `,
})
export class PortalProjectsComponent implements OnInit {
  private portal = inject(ClientPortalService);

  projects = signal<Project[]>([]);
  loading = signal<boolean>(true);
  showCreate = signal<boolean>(false);
  creating = signal<boolean>(false);
  createError = signal<string | null>(null);

  form = {
    name: '',
    description: '' as string | null,
    priority: 'medium' as 'low' | 'medium' | 'high' | 'critical',
    start_date: '' as string | null,
    end_date: '' as string | null,
  };

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    const { data } = await this.portal.getProjects();
    this.projects.set(data ?? []);
    this.loading.set(false);
  }

  toggleCreate() {
    this.showCreate.update((v) => !v);
    this.createError.set(null);
    if (!this.showCreate()) {
      this.resetForm();
    }
  }

  private resetForm() {
    this.form = {
      name: '',
      description: '',
      priority: 'medium',
      start_date: '',
      end_date: '',
    };
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
    await this.load();
  }

  priorityClass(p?: string | null): string {
    switch (p) {
      case 'critical':
        return 'bg-red-100 text-red-700';
      case 'high':
        return 'bg-orange-100 text-orange-700';
      case 'low':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-blue-100 text-blue-700';
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
}
