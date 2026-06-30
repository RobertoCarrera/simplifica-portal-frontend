import { Injectable, signal, inject, NgZone } from "@angular/core";
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";
import { BehaviorSubject, Observable, from, of } from "rxjs";
import { map, filter, take, switchMap } from "rxjs/operators";
import {
  IPortalAuth,
  PortalClientUser,
  PortalSession,
} from "../ports/iportal-auth";
import { RuntimeConfigService } from "../config/runtime-config.service";
import { Router } from "@angular/router";
import { environment } from '@env/environment';

/**
 * PortalAuthService — Implementación de IPortalAuth para el portal cliente.
 *
 * Esta clase es la abstracción de auth para el portal separado.
 * NO depende de AuthService del CRM — es completamente standalone.
 *
 * Flujo de auth:
 * 1. Cliente recibe OTP/magic link vía send-company-invite edge function
 * 2. Cliente hace click en enlace mágico → se autentica con Supabase Auth
 * 3. PortalAuthService detecta sesión y obtiene profile del portal
 * 4. ClientPortalService usa getCurrentClient() para obtener client_id
 *
 * El AuthService del CRM no existe en este repo — toda la auth es específica
 * del portal y usa Supabase Auth OTP (magic links) en lugar de password.
 */
@Injectable({ providedIn: "root" })
export class PortalAuthService implements IPortalAuth {
  private supabase!: SupabaseClient;
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private runtimeConfig = inject(RuntimeConfigService);

  // Session timeout: 1 hour max
  private static readonly SESSION_MAX_AGE_MS = 60 * 60 * 1000;
  private static readonly SESSION_CHECK_INTERVAL_MS = 60 * 1000;
  private static readonly SESSION_START_KEY = 'portal_session_start';
  private sessionCheckTimer: ReturnType<typeof setInterval> | null = null;

  // Reactive state
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private portalUserSubject = new BehaviorSubject<PortalClientUser | null>(
    null,
  );
  private loadingSubject = new BehaviorSubject<boolean>(true);

  // Signals
  authState = signal<boolean>(false);
  // Active company for multi-tenant clients. Read from the JWT's
  // app_metadata.company_id and refreshed by switchCompany().
  activeCompanyId = signal<string | null>(null);

  // Observables públicos
  currentUser$ = this.currentUserSubject.asObservable();
  portalUser$ = this.portalUserSubject.asObservable();
  currentClient$: Observable<PortalClientUser | null> =
    this.portalUserSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  /** Extract the active company_id from the user's app_metadata on the JWT. */
  private resolveActiveCompanyId(user: User | null): string | null {
    if (!user) return null;
    const meta = (user as any).app_metadata as { company_id?: string } | undefined;
    return meta?.company_id ?? null;
  }

