import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PortalDialogHeaderProject {
  id: string;
  name: string;
  description?: string | null;
  priority?: string | null;
}

@Component({
  selector: 'app-portal-project-dialog-header',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-white dark:bg-gray-800"
    >
      <div class="flex items-center space-x-2 min-w-0 flex-1">
        <span
          class="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-md text-blue-600 dark:text-blue-400 flex-shrink-0"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
        </span>
        <span class="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">
          {{ project?.name || 'Proyecto' }}
        </span>
        @if (project?.priority) {
          <span
            class="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider border flex-shrink-0"
            [ngClass]="{
              'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20':
                project?.priority === 'low',
              'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20':
                project?.priority === 'medium',
              'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20':
                project?.priority === 'high',
              'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20':
                project?.priority === 'critical',
            }"
          >
            {{ priorityLabel(project?.priority) }}
          </span>
        }
      </div>
      <button
        (click)="close.emit()"
        class="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 flex-shrink-0"
        title="Cerrar"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  `,
})
export class PortalProjectDialogHeaderComponent {
  @Input() project: PortalDialogHeaderProject | null = null;
  @Output() close = new EventEmitter<void>();

  priorityLabel(p?: string | null): string {
    switch (p) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'low': return 'Baja';
      default: return 'Media';
    }
  }
}
