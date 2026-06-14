import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export type PortalDialogTab = 'details' | 'tasks' | 'comments' | 'documents' | 'activity';

@Component({
  selector: 'app-portal-project-dialog-tabs-nav',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="px-6 border-b border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 flex space-x-6 overflow-x-auto"
    >
      @for (tab of tabs; track tab.key) {
        <button
          (click)="tabChange.emit(tab.key)"
          class="py-3 text-sm font-medium border-b-2 transition-colors relative flex items-center space-x-2 whitespace-nowrap"
          [ngClass]="
            activeTab === tab.key
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          "
        >
          <span>{{ tab.label }}</span>
          @if (getCount(tab.key) > 0) {
            <span
              class="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs py-0.5 px-2 rounded-full"
              >{{ getCount(tab.key) }}</span
            >
          }
        </button>
      }
    </div>
  `,
})
export class PortalProjectDialogTabsNavComponent {
  @Input() activeTab: PortalDialogTab = 'details';
  @Input() tasksCount = 0;
  @Input() commentsCount = 0;
  @Input() filesCount = 0;
  @Output() tabChange = new EventEmitter<PortalDialogTab>();

  tabs: Array<{ key: PortalDialogTab; label: string }> = [
    { key: 'details', label: 'Detalles' },
    { key: 'tasks', label: 'Tareas' },
    { key: 'comments', label: 'Comentarios' },
    { key: 'documents', label: 'Documentos' },
    { key: 'activity', label: 'Actividad' },
  ];

  getCount(tab: PortalDialogTab): number {
    switch (tab) {
      case 'tasks': return this.tasksCount;
      case 'comments': return this.commentsCount;
      case 'documents': return this.filesCount;
      default: return 0;
    }
  }
}
