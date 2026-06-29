import {
  Component,
  OnInit,
  OnDestroy,
  PLATFORM_ID,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { RuntimeConfigService } from '../../../core/config/runtime-config.service';
import { environment } from '@env/environment';

interface ConsentRequest {
  success: boolean;
  error?: string;
  client_id?: string;
  client_name?: string;
  subject_email?: string;
  company_id?: string;
  company_name?: string;
  company_nif?: string | null;
  invitation_status?: string;
  consent_status?: string;
  marketing_consent?: boolean;
  consent_date?: string | null;
  privacy_policy_url?: string;
}

/**
 * ConsentPortalComponent
 *
 * Public RGPD consent landing page reached from the link in the
 * consent-migration email. Route: /consent?token=<uuid>
 *
 * The token IS the authorization — the page is intentionally NOT behind an
 * auth guard. Both the Accept and Reject paths call
 * process_client_consent(p_token, ...) which looks up the client via
 * invitation_token; an invalid/expired token produces a friendly "enlace no
 * válido" message instead of leaking data.
 *
 * The page shows the full RGPD Art. 13 controller-identity block
 * (responsable, finalidad, base legal, retention, derechos, AEPD complaint)
 * and exposes two equally-prominent buttons — no dark patterns.
 *
 * After accepting/rejecting, a subtle "Create account" link is offered
 * (NOT required) — clicking it sends the user to /login (magic-link flow)
 * where they can request an access code to manage their data permanently.
 */
@Component({
  selector: 'app-consent-portal',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslocoPipe],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4 sm:px-6 lg:px-8">
      <div class="max-w-2xl mx-auto">
        @if (loading()) {
          <div class="flex items-center justify-center min-h-[40vh]">
            <div class="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        } @else if (invalidToken()) {
          <!-- INVALID / EXPIRED TOKEN ────────────────────────────────────── -->
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
        } @else if (alreadyCompleted()) {
          <!-- ALREADY COMPLETED ─────────────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <i class="fas fa-check text-green-600 dark:text-green-400 text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {{ 'consentPortal.alreadyCompletedTitle' | transloco }}
            </h1>
            <p class="text-gray-600 dark:text-gray-300 mb-2">
              {{ 'consentPortal.alreadyCompletedBody' | transloco }}
            </p>
            @if (requestData()?.company_name) {
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ 'consentPortal.fromCompany' | transloco: { company: requestData()!.company_name } }}
              </p>
            }
          </div>
        } @else if (submitted()) {
          <!-- SUBMITTED ──────────────────────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center">
            <div class="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
              <i class="fas fa-check text-green-600 dark:text-green-400 text-2xl"></i>
            </div>
            <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {{ 'consentPortal.thanksTitle' | transloco }}
            </h1>
            <p class="text-gray-600 dark:text-gray-300 mb-4">
              {{ 'consentPortal.thanksBody' | transloco: { company: requestData()?.company_name } }}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {{ 'consentPortal.thanksHint' | transloco }}
            </p>

            <!-- Optional "Create account" CTA — only after a successful submit -->
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {{ 'consentPortal.createAccountPrompt' | transloco }}
              </p>
              <a
                routerLink="/login"
                [queryParams]="{ email: requestData()?.subject_email }"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-600 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-medium text-sm transition-colors"
              >
                <i class="fas fa-user-plus"></i>
                {{ 'consentPortal.createAccountCta' | transloco }}
              </a>
              <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                {{ 'consentPortal.createAccountSubhint' | transloco }}
              </p>
            </div>
          </div>
        } @else {
          <!-- MAIN CONSENT UI ───────────────────────────────────────────── -->
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
            <!-- Header -->
            <div class="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <p class="text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400 mb-1">
                {{ 'consentPortal.headerEyebrow' | transloco }}
              </p>
              <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                {{ 'consentPortal.headerTitle' | transloco: { company: requestData()?.company_name } }}
              </h1>
              @if (requestData()?.client_name) {
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {{ 'consentPortal.helloName' | transloco: { name: requestData()!.client_name } }}
                </p>
              }
            </div>

            <!-- RGPD Art. 13 block -->
            <div class="px-6 py-5 space-y-4 text-sm text-gray-700 dark:text-gray-300">
              <p>{{ 'consentPortal.bodyIntro' | transloco }}</p>

              <!-- Controller identity -->
              <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-1.5">
                <p class="font-semibold text-gray-900 dark:text-white">
                  {{ 'consentPortal.controllerTitle' | transloco }}
                </p>
                <p>
                  <span class="text-gray-500 dark:text-gray-400">{{ 'consentPortal.controllerName' | transloco }}:</span>
                  <strong>{{ requestData()?.company_name }}</strong>
                </p>
                @if (requestData()?.company_nif) {
                  <p>
                    <span class="text-gray-500 dark:text-gray-400">{{ 'consentPortal.controllerNif' | transloco }}:</span>
                    {{ requestData()?.company_nif }}
                  </p>
                }
              </div>

              <!-- Purpose + legal basis + retention -->
              <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-1.5">
                <p>
                  <span class="text-gray-500 dark:text-gray-400">{{ 'consentPortal.purposeLabel' | transloco }}:</span>
                  {{ 'consentPortal.purposeValue' | transloco }}
                </p>
                <p>
                  <span class="text-gray-500 dark:text-gray-400">{{ 'consentPortal.legalBasisLabel' | transloco }}:</span>
                  {{ 'consentPortal.legalBasisValue' | transloco }}
                </p>
                <p>
                  <span class="text-gray-500 dark:text-gray-400">{{ 'consentPortal.retentionLabel' | transloco }}:</span>
                  {{ 'consentPortal.retentionValue' | transloco }}
                </p>
              </div>

              <!-- Marketing checkbox (only field user controls) -->
              <div class="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <p class="font-semibold text-gray-900 dark:text-white mb-2">
                  {{ 'consentPortal.choiceTitle' | transloco }}
                </p>
                <label class="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    [(ngModel)]="marketingConsent"
                    class="mt-1 w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                    data-testid="marketing-consent-checkbox"
                  />
                  <span class="text-sm text-gray-700 dark:text-gray-300">
                    {{ 'consentPortal.marketingChoiceLabel' | transloco }}
                  </span>
                </label>
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  {{ 'consentPortal.marketingChoiceHint' | transloco }}
                </p>
              </div>

              <!-- Rights -->
              <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                <p class="font-semibold text-gray-900 dark:text-white mb-1.5">
                  {{ 'consentPortal.rightsTitle' | transloco }}
                </p>
                <p>{{ 'consentPortal.rightsBody' | transloco }}</p>
                <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {{ 'consentPortal.rightsAepd' | transloco }}
                </p>
              </div>
            </div>

            <!-- Action buttons (RGPD Art. 7.3 — equally prominent) -->
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
                  {{ 'consentPortal.acceptButton' | transloco }}
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
                  {{ 'consentPortal.rejectButton' | transloco }}
                </button>
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
                {{ 'consentPortal.actionsHint' | transloco }}
              </p>
            </div>

            <!-- Footer: privacy policy + subtle "Create account" -->
            <div class="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              @if (requestData()?.privacy_policy_url) {
                <a
                  [routerLink]="requestData()!.privacy_policy_url!"
                  class="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  <i class="fas fa-shield-alt mr-1"></i>
                  {{ 'consentPortal.privacyPolicyLink' | transloco }}
                </a>
              }
              <a
                routerLink="/login"
                [queryParams]="{ email: requestData()?.subject_email }"
                class="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline"
              >
                {{ 'consentPortal.createAccountSubtle' | transloco }}
              </a>
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
  invalidToken = signal(false);
  alreadyCompleted = signal(false);
  submitted = signal(false);
  submitting = signal(false);
  pendingChoice = signal<'accept' | 'reject' | null>(null);
  submitError = signal<string | null>(null);
  requestData = signal<ConsentRequest | null>(null);

  // Marketing checkbox — the only field the user actually controls.
  // Default false: opt-in model per RGPD.
  marketingConsent = false;

  private token: string | null = null;
  private sb: SupabaseClient | null = null;
  private ipifyAbort: AbortController | null = null;

  async ngOnInit(): Promise<void> {
    this.token = this.route.snapshot.queryParamMap.get('token');

    if (!this.token) {
      this.loading.set(false);
      this.invalidToken.set(true);
      return;
    }

    this.sb = this.buildPublicSupabaseClient();
    if (!this.sb) {
      this.loading.set(false);
      this.invalidToken.set(true);
      return;
    }

    try {
      const { data, error } = await this.sb.rpc('get_client_consent_request', {
        p_token: this.token,
      });

      if (error || !data) {
        this.loading.set(false);
        this.invalidToken.set(true);
        return;
      }

      const payload = data as ConsentRequest;
      this.requestData.set(payload);

      if (!payload.success) {
        this.loading.set(false);
        this.invalidToken.set(true);
        return;
      }

      if (payload.invitation_status === 'completed') {
        this.loading.set(false);
        this.alreadyCompleted.set(true);
        return;
      }

      this.loading.set(false);
    } catch (e) {
      console.error('[ConsentPortal] Failed to load consent request', e);
      this.loading.set(false);
      this.invalidToken.set(true);
    }
  }

  ngOnDestroy(): void {
    if (this.ipifyAbort) {
      this.ipifyAbort.abort();
      this.ipifyAbort = null;
    }
  }

  async submit(accept: boolean): Promise<void> {
    if (this.submitting() || !this.token || !this.sb) return;

    // Honor the marketing checkbox: accept + marketing=true => record consent_given=true.
    // accept + marketing=false (default) OR reject => record consent_given=false.
    // This satisfies RGPD Art. 7 — the user is giving or withholding explicit consent;
    // the buttons themselves never decide unilaterally.
    const consentGiven = accept && this.marketingConsent;

    this.submitting.set(true);
    this.pendingChoice.set(accept ? 'accept' : 'reject');
    this.submitError.set(null);

    const ip = await this.detectClientIp();
    const ua = isPlatformBrowser(this.platformId)
      ? (navigator.userAgent || 'unknown')
      : 'server-side';

    const consentMethod = accept
      ? 'consent_migration_accept'
      : 'consent_migration_reject';

    try {
      const { data, error } = await this.sb.rpc('process_client_consent', {
        p_token: this.token,
        p_marketing_consent: consentGiven,
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
    const supabaseAnonKey = cfg?.anonKey?.trim() || environment.supabase?.anonKey || '';
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