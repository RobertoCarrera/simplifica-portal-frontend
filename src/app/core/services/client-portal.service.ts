import { Injectable, inject } from "@angular/core";
import { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import { PortalAuthService } from "./portal-auth.service";

export interface ClientPortalQuote {
  id: string;
  full_quote_number?: string | null;
  title?: string | null;
  status: string;
  quote_date?: string | null;
  valid_until?: string | null;
  total_amount?: number;
  currency?: string;
  subtotal?: number;
  tax_amount?: number;
  irpf_amount?: number;
  items?: any[];
  // Payment-related fields
  payment_status?: 'pending' | 'paid' | null;
  payment_url?: string | null;
  stripe_payment_url?: string | null;
  paypal_payment_url?: string | null;
  // Computed client-side
  rejection_reason?: string | null;
}

/** Payment-oriented status for client filtering */
export type QuotePaymentStatus = 'pendiente' | 'pagado' | 'vencido';

/** Derive a payment-oriented status from a quote's raw fields */
export function deriveQuotePaymentStatus(quote: ClientPortalQuote): QuotePaymentStatus {
  const now = new Date();
  const validUntil = quote.valid_until ? new Date(quote.valid_until) : null;
  const isExpired = validUntil && validUntil < now;

  // If explicitly marked as paid at the quote level
  if (quote.payment_status === 'paid') return 'pagado';
  // If accepted or invoiced, consider it paid (or at least not pending/expired payment)
  if (quote.status === 'accepted' || quote.status === 'invoiced') return 'pagado';

  // Expired: past valid_until and not in a terminal state
  if (isExpired && !['accepted', 'rejected', 'invoiced', 'cancelled'].includes(quote.status)) {
    return 'vencido';
  }

  // Everything else is pending
  return 'pendiente';
}

/** Derive a human-readable billing period from quote items */
export function deriveQuotePeriodicity(quote: ClientPortalQuote): string | null {
  const items = quote.items || [];
  if (!items.length) return null;

  const periods = new Set<string>();
  for (const item of items) {
    const bp = (item as any).billing_period;
    if (bp) periods.add(bp);
  }
  if (periods.size === 0) return null;
  if (periods.size === 1) return Array.from(periods)[0];
  return 'mixed';
}

export function getPeriodicityLabel(period: string | null): string {
  if (!period) return '—';
  const labels: Record<string, string> = {
    'one-time': 'Pago único',
    one_time: 'Pago único',
    monthly: 'Mensual',
    quarterly: 'Trimestral',
    annually: 'Anual',
    annual: 'Anual',
    yearly: 'Anual',
    mixed: 'Mixta',
  };
  return labels[period] || period;
}

export interface ClientPortalInvoice {
  id: string;
  invoice_number?: string | null;
  invoice_series?: string | null;
  full_invoice_number?: string | null;
  status?: string;
  payment_status?: string;
  invoice_date?: string | null;
  due_date?: string | null;
  total?: number;
  currency?: string;
  items?: any[];
}

/**
 * ClientPortalService — Service for portal client data operations.
 *
 * This is a COPY of the CRM's ClientPortalService, adapted to use
 * IPortalAuth (PortalAuthService) instead of AuthService.
 *
 * The key difference: this service depends on IPortalAuth interface,
 * not on the concrete AuthService from the CRM monorepo.
 *
 * This separation allows the portal to be deployed as a standalone app
 * without carrying the full AuthService dependency tree.
 */
@Injectable({ providedIn: "root" })
export class ClientPortalService {
  private auth = inject(PortalAuthService);
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = this.auth.client;
  }

  private async requireAccessToken(): Promise<string> {
    return this.auth.requireAccessToken();
  }

  async listTickets(): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-bff/tickets';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`tickets BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? [], error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || "listTickets failed" },
      };
    }
  }

  async listQuotes(): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-bff/quotes';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`quotes BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? [], error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || "listQuotes failed" },
      };
    }
  }

  async getQuote(id: string): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-bff/quotes/${id}`;

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) return { data: null, error: "Quote not found" };
        throw new Error(`quote BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? null, error: null };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e?.message || "getQuote failed" },
      };
    }
  }

  async listInvoices(): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-bff/invoices';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`invoices BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? [], error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || "listInvoices failed" },
      };
    }
  }

  async getInvoice(id: string): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-bff/invoices/${id}`;

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 404) return { data: null, error: "Invoice not found" };
        throw new Error(`invoice BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? null, error: null };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e?.message || "getInvoice failed" },
      };
    }
  }

  async respondToQuote(
    id: string,
    action: "accept" | "reject",
    rejectionReason?: string,
  ): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();

      const { data, error } = await this.supabase.functions.invoke(
        "client-quote-respond",
        {
          body: { id, action, rejection_reason: rejectionReason },
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (error) {
        console.error("❌ Error from Edge Function:", error);
        return { data: null, error };
      }

      return { data: data?.data || null, error: null };
    } catch (e: any) {
      console.error("❌ Unexpected error responding to quote:", e);
      return {
        data: null,
        error: { message: e?.message || "Failed to respond to quote" },
      };
    }
  }

  async getPaymentInfo(paymentToken: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.functions.invoke(
        "public-payment-info",
        {
          body: { token: paymentToken },
        },
      );
      if (error) throw error;
      return data;
    } catch (e: any) {
      console.error("Error getting payment info:", e);
      throw e;
    }
  }

  async markTicketOpened(
    ticketId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Portal does not have a tickets table — markTicketOpened is a no-op
    // The ticket visibility is controlled by client_visible_tickets sync
    return { success: true };
  }

  async subscribeToClientQuotes(
    callback: (payload: any) => void,
  ): Promise<RealtimeChannel> {
    const user = await this.auth.getCurrentClient();
    const filter = user?.client_id ? `client_id=eq.${user.client_id}` : undefined;
    return this.supabase
      .channel('portal-client-quotes')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'quotes', filter }, callback)
      .subscribe();
  }

  /**
   * GET /modules via the BFF (client-portal-bff)
   * Returns the list of active modules for the client's company,
   * including visibility flags (devMode, visibleToClients).
   * Uses direct fetch to allow GET on the edge function.
   */
  async getActiveModules(): Promise<any[]> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      // client-portal-modules is a multi-tenant BFF. It reads the active
      // company from the JWT's app_metadata.company_id.
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/modules';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`modules endpoint returned ${res.status}`);
      }

      const json = await res.json();
      const modules = json?.modules ?? json?.data?.modules ?? [];
      return Array.isArray(modules) ? modules : [];
    } catch (e: any) {
      console.error('[ClientPortalService] getActiveModules failed:', e?.message);
      return [];
    }
  }

  /**
   * List companies the current user belongs to.
   */
  async getCompanies(): Promise<Array<{ id: string; name: string; isActive: boolean }>> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/companies';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`companies endpoint returned ${res.status}`);
      }

      const json = await res.json();
      const companies = json?.companies ?? json?.data?.companies ?? [];
      return Array.isArray(companies) ? companies : [];
    } catch (e: any) {
      console.error('[ClientPortalService] getCompanies failed:', e?.message);
      return [];
    }
  }

  /**
   * Switch the user's active company. Updates app_metadata.company_id in
   * the BFF, then refreshes the session so the JWT carries the new claim.
   * Returns true on success.
   */
  async switchCompany(companyId: string): Promise<boolean> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/select-company';

      const res = await fetch(bffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ company_id: companyId }),
      });

      if (!res.ok) {
        throw new Error(`select-company returned ${res.status}`);
      }

      // The BFF has updated app_metadata.company_id. Refresh the Supabase
      // session so the new JWT includes the new claim.
      const newSession = await this.auth.refreshSession();
      return newSession !== null;
    } catch (e: any) {
      console.error('[ClientPortalService] switchCompany failed:', e?.message);
      return false;
    }
  }
}
