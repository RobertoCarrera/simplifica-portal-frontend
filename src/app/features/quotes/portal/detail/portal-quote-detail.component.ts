import { Component, OnInit, inject, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ActivatedRoute, Router, RouterModule } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import { ClientPortalService } from "../../../../core/services/client-portal.service";
import {
  deriveQuotePaymentStatus,
  deriveQuotePeriodicity,
  getPeriodicityLabel,
} from "../../../../core/services/client-portal.service";
import { ToastService } from "../../../../shared/services/toast.service";
import { PortalAuthService } from "../../../../core/services/portal-auth.service";
import { PortalClientUser } from "../../../../core/ports/iportal-auth";

@Component({
  selector: "app-portal-quote-detail",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="h-full bg-gray-50 dark:bg-gray-950 p-4 sm:p-6 lg:p-8">
      <div class="w-full">
        <!-- Back link -->
        <a
          routerLink="/portal/presupuestos"
          class="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4"
        >
          <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Volver a presupuestos
        </a>

        <!-- Loading -->
        @if (loading()) {
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
            <div class="flex items-center justify-center gap-3">
              <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"></div>
              <span class="text-gray-600 dark:text-gray-400">Cargando presupuesto…</span>
            </div>
          </div>
        }

        <!-- Not found -->
        @if (!loading() && !quote()) {
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <svg class="h-14 w-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg font-medium text-gray-500 dark:text-gray-400">Presupuesto no encontrado</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">Puede que no tengas acceso o haya sido eliminado.</p>
          </div>
        }

        @if (!loading() && quote(); as q) {
          <!-- Header -->
          <div class="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Presupuesto {{ q.full_quote_number || '—' }}
              </h1>
              @if (q.title) {
                <p class="text-gray-500 dark:text-gray-400 mt-1">{{ q.title }}</p>
              }
            </div>
            <button
              (click)="downloadPdf()"
              class="px-5 py-2.5 rounded-lg font-medium text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Descargar PDF
            </button>
          </div>

          <!-- Payment Status Banner -->
          @if (isAcceptedOrInvoiced()) {
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-3">
              <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-blue-700 dark:text-blue-300 font-medium">
                {{ 'portal.quoteDetail.alreadyAccepted' | transloco }}
                @if (q.accepted_at) {
                  {{ 'portal.quoteDetail.acceptedOn' | transloco }} {{ q.accepted_at | date: 'dd/MM/yyyy' }}
                }
              </span>
            </div>
          } @else if (paymentStatus() === 'pagado') {
            <div class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-3">
              <svg class="w-5 h-5 text-green-600 dark:text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-green-700 dark:text-green-300 font-medium">Este presupuesto está pagado</span>
            </div>
          }
          @if (!isAcceptedOrInvoiced() && paymentStatus() === 'pendiente') {
            <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between gap-3 flex-wrap">
              <div class="flex items-center gap-3">
                <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="text-amber-700 dark:text-amber-300 font-medium">Pago pendiente</span>
              </div>
              @if (!isExpired()) {
                <button
                  (click)="payNow()"
                  class="px-6 py-2.5 rounded-lg font-medium text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
                >
                  Pagar ahora
                </button>
              }
            </div>
          }
          @if (paymentStatus() === 'vencido') {
            <div class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
              <svg class="w-5 h-5 text-red-600 dark:text-red-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span class="text-red-700 dark:text-red-300 font-medium">Este presupuesto ha vencido</span>
            </div>
          }

          <!-- Summary cards -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <!-- Status -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Estado</div>
              <span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                [ngClass]="paymentStatusBadgeClass()">
                {{ paymentStatusLabel() }}
              </span>
            </div>
            <!-- Date -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Fecha</div>
              <div class="text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ q.quote_date | date: 'dd/MM/yyyy' }}
              </div>
            </div>
            <!-- Due date -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1"
                [class.text-red-500]="isExpired()">Vencimiento</div>
              <div class="text-base font-semibold"
                [class.text-red-600]="isExpired()"
                [class.dark:text-red-400]="isExpired()"
                [class.text-gray-900]="!isExpired()"
                [class.dark:text-gray-100]="!isExpired()">
                {{ q.valid_until | date: 'dd/MM/yyyy' }}
                @if (isExpired()) {
                  <span class="text-xs ml-1">(Expirado)</span>
                }
              </div>
            </div>
            <!-- Periodicity -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Periodicidad</div>
              <div class="text-base font-semibold text-gray-900 dark:text-gray-100">
                {{ getPeriodicityLabel(periodicity()) }}
              </div>
            </div>
          </div>

          <!-- Service description (only if the BFF returns one) -->
          @if (q.description) {
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6 mb-6">
              <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">
                {{ 'portal.quoteDetail.serviceDescription' | transloco }}
              </h2>
              <p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line">{{ q.description }}</p>
            </div>
          }

          <!-- Client / Issuer info (always rendered, populated from auth + BFF) -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <!-- Client -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ 'portal.quoteDetail.client' | transloco }}
              </div>
              @if (clientName() || clientEmail()) {
                <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {{ clientName() || '—' }}
                </div>
                @if (clientEmail()) {
                  <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">{{ clientEmail() }}</div>
                }
              } @else {
                <div class="text-sm text-gray-400 dark:text-gray-500">—</div>
              }
            </div>
            <!-- Issuer / Company -->
            <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                {{ 'portal.quoteDetail.issuer' | transloco }}
              </div>
              <div class="text-sm font-medium text-gray-900 dark:text-gray-100">
                {{ issuerName() || '—' }}
              </div>
            </div>
          </div>

          <!-- Items breakdown -->
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
            <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {{ 'portal.quoteDetail.items' | transloco }}
              </h2>
            </div>
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
                <thead class="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Concepto</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Cant.</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">% Dto.</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">IVA</th>
                    <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                  @for (item of q.items || []; track item; let i = $index) {
                    <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <td class="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                        <div class="font-medium">{{ item.description || 'Sin descripción' }}</div>
                        @if (item.billing_period) {
                          <div class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                            {{ getPeriodicityLabel(item.billing_period) }}
                          </div>
                        }
                      </td>
                      <td class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                        {{ item.quantity }}
                      </td>
                      <td class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                        {{ item.unit_price | number: '1.2-2' }} €
                      </td>
                      <td class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                        {{ item.discount_percent || 0 }}%
                      </td>
                      <td class="px-6 py-4 text-sm text-right text-gray-700 dark:text-gray-300">
                        {{ item.tax_rate || 0 }}%
                      </td>
                      <td class="px-6 py-4 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                        {{ item.total | number: '1.2-2' }} €
                      </td>
                    </tr>
                  }
                  @if (!q.items?.length) {
                    <tr>
                      <td colspan="6" class="px-6 py-8 text-center text-sm text-gray-400 dark:text-gray-500">
                        No hay conceptos en este presupuesto.
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>

          <!-- Total section -->
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
            <div class="space-y-2 mb-4">
              <!-- Subtotal -->
              <div class="flex justify-between text-sm">
                <span class="text-gray-600 dark:text-gray-400">Subtotal</span>
                <span class="text-gray-900 dark:text-gray-100 font-medium">{{ breakdown().subtotal | number: '1.2-2' }} €</span>
              </div>
              <!-- Tax -->
              @if (breakdown().taxAmount > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">IVA</span>
                  <span class="text-gray-900 dark:text-gray-100 font-medium">{{ breakdown().taxAmount | number: '1.2-2' }} €</span>
                </div>
              }
              <!-- IRPF -->
              @if (breakdown().irpfAmount > 0) {
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">IRPF</span>
                  <span class="text-red-600 dark:text-red-400 font-medium">−{{ breakdown().irpfAmount | number: '1.2-2' }} €</span>
                </div>
              }
            </div>
            <div class="border-t border-gray-200 dark:border-gray-700 pt-4 flex items-center justify-between">
              <div>
                <div class="text-sm text-gray-500 dark:text-gray-400">Total a pagar</div>
              </div>
              <div class="text-3xl font-bold text-gray-900 dark:text-gray-100">
                {{ breakdown().total | number: '1.2-2' }} €
              </div>
            </div>

            <!-- Action buttons -->
            <div class="mt-6 flex flex-wrap gap-3 justify-end">
              @if (canRespond()) {
                <button
                  (click)="onReject()"
                  [disabled]="processing()"
                  class="px-6 py-3 rounded-lg font-medium text-sm bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  Rechazar
                </button>
                <button
                  (click)="onAccept()"
                  [disabled]="processing()"
                  class="px-6 py-3 rounded-lg font-medium text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  ✓ Aceptar presupuesto
                </button>
              }
              @if (paymentStatus() === 'pendiente' && !isExpired()) {
                <button
                  (click)="payNow()"
                  [disabled]="processing()"
                  class="px-6 py-3 rounded-lg font-medium text-sm bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 transition-all shadow-sm ml-auto"
                >
                  Pagar ahora
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Confirmation Modal -->
    @if (showConfirmModal()) {
      <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[9999]" (click)="cancelConfirm()">
        <div class="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-md w-full p-6" (click)="$event.stopPropagation()">
          <h3 class="text-xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            {{ confirmAction() === 'accept' ? '¿Aceptar presupuesto?' : '¿Rechazar presupuesto?' }}
          </h3>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            @if (confirmAction() === 'accept') {
              Al aceptar este presupuesto, confirmas que estás de acuerdo con
              los términos y el importe total de
              <strong>{{ breakdown().total | number: '1.2-2' }} €</strong>.
            }
            @if (confirmAction() === 'reject') {
              <div class="mt-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Motivo del rechazo <span class="text-red-500">*</span>
                </label>
                <textarea
                  [(ngModel)]="rejectionReason"
                  rows="3"
                  class="w-full rounded-md border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 p-2 border"
                  placeholder="Por favor, indícanos el motivo…"
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
              [disabled]="processing() || (confirmAction() === 'reject' && !rejectionReason.trim())"
              class="px-4 py-2 rounded-lg font-medium text-sm text-white disabled:opacity-50"
              [ngClass]="confirmAction() === 'accept' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700'"
            >
              {{ confirmAction() === 'accept' ? 'Sí, aceptar' : 'Sí, rechazar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class PortalQuoteDetailComponent implements OnInit {
  private svc = inject(ClientPortalService);
  private auth = inject(PortalAuthService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private toast = inject(ToastService);

  quote = signal<any | null>(null);
  loading = signal<boolean>(true);
  processing = signal<boolean>(false);
  showConfirmModal = signal<boolean>(false);
  confirmAction = signal<"accept" | "reject" | null>(null);
  rejectionReason: string = "";

  // Company list (emisor data) — populated from BFF /companies
  companies = signal<Array<{ id: string; name: string; isActive: boolean }>>([]);

  // Portal client (snapshot taken at init for header rendering)
  portalClient = signal<PortalClientUser | null>(null);

  // Re-export helpers for template
  getPeriodicityLabel = getPeriodicityLabel;

  /** Payment-oriented status */
  paymentStatus = computed(() => {
    const q = this.quote();
    if (!q) return 'pendiente';
    return deriveQuotePaymentStatus(q);
  });

  /** True when the quote was accepted or invoiced (terminal client-side states) */
  isAcceptedOrInvoiced = computed(() => {
    const s = this.quote()?.status;
    return s === 'accepted' || s === 'invoiced';
  });

  /** Client full name from portal auth context */
  clientName = computed(() => {
    const pu = this.portalClient();
    if (!pu) return null;
    if (pu.full_name) return pu.full_name;
    const parts = [pu.name, pu.surname].filter(Boolean);
    return parts.length ? parts.join(' ') : null;
  });

  /** Client email from portal auth context */
  clientEmail = computed(() => {
    return this.portalClient()?.email ?? null;
  });

  /** Issuer / company name (the active company from the BFF companies endpoint) */
  issuerName = computed(() => {
    const active = this.companies().find((c) => c.isActive);
    return active?.name ?? this.portalClient()?.company_name ?? null;
  });

  /** Periodicity from items */
  periodicity = computed(() => {
    const q = this.quote();
    if (!q) return null;
    return deriveQuotePeriodicity(q);
  });

  /** Is the quote expired? */
  isExpired = computed(() => {
    const q = this.quote();
    if (!q?.valid_until) return false;
    return new Date(q.valid_until) < new Date();
  });

  /** Full breakdown */
  breakdown = computed(() => {
    const q = this.quote();
    if (!q) return { subtotal: 0, taxAmount: 0, irpfAmount: 0, total: 0 };

    // If backend provides explicit subtotal/tax, use those
    if (q.subtotal != null || q.tax_amount != null) {
      return {
        subtotal: Number(q.subtotal || 0),
        taxAmount: Number(q.tax_amount || 0),
        irpfAmount: Number(q.irpf_amount || 0),
        total: Number(q.total_amount || 0),
      };
    }

    // Compute from items
    const items = q.items || [];
    let subtotal = 0;
    let taxAmount = 0;
    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const discount = Number(item.discount_percent || 0) / 100;
      const taxRate = Number(item.tax_rate || 0) / 100;

      const lineSubtotal = qty * price * (1 - discount);
      const lineTax = lineSubtotal * taxRate;
      subtotal += lineSubtotal;
      taxAmount += lineTax;
    }
    const total = subtotal + taxAmount;
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      irpfAmount: 0,
      total: Math.round(total * 100) / 100,
    };
  });

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get("id") as string;

    // Snapshot the current portal client (public API — the private
    // portalUserSubject on PortalAuthService is not accessible from here).
    this.portalClient.set(await this.auth.getCurrentClient());

    // Use the BFF /quotes/:id detail endpoint, which returns the quote +
    // its line items + the quote-level description + accepted_at. This
    // is what the detail template needs (q.items, q.description,
    // q.accepted_at). Falls back to listQuotes+find only if the BFF
    // returns a non-OK status so the UI never gets stuck on the spinner
    // because of a transient BFF error.
    const [detailRes, companies] = await Promise.all([
      this.svc.getQuote(id),
      this.svc.getCompanies(),
    ]);

    this.companies.set(companies || []);

    if (detailRes.data) {
      this.quote.set(detailRes.data);
    } else if (detailRes.error && detailRes.error !== "Quote not found") {
      // Try the list endpoint as a fallback so the page is still usable.
      const { data: list } = await this.svc.listQuotes();
      const found = (list || []).find((x: any) => x.id === id);
      if (found) this.quote.set(found);
    } else {
      // 404 from BFF → leave quote() as null so the "Presupuesto no
      // encontrado" empty state renders.
    }
    this.loading.set(false);
  }

  downloadPdf() {
    this.toast.info("Información", "Descarga PDF disponible próximamente");
  }

  canRespond(): boolean {
    const s = this.quote()?.status;
    // Only show accept/reject when the quote is awaiting client action.
    return s === "sent" || s === "viewed";
  }

  payNow() {
    const q = this.quote();
    if (!q) return;
    const paymentUrl = q.payment_url || q.stripe_payment_url || q.paypal_payment_url;
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    } else {
      this.toast.info("Información", "Las opciones de pago estarán disponibles próximamente.");
    }
  }

  paymentStatusLabel(): string {
    const ps = this.paymentStatus();
    const labels: Record<string, string> = {
      pendiente: 'Pendiente de pago',
      pagado: 'Pagado',
      vencido: 'Vencido',
    };
    return labels[ps] || ps;
  }

  paymentStatusBadgeClass(): string {
    const ps = this.paymentStatus();
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      pagado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return map[ps] || 'bg-gray-100 text-gray-800';
  }

  // ---- Accept / Reject flow (preserved from original) ----

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
      this.toast.error("Error", "Debes indicar un motivo para rechazar el presupuesto");
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
        this.toast.error("Error", `No se pudo ${action === "accept" ? "aceptar" : "rechazar"} el presupuesto`);
      } else {
        this.quote.set(data);
        this.toast.success("Acción completada", `Presupuesto ${action === "accept" ? "aceptado" : "rechazado"} correctamente`);
      }
    } catch (err: any) {
      this.toast.error("Error inesperado", err?.message || "Operación no completada");
    } finally {
      this.processing.set(false);
      this.showConfirmModal.set(false);
      this.confirmAction.set(null);
    }
  }
}
