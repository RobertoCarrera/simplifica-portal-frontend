import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { IPortalAuth } from "../../../core/ports/iportal-auth";
import { GdprComplianceService } from "../../../shared/services/gdpr-compliance.service"; // STUB
import { environment } from "../../../../environments/environment";
import { TranslocoPipe } from "@ng-js-core/transloco";

@Component({
  selector: "app-portal-invite",
  standalone: true,
  imports: [FormsModule, TranslocoPipe],
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
              <img
                [src]="companyLogoUrl"
                alt="Company Logo"
                class="h-20 w-auto object-contain"
              />
            </div>
          }
          <h1 class="text-2xl font-extrabold text-gray-900 dark:text-white">
            {{ companyNameDisplay || "Portal Clientes" }}
          </h1>
        </div>

        @if (loading) {
          <div class="text-center py-8">
            <div
              class="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"
            ></div>
            <p class="text-gray-600 dark:text-gray-400">
              Procesando invitación...
            </p>
          </div>
        }

        @if (error && !showDetailsForm) {
          <div
            class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4"
          >
            <p class="text-red-800 dark:text-red-200">{{ error }}</p>
          </div>
        }

        @if (success && !showDetailsForm) {
          <div
            class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4"
          >
            <p class="text-green-800 dark:text-green-200">
              Cuenta creada correctamente
            </p>
          </div>
        }

        @if (showDetailsForm) {
          <form
            class="space-y-6"
            (submit)="submitRegistration(); $event.preventDefault()"
          >
            <div>
              <p
                class="text-sm text-gray-600 dark:text-gray-400 mb-4 text-center"
              >
                Completa tus datos
              </p>
              <div class="flex items-center justify-center gap-2 mb-4">
                <span
                  class="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-xs font-medium text-gray-600 dark:text-gray-300"
                >
                  {{ userEmail }}
                </span>
                <span
                  class="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium"
                >
                  {{ getRoleLabel(invitationData?.role) }}
                </span>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >Nombre</label
                >
                <input
                  type="text"
                  [(ngModel)]="name"
                  name="name"
                  required
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Tu nombre"
                  [disabled]="submitting"
                />
              </div>
              <div>
                <label
                  class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                  >Apellidos</label
                >
                <input
                  type="text"
                  [(ngModel)]="surname"
                  name="surname"
                  required
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:text-white"
                  placeholder="Tus apellidos"
                  [disabled]="submitting"
                />
              </div>
            </div>

            @if (invitationData?.role === "owner") {
              <div
                class="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800"
              >
                <h4
                  class="text-sm font-semibold text-emerald-800 dark:text-emerald-200 mb-3 flex items-center gap-2"
                >
                  <i class="fas fa-building"></i> Datos de la Nueva Empresa
                </h4>
                <div class="grid grid-cols-1 gap-4">
                  <div>
                    <label
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >Nombre de Empresa</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="companyName"
                      name="companyName"
                      required
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-emerald-500"
                      placeholder="Mi Empresa S.L."
                      [disabled]="submitting"
                    />
                  </div>
                  <div>
                    <label
                      class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >NIF/CIF</label
                    >
                    <input
                      type="text"
                      [(ngModel)]="companyNif"
                      name="companyNif"
                      required
                      class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                      placeholder="B12345678"
                      [disabled]="submitting"
                    />
                  </div>
                </div>
              </div>
            }

            <!-- GDPR Consent -->
            @if (!isStaff) {
              <div class="space-y-3 pt-2">
                <div
                  class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    [(ngModel)]="privacyAccepted"
                    name="privacy"
                    required
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <div class="ml-2 text-sm">
                    <label
                      class="font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                    >
                      He leído y acepto la
                      <a
                        href="/privacy-policy"
                        class="text-indigo-600 hover:underline"
                        >Política de Privacidad</a
                      >
                      *
                    </label>
                  </div>
                </div>
                <div
                  class="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700/30 rounded-lg border border-gray-100 dark:border-gray-700"
                >
                  <input
                    type="checkbox"
                    [(ngModel)]="marketingAccepted"
                    name="marketing"
                    class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <div class="ml-2 text-sm">
                    <label
                      class="font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none"
                    >
                      Acepto recibir comunicaciones comerciales
                    </label>
                  </div>
                </div>
              </div>
            }

            @if (formError) {
              <div
                class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
              >
                <p class="text-sm text-red-800 dark:text-red-200 font-medium">
                  {{ formError }}
                </p>
              </div>
            }

            <button
              type="submit"
              [disabled]="disabledState"
              class="w-full font-bold py-4 px-4 rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              [style.backgroundColor]="companyColors?.primary || '#4f46e5'"
              [style.color]="
                getContrastColor(companyColors?.primary || '#4f46e5')
              "
            >
              {{ submitting ? "Creando cuenta..." : "Crear Cuenta" }}
            </button>
          </form>
        }
      </div>
    </div>
  `,
})
export class PortalInviteComponent {
  private portalAuth = inject(IPortalAuth);
  // STUB: GdprComplianceService - Phase 3

  // Form data
  name = "";
  surname = "";
  companyName = "";
  companyNif = "";

  // GDPR Consent
  privacyAccepted = false;
  marketingAccepted = false;
  healthDataAccepted = false;

  // UI state
  loading = true;
  submitting = false;
  success = false;
  error: string | null = null;
  formError = "";
  userEmail = "";

  // Branding
  companyNameDisplay: string | null = null;
  companyLogoUrl: string | null = null;
  companyColors: { primary: string; secondary: string } | null = null;

  showDetailsForm = false;
  invitationToken = "";
  invitationData: any = null;

  get disabledState(): boolean {
    return (
      this.submitting ||
      !this.name ||
      !this.surname ||
      (!this.privacyAccepted && !this.isStaff)
    );
  }

  getContrastColor(hexcolor: string): string {
    const r = parseInt(hexcolor.substring(1, 3), 16);
    const g = parseInt(hexcolor.substring(3, 5), 16);
    const b = parseInt(hexcolor.substring(5, 7), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 128 ? "#1a1a1a" : "white";
  }

  get isStaff(): boolean {
    const role = this.invitationData?.role;
    return ["professional", "agent", "member", "admin"].includes(role);
  }

  getRoleLabel(role: string): string {
    const roles: Record<string, string> = {
      owner: "Propietario",
      admin: "Administrador",
      member: "Miembro",
      client: "Cliente",
      professional: "Profesional",
      agent: "Agente",
    };
    return roles[role] || role;
  }

  async ngOnInit() {
    // STUB: Handle invitation token from URL
    this.loading = false;
  }

  async submitRegistration() {
    this.formError = "";
    if (!this.name.trim() || !this.surname.trim()) {
      this.formError = "Por favor completa tu nombre y apellido";
      return;
    }
    if (!this.isStaff && !this.privacyAccepted) {
      this.formError = "Debes aceptar la política de privacidad";
      return;
    }

    this.submitting = true;
    try {
      // STUB: Phase 3 - complete registration flow
      this.success = true;
      this.showDetailsForm = false;
    } catch (e: any) {
      this.formError = e?.message || "Error inesperado";
    } finally {
      this.submitting = false;
    }
  }
}
