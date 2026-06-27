import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { PortalAuthService } from "../../../core/services/portal-auth.service";

@Component({
  selector: "app-portal-settings",
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Configuración
        </h1>
      </div>

      @if (isLoading) {
        <div class="text-center py-10">
          <i class="fas fa-spinner fa-spin text-3xl text-primary-500"></i>
          <p class="mt-2 text-gray-500">Cargando información...</p>
        </div>
      }

      <!-- Datos de Facturación -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-file-invoice-dollar text-primary-500"></i>
          Datos de Facturación
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Estos datos se usan al emitir facturas a tu nombre. Si necesitás
          cambiarlos, contactanos y los actualizamos en tu ficha de cliente.
        </p>
        <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li><span class="text-gray-500">Email de facturación:</span> {{ user?.email ?? '—' }}</li>
          <li><span class="text-gray-500">Empresa:</span> {{ user?.company_name ?? '—' }}</li>
          <li><span class="text-gray-500">NIF/CIF:</span> {{ user?.tax_id ?? '—' }}</li>
        </ul>
      </section>

      <!-- Consentimientos GDPR -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-shield-alt text-primary-500"></i>
          Consentimientos GDPR
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Podés revisar y modificar tus consentimientos de privacidad y
          comunicaciones comerciales desde la sección
          <a routerLink="/portal/consent" class="text-primary-600 dark:text-primary-400 hover:underline">Consentimientos</a>.
        </p>
      </section>

      <!-- GDPR: Ver y descargar mis datos (Art. 15 + 20) -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-download text-primary-500"></i>
          Ver y descargar mis datos
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Descargá una copia de toda la información que tenemos asociada a tu
          cuenta, en formato JSON. Incluye tu perfil, consentimientos,
          solicitudes previas y reservas.
        </p>
        <button
          type="button"
          (click)="exportMyData()"
          [disabled]="exporting"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          @if (exporting) {
            <i class="fas fa-spinner fa-spin"></i>
          } @else {
            <i class="fas fa-download"></i>
          }
          <span>{{ exporting ? 'Generando archivo…' : 'Descargar mis datos' }}</span>
        </button>
        @if (exportStatus === 'success') {
          <p class="mt-3 text-sm text-emerald-600 dark:text-emerald-400">
            <i class="fas fa-check-circle mr-1"></i>{{ exportStatusMsg }}
          </p>
        }
        @if (exportStatus === 'error') {
          <p class="mt-3 text-sm text-red-600 dark:text-red-400">
            <i class="fas fa-exclamation-circle mr-1"></i>{{ exportStatusMsg }}
          </p>
        }
      </section>

      <!-- GDPR: Rectificar mis datos (Art. 16) -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-edit text-primary-500"></i>
          Rectificar mis datos
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Solicitá la corrección de datos personales incorrectos o
          desactualizados. Revisaremos tu pedido y te responderemos.
        </p>
        <button
          type="button"
          (click)="openRectifyModal()"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        >
          <i class="fas fa-edit"></i>
          <span>Solicitar corrección</span>
        </button>
      </section>

      <!-- GDPR: Solicitar borrado de mi cuenta (Art. 17) -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-user-slash text-red-500"></i>
          Solicitar borrado de mi cuenta
          <span class="text-sm font-normal text-gray-500 dark:text-gray-400">(Derecho al olvido)</span>
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Esta acción anonimizará todos tus datos personales.
          <strong>No se puede deshacer.</strong>
          Si tenés facturas o suscripciones activas, contactanos primero.
        </p>
        <button
          type="button"
          (click)="openEraseModal()"
          class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors"
        >
          <i class="fas fa-user-slash"></i>
          <span>Solicitar borrado</span>
        </button>
      </section>
    </div>

    <!-- Modal: Rectificación (Art. 16) -->
    @if (showRectifyModal) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="closeRectifyModal()"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center gap-2 mb-4">
            <i class="fas fa-edit text-primary-500 text-xl"></i>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              Solicitar corrección de datos
            </h3>
          </div>
          <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
            Describí qué datos querés corregir y, si podés, indicá el valor
            correcto. Revisaremos tu solicitud y te responderemos.
          </p>
          <label
            for="rectify-description"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Descripción
          </label>
          <textarea
            id="rectify-description"
            name="rectify-description"
            rows="5"
            [(ngModel)]="rectifyDescription"
            [disabled]="sendingRectify"
            placeholder="Ej: Mi número de teléfono actual es +34 600 000 000, no el que figura en mi ficha."
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
          ></textarea>
          @if (rectifyStatus === 'error') {
            <p class="mt-2 text-sm text-red-600 dark:text-red-400">
              <i class="fas fa-exclamation-circle mr-1"></i>{{ rectifyStatusMsg }}
            </p>
          }
          @if (rectifyStatus === 'success') {
            <p class="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              <i class="fas fa-check-circle mr-1"></i>{{ rectifyStatusMsg }}
            </p>
          }
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              (click)="closeRectifyModal()"
              [disabled]="sendingRectify"
              class="px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="sendRectifyRequest()"
              [disabled]="sendingRectify || !rectifyDescription.trim()"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (sendingRectify) {
                <i class="fas fa-spinner fa-spin"></i>
              }
              <span>{{ sendingRectify ? 'Enviando…' : 'Enviar solicitud' }}</span>
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Modal: Borrado (Art. 17) -->
    @if (showEraseModal) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        (click)="closeEraseModal()"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full p-6"
          (click)="$event.stopPropagation()"
        >
          <div class="flex items-center gap-2 mb-4">
            <i class="fas fa-user-slash text-red-500 text-xl"></i>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              Solicitar borrado de cuenta
            </h3>
          </div>
          <div
            class="text-sm text-gray-700 dark:text-gray-200 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 mb-4"
          >
            <p class="font-semibold text-red-700 dark:text-red-300 mb-1">
              Esta acción es irreversible
            </p>
            <p>
              Anonimizaremos tu nombre, email, teléfono, dirección y cualquier
              dato personal asociado a tu cuenta. Los registros legales
              (facturas emitidas) se conservarán según obligación legal.
            </p>
          </div>
          <label
            for="erase-confirm"
            class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            Escribí <span class="font-mono font-bold">ELIMINAR</span> para confirmar:
          </label>
          <input
            id="erase-confirm"
            name="erase-confirm"
            type="text"
            [(ngModel)]="eraseConfirmText"
            [disabled]="erasing"
            autocomplete="off"
            class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
          />
          @if (eraseStatus === 'error') {
            <p class="mt-2 text-sm text-red-600 dark:text-red-400">
              <i class="fas fa-exclamation-circle mr-1"></i>{{ eraseStatusMsg }}
            </p>
          }
          @if (eraseStatus === 'success') {
            <p class="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              <i class="fas fa-check-circle mr-1"></i>{{ eraseStatusMsg }}
            </p>
          }
          <div class="mt-5 flex justify-end gap-2">
            <button
              type="button"
              (click)="closeEraseModal()"
              [disabled]="erasing"
              class="px-4 py-2 text-sm font-medium rounded-md bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="confirmErase()"
              [disabled]="!canConfirmErase"
              class="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (erasing) {
                <i class="fas fa-spinner fa-spin"></i>
              }
              <span>{{ erasing ? 'Procesando…' : 'Confirmar borrado' }}</span>
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PortalSettingsComponent implements OnInit {
  private auth = inject(PortalAuthService);

  user: any = null;
  isLoading = true;

  // ── Export (Art. 15 + 20) ─────────────────────────────────────────
  exporting = false;
  exportStatus: '' | 'success' | 'error' = '';
  exportStatusMsg = '';

  // ── Rectification (Art. 16) ───────────────────────────────────────
  showRectifyModal = false;
  rectifyDescription = '';
  sendingRectify = false;
  rectifyStatus: '' | 'success' | 'error' = '';
  rectifyStatusMsg = '';

  // ── Erasure (Art. 17) ─────────────────────────────────────────────
  showEraseModal = false;
  eraseConfirmText = '';
  erasing = false;
  eraseStatus: '' | 'success' | 'error' = '';
  eraseStatusMsg = '';

  async ngOnInit() {
    try {
      const client = await this.auth.getCurrentClient();
      this.user = client;
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }

  // ── Export (Art. 15 + 20) ─────────────────────────────────────────
  async exportMyData() {
    if (this.exporting) return;
    this.exporting = true;
    this.exportStatus = '';
    this.exportStatusMsg = '';
    try {
      const { data, error } = await this.auth.client.rpc('portal_export_my_data');
      if (error) throw error;
      if (data === null || data === undefined) {
        throw new Error('No se recibieron datos para exportar.');
      }

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      const emailPart = (this.user?.email ?? 'cliente').split('@')[0];
      const safeName =
        emailPart
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '')
          .substring(0, 40) || 'cliente';

      const link = document.createElement('a');
      link.href = url;
      link.download = `gdpr-export-${safeName}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      this.exportStatus = 'success';
      this.exportStatusMsg = 'Descarga iniciada. Revisá tu carpeta de descargas.';
    } catch (e: any) {
      console.error('Error exporting client data:', e);
      this.exportStatus = 'error';
      this.exportStatusMsg = e?.message ?? 'Error al exportar tus datos.';
    } finally {
      this.exporting = false;
    }
  }

  // ── Rectification (Art. 16) ───────────────────────────────────────
  openRectifyModal() {
    this.showRectifyModal = true;
    this.rectifyDescription = '';
    this.rectifyStatus = '';
    this.rectifyStatusMsg = '';
  }

  closeRectifyModal() {
    if (this.sendingRectify) return;
    this.showRectifyModal = false;
  }

  async sendRectifyRequest() {
    if (this.sendingRectify) return;
    const description = this.rectifyDescription.trim();
    if (!description) {
      this.rectifyStatus = 'error';
      this.rectifyStatusMsg = 'Describí qué datos querés corregir.';
      return;
    }
    this.sendingRectify = true;
    this.rectifyStatus = '';
    this.rectifyStatusMsg = '';
    try {
      const { data, error } = await this.auth.client.rpc('portal_submit_arco_request', {
        p_request_type: 'rectification',
        p_details: { description },
      });
      if (error) throw error;
      const result = (data ?? null) as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'No se pudo registrar la solicitud.');
      }
      this.rectifyStatus = 'success';
      this.rectifyStatusMsg = 'Tu solicitud fue registrada. Te responderemos a la brevedad.';
      this.rectifyDescription = '';
      setTimeout(() => {
        if (this.showRectifyModal && this.rectifyStatus === 'success') {
          this.showRectifyModal = false;
        }
      }, 1800);
    } catch (e: any) {
      console.error('Error sending rectification request:', e);
      this.rectifyStatus = 'error';
      this.rectifyStatusMsg = e?.message ?? 'Error al enviar la solicitud.';
    } finally {
      this.sendingRectify = false;
    }
  }

  // ── Erasure (Art. 17) ─────────────────────────────────────────────
  openEraseModal() {
    this.showEraseModal = true;
    this.eraseConfirmText = '';
    this.eraseStatus = '';
    this.eraseStatusMsg = '';
  }

  closeEraseModal() {
    if (this.erasing) return;
    this.showEraseModal = false;
  }

  get canConfirmErase(): boolean {
    return !this.erasing && this.eraseConfirmText.trim() === 'ELIMINAR';
  }

  async confirmErase() {
    if (!this.canConfirmErase) return;
    this.erasing = true;
    this.eraseStatus = '';
    this.eraseStatusMsg = '';
    try {
      const { data, error } = await this.auth.client.rpc('portal_submit_arco_request', {
        p_request_type: 'erasure',
        p_details: {
          reason: 'gdpr_erasure_request',
          confirmed_text: this.eraseConfirmText.trim(),
        },
      });
      if (error) throw error;
      const result = (data ?? null) as { success?: boolean; error?: string } | null;
      if (!result?.success) {
        throw new Error(result?.error ?? 'No se pudo registrar la solicitud.');
      }
      this.eraseStatus = 'success';
      this.eraseStatusMsg = 'Solicitud registrada. Revisaremos tu caso antes de proceder.';
      this.eraseConfirmText = '';
      setTimeout(() => {
        if (this.showEraseModal && this.eraseStatus === 'success') {
          this.showEraseModal = false;
        }
      }, 2500);
    } catch (e: any) {
      console.error('Error sending erasure request:', e);
      this.eraseStatus = 'error';
      this.eraseStatusMsg = e?.message ?? 'Error al registrar la solicitud.';
    } finally {
      this.erasing = false;
    }
  }
}
