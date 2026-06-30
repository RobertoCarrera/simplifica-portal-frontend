// Edge Function: portal-request-otp
// Purpose: Deliver a magic-link / "create your account" link to a portal client.
//
// Why this function exists at all:
//   The anon-key `supabase.auth.signInWithOtp` path is broken in the portal
//   Supabase project (throws "Database error updating user" + 500 for clients).
//   Routing the request through this edge function — which uses service_role —
//   avoids the broken path while keeping the magic-link verify on `/auth/callback`
//   unchanged.
//
// Why `generateLink` (NOT `signInWithOtp` and NOT `inviteUserByEmail`):
//   - `signInWithOtp` + `shouldCreateUser:false` is an anti-enumeration
//     silent-no-op: for new emails (no auth.users row) it returns 200 without
//     actually sending anything. Clients see "Enlace enviado" but get nothing.
//     This was the original RGPD/UX bug.
//   - `signInWithOtp` + `shouldCreateUser:true` fixes the new-user gap but the
//     email is sent by Supabase Auth's built-in magic-link template, which is
//     unbranded and offers no per-company branding.
//   - `inviteUserByEmail` (the previous fix) creates the user on click and
//     sends Supabase Auth's "set your password" template. It works, but the
//     template cannot use the company's SES-verified identity nor the
//     branded HTML the CRM uses elsewhere.
//   - `admin.auth.admin.generateLink({ type: 'magiclink' })` returns a fully
//     signed `action_link` that (a) creates the user on click if it doesn't
//     exist and (b) authenticates an existing user as a magic link — WITHOUT
//     sending the email itself. That lets US send via the verified SES
//     pipeline (`client-portal-bff` /send-link-email) using the company's
//     `company_email_accounts` SES identity for full RGPD-compliant branding.
//
// Behaviour:
//   - POST { email }  →  200 { success: true, action_link }
//   - 400 on malformed email / invalid JSON
//   - 429 on per-IP rate limit breach (5/min)
//   - 500 on hard infra errors (so the frontend can show a real failure
//     instead of falsely claiming "Enlace enviado")
//   - Anti-enumeration preserved: `generateLink` always produces an
//     action_link (the user is created on click). The response is 200 in
//     both cases.
//
// Auth: verify_jwt = false (called from the anon key). The service_role
// client is used internally; it lives in the same project as the
// `client-portal-bff` will then deliver the email via the CRM's verified SES.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PUBLIC_SITE_URL =
  Deno.env.get('PUBLIC_SITE_URL') ?? 'https://portal.simplificacrm.es';

/**
 * Resolve the email-redirect base URL.
 *
 *   - If the request Origin is a localhost URL, use that origin as the base.
 *     This lets developers test the OTP flow locally without touching env vars
 *     or the Supabase dashboard redirect allowlist (per-origin only).
 *   - Otherwise fall back to PUBLIC_SITE_URL (prod).
 *
 * Why not just use PUBLIC_SITE_URL for everything: production users would get
 * a magic link pointing to localhost. We only opt-in to localhost when the
 * caller is the local dev server itself.
 */
function resolveRedirectBase(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  // Only trust localhost for redirect — never accept arbitrary upstream hosts.
  const m = origin.match(/^http:\/\/localhost(:\d+)?$/);
  if (m) return origin;
  return PUBLIC_SITE_URL;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

// ── Inlined helpers (intentionally local to keep this function self-contained
//    for the Supabase bundler, which does not resolve ../_shared at deploy time).

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  'Referrer-Policy': 'no-referrer',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Cache-Control': 'no-store',
  'Content-Security-Policy': "default-src 'none'",
};

const ALLOWED_ORIGINS = ['https://portal.simplificacrm.es'];

function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.includes(origin) || /^http:\/\/localhost(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function getClientIP(req: Request): string {
  const cf = req.headers.get('CF-Connecting-IP');
  if (cf) return cf.trim();
  const realIp = req.headers.get('X-Real-IP');
  if (realIp) return realIp.trim();
  const forwarded = req.headers.get('X-Forwarded-For');
  if (forwarded) return forwarded.split(',')[0].trim();
  return 'unknown';
}

// In-memory rate limiter (per-isolate). Supabase's anon path is broken anyway
// and we are not protecting against a coordinated DoS — we just need to
// throttle a single client making many requests. Upstash is not configured
// for this function.
const _rlStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; remaining: number; resetAt: number; limit: number } {
  const now = Date.now();
  const entry = _rlStore.get(key);
  if (!entry || now >= entry.resetAt) {
    const resetAt = now + windowMs;
    _rlStore.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: limit - 1, resetAt, limit };
  }
  entry.count++;
  const allowed = entry.count <= limit;
  return {
    allowed,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
    limit,
  };
}

