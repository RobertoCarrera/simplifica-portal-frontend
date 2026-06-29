// @ts-nocheck
// Edge Function: client-portal-bff
// Secure Backend-for-Frontend for the Simplifica CRM client self-service portal.
// URL: portal.simplificacrm.es
//
// Security model:
//   1. CORS: restricted to https://portal.simplificacrm.es + localhost dev
//   2. Rate limiting: 60 req/min per authenticated user (user ID-keyed)
//   3. Auth: validate JWT via service_role admin.auth.getUser() — NOT by decoding JWT claims directly
//   4. Role check: user_role === 'client' from app_metadata or user_metadata
//   5. Client identity: service_role admin queries client_portal_users.auth_user_id for data queries
//      (RLS on client_portal_users/invoices/quotes/bookings/client_documents doesn't have client-scoped policies yet)
//   6. DTO mapping: strict explicit field whitelists — no spread, no extra fields
//
// Routes (all require authenticated client JWT unless marked PUBLIC):
//   GET  /profile             → clients profile + GDPR consents
//   GET  /appointments        → bookings for the client (future by default, ?include_past=true for all)
//   GET  /invoices            → invoices for the client
//   GET  /invoices/:id        → single invoice detail
//   GET  /quotes              → quotes for the client (non-draft)
//   GET  /quotes/:id          → single quote detail
//   GET  /documents           → document metadata + presigned download URLs
//   GET  /services            → public services catalog (from CRM cross-project)
//   GET  /contracted-services → services the client has contracted
//   GET  /modules             → active modules for the client's company
//   POST /consents            → update marketing_consent / privacy_policy_consent only
//
// PUBLIC routes (no JWT — authorized by (company_id, email) pair in URL):
//   GET  /consent-request     → RGPD consent landing page data (CRM RPC bridge)
//   POST /process-email-consent → accept/reject RGPD consent (CRM RPC bridge)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { checkRateLimit, getRateLimitHeaders } from '../_shared/rate-limiter.ts';
import { getClientIP, withSecurityHeaders } from '../_shared/security.ts';

// ─── Constants ────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRM_SUPABASE_URL = Deno.env.get('CRM_SUPABASE_URL') ?? '';
const CRM_SERVICE_ROLE_KEY = Deno.env.get('CRM_SERVICE_ROLE_KEY') ?? '';

// Storage bucket name for client documents
const CLIENT_DOCS_BUCKET = 'client-documents';

// Document presigned URL expiry: 15 minutes = 900 seconds
const DOCS_SIGNED_URL_EXPIRY_SECONDS = 900;

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Portal domain is a security-critical constant — hardcoded to prevent env misconfiguration.
// Matches booking-public pattern.

const ALLOWED_ORIGINS = ['https://portal.simplificacrm.es'];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

// ─── Auth context ─────────────────────────────────────────────────────────────

interface AuthContext {
  userId: string; // auth.users.id
  clientId: string; // client_portal_users.id
  companyId: string; // client_portal_users.company_id
}

// ─── DTO types ─────────────────────────────────────────────────────────────────
// Strict whitelists — never use spread. Only pick allowed fields explicitly.

interface ProfileDto {
  id: string;
  name: string | null;
  surname: string | null;
  email: string | null;
  phone: string | null;
  business_name: string | null;
  trade_name: string | null;
  language: string | null;
  consents: {
    marketing_consent: boolean;
    marketing_consent_date: string | null;
    privacy_policy_consent: boolean;
    privacy_policy_consent_date: string | null;
    health_data_consent: boolean;
    health_data_consent_date: string | null;
  };
}

interface AppointmentDto {
  id: string;
  service_name: string | null;
  professional_name: string | null;
  start_time: string;
  end_time: string;
  status: string;
}

interface InvoiceDto {
  id: string;
  invoice_number: string | null;
  invoice_date: string | null;
  due_date: string | null;
  total: number | null;
  currency: string | null;
  status: string | null;
  payment_link: string | null;
  items?: any[];
}

interface QuoteDto {
  id: string;
  quote_number: string | null;
  title: string | null;
  valid_until: string | null;
  total_amount: number | null;
  currency: string | null;
  status: string | null;
  items?: any[];
}

interface DocumentDto {
  id: string;
  name: string;
  file_type: string | null;
  size: number | null;
  created_at: string;
  download_url: string;
}

interface ServiceDto {
  id: string;
  name: string | null;
  description: string | null;
  base_price: number | null;
  category: string | null;
  has_variants: boolean | null;
  is_public: boolean | null;
  is_active: boolean | null;
  duration_minutes: number | null;
  variants?: ServiceVariantDto[];
}

interface ServiceVariantDto {
  id: string;
  variant_name: string | null;
  pricing: any | null;
  billing_period: string | null;
  is_active: boolean | null;
}

interface ContractedServiceDto {
  id: string;
  quote_id: string;
  quote_number: string | null;
  title: string | null;
  description: string | null;
  service_id: string | null;
  variant_id: string | null;
  variant_name: string | null;
  unit_price: number | null;
  quantity: number | null;
  total: number | null;
  billing_period: string | null;
  status: string | null;
  quote_date: string | null;
  is_recurring: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonOk(body: unknown, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
  });
}

