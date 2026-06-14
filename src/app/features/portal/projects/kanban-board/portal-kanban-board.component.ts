import { Component, Input, OnChanges, OnInit, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { PortalProjectCardComponent, PortalProjectCardData } from '../components/project-card/portal-project-card.component';

export interface PortalKanbanStage {
  id: string;
  name: string;
  position: number;
  is_review?: boolean;
  is_default?: boolean;
  is_landing?: boolean;
  is_final?: boolean;
}

interface KanbanColumn {
  stage: PortalKanbanStage;
  projects: Array<PortalProjectCardData & { stage_id?: string | null }>;
}

@Component({
  selector: 'app-portal-kanban-board',
  standalone: true,
  imports: [CommonModule, FormsModule, PortalProjectCardComponent],
  templateUrl: './portal-kanban-board.component.html',
  styleUrl: './portal-kanban-board.component.scss',
})
export class PortalKanbanBoardComponent implements OnInit, OnChanges {
  @Input() projects: PortalProjectCardData[] = [];
  @Input() stages: PortalKanbanStage[] = [];
  @Output() projectClick = new EventEmitter<PortalProjectCardData>();

  columns: KanbanColumn[] = [];

  constructor(private router: Router) {}

  ngOnInit() {
    this.updateColumns();
  }

  ngOnChanges() {
    this.updateColumns();
  }

  updateColumns() {
    if (!this.stages || !this.projects) return;

    this.columns = this.stages
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((stage) => ({
        stage,
        projects: this.projects
          .filter((p) => p.stage_id === stage.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0)),
      }));
  }

  onCardClick(project: PortalProjectCardData) {
    this.projectClick.emit(project);
    this.router.navigate(['/projects', project.id]);
  }
}
