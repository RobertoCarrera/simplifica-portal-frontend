import { Component, Input, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClientPortalService } from '../../../../../core/services/client-portal.service';

export interface PortalProjectCardData {
  id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  stage_id?: string | null;
  position?: number | null;
  is_archived?: boolean | null;
  created_at?: string;
  client_name?: string;
  tasks_count?: number;
  completed_tasks_count?: number;
  top_tasks?: Array<{ id: string; title: string; is_completed: boolean; position?: number }>;
  unread_count?: number;
}

@Component({
  selector: 'app-portal-project-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="group project-card bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-md hover:border-blue-200 dark:hover:border-blue-500/30 transition-all duration-200 relative overflow-hidden"
    >
      <!-- Unread Badge -->
      @if (unreadCount() > 0) {
        <div
          class="absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-sm z-10 animate-pulse"
        >
          {{ unreadCount() }}
        </div>
      }

      <!-- Priority Badge -->
      <div class="flex justify-between items-start mb-3">
        <span
          class="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider border"
          [ngClass]="{
            'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20':
              !project.priority || project.priority === 'low',
            'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20':
              project.priority === 'medium',
            'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20':
              project.priority === 'high',
            'bg-red-50 text-red-600 border-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20':
              project.priority === 'critical',
          }"
        >
          {{ getPriorityLabel(project.priority) }}
        </span>
      </div>

      <!-- Project Title -->
      <h3
        class="font-bold text-gray-900 dark:text-white text-base mb-1 leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
      >
        {{ project.name || 'Sin nombre' }}
      </h3>

      <!-- Client Name -->
      <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 mr-1.5 opacity-70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
        <span class="truncate">{{ getClientName() }}</span>
      </div>

      <!-- Progress Bar -->
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
        <div
          class="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
          [style.width.%]="getProgress()"
        ></div>
      </div>

      <!-- Top Tasks -->
      @if (topTasks.length > 0) {
        <div class="mb-3 space-y-1.5">
          @for (task of topTasks; track task.id) {
            <div
              class="flex items-start group/task cursor-pointer"
              (click)="toggleTask($event, task)"
            >
              <div
                class="mt-0.5 mr-2 flex-shrink-0 text-gray-400 dark:text-gray-500 group-hover/task:text-blue-500 transition-colors"
              >
                @if (!task.is_completed) {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2" />
                  </svg>
                }
                @if (task.is_completed) {
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4 text-green-500"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fill-rule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clip-rule="evenodd"
                    />
                  </svg>
                }
              </div>
              <span
                class="text-xs text-gray-600 dark:text-gray-300 truncate"
                [class.line-through]="task.is_completed"
                [class.text-gray-400]="task.is_completed"
                >{{ task.title }}</span
              >
            </div>
          }
        </div>
      }

      <!-- Footer: Tasks & Date -->
      <div
        class="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50"
      >
        <div class="flex items-center text-xs font-medium" [ngClass]="getTaskStatusClass()">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 mr-1.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{{ project.completed_tasks_count || 0 }}/{{ project.tasks_count || 0 }}</span>
        </div>

        @if (project.end_date) {
          <div class="flex items-center text-xs">
            <span [ngClass]="getDaysRemaining().class">
              {{ getDaysRemaining().text }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
  styles: [],
})
export class PortalProjectCardComponent implements OnInit {
  @Input() project!: PortalProjectCardData;

  private portal = inject(ClientPortalService);
  unreadCount = signal(0);

  ngOnInit() {
    this.unreadCount.set(this.project.unread_count || 0);
  }

  get topTasks(): Array<{ id: string; title: string; is_completed: boolean; position?: number }> {
    if (!this.project.top_tasks) return [];
    return [...this.project.top_tasks]
      .filter((t) => !t.is_completed)
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .slice(0, 5);
  }

  getClientName(): string {
    return this.project.client_name || 'Mi proyecto';
  }

  getProgress(): number {
    if (!this.project.tasks_count || this.project.tasks_count === 0) return 0;
    return Math.round(((this.project.completed_tasks_count || 0) / this.project.tasks_count) * 100);
  }

  getTaskStatusClass(): string {
    const progress = this.getProgress();
    if (progress === 100) return 'text-green-600 dark:text-green-400';
    if (progress > 0) return 'text-blue-600 dark:text-blue-400';
    return 'text-gray-400 dark:text-gray-500';
  }

  getPriorityLabel(priority?: string | null): string {
    switch (priority) {
      case 'low': return 'Baja';
      case 'medium': return 'Media';
      case 'high': return 'Alta';
      case 'critical': return 'Crítica';
      default: return 'Normal';
    }
  }

  getDaysRemaining(): { text: string; class: string } {
    if (!this.project.end_date) return { text: '', class: '' };

    const end = new Date(this.project.end_date);
    const start = this.project.start_date
      ? new Date(this.project.start_date)
      : new Date(this.project.created_at || new Date());
    const today = new Date();

    end.setHours(23, 59, 59, 999);
    start.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const totalDuration = end.getTime() - start.getTime();
    const elapsedTime = today.getTime() - start.getTime();
    const timeRemaining = end.getTime() - today.getTime();
    const diffDays = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)}d retraso`,
        class: 'text-white bg-[#722F37] dark:bg-[#5D242B] px-2 py-0.5 rounded font-bold',
      };
    }

    if (totalDuration <= 0) {
      if (diffDays === 0)
        return {
          text: 'Hoy',
          class: 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 px-2 py-0.5 rounded font-bold',
        };
      return {
        text: `${diffDays} días`,
        class: 'text-gray-500 bg-gray-50 dark:bg-gray-700/50 px-2 py-0.5 rounded',
      };
    }

    const percentUsed = Math.max(0, Math.min(100, (elapsedTime / totalDuration) * 100));
    const percentRemaining = 100 - percentUsed;

    let colorClass = '';

    if (diffDays === 0) {
      colorClass = 'text-red-600 bg-red-50 dark:bg-red-900/30 font-bold';
      return { text: 'Hoy', class: `${colorClass} px-2 py-0.5 rounded` };
    }

    if (percentRemaining < 10) {
      colorClass = 'text-red-600 bg-red-50 dark:bg-red-900/30 font-bold';
    } else if (percentRemaining < 25) {
      colorClass = 'text-orange-600 bg-orange-50 dark:bg-orange-900/30 font-medium';
    } else if (percentRemaining < 50) {
      colorClass = 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 font-medium';
    } else {
      colorClass = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 font-medium';
    }

    return { text: `${diffDays} días`, class: `${colorClass} px-2 py-0.5 rounded` };
  }

  async toggleTask(event: MouseEvent, task: { id: string; is_completed: boolean }) {
    event.stopPropagation();
    const newState = !task.is_completed;
    task.is_completed = newState;
    if (newState) {
      this.project.completed_tasks_count = (this.project.completed_tasks_count || 0) + 1;
    } else {
      this.project.completed_tasks_count = Math.max(0, (this.project.completed_tasks_count || 0) - 1);
    }
    const { success } = await this.portal.updateTask(this.project.id, task.id, { is_completed: newState });
    if (!success) {
      // revert
      task.is_completed = !newState;
      if (newState) {
        this.project.completed_tasks_count = Math.max(0, (this.project.completed_tasks_count || 0) - 1);
      } else {
        this.project.completed_tasks_count = (this.project.completed_tasks_count || 0) + 1;
      }
    }
  }
}
