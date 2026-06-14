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

export interface PortalProjectListItem {
  id: string;
  name: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'critical' | null;
  stage_id?: string | null;
  position?: number | null;
  is_archived?: boolean | null;
  created_at?: string;
  client_name?: string;
  tasks_count?: number;
  completed_tasks_count?: number;
  top_tasks?: Array<{ id: string; title: string; is_completed: boolean; position?: number }>;
  unread_count?: number;
}

export interface PortalService {
  id: string;
  name: string;
  description?: string | null;
  base_price?: number | null;
  estimated_hours?: number | null;
  category?: string | null;
  is_active?: boolean;
  is_public?: boolean;
  is_bookable?: boolean;
  allow_direct_contracting?: boolean;
  features?: string | null;
  min_quantity?: number | null;
  max_quantity?: number | null;
  duration_minutes?: number | null;
  buffer_minutes?: number | null;
  booking_color?: string | null;
  tax_rate?: number | null;
  unit_type?: string | null;
  tags?: string[] | null;
  has_variants?: boolean;
  display_price?: number | null;
  display_price_label?: string | null;
  display_price_from_variants?: boolean;
  display_hours?: number | null;
  display_hourly_rate?: number | null;
  company_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PortalContractedService {
  id: string;
  client_id: string;
  company_id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  start_date: string;
  status: 'active' | 'paused' | 'cancelled';
  recurrence_type?: 'monthly' | 'weekly' | 'yearly' | null;
  recurrence_day?: number | null;
  recurrence_start?: string | null;
  recurrence_end?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PortalServiceVariantPricing {
  period: 'one-time' | 'monthly' | 'annually' | 'custom';
  price: number;
  currency?: string;
}

export interface PortalServiceVariant {
  id: string;
  service_id: string;
  variant_name: string;
  base_price?: number | null;
  pricing?: PortalServiceVariantPricing[] | null;
  features?: {
    included?: string[];
    excluded?: string[];
    limits?: Record<string, any>;
  } | null;
  display_config?: {
    highlight?: boolean;
    badge?: string | null;
    color?: string | null;
  } | null;
  is_active?: boolean;
  is_hidden?: boolean;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
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

  /**
   * List bookings/appointments for the current company.
   * The BFF maps the public_bookings table and accepts ?include_past=true to
   * skip the upcoming-only filter. When omitted, defaults to upcoming only.
   */
  async listAppointments(includePast = false): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/appointments' + (includePast ? '?include_past=true' : '');

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`appointments BFF returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? [], error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || 'listAppointments failed' },
      };
    }
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

  /**
   * List the current client's projects in the active company.
   * Multi-tenant: server forces client_id and company_id from the JWT, so the
   * client only sees projects it owns in the company it is currently in.
   */
  async getProjects(): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/projects';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`projects endpoint returned ${res.status}`);
      }

      const json = await res.json();
      const data = json?.data ?? [];
      return { data: Array.isArray(data) ? data : [] };
    } catch (e: any) {
      console.error('[ClientPortalService] getProjects failed:', e?.message);
      return { data: [], error: { message: e?.message || 'getProjects failed' } };
    }
  }

  /**
   * Read one project (with its tasks) by id. Returns null when not found or
   * when the project does not belong to the current client/company.
   */
  async getProject(id: string): Promise<{ data: { project: any; tasks: any[] } | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(id)}`;

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 404) {
        return { data: null };
      }
      if (!res.ok) {
        throw new Error(`project endpoint returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] getProject failed:', e?.message);
      return { data: null, error: { message: e?.message || 'getProject failed' } };
    }
  }

  /**
   * Create a project owned by the current client in the active company.
   * Only `name`, `description`, `priority`, `start_date`, `end_date` are
   * accepted from the request — client_id and company_id are forced by the
   * BFF so the client cannot inject them.
   */
  async createProject(input: {
    name: string;
    description?: string | null;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    start_date?: string | null;
    end_date?: string | null;
  }): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/projects';

      const res = await fetch(bffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `create-project returned ${res.status}`);
      }

      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] createProject failed:', e?.message);
      return { data: null, error: { message: e?.message || 'createProject failed' } };
    }
  }

  /**
   * List projects with optional filters. Mirrors the CRM sidebar's
   * search/priority/archived filters.
   */
  async listProjects(filters?: { q?: string; priority?: string; stage_id?: string; include_archived?: boolean }): Promise<{ data: any[]; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const params = new URLSearchParams();
      if (filters?.q) params.set('q', filters.q);
      if (filters?.priority) params.set('priority', filters.priority);
      if (filters?.stage_id) params.set('stage_id', filters.stage_id);
      if (filters?.include_archived) params.set('include_archived', 'true');
      const qs = params.toString();
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/projects' + (qs ? '?' + qs : '');

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`projects endpoint returned ${res.status}`);
      const json = await res.json();
      return { data: json?.data ?? [] };
    } catch (e: any) {
      console.error('[ClientPortalService] listProjects failed:', e?.message);
      return { data: [], error: { message: e?.message || 'listProjects failed' } };
    }
  }

  /**
   * Read the project detail (project + tasks + comments + files + permissions).
   */
  async getProjectDetail(id: string): Promise<{
    data: { project: any; tasks: any[]; comments: any[]; files: any[]; permissions: any } | null;
    error?: any;
  }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(id)}`;

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (res.status === 404) return { data: null };
      if (!res.ok) {
        let bodyText = '';
        try { bodyText = await res.text(); } catch {}
        throw new Error(`project detail endpoint returned ${res.status}: ${bodyText.substring(0, 500)}`);
      }

      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] getProjectDetail failed:', e?.message);
      return { data: null, error: { message: e?.message || 'getProjectDetail failed' } };
    }
  }

