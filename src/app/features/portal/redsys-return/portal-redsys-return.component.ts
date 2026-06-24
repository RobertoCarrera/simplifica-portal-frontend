import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ClientPortalService } from '../../../core/services/client-portal.service';

@Component({
  selector: 'app-portal-redsys-return',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div class="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 text-center">
        @if (status() === 'ok') {
          <div class="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-check text-3xl text-emerald-600 dark:text-emerald-400"></i>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">¡Pago completado!</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Tu pago con Redsys se ha procesado correctamente. El servicio aparecerá en tu lista de contratados en unos segundos.
          </p>
        } @else {
          <div class="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-times text-3xl text-red-600 dark:text-red-400"></i>
          </div>
          <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Pago no completado</h2>
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
            Redsys no confirmó el pago. Si crees que es un error, contáctanos.
          </p>
        }

        <div class="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
          @if (refreshing()) {
            <span class="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></span>
            Actualizando tu lista de servicios…
          } @else {
            Redirigiendo en {{ countdown() }}s…
          }
        </div>

        <button
          (click)="goToServices()"
          class="mt-4 w-full px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700"
        >
          Ir a mis servicios ahora
        </button>
      </div>
    </div>
  `,
})
export class PortalRedsysReturnComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private portal = inject(ClientPortalService);

  status = signal<'ok' | 'ko'>('ko');
  contractId = signal<string | null>(null);
  refreshing = signal<boolean>(true);
  countdown = signal<number>(4);

  ngOnInit() {
    const params = this.route.snapshot.queryParamMap;
    this.status.set(params.get('status') === 'ok' ? 'ok' : 'ko');
    this.contractId.set(params.get('contract'));

    // Re-fetch services so the contract appears in the contracted list
    // if the notify already fired.
    this.portal.listServices().then(() => {
      this.refreshing.set(false);
    }).catch(() => {
      this.refreshing.set(false);
    });

    // Auto-redirect after 4 seconds
    const tick = setInterval(() => {
      const next = this.countdown() - 1;
      this.countdown.set(next);
      if (next <= 0) {
        clearInterval(tick);
        this.goToServices();
      }
    }, 1000);
  }

  goToServices() {
    this.router.navigate(['/portal/services']);
  }
}