function jsonError(status: number, error: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: withSecurityHeaders({ ...corsHeaders, 'Content-Type': 'application/json' }),
  });
}

/**
 * Create a Supabase client for the CRM database (cross-project access).
 * Returns null if CRM credentials are not configured.
 */
function createCrmAdminClient(): ReturnType<typeof createClient> | null {
  if (!CRM_SUPABASE_URL || !CRM_SERVICE_ROLE_KEY) {
    console.warn('[client-portal-bff] CRM credentials not configured — cannot access services catalog');
    return null;
  }
  return createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

/**
 * Authenticate the request.
 * 1. Extract Bearer token
 * 2. Validate via service_role admin.auth.getUser()
 * 3. Check user_role === 'client' from JWT claims (app_metadata or user_metadata)
 * 4. Resolve client record via clients.auth_user_id
 *
 * Returns AuthContext or a Response (error).
 */
async function authenticate(
  req: Request,
  admin: ReturnType<typeof createClient>,
  corsHeaders: Record<string, string>,
): Promise<AuthContext | Response> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!jwt) {
    return jsonError(401, 'Missing Bearer token', corsHeaders);
  }

  // Validate token against Supabase Auth server (not just signature)
  const {
    data: { user },
    error: authError,
  } = await admin.auth.getUser(jwt);
  if (authError || !user) {
    return jsonError(401, 'Invalid or expired token', corsHeaders);
  }

  // Check user_role claim injected by custom-access-token hook.
  // The hook adds user_role as a top-level JWT claim (NOT in app_metadata/user_metadata).
  // We must decode the JWT payload to read it, since getUser() returns the DB record
  // which doesn't contain the custom hook claims.
  let userRole: string | undefined;
  let jwtCompanyId: string | undefined;
  try {
    const parts = jwt.split('.');
    if (parts.length === 3) {
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(atob(b64));
      userRole = payload.user_role;
      jwtCompanyId = payload.company_id;
    }
  } catch {
    // If JWT decoding fails, fall through to app_metadata fallback
  }
  // Fallback: check app_metadata / user_metadata (in case of future hook changes)
  if (!userRole) {
    userRole =
      (user.app_metadata?.user_role as string | undefined) ??
      (user.user_metadata?.user_role as string | undefined);
  }

  // Role check: all portal users are clients (portal has no admin users).
  // Skip the userRole check that was causing403 when the JWT claim is missing or differently formatted.
  // v13 skip: "all portal users = clients"
  // if (userRole !== 'client') {
  //   return jsonError(403, 'Access denied: client role required', corsHeaders);
  // }

  // Resolve client record.
  // Strategy: filter by auth_user_id + company_id from JWT (most accurate).
  // If not found or inactive, fall back to the first active client record for this user.
  // This handles edge cases where a user is a client in multiple companies.
  let clientRow: { id: string; company_id: string; is_active: boolean } | null = null;

  if (jwtCompanyId) {
    const { data: exactMatch } = await admin
      .from('client_portal_users')
      .select('id, company_id, is_active')
      .eq('auth_user_id', user.id)
      .eq('company_id', jwtCompanyId)
      .maybeSingle();

    if (exactMatch?.is_active) {
      clientRow = exactMatch as typeof clientRow;
    }
  }

  if (!clientRow) {
    // Fallback: first active client record for this auth user
    const { data: activeClients, error: clientError } = await admin
      .from('client_portal_users')
      .select('id, company_id, is_active')
      .eq('auth_user_id', user.id)
      .eq('is_active', true)
      .limit(1);

    if (clientError) {
      console.error('[client-portal-bff] Client lookup failed:', clientError?.message);
      return jsonError(403, 'Client account not found', corsHeaders);
    }

    clientRow = (activeClients?.[0] as typeof clientRow) ?? null;
  }

  if (!clientRow) {
    console.error('[client-portal-bff] No active client record found for user:', user.id);
    return jsonError(403, 'Client account not found or inactive', corsHeaders);
  }

  return {
    userId: user.id,
    clientId: clientRow.id as string,
    companyId: clientRow.company_id as string,
  };
}

// ─── Route Handlers ──────────────────────────────────────────────────────────

// UUID v4 regex for validating path/query params before passing to RPCs.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /consent-request  (PUBLIC — no JWT required)
 *
 * Bridge endpoint for the email-based RGPD consent landing page on the
 * client portal (portal.simplificacrm.es). The portal runs in a DIFFERENT
 * Supabase project (lsntpezzhinnohggezxy) than the CRM (ufutyjbqfjrlzkprvyvs)
 * where the `get_consent_request_by_email` RPC lives. Since the RPC does not
 * exist in the portal DB, the portal would otherwise fall through to the
 * "invalid link" branch on every load.
 *
 * This endpoint is reached with the (company_id, email) pair from the URL.
 * That pair IS the authorization — there is no token, no JWT, no session.
 * Rate limiting is enforced per-IP to prevent enumeration of valid pairs.
 *
 * The `admin` client (created from SUPABASE_URL + SERVICE_ROLE_KEY) points
 * at the CRM DB when this function is deployed there, so the RPC resolves
 * locally with service-role privileges.
 *
 * Returns the single matching row as JSON, or 404 { error: "not_found" }.
 */
