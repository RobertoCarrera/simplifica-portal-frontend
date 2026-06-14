import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ClientPortalService, PortalProjectListItem } from '../../../../core/services/client-portal.service';
import { PortalKanbanBoardComponent, PortalKanbanStage } from '../kanban-board/portal-kanban-board.component';
import { PortalTimelineViewComponent, PortalProjectTimeline } from '../components/timeline-view/portal-timeline-view.component';
import { PortalListViewComponent, PortalListProject, PortalListStage } from '../components/list-view/portal-list-view.component';

@Component({
  selector: 'app-portal-projects',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    PortalKanbanBoardComponent,
    PortalTimelineViewComponent,
    PortalListViewComponent,
  ],
  templateUrl: './portal-projects.component.html',
  styleUrl: './portal-projects.component.scss',
})
export class PortalProjectsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private portal = inject(ClientPortalService);

  currentView: 'kanban' | 'timeline' | 'list' = 'kanban';

  projects = signal<PortalProjectListItem[]>([]);
  stages = signal<PortalKanbanStage[]>([]);
  loading = signal<boolean>(true);

  searchText = '';
  selectedPriority: string | null = null;
  selectedDeadline: string | null = null;

  filteredProjects = computed<PortalProjectListItem[]>(() => {
    const all = this.projects();
    return all.filter((p) => {
      const matchesSearch =
        !this.searchText ||
        p.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(this.searchText.toLowerCase()));
      const matchesPriority = !this.selectedPriority || p.priority === this.selectedPriority;
      const matchesDeadline = !this.selectedDeadline || this.checkDeadline(p, this.selectedDeadline);
      return matchesSearch && matchesPriority && matchesDeadline;
    });
  });

  ngOnInit() {
    this.loadData();
    this.route.queryParams.subscribe((params) => {
      if (params['view'] === 'timeline' || params['view'] === 'list' || params['view'] === 'kanban') {
        this.currentView = params['view'];
      }
    });
  }

  async loadData() {
    this.loading.set(true);
    const projRes = await this.portal.listProjects();
    const stagesRes = await this.portal.getStages();
    if (projRes.data) this.projects.set(projRes.data as PortalProjectListItem[]);
    if (stagesRes.data) {
      this.stages.set(
        (stagesRes.data as Array<{ id: string; name: string; position: number }>).map((s) => ({
          id: s.id,
          name: s.name,
          position: s.position,
        })),
      );
    }
    this.loading.set(false);
  }

  toggleView(view: 'kanban' | 'timeline' | 'list') {
    this.currentView = view;
  }

  clearFilters() {
    this.searchText = '';
    this.selectedPriority = null;
    this.selectedDeadline = null;
  }

  hasFilters(): boolean {
    return !!this.searchText || !!this.selectedPriority || !!this.selectedDeadline;
  }

  private checkDeadline(project: PortalProjectListItem, filter: string): boolean {
    if (!project.end_date) return false;
    const date = new Date(project.end_date);
    date.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (filter) {
      case 'overdue':
        return date < today;
      case 'today':
        return date.getTime() === today.getTime();
      case 'week': {
        const nextWeek = new Date(today);
        nextWeek.setDate(today.getDate() + 7);
        return date >= today && date <= nextWeek;
      }
      case 'month': {
        const nextMonth = new Date(today);
        nextMonth.setDate(today.getDate() + 30);
        return date >= today && date <= nextMonth;
      }
      default:
        return true;
    }
  }

  // Casters to feed child components with the shape they expect
  asTimelineProject(p: PortalProjectListItem): PortalProjectTimeline {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      start_date: p.start_date,
      end_date: p.end_date,
      priority: p.priority,
      position: p.position,
      is_archived: p.is_archived,
      created_at: p.created_at,
      client_name: p.client_name,
    };
  }

  asListProject(p: PortalProjectListItem): PortalListProject {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      start_date: p.start_date,
      end_date: p.end_date,
      priority: p.priority,
      stage_id: p.stage_id,
      position: p.position,
      is_archived: p.is_archived,
      created_at: p.created_at,
      client_name: p.client_name,
      tasks_count: p.tasks_count,
      completed_tasks_count: p.completed_tasks_count,
    };
  }

  asListStage(s: PortalKanbanStage): PortalListStage {
    return { id: s.id, name: s.name, position: s.position };
  }
}