function getRateLimitHeaders(r: { limit: number; remaining: number; resetAt: number }): Record<string, string> {
  return {
    'X-RateLimit-Limit': r.limit.toString(),
    'X-RateLimit-Remaining': r.remaining.toString(),
    'X-RateLimit-Reset': new Date(r.resetAt).toISOString(),
    'Retry-After': Math.ceil(Math.max(0, r.resetAt - Date.now()) / 1000).toString(),
  };
}

function jsonResponse(
  status: number,
  body: unknown,
  corsHeaders: Record<string, string>,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...SECURITY_HEADERS, ...corsHeaders, ...extraHeaders, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', {
      status: 405,
      headers: corsHeaders,
    });
  }

  // ── Parse + validate body ────────────────────────────────────────────────────
  let email = '';
  try {
    const body = await req.json();
    if (body && typeof body === 'object' && typeof body.email === 'string') {
      email = body.email.trim().toLowerCase();
    }
  } catch {
    return jsonResponse(400, { success: false, error: 'invalid_json' }, corsHeaders);
  }

  if (!email || !EMAIL_REGEX.test(email) || email.length > 320) {
    return jsonResponse(400, { success: false, error: 'invalid_email' }, corsHeaders);
  }

  // ── Per-IP rate limit ───────────────────────────────────────────────────────
  const clientIp = getClientIP(req);
  const rl = checkRateLimit(`portal-request-otp:${clientIp}`, RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.allowed) {
    return jsonResponse(
      429,
      { success: false, error: 'rate_limited' },
      corsHeaders,
      getRateLimitHeaders(rl),
    );
  }

  // ── Service-role admin client ───────────────────────────────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[portal-request-otp] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse(500, { success: false, error: 'server_misconfigured' }, corsHeaders);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // ── Generate the magic-link action_link (does NOT send email) ─────────────
  //
  // `admin.auth.admin.generateLink({ type: 'magiclink' })` is the only auth
  // primitive that:
  //   (a) creates the auth.users row on click for unknown emails (fixes the
  //       RGPD bug where new clients saw "Enlace enviado" but got nothing)
  //   (b) returns the action_link so we can deliver it via OUR verified SES
  //       pipeline (CRM's company_email_accounts), with branded HTML
  //   (c) works for both new-user onboarding AND existing-user re-auth
  //
  // We do NOT use `signInWithOtp` (user-facing, no row creation) and we do
  // NOT use `inviteUserByEmail` (sends Supabase's unbranded template).
  //
  // Hard-error contract: if generateLink fails for ANY reason, we return 500
  // so the frontend can surface a real error instead of falsely showing
  // "Enlace enviado" and leaving the user staring at their inbox. The
  // anti-enumeration invariant still holds: in the happy path, generateLink
  // always produces an action_link (Supabase creates the user on click).
  try {
    const redirectBase = resolveRedirectBase(req);
    const { data, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${redirectBase}/auth/callback` },
    });

    // Supabase JS 2.x: action_link lives at data.properties.action_link
    const actionLink = data?.properties?.action_link;

    if (linkErr || !actionLink) {
      console.error('[portal-request-otp] generateLink failed:', {
        email,
        status: (linkErr as any)?.status,
        name: (linkErr as any)?.name,
        message: linkErr?.message ?? 'no_action_link',
      });
      return jsonResponse(
        500,
        { success: false, error: 'service_unavailable' },
        corsHeaders,
      );
    }

    // Happy path — anti-enumeration: action_link is produced for both new
    // and existing emails. The user is created on click. The frontend will
    // POST this action_link to client-portal-bff /send-link-email for SES
    // delivery.
    return jsonResponse(
      200,
      { success: true, action_link: actionLink },
      corsHeaders,
    );
  } catch (e: any) {
    console.error('[portal-request-otp] generateLink threw:', {
      email,
      name: e?.name,
      message: e?.message,
    });
    return jsonResponse(
      500,
      { success: false, error: 'service_unavailable' },
      corsHeaders,
    );
  }
});