  /**
   * Public accessor for the active company_id (mirrors `activeCompanyId` signal).
   * Used by callers that want a method-call syntax (e.g. `this.companyId()`)
   * without needing the signal getter.
   */
  companyId(): string | null {
    return this.activeCompanyId();
  }

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    // RuntimeConfigService is loaded via APP_INITIALIZER before any service is instantiated,
    // so runtimeConfig.get() is already populated when this constructor runs.
    const supabaseConfig = this.runtimeConfig.getSupabase();
    const supabaseUrl = supabaseConfig?.url?.trim() || environment.supabase.url || '';
    const supabaseAnonKey = supabaseConfig?.anonKey?.trim() || environment.supabase.anonKey || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        "⚠️ PortalAuth: SUPABASE_URL or SUPABASE_ANON_KEY not configured",
      );
      this.loadingSubject.next(false);
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });

    // Initialize auth state
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();

      if (session?.user) {
        await this.setCurrentUser(session.user);
        this.startSessionTimer();
      } else {
        this.clearUserData();
      }
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error initializing auth:", error);
    } finally {
      this.loadingSubject.next(false);
    }

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (session?.user) {
          this.setCurrentUser(session.user);
          this.startSessionTimer();
        }
      } else if (event === "SIGNED_OUT") {
        this.clearUserData();
        this.stopSessionTimer();
      }
    });
  }

  private async setCurrentUser(user: User): Promise<void> {
    this.loadingSubject.next(true);
    this.currentUserSubject.next(user);
    this.authState.set(true);
    this.activeCompanyId.set(this.resolveActiveCompanyId(user));

    try {
      // Fetch portal user profile from client_portal_users + users
      const portalUser = await this.fetchPortalUser(user);
      if (portalUser) {
        this.portalUserSubject.next(portalUser);
      } else {
        console.warn(
          "⚠️ PortalAuth: No portal user found for auth user:",
          user.id,
        );
      }
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error fetching portal user:", error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async fetchPortalUser(user: User): Promise<PortalClientUser | null> {
    try {
      // Use the get-portal-user edge function instead of PostgREST directly.
      //
      // Why an edge function: the portal project's PostgREST schema cache is
      // stale and does not include the clients/users/companies tables, so any
      // embed like `client_portal_users?select=*,client:clients(*)` fails with
      // PGRST200 "Could not find a relationship". The PortalRoleGuard then
      // sees a null portalUser and bounces the user back to /login in a loop.
      // The edge function uses service_role to do the join server-side and
      // returns the joined object the frontend expects.
      const cfg = this.runtimeConfig.getSupabase();
      const supabaseUrl = cfg?.url?.trim() || environment.supabase.url;
      const anonKey = cfg?.anonKey?.trim() || environment.supabase.anonKey;
      const fnUrl = `${supabaseUrl}/functions/v1/get-portal-user`;

      const session = await this.supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        console.warn("⚠️ PortalAuth: no access token available");
        return null;
      }

      const res = await fetch(fnUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
      });

      if (res.status === 404) {
        console.warn(
          "⚠️ PortalAuth: No portal user found for auth user:",
          user.id,
        );
        return null;
      }
      if (!res.ok) {
        console.warn(
          "⚠️ PortalAuth: get-portal-user failed:",
          res.status,
          await res.text(),
        );
        return null;
      }

      const portalUser = (await res.json()) as PortalClientUser;
      return portalUser;
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error fetching portal user:", error);
      return null;
    }
  }

  private clearUserData(): void {
    this.currentUserSubject.next(null);
    this.portalUserSubject.next(null);
    this.authState.set(false);
    this.activeCompanyId.set(null);
    this.stopSessionTimer();
    try { sessionStorage.removeItem(PortalAuthService.SESSION_START_KEY); } catch { /* noop */ }
  }

  private startSessionTimer(): void {
    // Record session start if not already set
    if (!sessionStorage.getItem(PortalAuthService.SESSION_START_KEY)) {
      sessionStorage.setItem(
        PortalAuthService.SESSION_START_KEY,
        Date.now().toString(),
      );
    }

    this.stopSessionTimer();

    this.ngZone.runOutsideAngular(() => {
      this.sessionCheckTimer = setInterval(() => {
        this.checkSessionExpiry();
      }, PortalAuthService.SESSION_CHECK_INTERVAL_MS);
    });

    // Also check immediately
    this.checkSessionExpiry();
  }

  private stopSessionTimer(): void {
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
      this.sessionCheckTimer = null;
    }
  }

  private checkSessionExpiry(): void {
    const startStr = sessionStorage.getItem(PortalAuthService.SESSION_START_KEY);
    if (!startStr) return;

    const elapsed = Date.now() - parseInt(startStr, 10);
    if (elapsed >= PortalAuthService.SESSION_MAX_AGE_MS) {
      console.warn('⏰ Portal session expired after 1 hour — logging out');
      this.ngZone.run(() => {
        this.expireSession();
      });
    }
  }

  private async expireSession(): Promise<void> {
    this.stopSessionTimer();
    this.clearUserData();
    try { await this.supabase.auth.signOut(); } catch { /* noop */ }
    this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: { reason: 'session_expired' },
    });
  }

  /**
   * Login with OTP (magic link).
   *
   * Sends a magic link email to the client. Routes through the
   * `portal-request-otp` edge function (service_role) instead of calling
   * `supabase.auth.signInWithOtp` directly with the anon key, because the
   * anon-key path is broken in the portal Supabase project (throws
   * "Database error updating user" + 500). The magic-link verify on
   * `/auth/callback` is unchanged and still uses `supabase.auth.onAuthStateChange`.
   *
   * Anti-enumeration contract is preserved server-side: the edge function
   * returns success for unknown / inactive emails without sending anything.
   */
  async loginWithOTP(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Validate email format (keep on the frontend for fast UX feedback)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!email || !emailRegex.test(email.trim())) {
      return { success: false, error: "Email inválido" };
    }

    const cfg = this.runtimeConfig.getSupabase();
    const supabaseUrl = cfg?.url?.trim() || environment.supabase.url;
    const anonKey = cfg?.anonKey?.trim() || environment.supabase.anonKey;

    if (!supabaseUrl || !anonKey) {
      return { success: false, error: "Configuración del portal incompleta" };
    }

    const fnUrl = `${supabaseUrl}/functions/v1/portal-request-otp`;

    try {
      const res = await fetch(fnUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      if (res.ok) {
        return { success: true };
      }

      // 400 — invalid email (server-side double-check)
      if (res.status === 400) {
        return { success: false, error: "Email inválido" };
      }

      // 429 — rate limit
      if (res.status === 429) {
        return {
          success: false,
          error: "Demasiados intentos. Intenta en un minuto.",
        };
      }

      // Other non-2xx
      let body = "";
      try {
        body = await res.text();
      } catch {
        /* ignore */
      }
      return {
        success: false,
        error: body || `Error ${res.status} al enviar el enlace`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error?.message || "Error de red al enviar el enlace",
      };
    }
  }

  async logout(): Promise<void> {
    try {
      this.clearUserData();
      await this.supabase.auth.signOut();
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error during logout:", error);
    }
  }

  /**
   * Two-step "send me a magic link" flow that works for both new and existing
   * emails. Replaces the previous single-step `loginWithOTP()` to fix the
   * RGPD bug where brand-new clients (no auth.users row) saw "Enlace
   * enviado" but received NOTHING — `supabase.auth.signInWithOtp` (and
   * later `inviteUserByEmail`) didn't deliver via the company's verified
   * SES identity, so emails either silently no-op'd or used an unbranded
   * Supabase template.
   *
   * Step 1 — `portal-request-otp` (this project's edge function):
   *   Calls `admin.auth.admin.generateLink({ type: 'magiclink', email })` via
   *   service_role. Returns a signed `action_link` that creates the user
   *   on click (if missing) or authenticates an existing user. The action_link
   *   is Supabase-signed, so even if a malicious portal picked an arbitrary
   *   email, the link only works for its intended recipient.
   *
   * Step 2 — `client-portal-bff` `/send-link-email` (CRM project):
   *   Forwards the action_link in a branded HTML email sent through the
   *   company's verified SES identity (`company_email_accounts`). This is
   *   the SAME pipeline the CRM uses for `send-client-consent-invite`, so
   *   the email is RGPD-compliant (proper From identity, branded template,
   *   consent footer, etc.).
   *
   * @param emailOpt Optional override for the recipient. When the caller
   *   already knows the target email (e.g. the consent landing page reads
   *   it from the URL/RPC) it MUST be passed here — the user is NOT signed
   *   in yet, so `this.email()` is empty. Falls back to `this.email()`
   *   only for logged-in flows.
   *
   * Returns:
   *   { success: true }  — email handed to SES (delivery is async).
   *   { success: false, error: <reason> } — surfaced to the UI; we do NOT
   *   silently swallow real failures (the previous "Enlace enviado"
   *   green state was the actual UX bug).
   */
  async requestAccountLink(
    emailOpt?: string,
  ): Promise<{ success: boolean; error?: string }> {
    const email = (emailOpt ?? this.email() ?? '').trim().toLowerCase();
    if (!email) {
      return { success: false, error: 'No se ha proporcionado ningún correo.' };
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email)) {
      return { success: false, error: 'Email inválido' };
    }

    const cfg = this.runtimeConfig.getSupabase();
    const supabaseUrl = cfg?.url?.trim() || environment.supabase.url;
    const anonKey = cfg?.anonKey?.trim() || environment.supabase.anonKey;
    if (!supabaseUrl || !anonKey) {
      return { success: false, error: 'Configuración del portal incompleta' };
    }

    const companyId = this.companyId();
    if (!companyId) {
      return {
        success: false,
        error: 'No se ha podido determinar la empresa. Vuelve a iniciar la sesión.',
      };
    }

    try {
      // ── Step 1: get the magic-link action_link from the portal edge fn ──
      const otpRes = await fetch(
        `${supabaseUrl}/functions/v1/portal-request-otp`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: anonKey,
            Authorization: `Bearer ${anonKey}`,
          },
          body: JSON.stringify({ email }),
        },
      );
      const otpData = await otpRes.json().catch(() => null);
      if (!otpRes.ok || !otpData?.success || !otpData?.action_link) {
        if (otpRes.status === 429) {
          return {
            success: false,
            error: 'Demasiados intentos. Intenta en un minuto.',
          };
        }
        if (otpRes.status === 400) {
          return { success: false, error: 'Email inválido' };
        }
        return {
          success: false,
          error:
            otpData?.error
              ? `No se pudo generar el enlace (${otpData.error}).`
              : 'No se pudo generar el enlace.',
        };
      }

      const actionLink: string = otpData.action_link;

      // ── Step 2: deliver via the CRM BFF + the company's SES identity ──
      // The CRM BFF is a different Supabase project (ufutyjbqfjrlzkprvyvs),
      // pinned here the same way consent-portal.component.ts already does.
      const bffBase =
        'https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/client-portal-bff';
      const subject = 'Bienvenido a Simplifica — crea tu cuenta';
      const htmlBody = `<p>Hola,</p>
<p>Has sido invitado a crear una cuenta en el portal de cliente. Para empezar y establecer el acceso, haz clic en el siguiente botón:</p>
<p style="margin:24px 0;text-align:center;"><a href="${actionLink}" style="background-color:#4f46e5;color:#fff;padding:14px 28px;text-decoration:none;border-radius:6px;display:inline-block;font-weight:600;">Acceder a mi cuenta</a></p>
<p style="font-size:12px;color:#6b7280;">Si el botón no funciona, copia y pega este enlace en tu navegador:<br><span style="word-break:break-all;">${actionLink}</span></p>
<p>Este enlace es personal e intransferible, y caduca en 1 hora.</p>
<p>Gracias,<br>Simplifica</p>`;

      const sendRes = await fetch(`${bffBase}/send-link-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          to_email: email,
          subject,
          html_body: htmlBody,
        }),
      });
      const sendData = await sendRes.json().catch(() => null);
      if (!sendRes.ok || !sendData?.success) {
        // The action_link WAS generated in step 1 — we got that far. But
        // step 2 (SES send) failed; surface that. The UI should NOT show
        // "Enlace enviado" because nothing went out.
        return {
          success: false,
          error:
            sendData?.error
              ? `No se pudo enviar el correo (${sendData.error}).`
              : 'No se pudo enviar el correo. Inténtalo de nuevo.',
        };
      }

      return { success: true };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Error de red al enviar el enlace',
      };
    }
  }

  /** Email accessor used by callers that want a method-call syntax. */
  email(): string {
    return (this.currentUserSubject.value?.email ?? '').toString();
  }

  /**
   * Force a refresh of the Supabase session so the JWT (and therefore
   * `app_metadata.company_id`) is re-issued. Called by ClientPortalService
   * after a successful POST /select-company.
   */
  async refreshSession(): Promise<Session | null> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession();
      if (error) {
        console.warn('⚠️ PortalAuth: refreshSession failed:', error);
        return null;
      }
      if (data.session?.user) {
        await this.setCurrentUser(data.session.user);
      }
      return data.session;
    } catch (e) {
      console.warn('⚠️ PortalAuth: refreshSession threw:', e);
      return null;
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const { data } = await this.supabase.auth.getSession();
      return data.session;
    } catch (error) {
      return null;
    }
  }

  async getCurrentClient(): Promise<PortalClientUser | null> {
    return this.portalUserSubject.value;
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session?.user;
  }

  async requireAccessToken(): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (session?.access_token) return session.access_token;

      try {
        await this.supabase.auth.refreshSession();
      } catch {
        /* ignore */
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
    throw new Error("No hay una sesión válida. Inicia sesión de nuevo.");
  }

  /**
   * Get the Supabase client for direct queries.
   * Exposed for services that need to make queries outside of the auth layer.
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the Supabase URL (used for BFF fetch calls).
   */
  get supabaseUrl(): string {
    // Access via bracket notation to avoid TS protected-member error
    // The property exists at runtime on SupabaseClient instance
    return (this.supabase as any)['supabaseUrl'] as string;
  }

  /**
   * Get the Supabase anon key (used for BFF fetch calls).
   */
  get supabaseKey(): string {
    // Access via bracket notation to avoid TS protected-member error
    // The property exists at runtime on SupabaseClient instance
    return (this.supabase as any)['supabaseKey'] as string;
  }
}
