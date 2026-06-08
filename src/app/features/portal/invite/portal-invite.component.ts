import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PortalAuthService } from '../../../core/services/portal-auth.service';
import type { SupabaseClient } from '@supabase/supabase-js';

interface Invitation {
  email: string;
  role: string;
  company_name: string;
  inviter_name: string;
  expires_at: string;
}

@Component({
  selector: 'app-portal-invite',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="min-h-screen flex items-center py-4 justify-center bg-gray-50 dark:bg-gray-900 px-4"
    >
      <div
        class="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-100 dark:border-gray-700"
      >
        <!-- Header -->
        <div class="text-center mb-8">
          @if (companyLogoUrl) {
            <div class="mb-5 flex justify-center">
              <img [src]="companyLogoUrl" alt="Company Logo" class="h-20 w-auto object-contain" />
            </div>
          }
          <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
            {{ companyNameDisplay || 'Portal Clientes' }}
          </h1>
        </div>

        <!-- Loading State -->
        @if (state() === 'loading') {
          <div class="text-center py-8">
            <div
              class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
            ></div>
            <p class="text-gray-600 dark:text-gray-400">Validando invitación...</p>
          </div>
        }

        <!-- Error State -->
        @if (state() === 'error') {
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4"
          >
            <p class="text-red-800 dark:text-red-200">{{ errorMessage() }}</p>
          </div>
        }

        <!-- Success State -->
        @if (state() === 'success') {
          <div
            class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4"
          >
            <p class="text-green-800 dark:text-green-200 text-center">
              <span class="block text-2xl mb-2">&#10004;</span>
              ¡Invitación aceptada! Redirigiendo al dashboard...
            </p>
          </div>
        }

        <!-- Rejected State -->
        @if (state() === 'rejected') {
          <div
            class="bg-gray-50 dark:bg-gray-700/30 border border-gray-200 dark:border-gray-600 rounded-lg p-4 mb-4"
          >
            <p class="text-gray-800 dark:text-gray-200 text-center">
              <span class="block text-2xl mb-2">&#10060;</span>
              Has rechazado la invitación.
            </p>
          </div>
        }

        <!-- Details State: Show invitation info + Accept/Reject buttons -->
        @if (state() === 'details' && invitation()) {
          <div class="space-y-6">
            <!-- Invitation Details -->
            <div class="text-center">
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Has sido invitado a unirte a:
              </p>
              <div class="flex items-center justify-center gap-2 mb-4">
                <span
                  class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300"
                >
                  {{ invitation()?.email }}
                </span>
                <span
                  class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium"
                >
                  {{ getRoleLabel(invitation()?.role || '') }}
                </span>
              </div>
              @if (invitation()?.company_name) {
                <p class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {{ invitation()?.company_name }}
                </p>
              }
              @if (invitation()?.inviter_name) {
                <p class="text-sm text-gray-500 dark:text-gray-400">
                  Invitado por: {{ invitation()?.inviter_name }}
                </p>
              }
            </div>

            <!-- Accept/Reject Buttons -->
            <div class="flex gap-3">
              <button
                (click)="reject()"
                class="flex-1 py-3 px-4 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Rechazar
              </button>
              <button
                (click)="accept()"
                class="flex-1 py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Aceptar
              </button>
            </div>
          </div>
        }

        <!-- Accepting State -->
        @if (state() === 'accepting') {
          <div class="text-center py-8">
            <div
              class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
            ></div>
            <p class="text-gray-600 dark:text-gray-400">Aceptando invitación...</p>
          </div>
        }

        <!-- Rejecting State -->
        @if (state() === 'rejecting') {
          <div class="text-center py-8">
            <div
              class="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-600 mx-auto mb-4"
            ></div>
            <p class="text-gray-600 dark:text-gray-400">Rechazando invitación...</p>
          </div>
        }
      </div>
    </div>
  `,
})
export class PortalInviteComponent {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private portalAuth = inject(PortalAuthService);

  // Supabase client for edge function calls
  get supabase(): SupabaseClient {
    return this.portalAuth.client;
  }

  // Get current authenticated user
  get currentUser() {
    return this.portalAuth.getCurrentClient();
  }

  // State signals
  state = signal<
    'loading' | 'details' | 'accepting' | 'rejecting' | 'success' | 'error' | 'rejected'
  >('loading');
  invitation = signal<Invitation | null>(null);
  errorMessage = signal<string>('');

  // Form data
  name = '';
  surname = '';
  companyName = '';
  companyNif = '';

  // GDPR Consent
  privacyAccepted = false;
  marketingAccepted = false;
  healthDataAccepted = false;

  // UI state
  loading = true;
  submitting = false;
  success = false;
  error: string | null = null;
  formError = '';
  userEmail = '';

  // Branding
  companyNameDisplay: string | null = null;
  companyLogoUrl: string | null = null;
  companyColors: { primary: string; secondary: string } | null = null;

  showDetailsForm = false;
  invitationToken = '';
  invitationData: any = null;

  get disabledState(): boolean {
    return (
      this.submitting || !this.name || !this.surname || (!this.privacyAccepted && !this.isStaff)
    );
  }

  getContrastColor(hexcolor: string): string {
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? '#1a1a1a' : 'white';
  }

  get isStaff(): boolean {
    const role = this.invitation()?.role ?? '';
    return ['professional', 'agent', 'member', 'admin'].includes(role);
  }

  getRoleLabel(role: string): string {
    const roles: Record<string, string> = {
      owner: 'Propietario',
      admin: 'Administrador',
      member: 'Miembro',
      client: 'Cliente',
      professional: 'Profesional',
      agent: 'Agente',
    };
    return roles[role] || role;
  }

  async ngOnInit() {
    // 1. Get token from URL
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.state.set('error');
      this.errorMessage.set('No invitation token provided');
      return;
    }

    // 2. Validate token by calling edge function
    this.state.set('loading');
    try {
      const { data, error } = await this.supabase.functions.invoke('validate-invite-token', {
        body: { token },
      });

      if (error || !data?.valid) {
        this.state.set('error');
        this.errorMessage.set(data?.error || 'Invalid or expired invitation');
        return;
      }

      // 3. Store invitation data
      this.invitation.set(data.invitation);
      this.state.set('details'); // show accept/reject buttons
    } catch (e) {
      this.state.set('error');
      this.errorMessage.set('Failed to load invitation');
    }
  }

  private redirectToLogin(returnUrl: string): void {
    this.router.navigate(['/login'], {
      queryParams: { returnUrl },
    });
  }

  private buildReturnUrl(): string {
    const token = this.route.snapshot.queryParamMap.get('token');
    return `/invite?token=${token || ''}`;
  }

  async accept() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    // FIX #1 + #2: Get current user (must await since getCurrentClient is async)
    // FIX #2: Verify authentication before proceeding
    const user = await this.currentUser;
    if (!user) {
      this.redirectToLogin(this.buildReturnUrl());
      return;
    }

    this.state.set('accepting');
    try {
      const { data, error } = await this.supabase.functions.invoke('accept-invitation', {
        body: {
          token: token,
          user_id: user.id,
        },
      });

      if (error || !data?.success) {
        this.state.set('details');
        this.errorMessage.set(data?.error || 'Failed to accept invitation');
        return;
      }

      this.state.set('success');
      // Redirect to dashboard after 2 seconds
      setTimeout(() => this.router.navigate(['/dashboard']), 2000);
    } catch (e) {
      this.state.set('details');
      this.errorMessage.set('Failed to accept invitation');
    }
  }

  async reject() {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    // FIX #2: Verify authentication before proceeding (reject-invitation also requires JWT)
    const user = await this.currentUser;
    if (!user) {
      this.redirectToLogin(this.buildReturnUrl());
      return;
    }

    this.state.set('rejecting');
    try {
      const { data, error } = await this.supabase.functions.invoke('reject-invitation', {
        body: {
          token: token,
        },
      });

      if (error || !data?.success) {
        this.state.set('details');
        this.errorMessage.set(data?.error || 'Failed to reject invitation');
        return;
      }

      this.state.set('rejected');
    } catch (e) {
      this.state.set('details');
      this.errorMessage.set('Failed to reject invitation');
    }
  }

  async submitRegistration() {
    this.formError = '';
    if (!this.name.trim() || !this.surname.trim()) {
      this.formError = 'Por favor completa tu nombre y apellido';
      return;
    }
    if (!this.isStaff && !this.privacyAccepted) {
      this.formError = 'Debes aceptar la política de privacidad';
      return;
    }

    this.submitting = true;
    try {
      // STUB: Phase 3 - complete registration flow
      this.success = true;
      this.showDetailsForm = false;
    } catch (e: any) {
      this.formError = e?.message || 'Error inesperado';
    } finally {
      this.submitting = false;
    }
  }
}
