import { Component, inject, signal, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import {
  ClientPortalService,
  ClientPortalInvoice,
} from "../../../../services/client-portal.service";
import { ToastService } from "../../../../services/toast.service";
import {
  PaymentMethodSelectorComponent,
  PaymentSelection,
} from "../../../payments/selector/payment-method-selector.component";
import { formatInvoiceNumber } from "../../../../models/invoice.model";
import { isTrustedPaymentUrl } from "../../../../shared/payment-url.utils";

interface PaymentInfo {
  invoice_id: string;
  invoice_number: string;
  full_invoice_number: string;
  total: number;
  currency: string;
  due_date: string;
  company_name: string;
  payment_options: any[];
}

@Component({
  selector: "app-portal-invoices",
  standalone: true,
  imports: [CommonModule, RouterModule, PaymentMethodSelectorComponent],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="max-w-5xl mx-auto">
        <div class="flex items-center justify-between mb-6">
          <h1
            class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100"
          >
            Tus facturas
          </h1>
        </div>

        <div
          class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden"
        >
          <div class="overflow-x-auto">
            <table
              class="min-w-full divide-y divide-gray-200 dark:divide-gray-800"
            >
              <thead class="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Número
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Fecha
                  </th>
                  <th
                    class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Estado
                  </th>
                  <th
                    class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    Total
                  </th>
                  <th class="px-6 py-3"></th>
                </tr>
              </thead>
              <tbody
                class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800"
              >
                @for (inv of invoices(); track inv) {
                  <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td
                      class="px-6 py-3 text-sm text-gray-900 dark:text-gray-100"
                    >
                      {{ displayInvoiceNumber(inv) }}
                    </td>
                    <td
                      class="px-6 py-3 text-sm text-gray-700 dark:text-gray-300"
                    >
                      {{ inv.invoice_date | date: "dd/MM/yyyy" }}
                    </td>
                    <td class="px-6 py-3 text-sm">
                      @if (inv.payment_status === "paid") {
                        <span
                          class="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          >Pagada</span
                        >
                      }
                      @if (inv.payment_status === "pending") {
                        <span
                          class="px-2 py-1 text-xs font-medium rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          >Pendiente</span
                        >
                      }
                      @if (inv.payment_status === "pending_local") {
                        <span
                          class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          >Pago Local Pendiente</span
                        >
                      }
                      @if (
                        !inv.payment_status || inv.payment_status === "none"
                      ) {
                        <span
                          class="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                          >-</span
                        >
                      }
                    </td>
                    <td
                      class="px-6 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100"
                    >
                      {{ inv.total | number: "1.2-2" }}
                      {{ inv.currency || "EUR" }}
                    </td>
                    <td
                      class="px-6 py-3 text-right flex items-center justify-end gap-2"
                    >
                      <!-- Payment button: show if status is pending -->
                      @if (
                        inv.payment_status !== "paid" &&
                        inv.payment_status !== "pending_local"
                      ) {
                        <button
                          (click)="openPaymentOptions(inv)"
                          class="text-sm px-3 py-1.5 rounded bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 font-medium"
                        >
                          Pagar
                        </button>
                      }
                      <a
                        class="text-blue-600 hover:underline"
                        [routerLink]="['/portal/facturas', inv.id]"
                        >Ver</a
                      >
                      <button
                        class="text-sm px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
                        (click)="downloadPdf(inv.id)"
                      >
                        PDF
                      </button>
                    </td>
                  </tr>
                }
                @if (invoices().length === 0) {
                  <tr>
                    <td
                      colspan="5"
                      class="px-6 py-8 text-center text-sm text-gray-500 dark:text-gray-400"
                    >
                      No hay facturas por ahora.
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Payment Method Selector - STUB: needs cross-feature dependency -->
    <!-- app-payment-method-selector removed - Phase 3 will handle -->
  `,
})
export class PortalInvoicesComponent {
  private portal = inject(ClientPortalService);
  private toastService = inject(ToastService);

  invoices = signal<ClientPortalInvoice[]>([]);
  selectedInvoice = signal<ClientPortalInvoice | null>(null);
  loadingPaymentOptions = signal(false);

  constructor() {
    this.loadInvoices();
  }

  async loadInvoices() {
    const { data } = await this.portal.listInvoices();
    this.invoices.set(data || []);
  }

  async downloadPdf(id: string) {
    try {
      // STUB: InvoicesService stub needed - Phase 3
      this.toastService.error("Error", "Descarga PDF no disponible en Phase 2");
    } catch (e: any) {
      this.toastService.error(
        "Error",
        e?.message || "No se pudo descargar el PDF",
      );
    }
  }

  displayInvoiceNumber(inv: ClientPortalInvoice): string {
    const raw =
      inv.full_invoice_number ||
      (inv.invoice_series && inv.invoice_number
        ? `${inv.invoice_series}-${inv.invoice_number}`
        : "");
    return raw;
  }

  async openPaymentOptions(inv: ClientPortalInvoice) {
    // STUB: Payment integration - Phase 3
    this.toastService.error(
      "Error",
      "Opciones de pago no disponibles en Phase 2",
    );
  }
}
