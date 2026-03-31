import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// STUB: Phase 3 - Contract progress dialog requires portal contract management
// Real implementation will manage contract signing via portal Edge Functions

export interface ContractProgressStep {
  id: string;
  label: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  errorMessage?: string;
}

export interface ContractResult {
  success: boolean;
  paymentUrl?: string;
  message?: string;
  error?: string;
}

@Component({
  selector: 'app-contract-progress-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- STUB: Contract progress dialog - needs real portal contract management -->
    @if (visible()) {
      <div class="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
        <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full">
          <h3 class="text-lg font-bold text-gray-900 dark:text-white">Contratos (STUB)</h3>
          <p class="text-gray-500 mt-2">Funcionalidad de contratos no disponible en Phase 3</p>
          <button (click)="close()" class="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg">
            Cerrar
          </button>
        </div>
      </div>
    }
  `,
})
export class PortalContractProgressDialogComponent {
  @Input() serviceName = '';
  @Output() completed = new EventEmitter<ContractResult>();
  @Output() cancelled = new EventEmitter<void>();

  visible = signal(false);
  steps = signal<ContractProgressStep[]>([]);

  show(serviceName: string, steps: ContractProgressStep[]) {
    console.warn('[PortalContractProgressDialog] STUB - show not implemented');
    this.serviceName = serviceName;
    this.steps.set(steps);
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
    this.cancelled.emit();
  }

  complete(result: ContractResult) {
    this.visible.set(false);
    this.completed.emit(result);
  }
}
