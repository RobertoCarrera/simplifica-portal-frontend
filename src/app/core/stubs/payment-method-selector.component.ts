import { Component, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

// STUB: Phase 3 - Full payment method selector requires portal's payment providers
// Real implementation will use portal-specific Stripe/PayPal configuration

export interface PaymentMethod {
  provider: 'stripe' | 'paypal' | 'cash';
  name: string;
  icon: string;
  description: string;
  supportsInstallments?: boolean;
  installmentOptions?: { months: number; label: string }[];
}

export interface PaymentSelection {
  provider: 'stripe' | 'paypal' | 'cash';
  installments?: number;
}

@Component({
  selector: 'app-payment-method-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- STUB: Payment method selector - needs real portal payment integration -->
    <div class="p-4 bg-gray-100 rounded-lg text-center">
      <p class="text-gray-500 text-sm">Métodos de pago no disponibles (STUB - Phase 5)</p>
    </div>
  `,
})
export class PortalPaymentMethodSelectorComponent {
  @Input() amount = 0;
  @Input() invoiceNumber = '';
  @Input() availableProviders: ('stripe' | 'paypal' | 'cash')[] = ['stripe', 'paypal', 'cash'];

  visible = signal(false);

  open(amount: number, invoiceNumber: string, providers: ('stripe' | 'paypal' | 'cash')[]) {
    console.warn('[PortalPaymentMethodSelector] STUB - open not implemented');
    this.visible.set(true);
  }

  close() {
    this.visible.set(false);
  }

  onSelect(provider: 'stripe' | 'paypal' | 'cash') {
    console.warn('[PortalPaymentMethodSelector] STUB - onSelect not implemented');
    this.close();
  }

  cancel() {
    this.close();
  }
}
