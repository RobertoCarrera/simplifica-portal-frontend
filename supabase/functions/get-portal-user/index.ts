// Edge Function: get-portal-user
// Purpose: Return the portal user record (client_portal_users + joined clients + users)
// for the currently authenticated user, using service_role to bypass the PostgREST
// schema cache issue where related tables (clients, users, companies) are not
// exposed to the API.
//
// Why this exists:
// The portal frontend used to call PostgREST directly with the embed
//   client_portal_users?select=*,client:clients(*)
// but the PostgREST schema cache in the portal project is stale and does not
// include the clients/users/companies tables, so the embed fails with
// "Could not find a relationship between 'client_portal_users' and 'clients'".
// The PortalRoleGuard then sees a null portalUser and bounces the user back to
// /login in a loop.
//
// This function is the durable workaround. It authenticates the caller via
// the Authorization header (Supabase Auth JWT), uses service_role to read the
// portal user + client + app user, and returns the joined object the frontend
// expects.
//
// Auth: required (Authorization: Bearer <jwt>). verify_jwt = true in config.

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { getCorsHeaders, handleCorsOptions } from '../_shared/cors.ts';

interface PortalUserResponse {
  id: string;
  client_id: string;
  company_id: string;
  company_name: string | null;
  auth_user_id: string;
  email: string;
  name: string | null;
  surname: string | null;
  full_name: string | null;
  role: 'client';
  is_active: boolean;
}

serve(async (req: Request) => {
  // CORS preflight
  const cors = handleCorsOptions(req);
  if (cors) return cors;

  if (req.method !== 'GET' && req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: getCorsHeaders(req),
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[get-portal-user] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  // Verify the caller's JWT using a client built with anon key + Authorization header
  const authHeader = req.headers.get('Authorization') || '';
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Missing bearer token' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
  const token = authHeader.substring(7);

  // Build a user-scoped client to validate the token
  const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '', {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await userClient.auth.getUser(token);
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
      status: 401,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }
  const authUserId = userData.user.id;

  // Service-role client to read across tables regardless of RLS
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // 1) Portal user record (the only one we trust to identify the user as a portal client).
  //
  // Multi-tenant: a single auth user can have multiple client_portal_users rows
  // (one per company). We pick the active company from the JWT
  // (`app_metadata.company_id`) if set; otherwise the first active row by
  // created_at is the fallback.
  const { data: allPortalRows, error: portalErr } = await admin
    .from('client_portal_users')
    .select('id, company_id, client_id, email, auth_user_id, company_name, is_active, created_at')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (portalErr) {
    console.error('[get-portal-user] client_portal_users query failed:', portalErr);
    return new Response(JSON.stringify({ error: 'Failed to load portal user' }), {
      status: 500,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  if (!allPortalRows || allPortalRows.length === 0) {
    return new Response(JSON.stringify({ error: 'No portal user found' }), {
      status: 404,
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    });
  }

  // Allow the frontend to override the active company via ?company_id= or
  // body.company_id. Useful after a switch where the frontend wants the
  // new active company's portal user without having refreshed the JWT yet.
  //
  // SECURITY: the override MUST be in the user's list of memberships. If the
  // user asks for a company they do not belong to, ignore the override and
  // fall through to the app_metadata or default-row selection. This prevents
  // a malicious client from reading another company's portal user via
  // forged ?company_id=.
  const url = new URL(req.url);
  const overrideCompanyId =
    url.searchParams.get('company_id') ||
    (await req.clone().json().catch(() => null))?.company_id ||
    null;

  const appMetadataCompanyId =
    (userData.user.app_metadata as { company_id?: string } | undefined)?.company_id ?? null;

  const portalUser =
    (overrideCompanyId &&
      allPortalRows.find((r) => r.company_id === overrideCompanyId)) ||
    (appMetadataCompanyId &&
      allPortalRows.find((r) => r.company_id === appMetadataCompanyId)) ||
    allPortalRows[0];

  // 2) Public app user (for name/surname)
  const { data: appUser } = await admin
    .from('users')
    .select('id, name, surname, email')
    .eq('auth_user_id', authUserId)
    .maybeSingle();

  // 3) Client record (for completeness; the frontend may want it later)
  const { data: client } = portalUser.client_id
    ? await admin
        .from('clients')
        .select('id, name, surname, business_name, email, auth_user_id, company_id')
        .eq('id', portalUser.client_id)
        .maybeSingle()
    : { data: null };

  const fullName = appUser
    ? `${appUser.name || ''} ${appUser.surname || ''}`.trim()
    : client
      ? `${client.name || ''} ${client.surname || ''}`.trim()
      : null;

  const response: PortalUserResponse = {
    id: appUser?.id || client?.id || portalUser.client_id,
    client_id: portalUser.client_id,
    company_id: portalUser.company_id,
    company_name: portalUser.company_name ?? client?.business_name ?? null,
    auth_user_id: authUserId,
    email: appUser?.email || client?.email || portalUser.email,
    name: appUser?.name ?? client?.name ?? null,
    surname: appUser?.surname ?? client?.surname ?? null,
    full_name: fullName || null,
    role: 'client',
    is_active: portalUser.is_active === true,
  };

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
  });
});

