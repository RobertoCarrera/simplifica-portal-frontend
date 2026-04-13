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
  items?: any[];
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
    const client = this.auth.client;
    const { data, error } = await client
      .from("client_visible_tickets")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(200);
    return { data: (data || []) as any, error };
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
    try {
      const { error } = await this.supabase
        .from("tickets")
        .update({ is_opened: true })
        .eq("id", ticketId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
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
   * Returns the list of active module keys for the client's company.
   * Uses direct fetch to allow GET on the edge function.
   */
  async getActiveModules(): Promise<string[]> {
    try {
      const token = await this.requireAccessToken();
      const anonKey = this.auth.supabaseKey;
      const bffUrl = this.auth.supabaseUrl + '/functions/v1/client-portal-bff/modules';

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
      return (json?.data?.modules ?? []) as string[];
    } catch (e: any) {
      console.error('[ClientPortalService] getActiveModules failed:', e?.message);
      return [];
    }
  }
}
