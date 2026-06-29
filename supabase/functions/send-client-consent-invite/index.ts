// Edge Function: send-client-consent-invite
// Purpose: Send GDPR consent invitation email to a client.
// Two auth paths:
//   1. Direct user call (frontend) — requires a valid user JWT and owner/admin role.
//   2. Service call from send-campaign orchestrator — signaled by
//      `_service_context: 'campaign_send'` in the body. The orchestrator invokes
//      us with the service-role JWT (supabaseAdmin.functions.invoke forwards it),
//      which the per-user auth.getUser() check would reject. We trust the flag
//      and look up the client directly with the service-role admin client.
// Flow:
//   1. Parse body + determine path
//   2. If service context: look up client + company by client_id
//   3. If user context: validate JWT, check role, look up company
//   4. Generate invitation_token and persist on clients
//   5. Read consent template from company_email_settings (or friendly default)
//   6. Read the email account's from address (ses_from_email or email fallback)
//   7. Build the consent link WITHOUT a token: /consent?c=<company>&e=<email>
//      (the portal identifies the recipient by (company_id, email) pair)
//   8. Render with interpolateSafe() and send via SES directly
//      (with a branded-email attempt first, falling back to direct SES)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";
import { getCorsHeaders } from "../_shared/cors.ts";
import { getClientIP, withSecurityHeaders } from '../_shared/security.ts';
import { checkRateLimit, getRateLimitHeaders } from '../_shared/rate-limiter.ts';
import { interpolateSafe } from '../_shared/escape.ts';

// Fallback direct SES sender
async function sendViaSES(params: {
  html: string;
  to: string;
  subject: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  fromEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  const { html, to, subject, region, accessKeyId, secretAccessKey, fromEmail } = params;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, region, service: 'email' });
  const params_ = new URLSearchParams();
  params_.append('Action', 'SendEmail');
  params_.append('Source', fromEmail);
  params_.append('Destination.ToAddresses.member.1', to);
  params_.append('Message.Subject.Data', subject);
  params_.append('Message.Body.Html.Data', html);
  const res = await aws.fetch(`https://email.${region}.amazonaws.com`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params_.toString(),
  });
  if (!res.ok) {
    const t = await res.text();
    return { success: false, error: t };
  }
  return { success: true };
}