  /** Get the project stages (kanban columns) for the current company. */
  async getStages(): Promise<{ data: Array<{ id: string; name: string; position: number }>; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/stages';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`stages endpoint returned ${res.status}`);
      const json = await res.json();
      return { data: json?.stages ?? [] };
    } catch (e: any) {
      console.error('[ClientPortalService] getStages failed:', e?.message);
      return { data: [], error: { message: e?.message || 'getStages failed' } };
    }
  }

  /** Get the project permissions template for the current company. */
  async getPermissions(): Promise<{ data: any; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/permissions';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`permissions endpoint returned ${res.status}`);
      const json = await res.json();
      return { data: json?.permissions ?? {} };
    } catch (e: any) {
      console.error('[ClientPortalService] getPermissions failed:', e?.message);
      return { data: {}, error: { message: e?.message || 'getPermissions failed' } };
    }
  }

  /**
   * List services for the active company, split into:
   *  - `available`: services where is_public = true AND is_bookable = true
   *  - `contracted`: services the current client has already contracted
   */
  async listServices(): Promise<{
    data: { available: PortalService[]; contracted: PortalContractedService[] };
    error?: any;
  }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/services';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) throw new Error(`services endpoint returned ${res.status}`);
      const json = await res.json();
      return {
        data: {
          available: json?.available ?? [],
          contracted: json?.contracted ?? [],
        },
      };
    } catch (e: any) {
      console.error('[ClientPortalService] listServices failed:', e?.message);
      return { data: { available: [], contracted: [] }, error: { message: e?.message || 'listServices failed' } };
    }
  }

  /**
   * List the variants of a service the client can contract. Returns empty list
   * if the service has no variants or if it's not contractable.
   */
  async listServiceVariants(serviceId: string): Promise<{
    data: { has_variants: boolean; variants: PortalServiceVariant[] };
    error?: any;
  }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/services/${encodeURIComponent(serviceId)}/variants`;

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`variants endpoint returned ${res.status}: ${txt.substring(0, 500)}`);
      }
      const json = await res.json();
      return {
        data: {
          has_variants: !!json?.has_variants,
          variants: json?.variants ?? [],
        },
      };
    } catch (e: any) {
      console.error('[ClientPortalService] listServiceVariants failed:', e?.message);
      return { data: { has_variants: false, variants: [] }, error: { message: e?.message || 'listServiceVariants failed' } };
    }
  }

  /**
   * Contract a service for the current client. Returns the new contracted_services
   * row. The BFF validates that the service is `is_public = true`, `is_bookable = true`,
   * and `allow_direct_contracting = true` before inserting. If a `variant_id` is
   * provided, the BFF uses the variant's name and price.
   */
  async contractService(payload: {
    service_id: string;
    variant_id?: string | null;
    pricing_period?: 'one-time' | 'monthly' | 'annually' | 'custom' | null;
    start_date?: string | null;
    recurrence_type?: 'monthly' | 'weekly' | 'yearly' | null;
    recurrence_day?: number | null;
    recurrence_start?: string | null;
    recurrence_end?: string | null;
  }): Promise<{ data: PortalContractedService | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-modules/services/contract';

      const res = await fetch(bffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`contract service endpoint returned ${res.status}: ${txt.substring(0, 500)}`);
      }
      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] contractService failed:', e?.message);
      return { data: null, error: { message: e?.message || 'contractService failed' } };
    }
  }

  /** Create a task in a project. */
  async createTask(projectId: string, input: { title: string; due_date?: string | null }): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(projectId)}/tasks`;

      const res = await fetch(bffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `create-task returned ${res.status}`);
      }
      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] createTask failed:', e?.message);
      return { data: null, error: { message: e?.message || 'createTask failed' } };
    }
  }

  /** Update a task (toggle complete, rename, set due_date). */
  async updateTask(projectId: string, taskId: string, patch: { title?: string; is_completed?: boolean; due_date?: string | null }): Promise<{ success: boolean; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;

      const res = await fetch(bffUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(patch),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `update-task returned ${res.status}`);
      }
      return { success: true };
    } catch (e: any) {
      console.error('[ClientPortalService] updateTask failed:', e?.message);
      return { success: false, error: { message: e?.message || 'updateTask failed' } };
    }
  }

  /** Delete a task. */
  async deleteTask(projectId: string, taskId: string): Promise<{ success: boolean; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`;

      const res = await fetch(bffUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `delete-task returned ${res.status}`);
      }
      return { success: true };
    } catch (e: any) {
      console.error('[ClientPortalService] deleteTask failed:', e?.message);
      return { success: false, error: { message: e?.message || 'deleteTask failed' } };
    }
  }

  /** Add a comment to a project. */
  async addComment(projectId: string, content: string): Promise<{ data: any | null; error?: any }> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + `/functions/v1/client-portal-modules/projects/${encodeURIComponent(projectId)}/comments`;

      const res = await fetch(bffUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `add-comment returned ${res.status}`);
      }
      const json = await res.json();
      return { data: json?.data ?? null };
    } catch (e: any) {
      console.error('[ClientPortalService] addComment failed:', e?.message);
      return { data: null, error: { message: e?.message || 'addComment failed' } };
    }
  }
}
