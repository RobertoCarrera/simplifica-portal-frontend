import { CommonModule } from '@angular/common';
import { Component, Input, OnInit, OnChanges, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';

export interface PortalProjectTimeline {
  id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  position?: number | null;
  is_archived?: boolean | null;
  created_at?: string;
  client_name?: string;
}

@Component({
  selector: 'app-portal-timeline-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './portal-timeline-view.component.html',
  styleUrl: './portal-timeline-view.component.scss',
})
export class PortalTimelineViewComponent implements OnInit, OnChanges {
  @Input() projects: PortalProjectTimeline[] = [];
  @Output() projectClick = new EventEmitter<PortalProjectTimeline>();

  months: Date[] = [];
  minDate: Date = new Date();
  maxDate: Date = new Date();
  totalDays = 0;

  constructor(private router: Router) {}

  ngOnInit() {
    this.calculateTimeline();
  }

  ngOnChanges() {
    this.calculateTimeline();
  }

  calculateTimeline() {
    if (!this.projects || !this.projects.length) {
      this.months = [];
      this.minDate = new Date();
      this.maxDate = new Date();
      this.maxDate.setMonth(this.maxDate.getMonth() + 1);
      this.totalDays = 1;
      return;
    }

    const dates: Date[] = [];
    for (const p of this.projects) {
      const start = p.start_date ? new Date(p.start_date) : (p.created_at ? new Date(p.created_at) : new Date());
      const end = p.end_date ? new Date(p.end_date) : new Date(start.getTime() + 86400000);
      dates.push(start, end);
    }

    if (dates.length === 0) {
      this.minDate = new Date();
      this.maxDate = new Date();
      this.maxDate.setMonth(this.maxDate.getMonth() + 1);
    } else {
      this.minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
      this.maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
    }

    this.minDate.setDate(this.minDate.getDate() - 15);
    this.maxDate.setDate(this.maxDate.getDate() + 15);
    this.minDate.setHours(0, 0, 0, 0);
    this.maxDate.setHours(23, 59, 59, 999);

    this.totalDays = Math.max(1, (this.maxDate.getTime() - this.minDate.getTime()) / (1000 * 60 * 60 * 24));

    this.months = [];
    const current = new Date(this.minDate);
    current.setDate(1);
    while (current <= this.maxDate) {
      this.months.push(new Date(current));
      current.setMonth(current.getMonth() + 1);
    }
  }

  getProjectStyle(project: PortalProjectTimeline): any {
    const start = project.start_date ? new Date(project.start_date) : (project.created_at ? new Date(project.created_at) : new Date());
    let end = project.end_date ? new Date(project.end_date) : new Date(start.getTime() + 86400000);
    if (!project.end_date) {
      end = new Date(start.getTime() + 86400000);
    }

    const duration = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    const offset = (start.getTime() - this.minDate.getTime()) / (1000 * 60 * 60 * 24);

    return {
      left: `${(offset / this.totalDays) * 100}%`,
      width: `${Math.max(0.5, (duration / this.totalDays) * 100)}%`,
    };
  }

  getPriorityColor(priority?: string | null): string {
    switch (priority) {
      case 'low': return 'bg-emerald-500';
      case 'medium': return 'bg-blue-500';
      case 'high': return 'bg-orange-500';
      case 'critical': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  }

  getClientName(project: PortalProjectTimeline): string {
    return project.client_name || 'Mi proyecto';
  }

  getTodayStyle(): any {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (today < this.minDate || today > this.maxDate) {
      return { display: 'none' };
    }

    const offset = (today.getTime() - this.minDate.getTime()) / (1000 * 60 * 60 * 24);
    const leftPercent = (offset / this.totalDays) * 100;

    return {
      left: `${leftPercent}%`,
    };
  }

  onProjectClick(project: PortalProjectTimeline) {
    this.projectClick.emit(project);
    this.router.navigate(['/projects', project.id]);
  }
}
