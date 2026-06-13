import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';

interface Notification {
  id: string;
  title: string;
  body?: string | null;
  created_at: string;
  is_read?: boolean;
}

/**
 * Portal notifications page.
 *
 * The BFF does not yet expose a /notifications endpoint, so this page renders
 * an empty-state for now. The structure (header, list placeholder, footer
 * link) is in place so once the BFF endpoint is added, only the loader needs
 * to change.
 */
@Component({
  selector: 'app-portal-notifications',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="max-w-3xl mx-auto p-4">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Notificaciones</h1>
        @if (notifications().length > 0) {
          <button class="text-sm text-blue-600 dark:text-blue-400 hover:underline">
            Marcar todas como leídas
          </button>
        }
      </div>

      @if (loading()) {
        <div class="text-gray-600 dark:text-gray-400">Cargando notificaciones…</div>
      } @else if (notifications().length === 0) {
        <div class="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-10 text-center">
          <p class="text-gray-600 dark:text-gray-400 mb-1">
            No tienes notificaciones.
          </p>
          <p class="text-sm text-gray-500 dark:text-gray-500">
            Aquí aparecerán avisos de tus tickets, presupuestos y facturas.
          </p>
        </div>
      } @else {
        <ul class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
          @for (n of notifications(); track n.id) {
            <li class="p-4">
              <div class="flex items-start justify-between gap-2">
                <h3 class="font-medium text-gray-900 dark:text-white">{{ n.title }}</h3>
                <span class="text-xs text-gray-500 flex-shrink-0">
                  {{ n.created_at | date: 'short' }}
                </span>
              </div>
              @if (n.body) {
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {{ n.body }}
                </p>
              }
            </li>
          }
        </ul>
      }
    </div>
  `,
})
export class PortalNotificationsComponent implements OnInit {
  private portal = inject(ClientPortalService);

  notifications = signal<Notification[]>([]);
  loading = signal<boolean>(true);

  async ngOnInit() {
    // BFF /notifications is not yet implemented. Render the empty state
    // after a short "loading" so the UI feels responsive. When the endpoint
    // lands, replace this block with a fetch to ClientPortalService.
    this.loading.set(true);
    // Simulated load: keeps the placeholder experience consistent.
    setTimeout(() => {
      this.notifications.set([]);
      this.loading.set(false);
    }, 200);
  }
}
