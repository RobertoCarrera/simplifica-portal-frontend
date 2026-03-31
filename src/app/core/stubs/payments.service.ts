import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

// STUB: Phase 3 - Payment integration requires portal payment providers
// The full implementation will use Stripe/PayPal SDKs specific to portal

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  clientSecret?: string;
}

export interface PaymentMethod {
  provider: 'stripe' | 'paypal' | 'cash';
  name: string;
  icon: string;
  description: string;
  supportsInstallments?: boolean;
}

@Injectable({ providedIn: 'root' })
export class PortalPaymentsService {
  // STUB: Real implementation will use portal's Stripe/PayPal accounts
  // and Edge Functions for payment processing

  createPaymentIntent(amount: number, invoiceId?: string): Observable<PaymentIntent> {
    console.warn('[PortalPaymentsService] STUB - createPaymentIntent not implemented');
    return throwError(
      () => new Error('STUB: PortalPaymentsService.createPaymentIntent not implemented'),
    );
  }

  getPaymentMethods(): Observable<PaymentMethod[]> {
    console.warn('[PortalPaymentsService] STUB - getPaymentMethods not implemented');
    return of([
      {
        provider: 'stripe',
        name: 'Tarjeta',
        icon: 'fa-credit-card',
        description: 'Pago con tarjeta',
      },
      { provider: 'paypal', name: 'PayPal', icon: 'fa-paypal', description: 'Pago con PayPal' },
      { provider: 'cash', name: 'Efectivo', icon: 'fa-money-bill', description: 'Pago en local' },
    ]);
  }

  confirmPayment(paymentIntentId: string): Observable<boolean> {
    console.warn('[PortalPaymentsService] STUB - confirmPayment not implemented');
    return throwError(
      () => new Error('STUB: PortalPaymentsService.confirmPayment not implemented'),
    );
  }
}
