import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';

export interface PortalProjectCardData {
  id: string;
  name: string;
  description?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  start_date?: string | null;
  end_date?: string | null;
  stage_id?: string | null;
  is_archived?: boolean | null;
  client_name?: string | null;
  tasks_count?: number;
  completed_tasks_count?: number;
  top_tasks?: Array<{ id: string; title: string; is_completed: boolean }>;
  unread_count?: number;
  created_at: string;
  updated_at: string;
}

/**
 * PortalProjectCardComponent — a visual clone of the CRM's
 * project-card.component.ts, scoped to what the portal client is allowed
 * to see and do:
 *   - No archive / approve buttons (owner/admin only in the CRM).
 *   - No stage move UI (the portal client does not have client_can_move_stage).
 *   - Tasks inside the card are read-only previews; toggling happens in the
 *     detail tab.
 *
 * Layout is intentionally 1:1 with the CRM so the two apps feel like the
 * same product on different sides of the auth boundary.
 */
@Component({
  selector: 'app-portal-project-card',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
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
          {{ priorityLabel(project.priority) }}
        </span>
      </div>

      <!-- Project Title -->
      <h3
        class="font-bold text-gray-900 dark:text-white text-base mb-1 leading-tight line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
      >
        {{ project.name || 'Sin nombre' }}
      </h3>

      <!-- Client Name (portal version: we show "Mi proyecto" since the
           client only ever sees their own projects) -->
      <div class="flex items-center text-xs text-gray-500 dark:text-gray-400 mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 mr-1.5 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
        </svg>
        <span class="truncate">{{ project.client_name || 'Mi proyecto' }}</span>
      </div>

      <!-- Progress Bar -->
      <div class="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mb-4 overflow-hidden">
        <div
          class="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
          [style.width.%]="progress()"
        ></div>
      </div>

      <!-- Top tasks preview (read-only in the card; toggling happens in detail) -->
      @if (topTasks().length > 0) {
        <div class="mb-3 space-y-1.5">
          @for (task of topTasks(); track task.id) {
            <div class="flex items-start group/task">
              <div
                class="mt-0.5 mr-2 flex-shrink-0 text-gray-400 dark:text-gray-500"
              >
                @if (!task.is_completed) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2"/>
                  </svg>
                }
                @if (task.is_completed) {
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                  </svg>
                }
              </div>
              <span
                class="text-xs text-gray-600 dark:text-gray-300 line-through-hover decoration-gray-400 truncate"
              >{{ task.title }}</span>
            </div>
          }
        </div>
      }

      <!-- Footer: tasks count + days remaining -->
      <div
        class="flex items-center justify-between pt-2 border-t border-gray-50 dark:border-gray-700/50"
      >
        <div class="flex items-center text-xs font-medium" [ngClass]="taskStatusClass()">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span>{{ project.completed_tasks_count || 0 }}/{{ project.tasks_count || 0 }}</span>
        </div>

        @if (project.end_date) {
          <div class="flex items-center text-xs">
            <span [ngClass]="daysRemaining().class">
              {{ daysRemaining().text }}
            </span>
          </div>
        }
      </div>
    </div>
  `,
})
export class PortalProjectCardComponent {
  @Input({ required: true }) project!: PortalProjectCardData;
  @Output() cardClick = new EventEmitter<PortalProjectCardData>();

  // Mirror the CRM's "unread comments" badge. The portal does not yet
  // count unread comments, so we expose this as a signal the parent can
  // drive if it ever wants to. Default to 0 keeps the badge hidden.
  unreadCount = signal<number>(0);

  // The card itself is read-only in the portal (toggling tasks happens in
  // the detail tab). We do not emit a click event from the card — the
  // entire card is wrapped in a routerLink by the parent.

  topTasks = computed(() => {
    return (this.project.top_tasks ?? [])
      .filter((t) => !t.is_completed)
      .sort((a, b) => (a.title > b.title ? 1 : -1))
      .slice(0, 5);
  });

  progress = computed(() => {
    const total = this.project.tasks_count ?? 0;
    if (total === 0) return 0;
    return Math.round(((this.project.completed_tasks_count ?? 0) / total) * 100);
  });

  taskStatusClass = computed(() => {
    const p = this.progress();
    if (p === 100) return 'text-green-600 dark:text-green-400';
    if (p > 0) return 'text-blue-600 dark:text-blue-400';
    return 'text-gray-400 dark:text-gray-500';
  });

  priorityLabel(p?: string | null): string {
    switch (p) {
      case 'low': return 'Baja';
      case 'medium': return 'Media';
      case 'high': return 'Alta';
      case 'critical': return 'Crítica';
      default: return 'Normal';
    }
  }

  daysRemaining = computed<{ text: string; class: string }>(() => {
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

    // 1. Late (Overdue) — wine color, matches the CRM
    if (diffDays < 0) {
      return {
        text: `${Math.abs(diffDays)}d retraso`,
        class: 'text-white bg-[#722F37] dark:bg-[#5D242B] px-2 py-0.5 rounded font-bold',
      };
    }

    // 2. Not started or invalid duration
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

    // 3. Percentage remaining
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
  });
}