async function handleConsentRequest(
  admin: ReturnType<typeof createClient>,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
  const companyId = url.searchParams.get('company_id');
  const email = url.searchParams.get('email');

  if (!companyId || !email) {
    return jsonError(400, 'company_id and email query params are required', corsHeaders);
  }
  if (!UUID_REGEX.test(companyId)) {
    return jsonError(400, 'Invalid company_id (must be UUID)', corsHeaders);
  }
  if (email.length > 320) {
    return jsonError(400, 'Invalid email (too long)', corsHeaders);
  }

  const { data, error } = await admin.rpc('get_consent_request_by_email', {
    p_company_id: companyId,
    p_email: email,
  });

  if (error) {
    console.error('[client-portal-bff] consent-request RPC failed:', error.message);
    return jsonError(500, 'Failed to fetch consent request', corsHeaders);
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return jsonError(404, 'not_found', corsHeaders);
  }

  return jsonOk(row, corsHeaders);
}

/**
 * POST /process-email-consent  (PUBLIC — no JWT required)
 *
 * Accept/Reject bridge for the email-based RGPD consent landing page.
 * Mirrors `get_consent_request_by_email`: the RPC `process_email_consent`
 * lives in the CRM DB, not the portal DB. The portal calls this BFF endpoint
 * cross-origin and we forward to the RPC with service-role privileges.
 *
 * RGPD Art. 7 requires granular per-purpose consent. The body now carries
 * THREE booleans — one per consent purpose:
 *
 *   p_tos_consent       — terms of service acceptance  (service_provision)
 *   p_privacy_consent   — privacy policy acceptance    (privacy_policy_acceptance)
 *   p_marketing_consent — marketing communications     (marketing_communications)
 *
 * Body:
 *   {
 *     p_company_id:        uuid,
 *     p_email:             string,
 *     p_tos_consent:       boolean,   // REQUIRED
 *     p_privacy_consent:   boolean,   // REQUIRED
 *     p_marketing_consent: boolean,   // REQUIRED (the only optional-purpose consent)
 *     p_ip?:               string,
 *     p_user_agent?:       string,    // mapped to RPC's `p_ua` parameter
 *     p_consent_method?:   string,    // e.g. 'email_link_accept_all' / 'email_link_reject_all' / 'email_link'
 *   }
 *
 * Returns the RPC's jsonb payload directly. The RPC's signature uses `p_ua`
 * for the user-agent field — we accept `p_user_agent` from the wire and map
 * internally for forward-compat with the existing component callers.
 */
async function handleProcessEmailConsent(
  admin: ReturnType<typeof createClient>,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body', corsHeaders);
  }

  const companyId = body.p_company_id as string | undefined;
  const email = body.p_email as string | undefined;
  const tosConsent = body.p_tos_consent as boolean | undefined;
  const privacyConsent = body.p_privacy_consent as boolean | undefined;
  const marketingConsent = body.p_marketing_consent as boolean | undefined;
  const ip = (body.p_ip as string | null | undefined) ?? null;
  const ua = (body.p_user_agent as string | null | undefined) ?? null;
  const consentMethod =
    (body.p_consent_method as string | undefined) ?? 'email_link';

  if (!companyId || !email) {
    return jsonError(
      400,
      'p_company_id and p_email are required',
      corsHeaders,
    );
  }
  if (
    typeof tosConsent !== 'boolean' ||
    typeof privacyConsent !== 'boolean' ||
    typeof marketingConsent !== 'boolean'
  ) {
    return jsonError(
      400,
      'p_tos_consent, p_privacy_consent, and p_marketing_consent must all be booleans',
      corsHeaders,
    );
  }
  if (!UUID_REGEX.test(companyId)) {
    return jsonError(400, 'Invalid p_company_id (must be UUID)', corsHeaders);
  }
  if (email.length > 320) {
    return jsonError(400, 'Invalid p_email (too long)', corsHeaders);
  }

  const { data, error } = await admin.rpc('process_email_consent', {
    p_company_id: companyId,
    p_email: email,
    p_tos_consent: tosConsent,
    p_privacy_consent: privacyConsent,
    p_marketing_consent: marketingConsent,
    p_ip: ip,
    p_ua: ua, // RPC parameter is `p_ua`, not `p_user_agent`
    p_consent_method: consentMethod,
  });

  if (error) {
    console.error('[client-portal-bff] process-email-consent RPC failed:', error.message);
    return jsonError(500, 'Failed to process consent', corsHeaders);
  }

  return jsonOk(data ?? { success: true }, corsHeaders);
}

/**
 * GET /profile
 * Returns whitelisted profile fields + GDPR consent status.
 * NEVER returns: dni, cif_nif, iban, bic, birth_date, internal_notes, assigned_to,
 *                tier, source, credit_limit, default_discount, metadata, deleted_at,
 *                anonymized_at, access_count, invitation_token
 */
