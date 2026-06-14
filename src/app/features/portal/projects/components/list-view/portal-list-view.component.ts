import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

export interface PortalListProject {
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
}

export interface PortalListStage {
  id: string;
  name: string;
  position: number;
}

@Component({
  selector: 'app-portal-list-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-list-view.component.html',
  styleUrl: './portal-list-view.component.scss',
})
export class PortalListViewComponent {
  @Input() projects: PortalListProject[] = [];
  @Input() stages: PortalListStage[] = [];
  @Output() projectClick = new EventEmitter<PortalListProject>();

  sortColumn: string = 'created_at';
  sortDirection: 'asc' | 'desc' = 'desc';

  constructor(private router: Router) {}

  get sortedProjects() {
    return [...this.projects].sort((a, b) => {
      const valA = this.getSortValue(a, this.sortColumn);
      const valB = this.getSortValue(b, this.sortColumn);

      if (valA < valB) return this.sortDirection === 'asc' ? -1 : 1;
      if (valA > valB) return this.sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  getSortValue(project: PortalListProject, column: string): any {
    switch (column) {
      case 'name': return (project.name || '').toLowerCase();
      case 'client': return project.client_name || '';
      case 'status': return this.getStageName(project.stage_id);
      case 'priority': return this.getPriorityWeight(project.priority);
      case 'start_date': return project.start_date || '';
      case 'end_date': return project.end_date || '';
      case 'progress': return this.getProgress(project);
      default: return project.created_at || '';
    }
  }

  toggleSort(column: string) {
    if (this.sortColumn === column) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColumn = column;
      this.sortDirection = 'asc';
    }
  }

  getStageName(stageId?: string | null): string {
    if (!stageId) return '-';
    const stage = this.stages.find((s) => s.id === stageId);
    return stage ? stage.name : '-';
  }

  getPriorityWeight(priority?: string | null): number {
    switch (priority) {
      case 'critical': return 4;
      case 'high': return 3;
      case 'medium': return 2;
      case 'low': return 1;
      default: return 0;
    }
  }

  getPriorityLabel(priority?: string | null): string {
    switch (priority) {
      case 'critical': return 'Crítica';
      case 'high': return 'Alta';
      case 'medium': return 'Media';
      case 'low': return 'Baja';
      default: return '-';
    }
  }

  getPriorityColor(priority?: string | null): string {
    switch (priority) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      case 'medium': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'low': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  }

  getProgress(project: PortalListProject): number {
    if (!project.tasks_count) return 0;
    return Math.round(((project.completed_tasks_count || 0) / project.tasks_count) * 100);
  }

  onRowClick(project: PortalListProject) {
    this.projectClick.emit(project);
    this.router.navigate(['/projects', project.id]);
  }
}
