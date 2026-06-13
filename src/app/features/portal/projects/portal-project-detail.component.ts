import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
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

interface Task {
  id: string;
  title: string;
  is_completed: boolean;
  due_date?: string | null;
  assigned_to?: string | null;
  created_at: string;
}

@Component({
  selector: 'app-portal-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="max-w-4xl mx-auto p-4">
      <div class="mb-4">
        <a
          routerLink="/projects"
          class="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Volver a proyectos
        </a>
      </div>

      @if (loading()) {
        <div class="text-gray-600 dark:text-gray-400">Cargando proyecto…</div>
      } @else if (!project()) {
        <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8 text-center">
          <p class="text-gray-600 dark:text-gray-400">Proyecto no encontrado.</p>
        </div>
      } @else {
        <article class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
          <header class="flex items-start justify-between gap-3 mb-3">
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white flex-1">
              {{ project()!.name }}
            </h1>
            <span [class]="priorityClass(project()!.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {{ priorityLabel(project()!.priority) }}
            </span>
          </header>

          @if (project()!.description) {
            <p class="text-gray-700 dark:text-gray-300 mb-4 whitespace-pre-wrap">
              {{ project()!.description }}
            </p>
          }

          <dl class="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm mb-6">
            @if (project()!.start_date) {
              <div>
                <dt class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Inicio</dt>
                <dd class="text-gray-900 dark:text-white">{{ project()!.start_date | date }}</dd>
              </div>
            }
            @if (project()!.end_date) {
              <div>
                <dt class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Fin</dt>
                <dd class="text-gray-900 dark:text-white">{{ project()!.end_date | date }}</dd>
              </div>
            }
            <div>
              <dt class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">Creado</dt>
              <dd class="text-gray-900 dark:text-white">{{ project()!.created_at | date: 'short' }}</dd>
            </div>
          </dl>

          <section>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Tareas ({{ tasks().length }})
            </h2>
            @if (tasks().length === 0) {
              <p class="text-sm text-gray-500 dark:text-gray-400">
                No hay tareas todavía. El equipo de la empresa las añadirá.
              </p>
            } @else {
              <ul class="divide-y divide-gray-200 dark:divide-gray-700">
                @for (t of tasks(); track t.id) {
                  <li class="py-2 flex items-center gap-2">
                    <span
                      [class]="t.is_completed ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'"
                      class="flex-1"
                    >
                      {{ t.title }}
                    </span>
                    @if (t.due_date) {
                      <span class="text-xs text-gray-500">
                        {{ t.due_date | date }}
                      </span>
                    }
                  </li>
                }
              </ul>
            }
          </section>
        </article>
      }
    </div>
  `,
})
export class PortalProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private portal = inject(ClientPortalService);

  project = signal<Project | null>(null);
  tasks = signal<Task[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    const { data } = await this.portal.getProject(id);
    if (data) {
      this.project.set(data.project);
      this.tasks.set(data.tasks ?? []);
    }
    this.loading.set(false);
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
}
