import { Injectable, inject } from "@angular/core";
import { SupabaseClient } from "@supabase/supabase-js";
import { PortalAuthService } from "./portal-auth.service";

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
    const user = await this.auth.getCurrentClient();
    if (!user?.client_id) return { data: [], error: "No client context" };

    try {
      const { data, error } = await this.supabase
        .from("quotes")
        .select("*")
        .eq("client_id", user.client_id)
        .neq("status", "cancelled")
        .order("quote_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      return { data: (data || []) as any, error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || "listQuotes failed" },
      };
    }
  }

  async getQuote(id: string): Promise<{ data: any | null; error?: any }> {
    try {
      const { data, error } = await this.supabase
        .from("quotes")
        .select(
          "id, full_quote_number, title, status, quote_date, valid_until, total_amount, currency, items:quote_items(*)",
        )
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { data: null, error: "Quote not found" };
      return { data: data || null, error: null };
    } catch (e: any) {
      return {
        data: null,
        error: { message: e?.message || "getQuote failed" },
      };
    }
  }

  async listInvoices(): Promise<{ data: any[]; error?: any }> {
    const user = await this.auth.getCurrentClient();
    if (!user?.client_id) return { data: [], error: "No client context" };

    try {
      const { data, error } = await this.supabase
        .from("invoices")
        .select("*")
        .eq("client_id", user.client_id)
        .neq("status", "void")
        .neq("status", "cancelled")
        .order("invoice_date", { ascending: false })
        .limit(200);

      if (error) throw error;
      return { data: (data || []) as any, error: null };
    } catch (e: any) {
      return {
        data: [],
        error: { message: e?.message || "listInvoices failed" },
      };
    }
  }

  async getInvoice(id: string): Promise<{ data: any | null; error?: any }> {
    try {
      const { data, error } = await this.supabase
        .from("invoices")
        .select("*, items:invoice_items(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return { data: null, error: "Invoice not found" };
      return { data: data, error: null };
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
}
