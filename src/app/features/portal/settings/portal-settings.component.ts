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
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div class="max-w-7xl mx-auto p-6 md:p-10 space-y-8">

        <!-- Hero header -->
        <header class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 dark:from-blue-700 dark:via-indigo-700 dark:to-violet-800 p-8 md:p-10 text-white shadow-lg">
          <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 text-blue-100 text-xs font-semibold uppercase tracking-wider mb-2">
                <i class="fas fa-cog"></i>
                <span>Portal del cliente</span>
              </div>
              <h1 class="text-3xl md:text-4xl font-bold">Configuración</h1>
              <p class="mt-2 text-blue-100 text-sm md:text-base max-w-2xl">
                Gestioná tu cuenta, datos de facturación y derechos RGPD desde un solo lugar.
              </p>
            </div>
            <div class="hidden md:flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <i class="fas fa-sliders-h text-3xl text-white/90"></i>
            </div>
          </div>
          <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
          <div class="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-indigo-400/20 blur-3xl"></div>
        </header>

        @if (isLoading) {
          <div class="text-center py-10">
            <i class="fas fa-spinner fa-spin text-3xl text-primary-500"></i>
            <p class="mt-2 text-gray-500">Cargando información...</p>
          </div>
        }

        <!-- Datos de Facturación -->
        <section class="bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-shadow rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
          <div class="flex items-start gap-4 mb-6">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <i class="fas fa-file-invoice-dollar text-white text-lg"></i>
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-gray-800 dark:text-white">Datos de Facturación</h2>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Estos datos se usan al emitir facturas a tu nombre. Si necesitás cambiarlos, contactanos y los actualizamos en tu ficha de cliente.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
            <div class="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-gray-700/40 dark:to-gray-700/20 border border-gray-200 dark:border-gray-600 p-4">
              <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                <i class="fas fa-envelope text-blue-500"></i>
                <span>Email</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white break-all">{{ user?.email ?? '—' }}</p>
            </div>
            <div class="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-gray-700/40 dark:to-gray-700/20 border border-gray-200 dark:border-gray-600 p-4">
              <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                <i class="fas fa-building text-indigo-500"></i>
                <span>Empresa</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white break-words">{{ user?.company_name ?? '—' }}</p>
            </div>
            <div class="rounded-xl bg-gradient-to-br from-slate-50 to-blue-50/50 dark:from-gray-700/40 dark:to-gray-700/20 border border-gray-200 dark:border-gray-600 p-4">
              <div class="flex items-center gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                <i class="fas fa-id-card text-violet-500"></i>
                <span>NIF/CIF</span>
              </div>
              <p class="text-sm font-semibold text-gray-900 dark:text-white font-mono">{{ user?.tax_id ?? '—' }}</p>
            </div>
          </div>
        </section>

        <!-- Tu Privacidad y Datos -->
        <section>
          <div class="flex items-center gap-3 mb-5 pl-4 border-l-4 border-blue-500">
            <div>
              <h2 class="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">Tu Privacidad y Datos</h2>
              <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Tus derechos bajo el Reglamento General de Protección de Datos.
              </p>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">

            <!-- Consentimientos GDPR -->
            <article class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all p-5 relative overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-4">
                <i class="fas fa-shield-alt text-white text-lg"></i>
              </div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">Consentimientos GDPR</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 flex-1">
                Revisá y modificá tus consentimientos de privacidad y comunicaciones comerciales.
              </p>
              <a
                routerLink="/portal/consent"
                class="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 transition-all shadow-sm hover:shadow-md"
              >
                <i class="fas fa-arrow-right text-xs"></i>
                <span>Gestionar consentimientos</span>
              </a>
            </article>

            <!-- Ver y descargar mis datos (Art. 15 + 20) -->
            <article class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all p-5 relative overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-green-600"></div>
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 mb-4">
                <i class="fas fa-download text-white text-lg"></i>
              </div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">Ver y descargar mis datos</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 flex-1">
                Descargá una copia de toda tu información en formato JSON: perfil, consentimientos, solicitudes y reservas.
              </p>
              <button
                type="button"
                (click)="exportMyData()"
                [disabled]="exporting"
                class="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 text-white hover:from-emerald-700 hover:to-green-700 transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              >
                @if (exporting) {
                  <i class="fas fa-spinner fa-spin"></i>
                } @else {
                  <i class="fas fa-download"></i>
                }
                <span>{{ exporting ? 'Generando archivo…' : 'Descargar mis datos' }}</span>
              </button>
              @if (exportStatus === 'success') {
                <p class="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <i class="fas fa-check-circle mr-1"></i>{{ exportStatusMsg }}
                </p>
              }
              @if (exportStatus === 'error') {
                <p class="mt-2 text-xs text-red-600 dark:text-red-400">
                  <i class="fas fa-exclamation-circle mr-1"></i>{{ exportStatusMsg }}
                </p>
              }
            </article>

            <!-- Rectificar mis datos (Art. 16) -->
            <article class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all p-5 relative overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-orange-600"></div>
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4">
                <i class="fas fa-edit text-white text-lg"></i>
              </div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">Rectificar mis datos</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 flex-1">
                Solicitá la corrección de datos personales incorrectos o desactualizados.
              </p>
              <button
                type="button"
                (click)="openRectifyModal()"
                class="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 text-white hover:from-amber-700 hover:to-orange-700 transition-all shadow-sm hover:shadow-md"
              >
                <i class="fas fa-edit"></i>
                <span>Solicitar corrección</span>
              </button>
            </article>

            <!-- Solicitar borrado de mi cuenta (Art. 17) -->
            <article class="group flex flex-col h-full bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-md hover:shadow-xl hover:-translate-y-0.5 transition-all p-5 relative overflow-hidden">
              <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-rose-500 to-red-600"></div>
              <div class="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30 mb-4">
                <i class="fas fa-user-slash text-white text-lg"></i>
              </div>
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-2">
                Solicitar borrado
                <span class="text-xs font-normal text-gray-500 dark:text-gray-400">(Derecho al olvido)</span>
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 flex-1">
                Anonimizaremos todos tus datos personales. Esta acción no se puede deshacer.
              </p>
              <button
                type="button"
                (click)="openEraseModal()"
                class="mt-4 inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-rose-600 to-red-600 text-white hover:from-rose-700 hover:to-red-700 transition-all shadow-sm hover:shadow-md"
              >
                <i class="fas fa-user-slash"></i>
                <span>Solicitar borrado</span>
              </button>
            </article>
          </div>
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
    </div>
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