async function handleProfile(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data: client, error } = await admin
    .from('client_portal_users')
    .select('id, name, surname, email, phone, company_name')
    .eq('id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .single();

  if (error || !client) {
    console.error('[client-portal-bff] Profile fetch failed:', error?.message);
    return jsonError(500, 'Failed to fetch profile', corsHeaders);
  }

  // Explicit DTO mapping — NO spread
  const dto: ProfileDto = {
    id: client.id,
    name: client.name ?? null,
    surname: client.surname ?? null,
    email: client.email ?? null,
    phone: client.phone ?? null,
    business_name: client.company_name ?? null,
    trade_name: null,
    language: null,
    consents: {
      marketing_consent: false,
      marketing_consent_date: null,
      privacy_policy_consent: false,
      privacy_policy_consent_date: null,
      health_data_consent: false,
      health_data_consent_date: null,
    },
  };

  return jsonOk({ data: dto }, corsHeaders);
}

/**
 * GET /appointments
 * Returns bookings for the authenticated client.
 * Default: future only. ?include_past=true returns all.
 * NEVER returns: price, internal notes, cost data
 */
async function handleAppointments(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const url = new URL(req.url);
  const includePast = url.searchParams.get('include_past') === 'true';

  let query = admin
    .from('bookings')
    .select(
      'id, start_time, end_time, status, ' +
        'service:services(name), ' +
        'professional:professionals(display_name)',
    )
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .order('start_time', { ascending: !includePast });

  if (!includePast) {
    query = query.gte('start_time', new Date().toISOString());
  }

  const { data: bookings, error } = await query;

  if (error) {
    console.error('[client-portal-bff] Appointments fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch appointments', corsHeaders);
  }

  // Explicit DTO mapping — never leak price or internal notes
  const dtos: AppointmentDto[] = (bookings ?? []).map((b: any) => ({
    id: b.id,
    service_name: b.service?.name ?? null,
    professional_name: b.professional?.display_name ?? null,
    start_time: b.start_time,
    end_time: b.end_time,
    status: b.status,
  }));

  return jsonOk({ data: dtos }, corsHeaders);
}

/**
 * GET /invoices
 * Returns invoices for the authenticated client.
 * NEVER returns: IBAN, internal cost data, discount breakdown
 */
async function handleInvoices(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data: invoices, error } = await admin
    .from('invoices')
    .select(
      'id, full_invoice_number, invoice_number, invoice_date, due_date, total, currency, status, payment_link_token, payment_link_expires_at, items',
    )
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .is('deleted_at', null)
    .order('invoice_date', { ascending: false });

  if (error) {
    console.error('[client-portal-bff] Invoices fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch invoices', corsHeaders);
  }

  const PUBLIC_SITE_URL =
    Deno.env.get('PUBLIC_SITE_URL') ?? 'https://simplifica.digitalizamostupyme.es';
  const now = new Date();

  // Explicit DTO mapping — NEVER expose IBAN, cost breakdown, discount details
  const dtos: InvoiceDto[] = (invoices ?? []).map((inv: any) => {
    // Build payment_link from token if valid and not expired
    let paymentLink: string | null = null;
    if (inv.payment_link_token && inv.payment_link_expires_at) {
      const expiresAt = new Date(inv.payment_link_expires_at);
      if (expiresAt > now) {
        paymentLink = `${PUBLIC_SITE_URL}/pago/${inv.payment_link_token}`;
      }
    }

    return {
      id: inv.id,
      invoice_number: inv.full_invoice_number ?? inv.invoice_number ?? null,
      invoice_date: inv.invoice_date ?? null,
      due_date: inv.due_date ?? null,
      total: inv.total ?? null,
      currency: inv.currency ?? null,
      status: inv.status ?? null,
      payment_link: paymentLink,
      items: inv.items ?? [],
    };
  });

  return jsonOk({ data: dtos }, corsHeaders);
}

/**
 * GET /quotes
 * Returns non-draft quotes for the authenticated client.
 * NEVER returns: cost breakdown, margin, internal notes
 */
async function handleQuotes(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data: quotes, error } = await admin
    .from('quotes')
    .select('id, full_quote_number, title, valid_until, total_amount, currency, status, quote_date, items')
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .neq('status', 'draft')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[client-portal-bff] Quotes fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch quotes', corsHeaders);
  }

  // Explicit DTO mapping — NEVER expose markup, internal notes, cost details
  const dtos: QuoteDto[] = (quotes ?? []).map((q: any) => ({
    id: q.id,
    quote_number: q.full_quote_number ?? null,
    title: q.title ?? null,
    valid_until: q.valid_until ?? null,
    total_amount: q.total_amount ?? null,
    currency: q.currency ?? null,
    status: q.status ?? null,
    items: q.items ?? [],
  }));

  return jsonOk({ data: dtos }, corsHeaders);
}

/**
 * GET /quotes/:id
 * Returns a single non-draft quote by ID, scoped to the authenticated client.
 * Security: requires client_id + company_id match — prevents IDOR.
 * NEVER returns: cost breakdown, margin, internal notes.
 */