serve(async (req) => {
  // Rate limit by IP
  const ip = getClientIP(req);
  const rl = await checkRateLimit(`send-client-consent-invite:${ip}`, 20, 60000);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: withSecurityHeaders({ ...getCorsHeaders(req), 'Content-Type': 'application/json', ...getRateLimitHeaders(rl) }),
    });
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }

  try {
    // Parse body ONCE — the body shape decides the auth path
    let _body: any = {};
    try { _body = await req.json(); } catch { /* body may be empty for OPTIONS */ }
    const { client_id, _service_context } = _body;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    let companyId: string;
    let client: {
      id: string;
      name: string;
      email: string;
      company_id: string;
      consent_status: string;
    };

    if (_service_context === 'campaign_send') {
      // SERVICE path: trust the orchestrator (send-campaign). The service-role
      // JWT cannot satisfy getUser() — so we skip the per-user auth check and
      // resolve the company from the client row.
      if (!client_id) throw new Error('Client ID is required');

      const { data: c, error: ce } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, company_id, consent_status')
        .eq('id', client_id)
        .single();

      if (ce || !c) throw new Error('Client not found');
      if (!c.email) throw new Error('Client has no email address');

      client = c;
      companyId = c.company_id;
    } else {
      // USER path: validate JWT + role
      const authHeader = req.headers.get('Authorization')!;
      const userClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        throw new Error('Unauthorized');
      }

      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('id, company_id, app_roles(name)')
        .eq('auth_user_id', user.id)
        .single();

      const role = userData?.app_roles?.name;
      if (role !== 'owner' && role !== 'admin') {
        throw new Error('Forbidden: Only admins/owners can send consent invites');
      }

      companyId = userData.company_id;

      if (!client_id) throw new Error('Client ID is required');

      const { data: c, error: ce } = await supabaseAdmin
        .from('clients')
        .select('id, name, email, company_id, consent_status')
        .eq('id', client_id)
        .eq('company_id', companyId)
        .single();

      if (ce || !c) throw new Error('Client not found or access denied');
      if (!c.email) throw new Error('Client has no email address');

      client = c;
    }

    // Fetch company
    const { data: companyData, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('name, nif')
      .eq('id', companyId)
      .single();

    if (companyError || !companyData) {
      throw new Error('Company not found');
    }

    const companyName = companyData.name;

    // Fetch company branding
    let primaryColor = '#4f46e5';
    let companyLogo = '';
    try {
      const { data: brandData } = await supabaseAdmin
        .from('companies')
        .select('logo_url, settings')
        .eq('id', companyId)
        .single();
      if (brandData) {
        primaryColor = brandData.settings?.branding?.primary_color || primaryColor;
        if (brandData.logo_url) {
          companyLogo = `<img src="${brandData.logo_url}" alt="${companyName}" style="max-height:60px;max-width:200px;display:block;margin:0 auto 16px;">`;
        }
      }
    } catch { /* use defaults */ }

    // Generate invitation token (kept on clients for audit + future 1-click resend)
    const token = crypto.randomUUID();
    const sentAt = new Date().toISOString();

    // Update the client with the new token + consent_migration_sent_at
    // (the campaign-orchestrator uses this to enforce one-time-only)
    const { error: updateError } = await supabaseAdmin
      .from('clients')
      .update({
        invitation_token: token,
        invitation_sent_at: sentAt,
        invitation_status: 'sent',
        consent_migration_sent_at: sentAt,
      })
      .eq('id', client.id);

    if (updateError) throw new Error('Failed to update client record: ' + updateError.message);

    // Read the consent email template (per-tenant custom or friendly default)
    const { data: settings } = await supabaseAdmin
      .from('company_email_settings')
      .select('custom_subject_template, custom_body_template')
      .eq('company_id', companyId)
      .eq('email_type', 'consent')
      .eq('is_active', true)
      .maybeSingle();

    // Read the email account's verified from address (priority: ses_from_email > email)
    const { data: account } = await supabaseAdmin
      .from('company_email_accounts')
      .select('email, ses_from_email')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fromEmail = account?.ses_from_email || account?.email || Deno.env.get('SES_FROM_ADDRESS') || 'notifications@simplificacrm.es';

    const AWS_ACCESS_KEY_ID = Deno.env.get('AWS_ACCESS_KEY_ID');
    const AWS_SECRET_ACCESS_KEY = Deno.env.get('AWS_SECRET_ACCESS_KEY');
    const REGION = Deno.env.get('AWS_REGION') ?? 'us-east-1';
    const APP_URL = Deno.env.get('FRONTEND_APP_URL') ?? 'https://app.simplificacrm.es';
    // The portal is served from a separate origin (portal.simplificacrm.es)
    // which hosts the public /consent landing page. Token is no longer exposed
    // in the URL — the portal identifies the recipient by (company_id, email).
    const PORTAL_URL = Deno.env.get('PORTAL_URL') ?? 'https://portal.simplificacrm.es';

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('Missing AWS credentials');
    }

    // RGPD Art. 7.3 — every commercial email MUST offer a free opt-out
    const consentLink = `${PORTAL_URL}/consent?c=${encodeURIComponent(companyId)}&e=${encodeURIComponent(client.email)}`;
    const unsubscribeLink = `${PORTAL_URL}/unsubscribe?c=${encodeURIComponent(companyId)}&e=${encodeURIComponent(client.email)}&type=marketing`;

    const templateVars: Record<string, string> = {
      client_name: client.name,
      client_email: client.email,
      company_name: companyName,
      consent_url: consentLink,
      link: consentLink,
      unsubscribe_url: unsubscribeLink,
    };

    const subject = settings?.custom_subject_template
      ? interpolateSafe(settings.custom_subject_template, templateVars)
      : 'Importante: Actualización de Privacidad y Consentimiento';

    const defaultHtmlBody = `<p>Hola ${client.name},</p>
<p>${companyName} ha actualizado su sistema de gestión y necesitamos que confirmes tus preferencias de privacidad para seguir cumpliendo con el RGPD.</p>
<p>Para validar tus datos y gestionar tus preferencias, haz clic en el siguiente botón:</p>
<p style="margin:24px 0;text-align:center;"><a href="${consentLink}" style="background-color:#4f46e5;color:#ffffff;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Revisar y Validar Datos</a></p>
<p style="font-size:12px;color:#6b7280;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="word-break:break-all;">${consentLink}</span></p>
<p>Este enlace es único y personal. Caduca en 72 horas.</p>
<p>Gracias,<br>${companyName}</p>
<hr>
<p style="font-size:11px;color:#9ca3af;">Conforme al RGPD, tratamos tus datos según nuestra <a href="${APP_URL}/privacidad">política de privacidad</a>.</p>
<p style="font-size:11px;color:#9ca3af;">Si no quieres recibir más comunicaciones, <a href="${unsubscribeLink}">gestiona tu suscripción o da de baja tu email aquí</a>.</p>`;

    const htmlBody = settings?.custom_body_template
      ? interpolateSafe(settings.custom_body_template, templateVars)
      : defaultHtmlBody;

    // Send via SES directly (skipping send-branded-email entirely — it has
    // its own quirks for this email_type and we want a single code path).
    const aws = new AwsClient({
      accessKeyId: AWS_ACCESS_KEY_ID,
      secretAccessKey: AWS_SECRET_ACCESS_KEY,
      region: REGION,
      service: 'email',
    });

    const params_ = new URLSearchParams();
    params_.append('Action', 'SendEmail');
    params_.append('Source', fromEmail);
    params_.append('Destination.ToAddresses.member.1', client.email);
    params_.append('Message.Subject.Data', subject);
    params_.append('Message.Body.Html.Data', htmlBody);

    const response = await aws.fetch(`https://email.${REGION}.amazonaws.com`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params_.toString(),
    });

    if (!response.ok) {
      const txt = await response.text();
      console.error('[send-client-consent-invite] SES Error:', txt);
      throw new Error('Failed to send email via AWS SES: ' + txt);
    }

    return new Response(JSON.stringify({ success: true, message: 'Invitation sent' }), {
      headers: withSecurityHeaders({ ...getCorsHeaders(req), 'Content-Type': 'application/json' }),
    });

  } catch (error: any) {
    console.error('[send-client-consent-invite]', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: withSecurityHeaders({ ...getCorsHeaders(req), 'Content-Type': 'application/json' }),
    });
  }
});
