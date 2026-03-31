import { Component, OnInit, inject, signal, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ClientPortalService } from "../../../core/services/client-portal.service";
import { ToastService } from "../../../shared/services/toast.service";

interface ContractedService {
  id: string;
  name: string;
  description: string;
  price: number;
  isRecurring: boolean;
  billingPeriod: string;
  status: string;
  paymentStatus?: string;
  variants?: any[];
  selectedVariant?: any;
  nextBillingDate?: string;
}

// STUB: Phase 3 - needs supabase-invoices.service, payment-method-selector, etc.

@Component({
  selector: "app-portal-services",
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="min-h-screen bg-gray-50 dark:bg-slate-900 p-4">
      <div class="max-w-7xl mx-auto">
        <div class="mb-6">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
            Mis Servicios
          </h1>
          <p class="text-gray-600 dark:text-gray-400 mt-1">
            Gestiona tus servicios contratados y descubre nuevas opciones
          </p>
        </div>

        @if (loading()) {
          <div class="text-gray-500 dark:text-gray-400">
            Cargando servicios...
          </div>
        }

        @if (!loading()) {
          <!-- Contracted Services -->
          <div class="mb-10">
            <h2
              class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center"
            >
              <i class="fas fa-check-circle text-green-500 mr-2"></i> Servicios
              Contratados
            </h2>
            @if (services().length === 0) {
              <div
                class="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border border-gray-200 dark:border-slate-700 mb-6"
              >
                <p class="text-gray-500 dark:text-gray-400">
                  No tienes servicios activos actualmente.
                </p>
              </div>
            }
            @if (services().length > 0) {
              <div class="space-y-4">
                @for (service of services(); track service) {
                  <div
                    class="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm"
                  >
                    <div class="flex flex-col gap-4">
                      <div
                        class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"
                      >
                        <div class="flex-1">
                          <div class="flex items-center gap-2 mb-1">
                            <h3
                              class="font-bold text-lg text-gray-900 dark:text-white"
                            >
                              {{ service.name }}
                            </h3>
                            @if (service.paymentStatus === "pending") {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800"
                                >Pendiente de Pago</span
                              >
                            }
                            @if (service.selectedVariant) {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                                >{{ service.selectedVariant.name }}</span
                              >
                            }
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400">
                            {{ service.description }}
                          </div>
                        </div>
                        <div class="text-right min-w-[120px]">
                          <p
                            class="font-bold text-xl text-gray-900 dark:text-white"
                          >
                            {{ service.price | currency: "EUR" }}
                          </p>
                          @if (service.isRecurring) {
                            <p class="text-xs text-gray-500">
                              / {{ service.billingPeriod }}
                            </p>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                }
              </div>
            }
          </div>

          <!-- Public Services -->
          @if (publicServices().length > 0) {
            <div>
              <h2
                class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center"
              >
                <i class="fas fa-store text-blue-500 mr-2"></i> Catálogo de
                Servicios
              </h2>
              <div class="text-gray-500 dark:text-gray-400">
                Servicios públicos disponibles — Phase 3 integration needed
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class PortalServicesComponent implements OnInit {
  private portalService = inject(ClientPortalService);
  private toastService = inject(ToastService);

  loading = signal(true);
  services = signal<ContractedService[]>([]);
  publicServices = signal<any[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      await this.loadContractedServices();
    } finally {
      this.loading.set(false);
    }
  }

  private async loadContractedServices(): Promise<void> {
    // STUB: Phase 3 - needs full implementation with service variants
    this.services.set([]);
  }

  getBillingLabel(period: string): string {
    switch (period) {
      case "monthly":
        return "Mensual";
      case "annually":
        return "Anual";
      case "one-time":
        return "Pago único";
      default:
        return period;
    }
  }
}
