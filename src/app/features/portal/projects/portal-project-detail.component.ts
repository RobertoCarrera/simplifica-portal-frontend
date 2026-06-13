import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';

type Tab = 'details' | 'tasks' | 'comments' | 'activity' | 'documents';

interface ProjectDetail {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  is_archived?: boolean | null;
  created_at: string;
  updated_at: string;
}

interface ProjectTask {
  id: string;
  project_id: string;
  title: string;
  is_completed: boolean;
  due_date?: string | null;
  assigned_to?: string | null;
  position?: number | null;
  created_at: string;
  updated_at: string;
}

interface ProjectComment {
  id: string;
  user_id: string | null;
  client_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
}

interface ProjectFile {
  id: string;
  name: string;
  file_type?: string | null;
  size?: number | null;
  created_at: string;
  created_by?: string | null;
}

interface Permissions {
  client_can_create_tasks: boolean;
  client_can_edit_tasks: boolean;
  client_can_delete_tasks: boolean;
  client_can_assign_tasks: boolean;
  client_can_complete_tasks: boolean;
  client_can_comment: boolean;
  client_can_view_all_comments: boolean;
  client_can_edit_project: boolean;
  client_can_move_stage: boolean;
}

@Component({
  selector: 'app-portal-project-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      @if (loading()) {
        <div class="p-6 text-gray-600 dark:text-gray-400">Cargando proyecto…</div>
      } @else if (!project()) {
        <div class="p-8 text-center">
          <p class="text-gray-600 dark:text-gray-400 mb-2">Proyecto no encontrado.</p>
          <a routerLink="/projects" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Volver a proyectos</a>
        </div>
      } @else {
        <!-- Header -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
          <a routerLink="/projects" class="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-1 inline-block">← Volver a proyectos</a>
          <div class="flex items-start justify-between gap-3">
            <div class="flex-1">
              <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ project()!.name }}</h1>
              @if (project()!.description) {
                <p class="text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{{ project()!.description }}</p>
              }
            </div>
            <span [class]="priorityClass(project()!.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {{ priorityLabel(project()!.priority) }}
            </span>
          </div>
        </div>

        <!-- Tabs nav -->
        <div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div class="px-6 flex gap-1 overflow-x-auto">
            @for (t of tabsList; track t.key) {
              <button
                (click)="setTab(t.key)"
                [class.text-blue-600]="activeTab() === t.key"
                [class.border-blue-600]="activeTab() === t.key"
                [class.dark:text-blue-400]="activeTab() === t.key"
                [class.dark:border-blue-400]="activeTab() === t.key"
                [class.text-gray-500]="activeTab() !== t.key"
                [class.border-transparent]="activeTab() !== t.key"
                class="px-4 py-3 text-sm font-medium border-b-2 transition-colors hover:text-gray-700 dark:hover:text-gray-200 whitespace-nowrap"
              >
                {{ t.label }}
                @if (t.count !== undefined) {
                  <span class="ml-1 text-xs text-gray-500">({{ t.count }})</span>
                }
              </button>
            }
          </div>
        </div>

        <!-- Tab content -->
        <div class="flex-1 overflow-y-auto p-6">
          @switch (activeTab()) {
            @case ('details') {
              <div class="max-w-3xl space-y-4">
                <div>
                  <h2 class="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</h2>
                  <p class="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{{ project()!.description || '—' }}</p>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <dt class="text-xs text-gray-500 uppercase tracking-wide">Prioridad</dt>
                    <dd class="mt-1">
                      <span [class]="priorityClass(project()!.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                        {{ priorityLabel(project()!.priority) }}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-gray-500 uppercase tracking-wide">Inicio</dt>
                    <dd class="mt-1 text-gray-900 dark:text-white">{{ project()!.start_date | date }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-gray-500 uppercase tracking-wide">Fin</dt>
                    <dd class="mt-1 text-gray-900 dark:text-white">{{ project()!.end_date | date }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-gray-500 uppercase tracking-wide">Creado</dt>
                    <dd class="mt-1 text-gray-900 dark:text-white">{{ project()!.created_at | date: 'short' }}</dd>
                  </div>
                </div>
              </div>
            }

            @case ('tasks') {
              <div class="max-w-3xl">
                @if (perms()?.client_can_create_tasks) {
                  <form (ngSubmit)="addTask()" class="mb-4 flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="newTaskTitle"
                      name="newTaskTitle"
                      maxlength="200"
                      placeholder="Nueva tarea…"
                      class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      [disabled]="addingTask()"
                    />
                    <input
                      type="date"
                      [(ngModel)]="newTaskDue"
                      name="newTaskDue"
                      class="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                    />
                    <button type="submit" [disabled]="addingTask() || !newTaskTitle.trim()" class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                      Añadir
                    </button>
                  </form>
                }
                @if (tasks().length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">No hay tareas todavía.</p>
                } @else {
                  <ul class="space-y-1">
                    @for (t of tasks(); track t.id) {
                      <li class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                        <input
                          type="checkbox"
                          [checked]="t.is_completed"
                          (change)="toggleTask(t)"
                          [disabled]="!perms()?.client_can_complete_tasks"
                          class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span [class.line-through]="t.is_completed" [class.text-gray-500]="t.is_completed" class="flex-1 text-sm text-gray-900 dark:text-white">
                          {{ t.title }}
                        </span>
                        @if (t.due_date) {
                          <span class="text-xs text-gray-500">{{ t.due_date | date }}</span>
                        }
                        @if (perms()?.client_can_delete_tasks) {
                          <button (click)="deleteTask(t)" class="text-xs text-red-500 hover:text-red-700">Eliminar</button>
                        }
                      </li>
                    }
                  </ul>
                }
                @if (taskError()) {
                  <p class="text-sm text-red-600 mt-2">{{ taskError() }}</p>
                }
              </div>
            }

            @case ('comments') {
              <div class="max-w-3xl space-y-4">
                @if (perms()?.client_can_comment) {
                  <form (ngSubmit)="addComment()" class="space-y-2">
                    <textarea
                      [(ngModel)]="newComment"
                      name="newComment"
                      rows="3"
                      placeholder="Escribe un comentario…"
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      [disabled]="addingComment()"
                    ></textarea>
                    <div class="flex justify-end">
                      <button type="submit" [disabled]="addingComment() || !newComment.trim()" class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
                        {{ addingComment() ? 'Enviando…' : 'Comentar' }}
                      </button>
                    </div>
                  </form>
                }
                @if (comments().length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">No hay comentarios todavía.</p>
                } @else {
                  <ul class="space-y-3">
                    @for (c of comments(); track c.id) {
                      <li class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <p class="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{{ c.content }}</p>
                        <p class="text-xs text-gray-500 mt-1">
                          {{ c.user_id ? 'Equipo' : 'Tú' }} · {{ c.created_at | date: 'short' }}
                        </p>
                      </li>
                    }
                  </ul>
                }
              </div>
            }

            @case ('activity') {
              <div class="max-w-3xl">
                <p class="text-sm text-gray-500 dark:text-gray-400">El registro de actividad se muestra aquí. Por ahora, mira la pestaña de Comentarios para ver la actividad reciente.</p>
              </div>
            }

            @case ('documents') {
              <div class="max-w-3xl">
                @if (files().length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">No hay documentos adjuntos a este proyecto.</p>
                } @else {
                  <ul class="space-y-2">
                    @for (f of files(); track f.id) {
                      <li class="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <div class="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                          </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ f.name }}</p>
                          <p class="text-xs text-gray-500">{{ f.file_type || 'archivo' }} · {{ f.size || '—' }} · {{ f.created_at | date }}</p>
                        </div>
                      </li>
                    }
                  </ul>
                }
              </div>
            }
          }
        </div>
      }
    </div>
  `,
})
export class PortalProjectDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private portal = inject(ClientPortalService);

  activeTab = signal<Tab>('details');
  loading = signal<boolean>(true);

  project = signal<ProjectDetail | null>(null);
  tasks = signal<ProjectTask[]>([]);
  comments = signal<ProjectComment[]>([]);
  files = signal<ProjectFile[]>([]);
  perms = signal<Permissions | null>(null);

  // Task form
  newTaskTitle = '';
  newTaskDue: string | null = null;
  addingTask = signal<boolean>(false);
  taskError = signal<string | null>(null);

  // Comment form
  newComment = '';
  addingComment = signal<boolean>(false);

  tabsList: { key: Tab; label: string; count?: number }[] = [];

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    const { data } = await this.portal.getProjectDetail(id);
    if (data) {
      this.project.set(data.project);
      this.tasks.set(data.tasks ?? []);
      this.comments.set(data.comments ?? []);
      this.files.set(data.files ?? []);
      this.perms.set(data.permissions ?? null);
      this.rebuildTabs();
    }
    this.loading.set(false);
  }

  private rebuildTabs() {
    this.tabsList = [
      { key: 'details', label: 'Detalles' },
      { key: 'tasks', label: 'Tareas', count: this.tasks().length },
      { key: 'comments', label: 'Comentarios', count: this.comments().length },
      { key: 'activity', label: 'Actividad' },
      { key: 'documents', label: 'Documentos', count: this.files().length },
    ];
  }

  setTab(t: Tab) {
    this.activeTab.set(t);
  }

  async toggleTask(t: ProjectTask) {
    if (!this.perms()?.client_can_complete_tasks) return;
    const { success, error } = await this.portal.updateTask(this.project()!.id, t.id, { is_completed: !t.is_completed });
    if (success) {
      this.tasks.update((list) => list.map((x) => (x.id === t.id ? { ...x, is_completed: !t.is_completed } : x)));
      this.rebuildTabs();
    } else {
      this.taskError.set(error?.message || 'No se pudo actualizar la tarea');
    }
  }

  async addTask() {
    const title = this.newTaskTitle.trim();
    if (!title) return;
    this.addingTask.set(true);
    this.taskError.set(null);
    const { data, error } = await this.portal.createTask(this.project()!.id, {
      title,
      due_date: this.newTaskDue || null,
    });
    this.addingTask.set(false);
    if (data) {
      this.tasks.update((list) => [...list, data]);
      this.newTaskTitle = '';
      this.newTaskDue = null;
      this.rebuildTabs();
    } else {
      this.taskError.set(error?.message || 'No se pudo crear la tarea');
    }
  }

  async deleteTask(t: ProjectTask) {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const { success } = await this.portal.deleteTask(this.project()!.id, t.id);
    if (success) {
      this.tasks.update((list) => list.filter((x) => x.id !== t.id));
      this.rebuildTabs();
    }
  }

  async addComment() {
    const content = this.newComment.trim();
    if (!content) return;
    this.addingComment.set(true);
    const { data, error } = await this.portal.addComment(this.project()!.id, content);
    this.addingComment.set(false);
    if (data) {
      this.comments.update((list) => [...list, data]);
      this.newComment = '';
      this.rebuildTabs();
    } else {
      alert(error?.message || 'No se pudo agregar el comentario');
    }
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
