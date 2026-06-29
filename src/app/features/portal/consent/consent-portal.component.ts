import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RuntimeConfigService } from '../../../core/config/runtime-config.service';
import { environment } from '@env/environment';

interface ConsentRequest {
  client_id: string;
  client_name: string;
  subject_email: string;
  company_id: string;
  company_name: string;
  company_nif: string | null;
  invitation_status: string;
  consent_status: string;
  privacy_policy_url: string;
  has_account: boolean;
}

/**
 * ConsentPortalComponent — email-based, RGPD-light consent landing page.
 *
 * Reached from the link in the consent-migration email. Route:
 *   /consent?c=<company_id>&e=<urlencoded_email>
 *
 * The (company_id, email) pair IS the authorization — there is no token in
 * the URL. The page is intentionally NOT behind an auth guard.
 *
 * UX (matches the third-party "bizneo" example Roberto shared):
 *   - Simple Spanish copy: "Hola X, <company> quiere enviarte comunicaciones
 *     comerciales. ¿Aceptas?"
 *   - Two equally-prominent buttons (Aceptar / Rechazar) — no dark patterns.
 *   - Optional subtle "Crear cuenta" link below.
 *   - No RGPD Art. 13 wall on this view (the email + footer link to the
 *     privacy policy cover Art. 13; the controller-identity block lives in
 *     the email body and in /portal/settings for authenticated users).
 *
 * Both the Accept and Reject paths call process_email_consent(p_company_id,
 * p_email, ...). The RPC writes the gdpr_consent_records audit row and
 * updates clients (when matched). An invalid (company_id, email) pair
 * produces a friendly "enlace no válido" view instead of leaking data.
 *
 * Account linking: when the user later signs up via magic link, the
 * trg_link_consents_to_new_user trigger on auth.users backfills
 * gdpr_consent_records.subject_id from subject_email so the user can see
 * the consents they gave here from their portal account.
 */
