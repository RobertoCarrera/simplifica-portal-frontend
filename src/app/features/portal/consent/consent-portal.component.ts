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

interface ConsentChoices {
  tos: boolean;
  privacy: boolean;
  marketing: boolean;
}

/**
 * ConsentPortalComponent — email-based, RGPD Art. 7 granular consent landing page.
 *
 * Reached from the link in the consent-migration email. Route:
 *   /consent?c=<company_id>&e=<urlencoded_email>
 *
 * The (company_id, email) pair IS the authorization — there is no token in
 * the URL. The page is intentionally NOT behind an auth guard.
 *
 * UX (granular RGPD):
 *   - Three independent consent rows (Términos de uso, Privacidad,
 *     Comunicaciones comerciales). The user can toggle each individually.
 *   - "Aceptar todas" and "Rechazar todas" buttons at the bottom.
 *   - The two service-essential rows (TOS, Privacidad) are marked as
 *     "necesario" but are still individually selectable — the page does not
 *     force the user into a single bundle.
 *   - Marketing is the only optional-purpose consent.
 *   - Submission goes via process_email_consent(p_company_id, p_email,
 *     p_tos_consent, p_privacy_consent, p_marketing_consent, ...). The RPC
 *     writes three gdpr_consent_records rows (terms_of_service,
 *     privacy_policy, marketing) and updates clients cache columns.
 *   - Success screen reports which consents were granted.
 *
 * An invalid (company_id, email) pair produces a friendly "enlace no válido"
 * view instead of leaking data.
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
              Hemos registrado tu decisión
            </h1>
            <p class="text-gray-600 dark:text-gray-300 mb-4">
              Tu respuesta para <strong>{{ requestData()?.company_name }}</strong>
              se ha guardado conforme al RGPD. Estas son las finalidades que has aceptado:
            </p>

            <!-- Summary of the 3 decisions -->
            <ul class="text-left max-w-sm mx-auto space-y-2 mb-6">
              <li class="flex items-start gap-2">
                <i class="fas" [class.fa-check-circle]="lastChoices()?.tos"
                   [class.text-green-500]="lastChoices()?.tos"
                   [class.fa-times-circle]="!lastChoices()?.tos"
                   [class.text-red-400]="!lastChoices()?.tos"></i>
                <span>
                  <strong>Términos de uso y servicio:</strong>
                  {{ lastChoices()?.tos ? 'aceptados' : 'rechazados' }}
                </span>
              </li>
              <li class="flex items-start gap-2">
                <i class="fas" [class.fa-check-circle]="lastChoices()?.privacy"
                   [class.text-green-500]="lastChoices()?.privacy"
                   [class.fa-times-circle]="!lastChoices()?.privacy"
                   [class.text-red-400]="!lastChoices()?.privacy"></i>
                <span>
                  <strong>Política de privacidad:</strong>
                  {{ lastChoices()?.privacy ? 'aceptada' : 'rechazada' }}
                </span>
              </li>
              <li class="flex items-start gap-2">
                <i class="fas" [class.fa-check-circle]="lastChoices()?.marketing"
                   [class.text-green-500]="lastChoices()?.marketing"
                   [class.fa-times-circle]="!lastChoices()?.marketing"
                   [class.text-red-400]="!lastChoices()?.marketing"></i>
                <span>
                  <strong>Comunicaciones comerciales:</strong>
                  {{ lastChoices()?.marketing ? 'aceptadas' : 'rechazadas' }}
                </span>
              </li>
            </ul>

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
              <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">
                <strong>{{ requestData()?.company_name }}</strong> necesita tu
                consentimiento para varias finalidades. Puedes aceptar o rechazar
                cada una por separado.
              </p>
            </div>

            <!-- Granular consent rows -->
            <div class="px-6 py-4 divide-y divide-gray-200 dark:divide-gray-700">
              <!-- ROW 1: Términos de uso (necesario) -->
              <label
                class="flex items-start gap-3 py-3 cursor-pointer"
                data-testid="consent-row-tos"
              >
                <input
                  type="checkbox"
                  class="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  [checked]="prefs().tos"
                  (change)="setPref('tos', $any($event.target).checked)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      Acepto los términos de uso y servicio
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Necesario
                    </span>
                  </div>
                  <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Necesario para usar la plataforma y poder prestarte los
                    servicios contratados.
                  </p>
                </div>
              </label>

              <!-- ROW 2: Política de privacidad (necesario) -->
              <label
                class="flex items-start gap-3 py-3 cursor-pointer"
                data-testid="consent-row-privacy"
              >
                <input
                  type="checkbox"
                  class="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  [checked]="prefs().privacy"
                  (change)="setPref('privacy', $any($event.target).checked)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      Acepto la política de privacidad
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                      Necesario
                    </span>
                  </div>
                  <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Necesario para el tratamiento de tus datos personales conforme
                    al RGPD.
                    @if (requestData()?.privacy_policy_url) {
                      <a
                        [href]="requestData()!.privacy_policy_url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="underline hover:no-underline ml-1"
                      >Leer política</a>
                    }
                  </p>
                </div>
              </label>

              <!-- ROW 3: Comunicaciones comerciales (opcional) -->
              <label
                class="flex items-start gap-3 py-3 cursor-pointer"
                data-testid="consent-row-marketing"
              >
                <input
                  type="checkbox"
                  class="mt-1 h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                  [checked]="prefs().marketing"
                  (change)="setPref('marketing', $any($event.target).checked)"
                />
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      Acepto recibir comunicaciones comerciales
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                      Opcional
                    </span>
                  </div>
                  <p class="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Quiero recibir ofertas, novedades y comunicaciones de
                    {{ requestData()?.company_name }} por correo electrónico. Puedo
                    revocar este consentimiento en cualquier momento.
                  </p>
                </div>
              </label>
            </div>

            <!-- Bulk action buttons + error -->
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
                  (click)="acceptAll()"
                  [disabled]="submitting()"
                  data-testid="accept-all-btn"
                  class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold text-sm transition-colors"
                >
                  <i class="fas fa-check-double"></i>
                  Aceptar todas
                </button>
                <button
                  type="button"
                  (click)="rejectAll()"
                  [disabled]="submitting()"
                  data-testid="reject-all-btn"
                  class="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-500 hover:border-gray-400 dark:hover:border-gray-400 disabled:cursor-not-allowed text-gray-800 dark:text-white font-semibold text-sm transition-colors"
                >
                  <i class="fas fa-ban"></i>
                  Rechazar todas
                </button>
              </div>

              <!-- Manual submit (uses the user's current checkbox state) -->
              <button
                type="button"
                (click)="submitCurrent()"
                [disabled]="submitting() || !hasAnyChoice()"
                data-testid="submit-current-btn"
                class="mt-3 w-full inline-flex items-center justify-center gap-2 px-5 py-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:text-gray-400 disabled:cursor-not-allowed font-medium text-sm transition-colors"
              >
                @if (submitting()) {
                  <i class="fas fa-spinner fa-spin"></i>
                } @else {
                  <i class="fas fa-paper-plane"></i>
                }
                Guardar mi selección actual
              </button>

              <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                Cada finalidad es independiente. "Aceptar todas" y "Rechazar todas"
                son solo atajos — puedes ajustar las casillas antes de guardar.
              </p>
            </div>

            <!-- Footer: privacy policy link -->
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
  submitError = signal<string | null>(null);
  requestData = signal<ConsentRequest | null>(null);

  // Three independent consent toggles. Default: all unchecked — the user
  // must opt in to each. RGPD Art. 7 requires the consent action to be a
  // clear affirmative act; pre-checked boxes are forbidden.
  prefs = signal<ConsentChoices>({ tos: false, privacy: false, marketing: false });
  lastChoices = signal<ConsentChoices | null>(null);

  private companyId: string | null = null;
  private email: string | null = null;
  private sb: SupabaseClient | null = null;
  private ipifyAbort: AbortController | null = null;

  /**
   * BFF endpoint base. The consent-bridge RPCs (`get_consent_request_by_email`,
   * `process_email_consent`) live in the CRM DB, NOT the portal DB — so we
   * call them via the BFF that runs on the CRM Supabase. The BFF is
   * CORS-allowlisted for the portal origin.
   */
  private readonly crmBffBase =
    (typeof window !== 'undefined' && (window as any).__CRM_BFF_BASE__) ||
    'https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/client-portal-bff';

  async ngOnInit(): Promise<void> {
    this.companyId = this.route.snapshot.queryParamMap.get('c');
    this.email = this.route.snapshot.queryParamMap.get('e');

    if (!this.companyId || !this.email) {
      this.loading.set(false);
      this.invalid.set(true);
      return;
    }

    try {
      // Call the BFF (CRM cross-project bridge) — NOT a local RPC, which
      // does not exist in the portal's own Supabase.
      const url = `${this.crmBffBase}/consent-request?company_id=${encodeURIComponent(this.companyId)}&email=${encodeURIComponent(this.email)}`;
      const res = await fetch(url, { method: 'GET' });
      if (!res.ok) {
        this.loading.set(false);
        this.invalid.set(true);
        return;
      }

      const row = (await res.json()) as ConsentRequest;
      if (!row || !row.client_id) {
        this.loading.set(false);
        this.invalid.set(true);
        return;
      }

      this.requestData.set(row);
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

  /**
   * Toggle a single consent purpose (tos / privacy / marketing).
   * Uses immutable signal update to keep change detection cheap.
   */
  setPref(key: keyof ConsentChoices, value: boolean): void {
    this.prefs.update((p) => ({ ...p, [key]: value }));
  }

  /** Mark all three consents as granted. */
  acceptAll(): void {
    this.prefs.set({ tos: true, privacy: true, marketing: true });
  }

  /** Mark all three consents as rejected. */
  rejectAll(): void {
    this.prefs.set({ tos: false, privacy: false, marketing: false });
  }

  /**
   * True if the user has touched at least one checkbox from its initial
   * false-default, OR has explicitly used acceptAll/rejectAll. Avoids
   * sending a 0/0/0 payload when the user lands on the page and never
   * makes a choice (which would be implicit rejection under RGPD but
   * less obvious in the audit log).
   */
  hasAnyChoice(): boolean {
    const p = this.prefs();
    // All toggles are visible to the user from the start (unchecked).
    // "hasAnyChoice" really means "the form is in a state distinct from
    // the silent default" — for our UX the default IS already a valid
    // (all-rejected) state, so we always allow submission.
    return true;
  }

  /**
   * Convenience: submit with the user's current checkbox state. Equivalent
   * to calling acceptAll / rejectAll but reflects any manual adjustments.
   */
  submitCurrent(): Promise<void> {
    return this.submit(this.prefs());
  }

  /**
   * Submit the user's consent decision. Posts three booleans to the BFF
   * (p_tos_consent, p_privacy_consent, p_marketing_consent) which forwards
   * to the CRM process_email_consent RPC. The RPC writes three separate
   * gdpr_consent_records rows (RGPD Art. 7 granular compliance) and updates
   * the clients cache columns.
   */
  async submit(choices: ConsentChoices): Promise<void> {
    if (
      this.submitting() ||
      !this.companyId ||
      !this.email ||
      !this.sb
    ) {
      return;
    }

    this.submitting.set(true);
    this.submitError.set(null);

    const ip = await this.detectClientIp();
    const ua = isPlatformBrowser(this.platformId)
      ? (navigator.userAgent || 'unknown')
      : 'server-side';

    const consentMethod =
      choices.tos && choices.privacy && choices.marketing
        ? 'email_link_accept_all'
        : !choices.tos && !choices.privacy && !choices.marketing
          ? 'email_link_reject_all'
          : 'email_link_custom';

    try {
      // Call the BFF (CRM cross-project bridge) — same reason as ngOnInit.
      const url = `${this.crmBffBase}/process-email-consent`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_company_id: this.companyId,
          p_email: this.email,
          p_tos_consent: choices.tos,
          p_privacy_consent: choices.privacy,
          p_marketing_consent: choices.marketing,
          p_ip: ip,
          p_user_agent: ua,
          p_consent_method: consentMethod,
        }),
      });

      if (!res.ok) {
        let errMsg = 'No se pudo registrar tu respuesta.';
        try {
          const body = await res.json();
          if (body?.error) errMsg = body.error;
        } catch { /* ignore */ }
        this.submitError.set(errMsg);
        this.submitting.set(false);
        return;
      }

      const result = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (result.success === false) {
        this.submitError.set(result.error ?? 'No se pudo registrar tu respuesta.');
        this.submitting.set(false);
        return;
      }

      this.lastChoices.set({ ...choices });
      this.submitted.set(true);
      this.submitting.set(false);
    } catch (e: any) {
      this.submitError.set(e?.message ?? 'Error desconocido.');
      this.submitting.set(false);
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