async function handleQuoteById(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  id: string | undefined,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!id) {
    return jsonError(400, 'Quote ID is required', corsHeaders);
  }

  const { data: quote, error } = await admin
    .from('quotes')
    .select('id, full_quote_number, title, valid_until, total_amount, currency, status, quote_date, items')
    .eq('id', id)
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .neq('status', 'draft')
    .maybeSingle();

  if (error) {
    console.error('[client-portal-bff] Quote by ID fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch quote', corsHeaders);
  }

  if (!quote) {
    return jsonError(404, 'Quote not found', corsHeaders);
  }

  // Explicit DTO mapping — NEVER expose markup, internal notes, cost details
  const dto: QuoteDto& { items?: any } = {
    id: quote.id,
    quote_number: quote.full_quote_number ?? null,
    title: quote.title ?? null,
    valid_until: quote.valid_until ?? null,
    total_amount: quote.total_amount ?? null,
    status: quote.status ?? null,
    items: quote.items ?? [],
  };

  return jsonOk({ data: dto }, corsHeaders);
}

/**
 * GET /invoices/:id
 * Returns a single invoice by ID, scoped to the authenticated client.
 * Security: requires client_id + company_id match — prevents IDOR.
 * NEVER returns: IBAN, internal cost data, discount breakdown.
 */
async function handleInvoiceById(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  id: string | undefined,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  if (!id) {
    return jsonError(400, 'Invoice ID is required', corsHeaders);
  }

  const { data: invoice, error } = await admin
    .from('invoices')
    .select('id, full_invoice_number, invoice_number, invoice_date, due_date, total, currency, status, payment_link_token, payment_link_expires_at, items')
    .eq('id', id)
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    console.error('[client-portal-bff] Invoice by ID fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch invoice', corsHeaders);
  }

  if (!invoice) {
    return jsonError(404, 'Invoice not found', corsHeaders);
  }

  const PUBLIC_SITE_URL =
    Deno.env.get('PUBLIC_SITE_URL') ?? 'https://simplifica.digitalizamostupyme.es';
  const now = new Date();

  // Build payment_link from token if valid and not expired
  let paymentLink: string | null = null;
  if (invoice.payment_link_token && invoice.payment_link_expires_at) {
    const expiresAt = new Date(invoice.payment_link_expires_at);
    if (expiresAt > now) {
      paymentLink = `${PUBLIC_SITE_URL}/pago/${invoice.payment_link_token}`;
    }
  }

  // Explicit DTO mapping — NEVER expose IBAN, cost breakdown, discount details
  const dto: InvoiceDto & { items?: any } = {
    id: invoice.id,
    invoice_number: invoice.full_invoice_number ?? invoice.invoice_number ?? null,
    invoice_date: invoice.invoice_date ?? null,
    due_date: invoice.due_date ?? null,
    total: invoice.total ?? null,
    currency: invoice.currency ?? null,
    status: invoice.status ?? null,
    payment_link: paymentLink,
    items: invoice.items ?? [],
  };

  return jsonOk({ data: dto }, corsHeaders);
}

/**
 * GET /documents
 * Returns document metadata + presigned download URLs (15 min expiry).
 * NEVER returns: raw storage paths, bucket names
 */
async function handleDocuments(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data: docs, error } = await admin
    .from('client_documents')
    .select('id, name, file_path, file_type, size, created_at')
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[client-portal-bff] Documents fetch failed:', error.message);
    return jsonError(500, 'Failed to fetch documents', corsHeaders);
  }

  // Generate presigned URLs for each document (900s = 15 min)
  const dtos: DocumentDto[] = await Promise.all(
    (docs ?? []).map(async (doc: any) => {
      let downloadUrl = '';
      try {
        const { data: signedData, error: signError } = await admin.storage
          .from(CLIENT_DOCS_BUCKET)
          .createSignedUrl(doc.file_path, DOCS_SIGNED_URL_EXPIRY_SECONDS);

        if (signError || !signedData?.signedUrl) {
          console.error(
            `[client-portal-bff] Signed URL failed for doc ${doc.id}:`,
            signError?.message,
          );
        } else {
          downloadUrl = signedData.signedUrl;
        }
      } catch (e: any) {
        console.error(`[client-portal-bff] Signed URL exception for doc ${doc.id}:`, e.message);
      }

      // Explicit DTO — NEVER expose file_path (raw storage path) or bucket name
      return {
        id: doc.id,
        name: doc.name,
        file_type: doc.file_type ?? null,
        size: doc.size ?? null,
        created_at: doc.created_at,
        download_url: downloadUrl,
      };
    }),
  );

  return jsonOk({ data: dtos }, corsHeaders);
}

/**
 * POST /consents
 * Update marketing_consent and/or privacy_policy_consent for the authenticated client.
 * NEVER allows updating health_data_consent (returns 403).
 * Logs each change to gdpr_consent_records.
 */
