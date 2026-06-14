import { Component, Input, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PortalPropertiesProject {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  is_archived?: boolean | null;
  created_at?: string;
  stage_name?: string;
}

export interface PortalPropertiesStage {
  id: string;
  name: string;
  position: number;
}

@Component({
  selector: 'app-portal-project-dialog-properties',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full md:w-80 bg-gray-50/50 dark:bg-gray-900/20 p-6 md:p-8 space-y-6">
      <!-- Stage (read-only) -->
      <div>
        <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Estado</label>
        <div class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 shadow-sm">
          {{ stageName() }}
        </div>
      </div>

      <!-- Priority -->
      <div>
        <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prioridad</label>
        <div class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 shadow-sm">
          <span [ngClass]="priorityClass(project?.priority)" class="text-xs px-2 py-0.5 rounded-full font-medium">
            {{ priorityLabel(project?.priority) }}
          </span>
        </div>
      </div>

      <!-- Dates -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Inicio</label>
          <div class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 shadow-sm">
            {{ project?.start_date ? (project?.start_date | date: 'mediumDate') : '—' }}
          </div>
        </div>
        <div>
          <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Fin</label>
          <div class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 shadow-sm">
            {{ project?.end_date ? (project?.end_date | date: 'mediumDate') : '—' }}
          </div>
        </div>
      </div>

      <!-- Progreso -->
      <div>
        <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Progreso</label>
        <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div class="bg-blue-500 h-2 rounded-full transition-all duration-500" [style.width.%]="progress"></div>
        </div>
        <p class="text-xs text-gray-500 mt-1">{{ progress }}% ({{ completedCount }}/{{ totalCount }} tareas)</p>
      </div>

      <!-- Creado -->
      <div>
        <label class="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Creado</label>
        <div class="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 shadow-sm">
          {{ project?.created_at | date: 'longDate' }}
        </div>
      </div>

      <!-- Activity History slot -->
      <ng-content></ng-content>
    </div>
  `,
})
export class PortalProjectDialogPropertiesComponent {
  @Input() project: PortalPropertiesProject | null = null;
  @Input() stages: PortalPropertiesStage[] = [];
  @Input() totalCount = 0;
  @Input() completedCount = 0;

  get progress(): number {
    if (this.totalCount === 0) return 0;
    return Math.round((this.completedCount / this.totalCount) * 100);
  }

  stageName(): string {
    if (!this.project?.stage_id) return '—';
    const stage = this.stages.find((s) => s.id === this.project?.stage_id);
    return stage?.name ?? this.project.stage_name ?? '—';
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
}
