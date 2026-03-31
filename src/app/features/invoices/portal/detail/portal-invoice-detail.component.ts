import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { ClientPortalService } from "../../../../services/client-portal.service";
import { ToastService } from "../../../../services/toast.service";

@Component({
  selector: "app-portal-invoice-detail",
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="h-full p-4 sm:p-6 lg:p-8 transition-colors duration-200">
      @if (invoice(); as inv) {
        <div class="max-w-5xl mx-auto">
          <div
            class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
          >
            <div>
              <a
                routerLink="/portal/facturas"
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
                Volver a facturas
              </a>
              <h1
                class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100"
              >
                Factura {{ displayInvoiceNumber(inv) }}
              </h1>
            </div>
            <div class="flex gap-3">
              <button
                class="px-6 py-3 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700"
                (click)="downloadPdf()"
              >
                Descargar PDF
              </button>
            </div>
          </div>
          <!-- Payment Status Banner -->
          @if (inv.payment_status === "paid") {
            <div
              class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3"
            >
              <span class="text-green-700 dark:text-green-300 font-medium"
                >Esta factura está pagada</span
              >
            </div>
          }
          @if (
            inv.payment_status === "pending" || inv.payment_status === null
          ) {
            <div
              class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-3"
            >
              <span class="text-amber-700 dark:text-amber-300 font-medium"
                >Pago pendiente</span
              >
            </div>
          }
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
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
                {{ inv.invoice_date | date: "dd/MM/yyyy" }}
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
              <div class="flex items-center gap-2">
                <span
                  class="text-base font-semibold text-gray-900 dark:text-gray-100 capitalize"
                  >{{ getStatusLabel(inv.status) }}</span
                >
                @if (inv.payment_status === "paid") {
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    >Pagada</span
                  >
                }
                @if (inv.payment_status === "pending") {
                  <span
                    class="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    >Pago Pendiente</span
                  >
                }
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
                  @for (it of invoiceItems(); track it) {
                    <tr
                      class="transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td
                        class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100"
                      >
                        <div class="font-medium">{{ it.description }}</div>
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
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-1">
              Importe Total
            </div>
            <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {{ invoiceTotal() | number: "1.2-2" }} €
            </div>
          </div>
        </div>
      } @else {
        <div class="p-8 text-center text-gray-600 dark:text-gray-400">
          Cargando...
        </div>
      }
    </div>
  `,
})
export class PortalInvoiceDetailComponent implements OnInit {
  private portal = inject(ClientPortalService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  invoice = signal<any | null>(null);
  invoiceItems = signal<any[]>([]);
  invoiceTotal = signal<number>(0);

  async ngOnInit() {
    this.loadInvoice();
  }

  async loadInvoice() {
    const id = this.route.snapshot.paramMap.get("id") as string;
    const { data } = await this.portal.getInvoice(id);
    this.invoice.set(data || null);
    this.invoiceItems.set(data?.items || []);
    this.invoiceTotal.set(Number(data?.total || 0));
  }

  downloadPdf() {
    // STUB: Phase 3 - InvoicesService needed
    this.toast.error("Error", "Descarga PDF no disponible en Phase 2");
  }

  displayInvoiceNumber(inv: any): string {
    return inv?.full_invoice_number || "";
  }

  getStatusLabel(status: string): string {
    const map: Record<string, string> = {
      draft: "Borrador",
      approved: "Aprobada",
      issued: "Emitida",
      sent: "Enviada",
      paid: "Pagada",
      partial: "Parcial",
      overdue: "Vencida",
      cancelled: "Cancelada",
      void: "Anulada",
    };
    return map[status] || status;
  }
}