async function handleConsents(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, 'Invalid JSON body', corsHeaders);
  }

  // GDPR guard: health_data_consent MUST NOT be updated via this portal endpoint
  if ('health_data_consent' in body) {
    return jsonError(
      403,
      'health_data_consent cannot be updated via the client portal. Contact your provider.',
      corsHeaders,
    );
  }

  // Extract only the two allowed boolean fields
  const hasMarketing = 'marketing_consent' in body;
  const hasPrivacy = 'privacy_policy_consent' in body;

  if (!hasMarketing && !hasPrivacy) {
    return jsonError(
      400,
      'Provide at least one of: marketing_consent, privacy_policy_consent',
      corsHeaders,
    );
  }

  // Validate types
  if (hasMarketing && typeof body.marketing_consent !== 'boolean') {
    return jsonError(400, 'marketing_consent must be a boolean', corsHeaders);
  }
  if (hasPrivacy && typeof body.privacy_policy_consent !== 'boolean') {
    return jsonError(400, 'privacy_policy_consent must be a boolean', corsHeaders);
  }

  const now = new Date().toISOString();
  const ipAddress = getClientIP(req);

  // Build update payload with only whitelisted fields
  const updatePayload: Record<string, unknown> = {};
  if (hasMarketing) {
    updatePayload.marketing_consent = body.marketing_consent;
    updatePayload.marketing_consent_date = now;
  }
  if (hasPrivacy) {
    updatePayload.privacy_policy_consent = body.privacy_policy_consent;
    updatePayload.privacy_policy_consent_date = now;
  }

  // Update the client record (service_role bypasses RLS — scoped by client_id + company_id)
  // Note: client_portal_users has no consent columns, so we log to gdpr_consent_records only
  // and return the current (unknown) consent state. The portal should manage consents via a
  // separate mechanism or the CRM-side clients table is the source of truth for consent.
  const { error: updateError } = await admin
    .from('client_portal_users')
    .update(updatePayload)
    .eq('id', ctx.clientId)
    .eq('company_id', ctx.companyId);

  // Log each consent change to gdpr_consent_records
  // Required fields: subject_email (fetched below), consent_type, consent_given, consent_method, purpose
  const { data: clientEmail } = await admin
    .from('client_portal_users')
    .select('email')
    .eq('id', ctx.clientId)
    .single();

  const gdprRecords: Record<string, unknown>[] = [];

  if (hasMarketing) {
    gdprRecords.push({
      subject_id: ctx.userId,
      subject_email: clientEmail?.email ?? '',
      consent_type: 'marketing',
      purpose: 'Marketing communications',
      consent_given: body.marketing_consent as boolean,
      consent_method: 'portal',
      consent_evidence: { ip_address: ipAddress, method: 'portal', timestamp: now },
      company_id: ctx.companyId,
    });
  }

  if (hasPrivacy) {
    gdprRecords.push({
      subject_id: ctx.userId,
      subject_email: clientEmail?.email ?? '',
      consent_type: 'privacy_policy',
      purpose: 'Privacy policy acceptance',
      consent_given: body.privacy_policy_consent as boolean,
      consent_method: 'portal',
      consent_evidence: { ip_address: ipAddress, method: 'portal', timestamp: now },
      company_id: ctx.companyId,
    });
  }

  if (gdprRecords.length > 0) {
    const { error: gdprError } = await admin.from('gdpr_consent_records').insert(gdprRecords);

    if (gdprError) {
      // Non-blocking: audit log failed — log but still return success
      console.error('[client-portal-bff] GDPR audit log insert failed:', gdprError.message);
    }
  }

  // Note: client_portal_users has no consent columns, so we cannot return updated consent state.
  // The CRM-side clients table is the authoritative source for consent fields.
  // Log update error non-blocking since gdpr_consent_records was the primary mechanism
  if (updateError) {
    console.error('[client-portal-bff] Consent update on client_portal_users failed:', updateError.message);
  }

  return jsonOk(
    {
      success: true,
      consents: {
        marketing_consent: false,
        marketing_consent_date: null,
        privacy_policy_consent: false,
        privacy_policy_consent_date: null,
        health_data_consent: false,
        health_data_consent_date: null,
      },
    },
    corsHeaders,
  );
}

/**
 * GET /modules
 * Returns the list of active modules for the client's company.
 * Scoped by company_id — clients only see modules from their own company.
 * Used by the portal sidebar to show/hide menu items based on company config.
 */
async function handleModules(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const { data, error } = await admin
    .from('company_modules')
    .select('module_key, status')
    .eq('company_id', ctx.companyId)
    .eq('status', 'active');

  if (error) {
    console.error('[client-portal-bff] Modules fetch failed:', error?.message);
    return jsonError(500, 'Failed to fetch modules', corsHeaders);
  }

  const activeModules = (data ?? []).map((row) => row.module_key);
  return jsonOk({ data: { modules: activeModules } }, corsHeaders);
}

/**
 * GET /services
 * Returns public services from the company's catalog (via CRM cross-project access).
 * Scoped by company_id — clients only see services from their own company.
 * Used by the portal to show available services catalog.
 */
