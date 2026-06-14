import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ClientPortalService } from '../../../../../core/services/client-portal.service';
import {
  PortalProjectDialogHeaderComponent,
  PortalDialogHeaderProject,
} from './components/portal-project-dialog-header.component';
import {
  PortalProjectDialogTabsNavComponent,
  PortalDialogTab,
} from './components/portal-project-dialog-tabs-nav.component';

type Tab = PortalDialogTab;

interface PortalTask {
  id: string;
  title: string;
  is_completed: boolean;
  due_date?: string | null;
  created_at?: string;
  position?: number;
}

interface PortalComment {
  id: string;
  user_id?: string | null;
  client_id?: string | null;
  content: string;
  created_at?: string;
}

interface PortalPermissions {
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

interface PortalDetail {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  is_archived?: boolean | null;
  created_at?: string;
}

@Component({
  selector: 'app-portal-project-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, PortalProjectDialogHeaderComponent, PortalProjectDialogTabsNavComponent],
  template: `
    <div class="h-full flex flex-col bg-white dark:bg-gray-800">
      @if (loading()) {
        <div class="p-8 text-center text-gray-500">Cargando proyecto…</div>
      } @else if (!project()) {
        <div class="p-8 text-center">
          <p class="text-gray-500 mb-2">Proyecto no encontrado.</p>
          <a routerLink="/projects" class="text-sm text-blue-600 dark:text-blue-400 hover:underline">← Volver a proyectos</a>
        </div>
      } @else {
        <!-- HEADER -->
        <app-portal-project-dialog-header
          [project]="project() as unknown as PortalDialogHeaderProject"
          (close)="goBack()"
        ></app-portal-project-dialog-header>

        <!-- TABS NAV -->
        <app-portal-project-dialog-tabs-nav
          [activeTab]="activeTab()"
          [tasksCount]="tasks().length"
          [commentsCount]="comments().length"
          [filesCount]="files().length"
          (tabChange)="setTab($event)"
        ></app-portal-project-dialog-tabs-nav>

        <!-- BODY -->
        <div class="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900">
          @switch (activeTab()) {
            @case ('details') {
              <div class="flex flex-col md:flex-row h-full">
                <!-- LEFT: Main content -->
                <div class="flex-1 p-6 md:p-8 space-y-8 border-r border-gray-100 dark:border-gray-700">
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Nombre</label>
                    <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ project()!.name }}</div>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Descripción</label>
                    <p class="text-base text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                      {{ project()!.description || 'Sin descripción.' }}
                    </p>
                  </div>

                  <!-- TASKS SECTION -->
                  <div>
                    <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3">Tareas</h3>
                    @if (tasks().length === 0) {
                      <p class="text-sm text-gray-500 dark:text-gray-400">No hay tareas todavía.</p>
                    } @else {
                      <ul class="space-y-2">
                        @for (t of tasks(); track t.id) {
                          <li class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                            <input
                              type="checkbox"
                              [checked]="t.is_completed"
                              (change)="toggleTask(t)"
                              [disabled]="!perms()?.client_can_complete_tasks"
                              class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                            />
                            <span
                              [class.line-through]="t.is_completed"
                              [class.text-gray-500]="t.is_completed"
                              class="flex-1 text-sm text-gray-900 dark:text-white"
                            >{{ t.title }}</span>
                            @if (t.due_date) {
                              <span class="text-xs text-gray-500">{{ t.due_date | date }}</span>
                            }
                          </li>
                        }
                      </ul>
                    }
                  </div>
                </div>

                <!-- RIGHT: Sidebar properties -->
                <div class="w-full md:w-80 p-6 space-y-6">
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prioridad</label>
                    <span [class]="priorityClass(project()!.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium">
                      {{ priorityLabel(project()!.priority) }}
                    </span>
                  </div>
                  @if (project()!.start_date) {
                    <div>
                      <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fecha de inicio</label>
                      <p class="text-sm text-gray-700 dark:text-gray-300">{{ project()!.start_date | date: 'longDate' }}</p>
                    </div>
                  }
                  @if (project()!.end_date) {
                    <div>
                      <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fecha de entrega</label>
                      <p class="text-sm text-gray-700 dark:text-gray-300">{{ project()!.end_date | date: 'longDate' }}</p>
                    </div>
                  }
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Progreso</label>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                      <div class="bg-blue-500 h-2 rounded-full transition-all duration-500" [style.width.%]="getProgress()"></div>
                    </div>
                    <p class="text-xs text-gray-500 mt-1">{{ getProgress() }}% ({{ completedCount() }}/{{ tasks().length }} tareas)</p>
                  </div>
                  <div>
                    <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Creado</label>
                    <p class="text-sm text-gray-700 dark:text-gray-300">{{ project()!.created_at | date: 'longDate' }}</p>
                  </div>
                </div>
              </div>
            }

            @case ('tasks') {
              <div class="max-w-3xl mx-auto p-6 space-y-4">
                @if (perms()?.client_can_create_tasks) {
                  <form (ngSubmit)="addTask()" class="flex gap-2">
                    <input
                      type="text"
                      [(ngModel)]="newTaskTitle"
                      name="newTaskTitle"
                      placeholder="Nueva tarea…"
                      class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                      [disabled]="addingTask()"
                    />
                    <button
                      type="submit"
                      [disabled]="addingTask() || !newTaskTitle.trim()"
                      class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {{ addingTask() ? 'Añadiendo…' : 'Añadir' }}
                    </button>
                  </form>
                }
                @if (tasks().length === 0) {
                  <p class="text-sm text-gray-500 dark:text-gray-400">No hay tareas todavía.</p>
                } @else {
                  <ul class="space-y-2">
                    @for (t of tasks(); track t.id) {
                      <li class="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                        <input
                          type="checkbox"
                          [checked]="t.is_completed"
                          (change)="toggleTask(t)"
                          [disabled]="!perms()?.client_can_complete_tasks"
                          class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span
                          [class.line-through]="t.is_completed"
                          [class.text-gray-500]="t.is_completed"
                          class="flex-1 text-sm text-gray-900 dark:text-white"
                        >{{ t.title }}</span>
                        @if (t.due_date) {
                          <span class="text-xs text-gray-500">{{ t.due_date | date }}</span>
                        }
                      </li>
                    }
                  </ul>
                }
                @if (taskError()) {
                  <p class="text-sm text-red-600">{{ taskError() }}</p>
                }
              </div>
            }

            @case ('comments') {
              <div class="max-w-3xl mx-auto p-6 space-y-4">
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
                      <button
                        type="submit"
                        [disabled]="addingComment() || !newComment.trim()"
                        class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                      >
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

            @case ('documents') {
              <div class="max-w-4xl mx-auto p-6 space-y-4">
                <p class="text-xs text-gray-500 dark:text-gray-400">Gestiona los archivos y carpetas del proyecto.</p>
                @if (files().length === 0) {
                  <div class="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-700">
                    <svg xmlns="http://www.w3.org/2000/svg" class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    </svg>
                    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">Carpeta vacía</p>
                  </div>
                } @else {
                  <ul class="space-y-2">
                    @for (f of files(); track f.id) {
                      <li class="flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3">
                        <div class="w-10 h-10 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-300 flex-shrink-0">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ f.name }}</p>
                          <p class="text-xs text-gray-500">{{ f.file_type || 'archivo' }} · {{ f.created_at | date }}</p>
                        </div>
                      </li>
                    }
                  </ul>
                }
              </div>
            }

            @case ('activity') {
              <div class="max-w-3xl mx-auto p-6">
                <p class="text-sm text-gray-500 dark:text-gray-400">El registro de actividad se muestra aquí. Por ahora, mira la pestaña de Comentarios para ver la actividad reciente.</p>
              </div>
            }
          }
        </div>
      }
    </div>
  `,
  styles: [],
})
export class PortalProjectDialogComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private portal = inject(ClientPortalService);

