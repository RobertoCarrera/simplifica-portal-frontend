// Edge Function: portal-request-otp
// Purpose: Workaround for broken anon-key `supabase.auth.signInWithOtp` on the
// portal Supabase project. The anon-key OTP call throws "Database error updating
// user" + 500 for portal clients. Routing the request through this edge function
// (which uses service_role) avoids the broken path while keeping the magic-link
// verify flow on `/auth/callback` unchanged.
//
// Behaviour:
//   - POST { email }  →  200 { success: true } (always, for valid email)
//   - 400 on malformed email
//   - 429 on per-IP rate limit breach (5/min)
//   - Anti-enumeration: unknown / inactive client returns 200 without sending.
//
// Why not just call signInWithOtp with the anon key in the frontend?
//   The anon path triggers an internal UPDATE auth.users whose trigger chain
//   fails with 42P01 in the public project's auth context. The service_role
//   path goes through a different code path in GoTrue that is healthy.
//
// Auth: verify_jwt = false (the function is called from the anon key). The
// service_role client is used internally for the actual OTP send.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const PUBLIC_SITE_URL =
  Deno.env.get('PUBLIC_SITE_URL') ?? 'https://portal.simplificacrm.es';

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
    return jsonResponse(400, { success: false, error: 'invalid_email' }, corsHeaders);
  }

  if (!EMAIL_REGEX.test(email)) {
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

  // ── Anti-enumeration lookup ──────────────────────────────────────────────────
  // If the email does not belong to an active portal client, return success
  // without sending anything. This prevents an attacker from probing which
  // emails are registered.
  try {
    const { data: clientRow, error: lookupErr } = await admin
      .from('client_portal_users')
      .select('id')
      .eq('email', email)
      .eq('is_active', true)
      .maybeSingle();

    if (lookupErr) {
      console.error('[portal-request-otp] client_portal_users lookup failed:', lookupErr.message);
      // Do not leak DB errors. Treat as "no client" → return success.
      return jsonResponse(200, { success: true }, corsHeaders);
    }

    if (!clientRow) {
      // Unknown / inactive email — anti-enumeration: pretend success.
      return jsonResponse(200, { success: true }, corsHeaders);
    }
  } catch (e: any) {
    console.error('[portal-request-otp] lookup threw:', e?.message ?? e);
    return jsonResponse(200, { success: true }, corsHeaders);
  }

  // ── Dispatch the magic link via service_role ────────────────────────────────
  try {
    const { error: otpErr } = await admin.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${PUBLIC_SITE_URL}/auth/callback`,
      },
    });

    if (otpErr) {
      console.error('[portal-request-otp] signInWithOtp error:', {
        status: otpErr.status,
        name: (otpErr as any).name,
        message: otpErr.message,
      });
    }
  } catch (e: any) {
    console.error('[portal-request-otp] signInWithOtp threw:', {
      name: e?.name,
      message: e?.message,
    });
  }

  // Anti-enumeration: always 200 on the happy path, regardless of internal send success.
  return jsonResponse(200, { success: true }, corsHeaders);
});
