import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { PortalSidebarComponent } from './portal-sidebar.component';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, PortalSidebarComponent],
  template: `
    <div class="flex h-screen bg-gray-100 dark:bg-gray-900">
      <!-- Portal Sidebar (Fixed) -->
      <app-portal-sidebar></app-portal-sidebar>

      <!-- Main Content Area -->
      <main class="flex-1 ml-64 overflow-y-auto">
        <div class="min-h-screen p-8">
          <router-outlet></router-outlet>
        </div>
      </main>
    </div>
  `,
})
export class PortalLayoutComponent {}
