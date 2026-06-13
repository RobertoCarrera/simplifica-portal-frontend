import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';

interface Booking {
  id: string;
  start_time: string;
  end_time?: string | null;
  service_name?: string | null;
  professional_name?: string | null;
  status: string;
}

/**
 * Portal reservations page.
 *
 * The BFF exposes a /appointments endpoint (mapped to public_bookings). This
 * component reads from there and renders upcoming + past reservations in two
 * sections. The structure is in place; the BFF already returns the data.
 */
@Component({
  selector: 'app-portal-reservas',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <div class="max-w-3xl mx-auto p-4">
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">Reservas</h1>

      @if (loading()) {
        <div class="text-gray-600 dark:text-gray-400">Cargando reservas…</div>
      } @else {
        <section class="mb-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Próximas
          </h2>
          @if (upcoming().length === 0) {
            <div class="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-6 text-center text-gray-500 dark:text-gray-400 text-sm">
              No tienes reservas próximas.
            </div>
          } @else {
            <ul class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
              @for (b of upcoming(); track b.id) {
                <li class="p-4">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-medium text-gray-900 dark:text-white">
                        {{ b.start_time | date: 'fullDate' }}
                        <span class="text-gray-500">·</span>
                        {{ b.start_time | date: 'shortTime' }}
                      </p>
                      @if (b.service_name) {
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                          {{ b.service_name }}
                        </p>
                      }
                      @if (b.professional_name) {
                        <p class="text-xs text-gray-500">
                          Con {{ b.professional_name }}
                        </p>
                      }
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full"
                      [class]="statusClass(b.status)">
                      {{ b.status }}
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>

        <section>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Pasadas
          </h2>
          @if (past().length === 0) {
            <p class="text-sm text-gray-500">Sin reservas pasadas.</p>
          } @else {
            <ul class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl divide-y divide-gray-200 dark:divide-gray-700">
              @for (b of past(); track b.id) {
                <li class="p-4 opacity-70">
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <p class="font-medium text-gray-700 dark:text-gray-300">
                        {{ b.start_time | date: 'fullDate' }}
                        <span class="text-gray-500">·</span>
                        {{ b.start_time | date: 'shortTime' }}
                      </p>
                      @if (b.service_name) {
                        <p class="text-sm text-gray-500">{{ b.service_name }}</p>
                      }
                    </div>
                    <span class="text-xs px-2 py-0.5 rounded-full"
                      [class]="statusClass(b.status)">
                      {{ b.status }}
                    </span>
                  </div>
                </li>
              }
            </ul>
          }
        </section>
      }
    </div>
  `,
})
export class PortalReservasComponent implements OnInit {
  private portal = inject(ClientPortalService);

  loading = signal<boolean>(true);
  upcoming = signal<Booking[]>([]);
  past = signal<Booking[]>([]);

  async ngOnInit() {
    this.loading.set(true);
    // include_past=true so the past section can render its own list.
    const { data } = await this.portal.listAppointments(true);
    const all: Booking[] = (data ?? []) as Booking[];
    const now = Date.now();
    this.upcoming.set(all.filter((b) => new Date(b.start_time).getTime() >= now));
    this.past.set(all.filter((b) => new Date(b.start_time).getTime() < now));
    this.loading.set(false);
  }

  statusClass(status: string): string {
    switch ((status || '').toLowerCase()) {
      case 'confirmed':
      case 'confirmada':
        return 'bg-green-100 text-green-700';
      case 'cancelled':
      case 'cancelada':
        return 'bg-red-100 text-red-700';
      case 'pending':
      case 'pendiente':
        return 'bg-yellow-100 text-yellow-700';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
}
