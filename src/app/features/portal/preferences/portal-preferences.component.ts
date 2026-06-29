import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { PortalAuthService } from '../../../core/services/portal-auth.service';

interface ConsentState {
  consent_given: boolean;
  consent_given_date: string | null;
}

/**
 * PortalPreferencesComponent — RGPD Art. 7 + Art. 7.3 self-service for the
 * authenticated portal user. Reachable at /settings/preferences (under the
 * PortalRoleGuard so only authenticated client users can see it).
 *
 * The page shows the three user-managed consents (TOS, Privacy, Marketing)
 * pre-checked from the user's latest gdpr_consent_records rows. The user can
 * flip each toggle and save, or hit the "Withdraw all consents" button
 * (RGPD Art. 7.3 — withdrawal must be as easy as granting).
 *
 * Reads:    GET  /consents            (BFF — fetches latest per consent_type)
 * Writes:   POST /consents            (BFF — already supports TOS, marketing, privacy)
 * Withdraw: POST /withdraw-consent    (BFF — handles 'all' or single type)
 *
 * The page never calls Supabase directly — the BFF is the authoritative gate.
 */
@Component({
  selector: 'app-portal-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslocoModule],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
      <div class="max-w-4xl mx-auto p-6 md:p-10 space-y-8">
        <!-- Hero header -->
        <header class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-700 dark:from-indigo-700 dark:via-blue-700 dark:to-violet-800 p-8 md:p-10 text-white shadow-lg">
          <div class="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 text-blue-100 text-xs font-semibold uppercase tracking-wider mb-2">
                <i class="fas fa-sliders-h"></i>
                <span>Portal del cliente</span>
              </div>
              <h1 class="text-3xl md:text-4xl font-bold">Mis preferencias de privacidad</h1>
              <p class="mt-2 text-blue-100 text-sm md:text-base max-w-2xl">
                Gestiona tus consentimientos RGPD en cualquier momento. Tus decisiones se registran de forma inmutable y pueden retirarse con la misma facilidad con la que se otorgaron.
              </p>
            </div>
            <div class="hidden md:flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20">
              <i class="fas fa-shield-halved text-3xl text-white/90"></i>
            </div>
          </div>
          <div class="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-white/10 blur-2xl"></div>
          <div class="absolute -bottom-16 -left-16 w-64 h-64 rounded-full bg-indigo-400/20 blur-3xl"></div>
        </header>

        @if (loading()) {
          <div class="text-center py-10">
            <i class="fas fa-spinner fa-spin text-3xl text-primary-500"></i>
            <p class="mt-2 text-gray-500">Cargando tus preferencias...</p>
          </div>
        }

        <!-- Toast feedback -->
        @if (feedback()) {
          <div
            class="p-4 rounded-xl flex items-start gap-3"
            [class.bg-emerald-50]="feedback()!.kind === 'success'"
            [class.dark:bg-emerald-900\/30]="feedback()!.kind === 'success'"
            [class.border-emerald-200]="feedback()!.kind === 'success'"
            [class.dark:border-emerald-800]="feedback()!.kind === 'success'"
            [class.text-emerald-800]="feedback()!.kind === 'success'"
            [class.dark:text-emerald-200]="feedback()!.kind === 'success'"
            [class.bg-red-50]="feedback()!.kind === 'error'"
            [class.dark:bg-red-900\/30]="feedback()!.kind === 'error'"
            [class.border-red-200]="feedback()!.kind === 'error'"
            [class.dark:border-red-800]="feedback()!.kind === 'error'"
            [class.text-red-800]="feedback()!.kind === 'error'"
            [class.dark:text-red-200]="feedback()!.kind === 'error'"
            [class.border]="true"
          >
            <i
              class="fas mt-0.5"
              [class.fa-check-circle]="feedback()!.kind === 'success'"
              [class.fa-exclamation-circle]="feedback()!.kind === 'error'"
            ></i>
            <p class="text-sm font-medium">{{ feedback()!.msg }}</p>
          </div>
        }

        <!-- Granular consents -->
        <section class="bg-white dark:bg-gray-800 shadow-md hover:shadow-xl transition-shadow rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
          <div class="flex items-start gap-4 mb-6">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <i class="fas fa-toggle-on text-white text-lg"></i>
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-gray-800 dark:text-white">Consentimientos granulares</h2>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Cada finalidad es independiente conforme al RGPD Art. 7. Toca el interruptor y guarda los cambios.
              </p>
            </div>
          </div>

          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            <!-- TOS -->
            <div class="py-4 flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base font-semibold text-gray-900 dark:text-white">
                    Términos de uso y servicio
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    Necesario
                  </span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Necesario para usar la plataforma y poder prestarte los servicios contratados.
                </p>
                @if (consents()?.terms_of_service_consent_date) {
                  <p class="text-xs text-gray-400 mt-1">
                    <i class="fas fa-clock mr-1"></i>Última actualización: {{ consents()!.terms_of_service_consent_date | date: 'short' }}
                  </p>
                }
              </div>
              <label class="inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  [checked]="prefs.tos"
                  (change)="prefs.tos = $any($event.target).checked"
                />
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <!-- Privacy -->
            <div class="py-4 flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base font-semibold text-gray-900 dark:text-white">
                    Política de privacidad
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                    Necesario
                  </span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Necesario para el tratamiento de tus datos personales conforme al RGPD.
                </p>
                @if (consents()?.privacy_policy_consent_date) {
                  <p class="text-xs text-gray-400 mt-1">
                    <i class="fas fa-clock mr-1"></i>Última actualización: {{ consents()!.privacy_policy_consent_date | date: 'short' }}
                  </p>
                }
              </div>
              <label class="inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  [checked]="prefs.privacy"
                  (change)="prefs.privacy = $any($event.target).checked"
                />
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></div>
              </label>
            </div>

            <!-- Marketing -->
            <div class="py-4 flex items-start justify-between gap-4">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-base font-semibold text-gray-900 dark:text-white">
                    Comunicaciones comerciales
                  </span>
                  <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                    Opcional
                  </span>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Quiero recibir ofertas, novedades y comunicaciones por correo electrónico. Puedo revocar este consentimiento en cualquier momento.
                </p>
                @if (consents()?.marketing_consent_date) {
                  <p class="text-xs text-gray-400 mt-1">
                    <i class="fas fa-clock mr-1"></i>Última actualización: {{ consents()!.marketing_consent_date | date: 'short' }}
                  </p>
                }
              </div>
              <label class="inline-flex items-center cursor-pointer shrink-0 mt-1">
                <input
                  type="checkbox"
                  class="sr-only peer"
                  [checked]="prefs.marketing"
                  (change)="prefs.marketing = $any($event.target).checked"
                />
                <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-blue-600 relative transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5"></div>
              </label>
            </div>
          </div>

          <div class="mt-6 flex justify-end">
            <button
              type="button"
              (click)="save()"
              [disabled]="saving()"
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              @if (saving()) {
                <i class="fas fa-spinner fa-spin"></i>
              } @else {
                <i class="fas fa-save"></i>
              }
              Guardar preferencias
            </button>
          </div>
        </section>

        <!-- RGPD Art. 7.3 withdrawal -->
        <section class="bg-white dark:bg-gray-800 shadow-md rounded-2xl p-6 md:p-8 border border-gray-200 dark:border-gray-700">
          <div class="flex items-start gap-4 mb-4">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg shadow-rose-500/30">
              <i class="fas fa-ban text-white text-lg"></i>
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold text-gray-800 dark:text-white">Retirar todos mis consentimientos</h2>
              <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Conforme al RGPD Art. 7.3, puedes retirar tu consentimiento en cualquier momento y debe ser tan fácil como otorgarlo. Esta acción registra la retirada en el log inmutable.
              </p>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              (click)="withdrawAll()"
              [disabled]="withdrawing()"
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition-colors shadow-sm"
            >
              @if (withdrawing()) {
                <i class="fas fa-spinner fa-spin"></i>
              } @else {
                <i class="fas fa-ban"></i>
              }
              Retirar todos los consentimientos
            </button>
            <a
              [routerLink]="['/settings']"
              class="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <i class="fas fa-arrow-left"></i>
              Volver a configuración
            </a>
          </div>
        </section>

        <p class="text-xs text-gray-500 dark:text-gray-400 text-center">
          Tus decisiones se conservan conforme al RGPD Art. 7.1 (trazabilidad) durante 5 años.
        </p>
      </div>
    </div>
  `,
})
export class PortalPreferencesComponent implements OnInit {
  private auth = inject(PortalAuthService);
  private platformId = inject(PLATFORM_ID);

  loading = signal(true);
  saving = signal(false);
  withdrawing = signal(false);
  feedback = signal<{ kind: 'success' | 'error'; msg: string } | null>(null);

  consents = signal<{
    terms_of_service_consent: boolean;
    terms_of_service_consent_date: string | null;
    privacy_policy_consent: boolean;
    privacy_policy_consent_date: string | null;
    marketing_consent: boolean;
    marketing_consent_date: string | null;
    health_data_consent: boolean;
    health_data_consent_date: string | null;
  } | null>(null);

  /**
   * Working copy of the toggles. ngModel binds here; the user must hit
   * "Guardar" to commit. This keeps the API call count to one per save.
   */
  prefs = {
    tos: false,
    privacy: false,
    marketing: false,
  };

  async ngOnInit(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }

    try {
      const session = await this.auth.getSession();
      if (!session?.access_token) {
        this.feedback.set({
          kind: 'error',
          msg: 'No has iniciado sesión. Vuelve a la página principal para acceder.',
        });
        this.loading.set(false);
        return;
      }

      const res = await fetch(this.bffBase() + '/consents', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        this.feedback.set({
          kind: 'error',
          msg: `No se pudieron cargar tus consentimientos (${err.error ?? res.status}).`,
        });
        this.loading.set(false);
        return;
      }

      const body = (await res.json()) as { consents: any };
      this.consents.set(body.consents);
      this.prefs.tos = !!body.consents.terms_of_service_consent;
      this.prefs.privacy = !!body.consents.privacy_policy_consent;
      this.prefs.marketing = !!body.consents.marketing_consent;
    } catch (e: any) {
      console.error('[PortalPreferences] load failed', e);
      this.feedback.set({
        kind: 'error',
        msg: e?.message ?? 'Error desconocido al cargar tus preferencias.',
      });
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    this.feedback.set(null);
    try {
      const session = await this.auth.getSession();
      if (!session?.access_token) throw new Error('Sesión caducada.');

      const res = await fetch(this.bffBase() + '/consents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          terms_of_service_consent: this.prefs.tos,
          privacy_policy_consent: this.prefs.privacy,
          marketing_consent: this.prefs.marketing,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      // Re-fetch so the UI shows the authoritative server state + dates.
      await this.reloadConsents();
      this.feedback.set({
        kind: 'success',
        msg: 'Tus preferencias se han guardado correctamente.',
      });
    } catch (e: any) {
      console.error('[PortalPreferences] save failed', e);
      this.feedback.set({
        kind: 'error',
        msg: e?.message ?? 'No se pudieron guardar tus preferencias.',
      });
    } finally {
      this.saving.set(false);
    }
  }

  async withdrawAll(): Promise<void> {
    if (this.withdrawing()) return;
    const confirmed = isPlatformBrowser(this.platformId)
      ? window.confirm('¿Seguro que quieres retirar TODOS tus consentimientos? Esta acción se registrará en tu historial RGPD.')
      : true;
    if (!confirmed) return;

    this.withdrawing.set(true);
    this.feedback.set(null);
    try {
      const session = await this.auth.getSession();
      if (!session?.access_token) throw new Error('Sesión caducada.');

      const res = await fetch(this.bffBase() + '/withdraw-consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ consent_type: 'all' }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? `Error ${res.status}`);
      }

      this.prefs.tos = false;
      this.prefs.privacy = false;
      this.prefs.marketing = false;
      await this.reloadConsents();
      this.feedback.set({
        kind: 'success',
        msg: 'Has retirado todos tus consentimientos. La retirada se ha registrado en el log RGPD.',
      });
    } catch (e: any) {
      console.error('[PortalPreferences] withdraw failed', e);
      this.feedback.set({
        kind: 'error',
        msg: e?.message ?? 'No se pudo completar la retirada.',
      });
    } finally {
      this.withdrawing.set(false);
    }
  }

  private async reloadConsents(): Promise<void> {
    try {
      const session = await this.auth.getSession();
      if (!session?.access_token) return;
      const res = await fetch(this.bffBase() + '/consents', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) return;
      const body = (await res.json()) as { consents: any };
      this.consents.set(body.consents);
      this.prefs.tos = !!body.consents.terms_of_service_consent;
      this.prefs.privacy = !!body.consents.privacy_policy_consent;
      this.prefs.marketing = !!body.consents.marketing_consent;
    } catch (e) {
      console.warn('[PortalPreferences] reload failed (non-blocking)', e);
    }
  }

  /**
   * Resolve the BFF base URL — same logic the consent landing page uses.
   * The portal frontend talks to the CRM project (ufutyjbqfjrlzkprvyvs) via
   * the Edge Function; tests override via __CRM_BFF_BASE__.
   */
  private bffBase(): string {
    if (typeof window !== 'undefined' && (window as any).__CRM_BFF_BASE__) {
      return (window as any).__CRM_BFF_BASE__;
    }
    return 'https://ufutyjbqfjrlzkprvyvs.supabase.co/functions/v1/client-portal-bff';
  }
}