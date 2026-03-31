import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { IPortalAuth } from "../../../core/ports/iportal-auth";
import { ToastService } from "../../../shared/services/toast.service"; // STUB

// STUB: Phase 3 - needs customers service and ClientGdprPanelComponent

@Component({
  selector: "app-portal-settings",
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="max-w-4xl mx-auto p-6 space-y-8">
      <div class="flex items-center justify-between">
        <h1 class="text-3xl font-bold text-gray-900 dark:text-white">
          Configuración
        </h1>
      </div>

      @if (isLoading) {
        <div class="text-center py-10">
          <i class="fas fa-spinner fa-spin text-3xl text-primary-500"></i>
          <p class="mt-2 text-gray-500">Cargando información...</p>
        </div>
      }

      <!-- STUB: Phase 3 - Billing section will be completed when supabase-customers.service is stubbed -->
      <div
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"
        >
          <i class="fas fa-file-invoice-dollar text-primary-500"></i>
          Datos de Facturación
        </h2>
        <p class="text-gray-500 dark:text-gray-400 mb-6 text-sm">
          Configura tus datos de facturación — Phase 3 integration needed
        </p>
        <div class="text-gray-400 dark:text-gray-500">
          billing_email, iban, bic, payment_method fields — STUB
        </div>
      </div>

      <!-- STUB: Phase 3 - GDPR Panel will use copied client-gdpr-panel component -->
      <div
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2"
        >
          <i class="fas fa-shield-alt text-primary-500"></i>
          Consentimientos GDPR
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Phase 3: Integrate ClientGdprPanelComponent from copied customers
          feature
        </p>
      </div>
    </div>
  `,
})
export class PortalSettingsComponent implements OnInit {
  private auth = inject(IPortalAuth);
  private toast = inject(ToastService); // STUB

  user: any = null;
  isLoading = true;

  async ngOnInit() {
    try {
      const client = await this.auth.getCurrentClient();
      this.user = client;
    } catch (e) {
      console.error(e);
    } finally {
      this.isLoading = false;
    }
  }
}
