import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { PortalAuthService } from "../../../core/services/portal-auth.service";

@Component({
  selector: "app-portal-settings",
  standalone: true,
  imports: [CommonModule],
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

      <!-- Datos de Facturación -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-file-invoice-dollar text-primary-500"></i>
          Datos de Facturación
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Estos datos se usan al emitir facturas a tu nombre. Si necesitás
          cambiarlos, contactanos y los actualizamos en tu ficha de cliente.
        </p>
        <ul class="text-sm text-gray-700 dark:text-gray-300 space-y-1">
          <li><span class="text-gray-500">Email de facturación:</span> {{ user?.email ?? '—' }}</li>
          <li><span class="text-gray-500">Empresa:</span> {{ user?.company_name ?? '—' }}</li>
          <li><span class="text-gray-500">NIF/CIF:</span> {{ user?.tax_id ?? '—' }}</li>
        </ul>
      </section>

      <!-- GDPR -->
      <section
        class="bg-white dark:bg-gray-800 shadow rounded-xl p-6 border border-gray-200 dark:border-gray-700"
      >
        <h2
          class="text-xl font-bold text-gray-800 dark:text-white mb-2 flex items-center gap-2"
        >
          <i class="fas fa-shield-alt text-primary-500"></i>
          Consentimientos GDPR
        </h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm">
          Podés revisar y modificar tus consentimientos de privacidad y
          comunicaciones comerciales desde la sección
          <a routerLink="/portal/consent" class="text-primary-600 dark:text-primary-400 hover:underline">Consentimientos</a>.
        </p>
      </section>
    </div>
  `,
})
export class PortalSettingsComponent implements OnInit {
  private auth = inject(PortalAuthService);

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
