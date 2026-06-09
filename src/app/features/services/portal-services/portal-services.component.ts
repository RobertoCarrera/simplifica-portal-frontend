import { Component, OnInit, inject, signal, ViewChild } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterModule } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { ClientPortalService } from "../../../core/services/client-portal.service";
import { PortalAuthService } from "../../../core/services/portal-auth.service";
import { ToastService } from "../../../shared/services/toast.service";

interface ContractedService {
  id: string;
  quote_id: string;
  quote_number: string | null;
  title: string | null;
  description: string | null;
  service_id: string | null;
  variant_id: string | null;
  variant_name: string | null;
  unit_price: number | null;
  quantity: number | null;
  total: number | null;
  billing_period: string | null;
  status: string | null;
  quote_date: string | null;
  is_recurring: boolean;
  paymentStatus?: string;
}

interface PublicService {
  id: string;
  name: string | null;
  description: string | null;
  base_price: number | null;
  category: string | null;
  has_variants: boolean | null;
  is_public: boolean | null;
  is_active: boolean | null;
  duration_minutes: number | null;
  variants?: ServiceVariant[];
}

interface ServiceVariant {
  id: string;
  variant_name: string | null;
  pricing: any | null;
  billing_period: string | null;
  is_active: boolean | null;
}

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
            @if (contractedServices().length === 0) {
              <div
                class="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border border-gray-200 dark:border-slate-700 mb-6"
              >
                <p class="text-gray-500 dark:text-gray-400">
                  No tienes servicios activos actualmente.
</p>
              </div>
            }
            @if (contractedServices().length > 0) {
              <div class="space-y-4">
                @for (service of contractedServices(); track service.id) {
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
                              {{ service.title || 'Servicio' }}
                            </h3>
                            @if (service.status === 'invoiced') {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"
                                >Facturado</span
                              >
                            }
                            @if (service.status === 'accepted') {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                                >Activo</span
                              >
                            }
                            @if (service.variant_name) {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                                >{{ service.variant_name }}</span
                              >
                            }
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400">
                            {{ service.description || service.title || 'Servicio contratado' }}
                          </div>
                          @if (service.quote_number) {
                            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Presupuesto: {{ service.quote_number }}
                            </div>
                          }
                        </div>
                        <div class="text-right min-w-[120px]">
                          <p
                            class="font-bold text-xl text-gray-900 dark:text-white"
                          >
                            {{ service.total | currency: "EUR" }}
                          </p>
                          @if (service.is_recurring) {
                            <p class="text-xs text-gray-500">
                              / {{ getBillingLabel(service.billing_period) }}
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

          <!-- Public Services Catalog -->
          <div>
            <h2
              class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center"
            >
              <i class="fas fa-store text-blue-500 mr-2"></i> Catálogo de
              Servicios
            </h2>
            @if (publicServices().length === 0) {
<div
                class="bg-white dark:bg-slate-800 rounded-xl p-6 text-center border border-gray-200 dark:border-slate-700"
              >
                <p class="text-gray-500 dark:text-gray-400">
                  No hay servicios disponibles en este momento.
</p>
              </div>
            }
            @if (publicServices().length > 0) {
              <div class="space-y-4">
                @for (service of publicServices(); track service.id) {
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
                            @if (service.category) {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                                >{{ service.category }}</span
                              >
                            }
                            @if (service.has_variants) {
                              <span
                                class="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700"
                                >Con variantes</span
                              >
                            }
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400">
                            {{ service.description || 'Sin descripción' }}
                          </div>
                          @if (service.duration_minutes) {
                            <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              Duración: {{ service.duration_minutes }} minutos
                            </div>
                          }
                        </div>
                        <div class="text-right min-w-[120px]">
                          @if (service.base_price !== null) {
                            <p
                              class="font-bold text-xl text-gray-900 dark:text-white"
                            >
                              {{ service.base_price | currency: "EUR" }}
                            </p>
 @if (service.has_variants) {
                              <p class="text-xs text-gray-500">
                                desde
                              </p>
                            }
                          }
                        </div>
                      </div>
                      @if (service.variants && service.variants.length > 0) {
                        <div class="border-t border-gray-200 dark:border-slate-700 pt-3">
                          <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">Variantes disponibles:</p>
                          <div class="flex flex-wrap gap-2">
                            @for (variant of service.variants; track variant.id) {
                              <span
                                class="px-3 py-1 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                              >
                                {{ variant.variant_name || 'Variante' }}
                                @if (variant.pricing && variant.pricing[0]) {
                                  - {{ variant.pricing[0].base_price | currency: "EUR" }}
                                }
                              </span>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    </div>
  `,
})
export class PortalServicesComponent implements OnInit {
  private portalService = inject(ClientPortalService);
  private authService = inject(PortalAuthService);
  private toastService = inject(ToastService);

  loading = signal(true);
  contractedServices = signal<ContractedService[]>([]);
  publicServices = signal<PublicService[]>([]);

  ngOnInit(): void {
    this.loadData();
  }

  private async loadData(): Promise<void> {
    this.loading.set(true);
    try {
      await Promise.all([
        this.loadContractedServices(),
        this.loadAvailableServices(),
      ]);
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Load services the client has contracted (accepted/invoiced quotes).
   * These come from the portal's quotes table filtered by status.
   */
  private async loadContractedServices(): Promise<void> {
    try {
      const token = await this.authService.requireAccessToken();
      const anonKey = this.authService.supabaseKey;
      const bffUrl = this.authService.supabaseUrl + '/functions/v1/client-portal-bff/contracted-services';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        console.error('[PortalServices] contracted-services BFF returned', res.status);
        this.contractedServices.set([]);
        return;
      }

      const json = await res.json();
      const services = json?.data ?? [];
      this.contractedServices.set(Array.isArray(services) ? services : []);
    } catch (e: any) {
      console.error('[PortalServices] loadContractedServices failed:', e?.message);
      this.contractedServices.set([]);
    }
  }

  /**
   * Load public services from the company's catalog.
   * This requires CRM cross-project access, so it may fail if CRM credentials are not configured.
   */
  private async loadAvailableServices(): Promise<void> {
    try {
      const token = await this.authService.requireAccessToken();
      const anonKey = this.authService.supabaseKey;
      const bffUrl = this.authService.supabaseUrl + '/functions/v1/client-portal-bff/services';

      const res = await fetch(bffUrl, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        if (res.status === 500) {
          // CRM credentials may not be configured — this is expected in some environments
          console.warn('[PortalServices] Services catalog unavailable (CRM not connected)');
        } else {
          console.error('[PortalServices] services BFF returned', res.status);
        }
        this.publicServices.set([]);
        return;
      }

      const json = await res.json();
      const services = json?.data ?? [];
      this.publicServices.set(Array.isArray(services) ? services : []);
    } catch (e: any) {
      console.error('[PortalServices] loadAvailableServices failed:', e?.message);
      this.publicServices.set([]);
    }
  }

  getBillingLabel(period: string | null | undefined): string {
    if (!period) return '';
    switch (period) {
      case 'monthly':
        return 'Mensual';
      case 'quarterly':
        return 'Trimestral';
      case 'biannually':
        return 'Semestral';
      case 'annually':
      case 'yearly':
        return 'Anual';
      case 'one-time':
        return 'Pago único';
      default:
        return period;
    }
  }
}
