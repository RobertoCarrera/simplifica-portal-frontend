import { Component, OnInit, OnDestroy, inject, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { RouterModule, Router, ActivatedRoute } from "@angular/router";
import { TranslocoModule } from "@jsverse/transloco";
import {
  ClientPortalService,
  ClientPortalQuote,
  QuotePaymentStatus,
  deriveQuotePaymentStatus,
  deriveQuotePeriodicity,
  getPeriodicityLabel,
} from "../../../../core/services/client-portal.service";
import { ToastService } from "../../../../shared/services/toast.service";
import { RealtimeChannel } from "@supabase/supabase-js";
@Component({
  selector: "app-portal-quotes",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, TranslocoModule],
  template: `
    <div class="p-4 sm:p-6 lg:p-8">
      <div class="w-full">
        <!-- Header -->
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
            Mis presupuestos
          </h1>
        </div>

        <!-- Filters bar -->
        <div class="mb-6 flex flex-col sm:flex-row gap-3">
          <!-- Search -->
          <div class="relative flex-1">
            <input
              type="text"
              [ngModel]="searchTerm()"
              (ngModelChange)="searchTerm.set($event)"
              placeholder="Buscar por número o título…"
              class="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          <!-- Status filter -->
          <select
            [ngModel]="statusFilter()"
            (ngModelChange)="statusFilter.set($event)"
            class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="vencido">Vencido</option>
          </select>

          <!-- Periodicity filter -->
          <select
            [ngModel]="periodFilter()"
            (ngModelChange)="periodFilter.set($event)"
            class="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas las periodicidades</option>
            <option value="one_time">Pago único</option>
            <option value="monthly">Mensual</option>
            <option value="quarterly">Trimestral</option>
            <option value="annual">Anual</option>
            <option value="mixed">Mixta</option>
          </select>
        </div>

        <!-- Loading state -->
        @if (loading()) {
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-12">
            <div class="flex items-center justify-center gap-3">
              <div class="animate-spin rounded-full h-10 w-10 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400"></div>
              <span class="text-gray-600 dark:text-gray-400">Cargando presupuestos…</span>
            </div>
          </div>
        }

        <!-- Error state -->
        @if (!loading() && error()) {
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <svg class="h-10 w-10 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p class="text-red-700 dark:text-red-300 font-medium mb-2">Error al cargar presupuestos</p>
            <p class="text-red-600 dark:text-red-400 text-sm mb-4">{{ error() }}</p>
            <button
              (click)="reload()"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Reintentar
            </button>
          </div>
        }

        <!-- Empty state (after load, no quotes at all) -->
        @if (!loading() && !error() && quotes().length === 0) {
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <svg class="h-14 w-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p class="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">No tienes presupuestos todavía</p>
            <p class="text-sm text-gray-400 dark:text-gray-500">Cuando recibas un presupuesto, aparecerá aquí.</p>
          </div>
        }

        <!-- Empty state (after filtering, no results) -->
        @if (!loading() && !error() && quotes().length > 0 && filteredQuotes().length === 0) {
          <div class="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-dashed border-gray-300 dark:border-gray-700 p-12 text-center">
            <svg class="h-14 w-14 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <p class="text-lg font-medium text-gray-500 dark:text-gray-400 mb-1">Sin resultados</p>
            <p class="text-sm text-gray-400 dark:text-gray-500 mb-4">No hay presupuestos que coincidan con los filtros actuales.</p>
            <button
              (click)="clearFilters()"
              class="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Limpiar filtros
            </button>
          </div>
        }

        <!-- Data: Desktop Table -->
        @if (!loading() && !error() && filteredQuotes().length > 0) {
          <!-- Desktop view -->
          <div class="hidden md:block bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div class="px-6 py-3 border-b border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
              {{ filteredQuotes().length }} presupuesto{{ filteredQuotes().length !== 1 ? 's' : '' }}
            </div>
            <table class="w-full table-fixed divide-y divide-gray-200 dark:divide-gray-800">
              <thead class="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[13%]">Número</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Título</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[10%]">Fecha</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[11%]">Vencimiento</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[12%]">Periodicidad</th>
                  <th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[11%]">Estado</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[12%]">Total</th>
                  <th class="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[15%]"></th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                @for (q of filteredQuotes(); track q.id) {
                  <tr
                    class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                    [routerLink]="['/portal/quotes', q.id]"
                  >
                    <td class="px-4 py-4 text-sm font-mono text-gray-900 dark:text-gray-100 whitespace-nowrap truncate">
                      {{ q.full_quote_number || '—' }}
                    </td>
                    <td class="px-4 py-4 text-sm text-gray-700 dark:text-gray-300 truncate" [title]="q.title || ''">
                      {{ q.title || 'Sin título' }}
                    </td>
                    <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {{ q.quote_date | date: 'dd/MM/yyyy' }}
                    </td>
                    <td class="px-4 py-4 text-sm whitespace-nowrap"
                      [class.text-red-600]="isExpired(q)"
                      [class.dark:text-red-400]="isExpired(q)"
                      [class.text-gray-600]="!isExpired(q)"
                      [class.dark:text-gray-400]="!isExpired(q)">
                      {{ q.valid_until | date: 'dd/MM/yyyy' }}
                      @if (isExpired(q)) {
                        <span class="ml-1 text-xs">⚠</span>
                      }
                    </td>
                    <td class="px-4 py-4 text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {{ getPeriodicityLabel(deriveQuotePeriodicity(q)) }}
                      </span>
                    </td>
                    <td class="px-4 py-4 whitespace-nowrap">
                      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                        [ngClass]="paymentStatusClass(q)">
                        {{ paymentStatusLabel(q) }}
                      </span>
                    </td>
                    <td class="px-4 py-4 text-sm text-right font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                      {{ (q.total_amount ?? 0) | number: '1.2-2' }} {{ q.currency || '€' }}
                    </td>
                    <td class="px-4 py-4 text-right whitespace-nowrap">
                      <div class="flex items-center justify-end gap-2">
                        @if (canPay(q)) {
                          <button
                            (click)="$event.stopPropagation(); $event.preventDefault(); payQuote(q)"
                            class="px-3 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
                          >
                            Pagar ahora
                          </button>
                        }
                        <span
                          class="text-blue-600 dark:text-blue-400 text-sm font-medium pointer-events-none"
                        >{{ 'portal.quotes.view' | transloco }}</span>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>

          <!-- Mobile card view -->
          <div class="md:hidden space-y-4">
            @for (q of filteredQuotes(); track q.id) {
              <a
                [routerLink]="['/portal/quotes', q.id]"
                class="block bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
              >
                <div class="flex items-start justify-between mb-3">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-mono text-gray-500 dark:text-gray-400 mb-0.5">
                      {{ q.full_quote_number || '—' }}
                    </div>
                    <div class="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {{ q.title || 'Sin título' }}
                    </div>
                  </div>
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium shrink-0 ml-2"
                    [ngClass]="paymentStatusClass(q)">
                    {{ paymentStatusLabel(q) }}
                  </span>
                </div>

                <div class="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span class="text-gray-400 dark:text-gray-500 text-xs">Fecha</span>
                    <div class="text-gray-700 dark:text-gray-300">{{ q.quote_date | date: 'dd/MM/yyyy' }}</div>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500 text-xs"
                      [class.text-red-500]="isExpired(q)">Vencimiento</span>
                    <div class="text-gray-700 dark:text-gray-300"
                      [class.text-red-600]="isExpired(q)"
                      [class.dark:text-red-400]="isExpired(q)">
                      {{ q.valid_until | date: 'dd/MM/yyyy' }}
                    </div>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500 text-xs">Periodicidad</span>
                    <div class="text-gray-700 dark:text-gray-300">{{ getPeriodicityLabel(deriveQuotePeriodicity(q)) }}</div>
                  </div>
                  <div>
                    <span class="text-gray-400 dark:text-gray-500 text-xs">Total</span>
                    <div class="text-gray-900 dark:text-gray-100 font-semibold">
                      {{ (q.total_amount ?? 0) | number: '1.2-2' }} {{ q.currency || '€' }}
                    </div>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span class="text-sm text-blue-600 dark:text-blue-400 font-medium">{{ 'portal.quotes.viewDetail' | transloco }} →</span>
                  @if (canPay(q)) {
                    <button
                      (click)="$event.preventDefault(); $event.stopPropagation(); payQuote(q)"
                      class="px-4 py-2 text-xs font-medium rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-all shadow-sm"
                    >
                      Pagar ahora
                    </button>
                  }
                </div>
              </a>
            }
          </div>
        }
      </div>
    </div>

  `,
})
export class PortalQuotesComponent implements OnInit, OnDestroy {
  private svc = inject(ClientPortalService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private toast = inject(ToastService);

  quotes = signal<ClientPortalQuote[]>([]);
  loading = signal<boolean>(true);
  error = signal<string | null>(null);

  searchTerm = signal<string>("");
  statusFilter = signal<string>("");
  periodFilter = signal<string>("");

  subscription: RealtimeChannel | null = null;

  // Re-export helpers for template
  deriveQuotePeriodicity = deriveQuotePeriodicity;
  getPeriodicityLabel = getPeriodicityLabel;

  /** Filtered quotes based on search + status + periodicity */
  filteredQuotes = computed(() => {
    let result = this.quotes();
    const search = this.searchTerm().toLowerCase().trim();
    const status = this.statusFilter();
    const period = this.periodFilter();

    // Search
    if (search) {
      result = result.filter(q => {
        const num = (q.full_quote_number || "").toLowerCase();
        const title = (q.title || "").toLowerCase();
        return num.includes(search) || title.includes(search);
      });
    }

    // Status filter
    if (status) {
      result = result.filter(q => deriveQuotePaymentStatus(q) === status);
    }

    // Periodicity filter
    if (period) {
      result = result.filter(q => {
        const p = deriveQuotePeriodicity(q);
        if (period === 'mixed') return p === 'mixed';
        // Normalize variants of the same period
        if (period === 'one_time') return p === 'one_time' || p === 'one-time';
        if (period === 'annual') return p === 'annual' || p === 'annually' || p === 'yearly';
        return p === period;
      });
    }

    return result;
  });

  async ngOnInit() {
    await this.reload();

    // Auto-navigate if "open" query param present
    const openId = this.route.snapshot.queryParamMap.get("open");
    if (openId && this.quotes().some((q) => q.id === openId)) {
      this.router.navigate(["/portal/presupuestos", openId]);
    }

    // Real-time subscription
    this.subscription = await this.svc.subscribeToClientQuotes((payload) => {
      if (payload.eventType === "INSERT") {
        this.quotes.update((list) => [payload.new as ClientPortalQuote, ...list]);
      } else if (payload.eventType === "UPDATE") {
        this.quotes.update((list) =>
          list.map((q) => (q.id === payload.new.id ? { ...q, ...payload.new } : q)),
        );
      }
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  async reload() {
    this.loading.set(true);
    this.error.set(null);
    const { data, error } = await this.svc.listQuotes();
    if (error) {
      this.error.set(error.message || "Error al cargar presupuestos");
    } else {
      this.quotes.set(data || []);
    }
    this.loading.set(false);
  }

  clearFilters() {
    this.searchTerm.set("");
    this.statusFilter.set("");
    this.periodFilter.set("");
  }

  /** Check if quote is expired */
  isExpired(q: ClientPortalQuote): boolean {
    if (!q.valid_until) return false;
    return new Date(q.valid_until) < new Date();
  }

  /** Can the client pay this quote? */
  canPay(q: ClientPortalQuote): boolean {
    const paymentStatus = deriveQuotePaymentStatus(q);
    if (paymentStatus !== 'pendiente') return false;
    // Also check if quote is expired
    if (this.isExpired(q)) return false;
    return true;
  }

  /** Navigate to payment */
  payQuote(q: ClientPortalQuote) {
    const paymentUrl = q.payment_url || q.stripe_payment_url || q.paypal_payment_url;
    if (paymentUrl) {
      window.open(paymentUrl, '_blank');
    } else {
      // Navigate to detail which may have payment options
      this.router.navigate(['/portal/presupuestos', q.id]);
    }
  }

  /** Payment-status label for the UI */
  paymentStatusLabel(q: ClientPortalQuote): string {
    const ps = deriveQuotePaymentStatus(q);
    const labels: Record<QuotePaymentStatus, string> = {
      pendiente: 'Pendiente',
      pagado: 'Pagado',
      vencido: 'Vencido',
    };
    return labels[ps] || ps;
  }

  /** Payment-status CSS classes */
  paymentStatusClass(q: ClientPortalQuote): string {
    const ps = deriveQuotePaymentStatus(q);
    const map: Record<string, string> = {
      pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      pagado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    };
    return map[ps] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}
