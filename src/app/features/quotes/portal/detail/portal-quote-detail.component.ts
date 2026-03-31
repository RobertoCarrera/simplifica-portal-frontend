import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ClientPortalService } from "../../../../services/client-portal.service";
import { ToastService } from "../../../../services/toast.service";

@Component({
  selector: "app-portal-quote-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="h-full bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div
          class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
        >
          <div>
            <a
              routerLink="/portal/presupuestos"
              class="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2"
            >
              <svg
                class="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                ></path>
              </svg>
              Volver a presupuestos
            </a>
            <h1
              class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100"
            >
              Presupuesto {{ displayQuoteNumber() }}
            </h1>
          </div>
        </div>

        @if (loading()) {
          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12"
          >
            <div class="flex items-center justify-center">
              <div
                class="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"
              ></div>
              <span class="ml-3 text-gray-600 dark:text-gray-400"
                >Cargando presupuesto…</span
              >
            </div>
          </div>
        }

        @if (!loading() && !quote()) {
          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center"
          >
            <p class="text-lg text-gray-600 dark:text-gray-400">
              Presupuesto no encontrado o sin acceso.
            </p>
          </div>
        }

        @if (!loading() && quote()) {
          <div
            class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
          >
            <div
              class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5"
            >
              <div
                class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
              >
                Título
              </div>
              <div
                class="text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {{ quote()?.title }}
              </div>
            </div>
            <div
              class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5"
            >
              <div
                class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
              >
                Estado
              </div>
              <span
                class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                [ngClass]="statusClass(quote()?.status)"
              >
                {{ statusLabel(quote()?.status) }}
              </span>
              @if (
                quote()?.status === "rejected" && quote()?.rejection_reason
              ) {
                <div class="mt-2 text-sm text-red-600 dark:text-red-400">
                  <strong>Motivo:</strong> {{ quote()?.rejection_reason }}
                </div>
              }
            </div>
            <div
              class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5"
            >
              <div
                class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
              >
                Fecha
              </div>
              <div
                class="text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {{ quote()?.quote_date | date: "dd/MM/yyyy" }}
              </div>
            </div>
            <div
              class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5"
            >
              <div
                class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
              >
                Válido hasta
              </div>
              <div
                class="text-base font-semibold text-gray-900 dark:text-gray-100"
              >
                {{ quote()?.valid_until | date: "dd/MM/yyyy" }}
              </div>
            </div>
          </div>

          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden mb-6"
          >
            <div
              class="px-6 py-4 border-b border-gray-200 dark:border-gray-800"
            >
              <h2
                class="text-lg font-semibold text-gray-900 dark:text-gray-100"
              >
                Conceptos
              </h2>
            </div>
            <div class="overflow-x-auto">
              <table
                class="min-w-full divide-y divide-gray-200 dark:divide-gray-800"
              >
                <thead class="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th
                      class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Descripción
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Cantidad
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Precio
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      IVA
                    </th>
                    <th
                      class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                    >
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody
                  class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800"
                >
                  @for (it of quote()?.items || []; track it) {
                    <tr>
                      <td
                        class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
                      >
                        {{ it.description }}
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300"
                      >
                        {{ it.quantity }}
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300"
                      >
                        {{ it.unit_price | number: "1.2-2" }} €
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300"
                      >
                        {{ it.tax_rate }}%
                      </td>
                      <td
                        class="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100"
                      >
                        {{ it.total | number: "1.2-2" }} €
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6"
          >
            <div
              class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
            >
              <div class="flex-1">
                <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Importe Total
                </div>
                <div
                  class="text-3xl font-bold text-gray-900 dark:text-gray-100"
                >
                  {{ quote()?.total_amount | number: "1.2-2" }} €
                </div>
              </div>
              <div class="flex flex-wrap gap-3 items-center">
                <button
                  (click)="downloadPdf()"
                  class="px-6 py-3 rounded-lg font-medium text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Descargar PDF
                </button>
                @if (canRespond()) {
                  <div class="flex gap-3">
                    <button
                      (click)="onReject()"
                      [disabled]="processing()"
                      class="px-6 py-3 rounded-lg font-medium text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                    >
                      Rechazar
                    </button>
                    <button
                      (click)="onAccept()"
                      [disabled]="processing()"
                      class="px-6 py-3 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      ✓ Aceptar presupuesto
                    </button>
                  </div>
                }
              </div>
            </div>
          </div>
        }
      </div>

      @if (showConfirmModal()) {
        <div
          class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]"
        >
          <div
            class="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6"
            (click)="$event.stopPropagation()"
          >
            <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              {{
                confirmAction() === "accept"
                  ? "¿Aceptar presupuesto?"
                  : "¿Rechazar presupuesto?"
              }}
            </h3>
            <p class="text-gray-600 dark:text-gray-400 mb-6">
              @if (confirmAction() === "accept") {
                Al aceptar este presupuesto, confirmas que estás de acuerdo con
                los términos y el importe total de
                <strong>{{ quote()?.total_amount | number: "1.2-2" }} €</strong
                >.
              }
              @if (confirmAction() === "reject") {
                <div class="mt-2">
                  <label
                    class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >Motivo del rechazo
                    <span class="text-red-500">*</span></label
                  >
                  <textarea
                    [(ngModel)]="rejectionReason"
                    rows="3"
                    class="w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 p-2 border"
                    placeholder="Por favor, indícanos el motivo..."
                  ></textarea>
                </div>
              }
            </p>
            <div class="flex gap-3 justify-end">
              <button
                (click)="cancelConfirm()"
                class="px-4 py-2 rounded-lg font-medium text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
              >
                Cancelar
              </button>
              <button
                (click)="confirmResponse()"
                [disabled]="
                  processing() ||
                  (confirmAction() === 'reject' && !rejectionReason.trim())
                "
                class="px-4 py-2 rounded-lg font-medium text-sm text-white disabled:opacity-50"
                [ngClass]="
                  confirmAction() === 'accept'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-red-600 hover:bg-red-700'
                "
              >
                {{
                  confirmAction() === "accept" ? "Sí, aceptar" : "Sí, rechazar"
                }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class PortalQuoteDetailComponent implements OnInit {
  private svc = inject(ClientPortalService);
  rejectionReason: string = "";
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  quote = signal<any | null>(null);
  loading = signal<boolean>(true);
  processing = signal<boolean>(false);
  showConfirmModal = signal<boolean>(false);
  confirmAction = signal<"accept" | "reject" | null>(null);

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id") as string;
    const { data, error } = await this.svc.getQuote(id);
    if (error) {
      console.error("Error loading quote:", error);
    } else {
      this.quote.set(data);
    }
    this.loading.set(false);
  }

  displayQuoteNumber(): string {
    return this.quote()?.full_quote_number || "";
  }

  downloadPdf() {
    // STUB: Phase 3 - QuotesService needed
    this.toast.error("Error", "Descarga PDF no disponible en Phase 2");
  }

  canRespond(): boolean {
    const s = this.quote()?.status;
    return ["sent", "viewed", "pending"].includes(s || "");
  }

  onAccept() {
    this.rejectionReason = "";
    this.confirmAction.set("accept");
    this.showConfirmModal.set(true);
  }

  onReject() {
    this.rejectionReason = "";
    this.confirmAction.set("reject");
    this.showConfirmModal.set(true);
  }

  cancelConfirm() {
    this.showConfirmModal.set(false);
    this.confirmAction.set(null);
    this.rejectionReason = "";
  }

  async confirmResponse() {
    const action = this.confirmAction();
    if (!action) return;

    if (action === "reject" && !this.rejectionReason.trim()) {
      this.toast.error(
        "Error",
        "Debes indicar un motivo para rechazar el presupuesto",
      );
      return;
    }

    this.processing.set(true);
    const id = this.quote()?.id;

    try {
      const { data, error } = await this.svc.respondToQuote(
        id,
        action,
        action === "reject" ? this.rejectionReason : undefined,
      );

      if (error) {
        this.toast.error(
          "Error",
          `No se pudo ${action === "accept" ? "aceptar" : "rechazar"} el presupuesto`,
        );
      } else {
        this.quote.set(data);
        this.toast.success(
          "Acción completada",
          `Presupuesto ${action === "accept" ? "aceptado" : "rechazado"} correctamente`,
        );
      }
    } catch (err: any) {
      this.toast.error(
        "Error inesperado",
        err?.message || "Operación no completada",
      );
    } finally {
      this.processing.set(false);
      this.showConfirmModal.set(false);
      this.confirmAction.set(null);
    }
  }

  statusLabel(status?: string | null): string {
    const labels: Record<string, string> = {
      draft: "Borrador",
      request: "Solicitud",
      pending: "Pendiente",
      sent: "Enviado",
      viewed: "Visto",
      accepted: "Aceptado",
      rejected: "Rechazado",
      expired: "Expirado",
      invoiced: "Facturado",
      cancelled: "Cancelado",
    };
    return (status && labels[status]) || status || "";
  }

  statusClass(status?: string | null): string {
    const base = "text-xs";
    const map: Record<string, string> = {
      draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
      request:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      pending:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
      sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
      viewed:
        "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
      accepted:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
      expired:
        "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
      invoiced:
        "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
      cancelled:
        "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
    };
    return `${base} ${status ? map[status] : map["draft"]}`;
  }
}