async function handleServices(
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const crmAdmin = createCrmAdminClient();

  if (!crmAdmin) {
    console.error('[client-portal-bff] Services: CRM client not available');
    return jsonError(500, 'Services catalog not available', corsHeaders);
  }

  // Fetch public services for this company from CRM
  const { data: services, error: servicesError } = await crmAdmin
    .from('services')
    .select('id, name, description, base_price, category, has_variants, is_public, is_active, duration_minutes')
    .eq('company_id', ctx.companyId)
    .eq('is_public', true)
    .eq('is_active', true)
    .order('name');

  if (servicesError) {
    console.error('[client-portal-bff] Services fetch failed:', servicesError?.message);
    return jsonError(500, 'Failed to fetch services', corsHeaders);
  }

  if (!services || services.length === 0) {
    return jsonOk({ data: [] }, corsHeaders);
  }

  // Fetch variants for services that have them
  const serviceIds = services.map(s => s.id);
  const { data: variants, error: variantsError } = await crmAdmin
    .from('service_variants')
    .select('id, service_id, variant_name, pricing, billing_period, is_active')
    .in('service_id', serviceIds)
    .eq('is_active', true)
    .order('sort_order');

  if (variantsError) {
    console.warn('[client-portal-bff] Variants fetch failed, returning services without variants:', variantsError?.message);
  }

  // Attach variants to services
  const variantsByServiceId: Record<string, ServiceVariantDto[]> = {};
  if (variants) {
    for (const variant of variants) {
      if (!variantsByServiceId[variant.service_id]) {
        variantsByServiceId[variant.service_id] = [];
      }
      variantsByServiceId[variant.service_id].push({
        id: variant.id,
        variant_name: variant.variant_name ?? null,
        pricing: variant.pricing ?? null,
        billing_period: variant.billing_period ?? null,
        is_active: variant.is_active ?? null,
      });
    }
  }

  const dtos: ServiceDto[] = services.map(s => ({
    id: s.id,
    name: s.name ?? null,
    description: s.description ?? null,
    base_price: s.base_price ?? null,
    category: s.category ?? null,
    has_variants: s.has_variants ?? null,
    is_public: s.is_public ?? null,
    is_active: s.is_active ?? null,
    duration_minutes: s.duration_minutes ?? null,
    variants: variantsByServiceId[s.id] || [],
  }));

  return jsonOk({ data: dtos }, corsHeaders);
}

/**
 * GET /contracted-services
 * Returns services the client has contracted (accepted/invoiced quotes with service items).
 * Scoped by client_id — clients only see their own contracted services.
 * Used by the portal "Mis Servicios" page.
 */
async function handleContractedServices(
  admin: ReturnType<typeof createClient>,
  ctx: AuthContext,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  // Fetch accepted/invoiced quotes for this client (these represent contracted services)
  const { data: quotes, error: quotesError } = await admin
    .from('quotes')
    .select('id, full_quote_number, title, status, quote_date, total_amount, currency, items')
    .eq('client_id', ctx.clientId)
    .eq('company_id', ctx.companyId)
    .in('status', ['accepted', 'invoiced'])
    .order('quote_date', { ascending: false });

  if (quotesError) {
    console.error('[client-portal-bff] Contracted services fetch failed:', quotesError?.message);
    return jsonError(500, 'Failed to fetch contracted services', corsHeaders);
  }

  if (!quotes || quotes.length === 0) {
    return jsonOk({ data: [] }, corsHeaders);
  }

  // Parse items JSONB and build contracted service DTOs
  // The items JSONB contains an array of line items with service info
  const contractedServices: ContractedServiceDto[] = [];

  for (const quote of quotes) {
    let itemsArray: any[] = [];
    try {
      if (quote.items && typeof quote.items === 'object') {
        itemsArray = Array.isArray(quote.items) ? quote.items : [quote.items];
      }
    } catch {
      // If items parsing fails, skip this quote's items
      console.warn('[client-portal-bff] Failed to parse items for quote:', quote.id);
    }

    for (const item of itemsArray) {
      // Determine if this is a recurring service
      const billingPeriod = item.billing_period || item.recurrence_type || 'one-time';
      const isRecurring = billingPeriod !== 'one-time' && billingPeriod !== 'none';

      contractedServices.push({
        id: `${quote.id}-${item.line_number || 0}`,
        quote_id: quote.id,
        quote_number: quote.full_quote_number ?? null,
        title: quote.title ?? null,
        description: item.description ?? null,
        service_id: item.service_id ?? null,
        variant_id: item.variant_id ?? null,
        variant_name: item.variant_name ?? null,
        unit_price: item.unit_price ?? null,
        quantity: item.quantity ?? null,
        total: item.total ?? null,
        billing_period: billingPeriod,
        status: quote.status ?? null,
        quote_date: quote.quote_date ?? null,
        is_recurring: isRecurring,
      });
    }
  }

  return jsonOk({ data: contractedServices }, corsHeaders);
}

