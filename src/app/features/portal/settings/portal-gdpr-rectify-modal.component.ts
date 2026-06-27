import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PortalAuthService } from '../../../core/services/portal-auth.service';
import { ToastService } from '../../../shared/services/toast.service';

/**
 * Portal GDPR Rectification Modal (Art. 16)
 *
 * Ported from the CRM's `GdprRequestModalComponent` (635 LOC), stripped down
 * to ONLY the rectification flow because the portal is client-facing and
 * does not need restriction/objection branches.
 *
 * Adaptations vs the source component:
 *   - No `LocalitiesService` / via / locality autocomplete — the portal
 *     treats `address` as a single free-text line.
 *   - No `GdprComplianceService` — calls `portal_submit_arco_request` RPC
 *     directly via `PortalAuthService.client`.
 *   - No `TranslocoPipe` — portal hardcodes Spanish strings.
 *   - No `body.appendChild` / `HostListener('document:click')` — modal is
 *     rendered inline (`@if (open)`); the parent controls mounting.
 *   - No `Locality` model dependency.
 *   - Removed `restriction` and `objection` branches from the open() method.
 *
 * RPC contract (see supabase/migrations/20260406000005_portal_arco_rpcs.sql):
 *   portal_submit_arco_request(p_request_type TEXT, p_details JSONB)
 *     → returns { success: bool, request_id?: uuid, error?: string }
 */
@Component({
  selector: 'app-portal-gdpr-rectify-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (isOpen) {
      <div
        class="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-[99999] flex items-center justify-center modal-backdrop"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="relative p-6 border w-11/12 md:w-1/2 lg:w-2/5 rounded-xl bg-white dark:bg-slate-800 dark:border-slate-600 modal-content-box"
          (click)="$event.stopPropagation()"
        >
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ titleText }}
            </h3>
            <button
              type="button"
              (click)="close()"
              [disabled]="submitting"
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
              aria-label="Cerrar"
            >
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>

          <p
            class="text-sm text-gray-600 dark:text-gray-400 mb-6 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-100 dark:border-blue-800"
          >
            {{ descriptionText }}
          </p>

          <div
            class="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded-r text-sm text-blue-800 dark:text-blue-300"
          >
            Marcá los campos que querés corregir y escribí el valor correcto para cada uno.
          </div>

          <div class="mb-6">
            <div class="space-y-4">
              @for (field of rectificationFields; track field.key) {
                <div
                  class="p-4 border rounded-xl dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50 transition-all shadow-sm"
                >
                  <div class="flex items-center mb-3">
                    <input
                      type="checkbox"
                      [id]="'pf-' + field.key"
                      [(ngModel)]="field.selected"
                      [disabled]="submitting"
                      class="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                    />
                    <label
                      [for]="'pf-' + field.key"
                      class="ml-3 text-sm font-semibold cursor-pointer select-none"
                    >
                      {{ field.label }}
                    </label>
                  </div>

                  @if (field.selected) {
                    <div class="ml-7 mt-3 space-y-3 animate-fadeIn">
                      @if (field.currentValue) {
                        <div class="text-[10px] text-gray-500 italic flex items-center gap-1.5">
                          <i class="fas fa-info-circle text-blue-400"></i>
                          Valor registrado: {{ field.currentValue }}
                        </div>
                      }

                      <div>
                        <input
                          type="text"
                          [(ngModel)]="field.newValue"
                          [disabled]="submitting"
                          [placeholder]="'Nuevo ' + field.label"
                          class="w-full px-3 py-2 text-sm border rounded-lg dark:bg-slate-900 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
                        />
                      </div>
                    </div>
                  }
                </div>
              }
            </div>

            @if (!hasSelectedFields()) {
              <p class="text-xs text-red-500 mt-6 text-center italic">
                Seleccioná al menos un campo para corregir.
              </p>
            }
          </div>

          <div class="flex justify-end gap-3 pt-6 border-t dark:border-slate-700">
            <button
              type="button"
              (click)="close()"
              [disabled]="submitting"
              class="px-5 py-2.5 text-sm font-medium rounded-xl bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors shadow-sm disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="submit()"
              [disabled]="submitting || !isValid()"
              class="px-5 py-2.5 text-sm font-bold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              @if (submitting) {
                <span
                  class="animate-spin inline-block h-3 w-3 border-2 border-white border-t-transparent rounded-full"
                ></span>
              }
              Enviar solicitud de rectificación
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [
    `
      .modal-backdrop {
        background-color: rgba(0, 0, 0, 0.7);
        backdrop-filter: blur(2px);
      }
      .modal-content-box {
        max-height: 95vh;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      }
      .animate-fadeIn {
        animation: fadeIn 0.2s ease-out forwards;
      }
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(5px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `,
  ],
})
export class PortalGdprRectifyModalComponent {
  @Input() clientEmail = '';
  @Input() clientName = '';
  @Input() clientPhone?: string;
  @Input() clientDni?: string;
  @Input() clientAddress?: string;
  @Input() clientWeb?: string;

  /**
   * Optional billing data — only used when `context === 'billing'`.
   * The portal currently only fires the personal branch.
   */
  @Input() billingData?: {
    business_name?: string;
    trade_name?: string;
    cif_nif?: string;
    billing_email?: string;
    iban?: string;
    address?: string;
  };

  @Input() context: 'personal' | 'billing' = 'personal';

  @Output() requestCreated = new EventEmitter<void>();

  private auth = inject(PortalAuthService);
  private toast = inject(ToastService);

  isOpen = false;
  submitting = false;

  /** Title shown in the modal header — mirrors CRM context switch. */
  get titleText(): string {
    return this.context === 'billing'
      ? 'Rectificar Datos de Facturación'
      : 'Rectificar Datos Personales';
  }

