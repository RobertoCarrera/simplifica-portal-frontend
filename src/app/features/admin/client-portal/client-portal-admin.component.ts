import { Component, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { ClientPortalService } from "../../../core/services/client-portal.service";
import { IPortalAuth } from "../../../core/ports/iportal-auth";

@Component({
  selector: "app-client-portal-admin",
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="max-w-3xl mx-auto p-4">
      <h1 class="text-2xl font-bold mb-4">Portal de clientes - Mapeos</h1>

      <!-- STUB: Admin component for managing client portal mappings -->
      <div class="bg-white rounded-xl shadow p-4 mb-6">
        <p class="text-gray-500 dark:text-gray-400">
          Phase 5: Administrative interface for managing client portal access
          mappings
        </p>
      </div>

      <div class="bg-white rounded-xl shadow p-4">
        <h2 class="text-lg font-semibold mb-3">Nota</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
          Este componente será configurado completamente en Phase 5 (Infra +
          Edge Functions). Requiere: client_portal_users table,
          send-company-invite Edge Function.
        </p>
      </div>
    </div>
  `,
})
export class ClientPortalAdminComponent {
  private portal = inject(ClientPortalService);
  private auth = inject(IPortalAuth);

  mappings: any[] = [];
  loading = signal(false);
  form = { client_id: "", email: "" };

  async reload() {
    this.loading.set(true);
    const { data } = await this.portal.listMappings();
    this.mappings = data || [];
    this.loading.set(false);
  }

  async save() {
    // STUB: Phase 5 - complete upsert mapping
  }

  async remove(id: string) {
    // STUB: Phase 5 - complete delete mapping
  }
}