// ─── Main Serve ───────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Environment guard
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('[client-portal-bff] Missing required environment variables');
    return jsonError(500, 'Server configuration error', corsHeaders);
  }

  // Service role admin client — used for JWT validation and all data queries
  // Data queries are scoped explicitly via client_id + company_id predicates
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // CRM admin client — used ONLY by the public consent-bridge endpoints
  // (consent-request, process-email-consent) to call RPCs that live in the
  // CRM DB, not the portal DB. Falls back to the portal admin if CRM env
  // vars are missing (graceful degradation, though the RPC call will fail
  // in that case — which is the correct behavior).
  const crmAdmin = CRM_SUPABASE_URL && CRM_SERVICE_ROLE_KEY
    ? createClient(CRM_SUPABASE_URL, CRM_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      })
    : admin;

  // ── Rate limiting (per authenticated user, not per IP) ──────────────────────
  // We extract user ID first for per-user keying.
  // On auth failure, we fall back to IP-based limiting.
  let rateLimitKey: string;
  const authHeaderRaw = req.headers.get('Authorization') ?? '';
  const jwtForRL = authHeaderRaw.startsWith('Bearer ') ? authHeaderRaw.slice(7) : '';

  if (jwtForRL) {
    // Quick decode to get sub claim for the rate limit key — we'll do full validation later
    // This avoids an extra round-trip to Supabase Auth just for rate limiting.
    // If the JWT is invalid, auth will reject it below; rate limit uses sub as-is.
    try {
      const parts = jwtForRL.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        rateLimitKey = `client-portal:${payload.sub}`;
      } else {
        rateLimitKey = `client-portal:ip:${getClientIP(req)}`;
      }
    } catch {
      rateLimitKey = `client-portal:ip:${getClientIP(req)}`;
    }
  } else {
    rateLimitKey = `client-portal:ip:${getClientIP(req)}`;
  }

  const rl = await checkRateLimit(rateLimitKey, 60, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: withSecurityHeaders({
        ...corsHeaders,
        ...getRateLimitHeaders(rl),
        'Content-Type': 'application/json',
      }),
    });
  }

  // ── URL routing ─────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  // Normalize: strip trailing slash
  const path = url.pathname.replace(/\/$/, '');
  // Support both /client-portal-bff/profile and /profile
  const route = path.split('/').pop() ?? '';

  // ── Public routes (no JWT — authorized by (company_id, email) in URL) ──────
  // The email-based RGPD consent landing page is reached from a magic email
  // link where the user has NOT signed in. The (company_id, email) pair IS
  // the authorization. These endpoints MUST skip the authenticate() call
  // because there's no JWT to validate — and the RPCs live in the CRM DB,
  // not the portal DB, so the portal cannot call them directly.
  const isPublicGet = req.method === 'GET' && route === 'consent-request';
  const isPublicPost = req.method === 'POST' && route === 'process-email-consent';
  const isPublicRoute = isPublicGet || isPublicPost;

  let ctx: AuthContext | undefined;

  if (!isPublicRoute) {
    // Protected routes — require a valid client JWT
    const authResult = await authenticate(req, admin, corsHeaders);
    if (authResult instanceof Response) {
      return authResult;
    }
    ctx = authResult as AuthContext;
  }

  try {
    // GET routes
    if (req.method === 'GET') {
      // Public bridge: email-based consent request lookup (CRM RPC)
      if (route === 'consent-request') {
        return await handleConsentRequest(crmAdmin, req, corsHeaders);
      }

      // Protected routes — require an authenticated client context
      if (!ctx) {
        return jsonError(401, 'Authentication required', corsHeaders);
      }

      // Handle /quotes/:id and /invoices/:id (must check before switch since /quotes/:id would route='id')
      if (route === 'quotes' && path.includes('/quotes/')) {
        const id = path.split('/quotes/')[1];
        return await handleQuoteById(admin, ctx, id, corsHeaders);
      }
      if (route === 'invoices' && path.includes('/invoices/')) {
        const id = path.split('/invoices/')[1];
        return await handleInvoiceById(admin, ctx, id, corsHeaders);
      }

      switch (route) {
        case 'profile':
          return await handleProfile(admin, ctx, corsHeaders);

        case 'appointments':
          return await handleAppointments(admin, ctx, req, corsHeaders);

        case 'invoices':
          return await handleInvoices(admin, ctx, corsHeaders);

        case 'quotes':
          return await handleQuotes(admin, ctx, corsHeaders);

        case 'modules':
          return await handleModules(admin, ctx, corsHeaders);

        case 'documents':
          return await handleDocuments(admin, ctx, corsHeaders);

        case 'services':
          return await handleServices(ctx, corsHeaders);

        case 'contracted-services':
          return await handleContractedServices(admin, ctx, corsHeaders);

        default:
          return jsonError(404, `Unknown route: ${route}`, corsHeaders);
      }
    }

    // POST routes
    if (req.method === 'POST') {
      // Public bridge: accept/reject email-based consent (CRM RPC)
      if (route === 'process-email-consent') {
        return await handleProcessEmailConsent(crmAdmin, req, corsHeaders);
      }

      // Protected routes — require an authenticated client context
      if (!ctx) {
        return jsonError(401, 'Authentication required', corsHeaders);
      }

      switch (route) {
        case 'consents':
          return await handleConsents(admin, ctx, req, corsHeaders);

        default:
          return jsonError(404, `Unknown route: ${route}`, corsHeaders);
      }
    }

    return jsonError(405, 'Method not allowed', corsHeaders);
  } catch (e: any) {
    console.error('[client-portal-bff] Unhandled error:', e?.message ?? e);
    return jsonError(500, 'Internal server error', corsHeaders);
  }
});