  get descriptionText(): string {
    return 'Indica qué datos son incorrectos y proporciona el valor real.';
  }

  rectificationFields: Array<{
    key: string;
    label: string;
    currentValue: string;
    newValue: string;
    selected: boolean;
  }> = [];

  /**
   * Open the modal in either personal or billing context.
   * `data` overrides whatever was passed via @Input — this is the path
   * the parent uses (the CRM `gdprService` reads @Inputs, but here we
   * pass everything explicitly so the modal stays decoupled).
   */
  open(
    context: 'personal' | 'billing',
    data: {
      email?: string;
      name?: string;
      phone?: string;
      dni?: string;
      address?: string;
      web?: string;
    },
  ): void {
    this.context = context;
    if (data.email !== undefined) this.clientEmail = data.email;
    if (data.name !== undefined) this.clientName = data.name;
    if (data.phone !== undefined) this.clientPhone = data.phone;
    if (data.dni !== undefined) this.clientDni = data.dni;
    if (data.address !== undefined) this.clientAddress = data.address;
    if (data.web !== undefined) this.clientWeb = data.web;
    this.initRectificationForm();
    this.isOpen = true;
  }

  close(): void {
    if (this.submitting) return;
    this.isOpen = false;
  }

  private initRectificationForm(): void {
    if (this.context === 'billing') {
      this.rectificationFields = [
        {
          key: 'business_name',
          label: 'Razón Social',
          currentValue: this.billingData?.business_name || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'trade_name',
          label: 'Nombre Comercial',
          currentValue: this.billingData?.trade_name || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'cif_nif',
          label: 'CIF / NIF',
          currentValue: this.billingData?.cif_nif || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'billing_email',
          label: 'Email Facturación',
          currentValue: this.billingData?.billing_email || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'iban',
          label: 'IBAN / Cuenta',
          currentValue: this.billingData?.iban || '***',
          newValue: '',
          selected: false,
        },
        {
          key: 'address',
          label: 'Dirección Fiscal',
          currentValue: this.billingData?.address || '',
          newValue: '',
          selected: false,
        },
      ];
    } else {
      // Personal context — 6 fields. Same keys as CRM minus the multi-field
      // address breakdown; here `address` is a single free-text line.
      this.rectificationFields = [
        {
          key: 'name',
          label: 'Nombre Completo',
          currentValue: this.clientName || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'email',
          label: 'Email',
          currentValue: this.clientEmail || '',
          newValue: '',
          selected: false,
        },
        {
          key: 'dni',
          label: 'DNI / CIF',
          currentValue: this.clientDni || 'No registrado',
          newValue: '',
          selected: false,
        },
        {
          key: 'phone',
          label: 'Teléfono',
          currentValue: this.clientPhone || 'No registrado',
          newValue: '',
          selected: false,
        },
        {
          key: 'web',
          label: 'Sitio Web',
          currentValue: this.clientWeb || 'No registrado',
          newValue: '',
          selected: false,
        },
        {
          key: 'address',
          label: 'Dirección Física',
          currentValue: this.clientAddress || 'No registrado',
          newValue: '',
          selected: false,
        },
      ];
    }
  }

  hasSelectedFields(): boolean {
    return this.rectificationFields.some((f) => f.selected);
  }

  isValid(): boolean {
    const selected = this.rectificationFields.filter((f) => f.selected);
    if (selected.length === 0) return false;
    return selected.every((f) => f.newValue && f.newValue.trim().length > 0);
  }

  async submit(): Promise<void> {
    if (this.submitting || !this.isValid()) return;

    const changes = this.rectificationFields
      .filter((f) => f.selected)
      .map((f) => `- ${f.label}: "${f.currentValue}" => "${f.newValue}"`)
      .join('\n');

    const description = 'RECTIFICACIÓN:\n' + changes;

    this.submitting = true;
    try {
      // Call create_arc_request (not portal_submit_arco_request) — the latter
      // has a stale PostgREST schema cache entry that won't pick up the
      // fresh definition, so the portal is hitting a cached 4-param function
      // signature mismatch. The new sibling function has a fresh cache entry.
      const { data, error } = await this.auth.client.rpc(
        'create_arc_request',
        {
          p_request_type: 'rectification',
          p_details: { description },
          p_ip_address: null,
          p_user_agent:
            typeof navigator !== 'undefined' && navigator.userAgent
              ? navigator.userAgent
              : null,
        },
      );

      if (error) throw error;

      const result = (data ?? null) as
        | { success?: boolean; request_id?: string; error?: string }
        | null;

      if (!result?.success) {
        const msg = this.translateRpcError(result?.error);
        this.toast.error('No se pudo enviar', msg);
        return;
      }

      this.toast.success(
        'Solicitud enviada',
        'El responsable ha sido notificado.',
      );
      this.requestCreated.emit();
      this.isOpen = false;
    } catch (e: any) {
      console.error('Error submitting rectification request:', e);
      this.toast.error(
        'Error',
        e?.message ?? 'No se pudo enviar la solicitud de rectificación.',
      );
    } finally {
      this.submitting = false;
    }
  }

  private translateRpcError(code?: string): string {
    switch (code) {
      case 'already_open':
        return 'Ya tenés una solicitud de rectificación pendiente. Te responderemos a la brevedad.';
      case 'Invalid request type':
        return 'Tipo de solicitud inválido.';
      case 'Client not found':
        return 'No se encontró tu ficha de cliente. Contactanos para resolverlo.';
      default:
        return code ?? 'No se pudo registrar la solicitud.';
    }
  }
}