  loading = signal<boolean>(true);
  activeTab = signal<Tab>('details');

  project = signal<PortalDetail | null>(null);
  tasks = signal<PortalTask[]>([]);
  comments = signal<PortalComment[]>([]);
  files = signal<Array<{ id: string; name: string; file_type?: string | null; created_at?: string }>>([]);
  perms = signal<PortalPermissions | null>(null);

  newTaskTitle = '';
  addingTask = signal<boolean>(false);
  taskError = signal<string | null>(null);

  newComment = '';
  addingComment = signal<boolean>(false);

  completedCount = computed(() => this.tasks().filter((t) => t.is_completed).length);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    const { data } = await this.portal.getProjectDetail(id);
    if (data) {
      this.project.set(data.project as PortalDetail);
      this.tasks.set((data.tasks ?? []) as PortalTask[]);
      this.comments.set((data.comments ?? []) as PortalComment[]);
      this.files.set((data.files ?? []) as Array<{ id: string; name: string; file_type?: string | null; created_at?: string }>);
      this.perms.set(data.permissions as PortalPermissions);
    }
    this.loading.set(false);
  }

  setTab(t: Tab) {
    this.activeTab.set(t);
  }

  goBack() {
    window.history.back();
  }

  priorityClass(p?: string | null): string {
    switch (p) {
      case 'critical': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'low': return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
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

  getProgress(): number {
    const total = this.tasks().length;
    if (total === 0) return 0;
    return Math.round((this.completedCount() / total) * 100);
  }

  async toggleTask(t: PortalTask) {
    if (!this.perms()?.client_can_complete_tasks) return;
    const newState = !t.is_completed;
    t.is_completed = newState;
    this.tasks.set([...this.tasks()]);
    const { success } = await this.portal.updateTask(this.project()!.id, t.id, { is_completed: newState });
    if (!success) {
      t.is_completed = !newState;
      this.tasks.set([...this.tasks()]);
    }
  }

  async addTask() {
    const title = this.newTaskTitle.trim();
    if (!title) return;
    this.addingTask.set(true);
    this.taskError.set(null);
    const { data, error } = await this.portal.createTask(this.project()!.id, { title });
    this.addingTask.set(false);
    if (data) {
      this.tasks.set([...this.tasks(), data as PortalTask]);
      this.newTaskTitle = '';
    } else {
      this.taskError.set(error?.message || 'No se pudo crear la tarea');
    }
  }

  async addComment() {
    const content = this.newComment.trim();
    if (!content) return;
    this.addingComment.set(true);
    const { data, error } = await this.portal.addComment(this.project()!.id, content);
    this.addingComment.set(false);
    if (data) {
      this.comments.set([...this.comments(), data as PortalComment]);
      this.newComment = '';
    } else {
      alert(error?.message || 'No se pudo agregar el comentario');
    }
  }
}