@Component({
  selector: 'app-consent-portal',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslocoPipe],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4 sm:px-6 lg:px-8">
      <div class="max-w-xl mx-auto">
        @if (loading()) {
          <div class="flex items-center justify-center min-h-[40vh]">
            <div class="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        } @else if (invalid()) {
          <!-- INVALID / UNKNOWN CLIENT ───────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
              <i class="fas fa-link-slash text-amber-600 dark:text-amber-400 text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {{ 'consentPortal.invalidTokenTitle' | transloco }}
            </h1>
            <p class="text-gray-600 dark:text-gray-300 mb-6">
              {{ 'consentPortal.invalidTokenBody' | transloco }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {{ 'consentPortal.invalidTokenContact' | transloco }}
            </p>
          </div>
        } @else if (submitted()) {
          <!-- SUBMITTED ──────────────────────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <i class="fas fa-check text-green-600 dark:text-green-400 text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
              @if (lastChoice() === 'accept') {
                ✓ Has aceptado las comunicaciones de {{ requestData()?.company_name }}
              } @else {
                ✓ Has rechazado las comunicaciones de {{ requestData()?.company_name }}
              }
            </h1>
            <p class="text-gray-600 dark:text-gray-300 mb-2">
              Tu decisión ha quedado registrada y conservada conforme al RGPD.
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Puedes cerrar esta ventana.
            </p>

            <!-- Subtle "Create account" CTA — only after a successful submit -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                ¿Quieres gestionar tus datos permanentemente?
              </p>
              <a
                [routerLink]="loginLink()"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
              >
                <i class="fas fa-user-plus"></i>
                @if (requestData()?.has_account) {
                  Iniciar sesión
                } @else {
                  Crear cuenta
                }
              </a>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Te enviaremos un enlace de acceso a tu correo — sin contraseñas.
              </p>
            </div>
          </div>
        } @else {
          <!-- MAIN CONSENT UI ───────────────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
                RGPD · Tus preferencias
              </p>
              <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                Hola {{ requestData()?.client_name }},
              </h1>
            </div>

            <!-- The actual ask — friendly, conversational Spanish -->
            <div class="px-6 py-6 text-gray-800 dark:text-gray-200">
              <p class="text-base sm:text-lg leading-relaxed">
                <strong>{{ requestData()?.company_name }}</strong> quiere enviarte
                comunicaciones comerciales.
              </p>
              <p class="mt-2 text-base sm:text-lg font-medium">
                ¿Aceptas?
              </p>
            </div>

            <!-- Action buttons — equally prominent (RGPD Art. 7.3) -->
            <div class="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-800/50">
              @if (submitError()) {
                <div class="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
                  <i class="fas fa-exclamation-circle mr-1"></i>
                  {{ submitError() }}
                </div>
              }
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  (click)="submit(true)"
                  [disabled]="submitting()"
                  data-testid="accept-btn"
                  class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  @if (submitting() && pendingChoice() === 'accept') {
                    <i class="fas fa-spinner fa-spin"></i>
                  } @else {
                    <i class="fas fa-check"></i>
                  }
                  Aceptar
                </button>
                <button
                  type="button"
                  (click)="submit(false)"
                  [disabled]="submitting()"
                  data-testid="reject-btn"
                  class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400 disabled:cursor-not-allowed text-gray-800 dark:text-white font-semibold text-sm transition-colors"
                >
                  @if (submitting() && pendingChoice() === 'reject') {
                    <i class="fas fa-spinner fa-spin"></i>
                  } @else {
                    <i class="fas fa-times"></i>
                  }
                  Rechazar
                </button>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                Ambas opciones tienen la misma visibilidad.
              </p>
            </div>

            <!-- Footer: optional "Create account" + privacy policy link -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <a
                [routerLink]="loginLink()"
                class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline"
              >
                ¿Quieres gestionar tus datos permanentemente?
                @if (requestData()?.has_account) {
                  Iniciar sesión
                } @else {
                  Crear cuenta
                }
              </a>
              @if (requestData()?.privacy_policy_url) {
                <a
                  [href]="requestData()!.privacy_policy_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  <i class="fas fa-shield-alt mr-1"></i>
                  Política de privacidad
                </a>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
})
export class ConsentPortalComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private runtimeConfig = inject(RuntimeConfigService);
  private platformId = inject(PLATFORM_ID);

  // ── State ────────────────────────────────────────────────────────────
  loading = signal(true);
  invalid = signal(false);
  submitted = signal(false);
  submitting = signal(false);
  pendingChoice = signal<'accept' | 'reject' | null>(null);
  lastChoice = signal<'accept' | 'reject' | null>(null);
  submitError = signal<string | null>(null);
  requestData = signal<ConsentRequest | null>(null);

  private companyId: string | null = null;
  private email: string | null = null;
  private sb: SupabaseClient | null = null;
  private ipifyAbort: AbortController | null = null;

  async ngOnInit(): Promise<void> {
    this.companyId = this.route.snapshot.queryParamMap.get('c');
    this.email = this.route.snapshot.queryParamMap.get('e');

    if (!this.companyId || !this.email) {
      this.loading.set(false);
      this.invalid.set(true);
      return;
    }

    this.sb = this.buildPublicSupabaseClient();
    if (!this.sb) {
      this.loading.set(false);
      this.invalid.set(true);
      return;
    }

    try {
      const { data, error } = await this.sb.rpc('get_consent_request_by_email', {
        p_company_id: this.companyId,
        p_email: this.email,
      });

      if (error || !data) {
        this.loading.set(false);
        this.invalid.set(true);
        return;
      }

      // The RPC returns a single row when a client matches, zero rows otherwise.
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        this.loading.set(false);
        this.invalid.set(true);
        return;
      }

      this.requestData.set(row as ConsentRequest);
      this.loading.set(false);
    } catch (e) {
      console.error('[ConsentPortal] Failed to load consent request', e);
      this.loading.set(false);
      this.invalid.set(true);
    }
  }

  ngOnDestroy(): void {
    if (this.ipifyAbort) {
      this.ipifyAbort.abort();
      this.ipifyAbort = null;
    }
  }

  /**
   * Build the "/login?email=..." link used for both the in-flow "Crear cuenta"
   * CTA and the post-submit one. The portal login form reads `?email=` and
   * pre-fills the magic-link field.
   */
  loginLink(): string {
    const email = this.requestData()?.subject_email ?? this.email ?? '';
    return `/login?email=${encodeURIComponent(email)}`;
  }

  async submit(accept: boolean): Promise<void> {
    if (
      this.submitting() ||
      !this.companyId ||
      !this.email ||
      !this.sb
    ) {
      return;
    }

    this.submitting.set(true);
    this.pendingChoice.set(accept ? 'accept' : 'reject');
    this.submitError.set(null);

    const ip = await this.detectClientIp();
    const ua = isPlatformBrowser(this.platformId)
      ? (navigator.userAgent || 'unknown')
      : 'server-side';

    const consentMethod = accept ? 'email_link_accept' : 'email_link_reject';

    try {
      const { data, error } = await this.sb.rpc('process_email_consent', {
        p_company_id: this.companyId,
        p_email: this.email,
        p_marketing_consent: accept,
        p_ip: ip,
        p_user_agent: ua,
        p_consent_method: consentMethod,
      });

      const result = (data ?? {}) as { success?: boolean; error?: string };
      if (error || result.success === false) {
        this.submitError.set(
          (result.error || error?.message) ?? 'No se pudo registrar tu respuesta.',
        );
        this.submitting.set(false);
        this.pendingChoice.set(null);
        return;
      }

      this.lastChoice.set(accept ? 'accept' : 'reject');
      this.submitted.set(true);
      this.submitting.set(false);
    } catch (e: any) {
      this.submitError.set(e?.message ?? 'Error desconocido.');
      this.submitting.set(false);
      this.pendingChoice.set(null);
    }
  }

  /**
   * Build a public Supabase client (anon key, no session) so we can call
   * the public RPCs without depending on PortalAuthService (which is meant
   * for authenticated portal users).
   */
  private buildPublicSupabaseClient(): SupabaseClient | null {
    const cfg = this.runtimeConfig.getSupabase();
    const supabaseUrl = cfg?.url?.trim() || environment.supabase?.url || '';
    const supabaseAnonKey =
      cfg?.anonKey?.trim() || environment.supabase?.anonKey || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[ConsentPortal] Supabase URL or anon key not configured');
      return null;
    }
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  /**
   * Best-effort client IP detection for the audit row. Falls back to
   * 'browser-unknown' if the lightweight IP echo service is unreachable
   * (offline / corporate proxy / ad blocker) — the RPC accepts any string.
   */
  private async detectClientIp(): Promise<string> {
    if (!isPlatformBrowser(this.platformId)) return 'server-side';
    try {
      this.ipifyAbort = new AbortController();
      const timeout = setTimeout(() => this.ipifyAbort?.abort(), 1500);
      const res = await fetch('https://api.ipify.org?format=json', {
        signal: this.ipifyAbort.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const body = await res.json().catch(() => null);
        if (body && typeof body.ip === 'string' && body.ip.length > 0) {
          return body.ip;
        }
      }
    } catch {
      /* fall through */
    }
    return 'browser-unknown';
  }
}