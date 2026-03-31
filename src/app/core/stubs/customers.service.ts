import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { Customer, CreateCustomer, UpdateCustomer } from '../../models/customer';

// STUB: Phase 3 - Full implementation requires portal Supabase instance
// This service provides the interface needed by portal components without
// depending on the CRM's SupabaseCustomersService

export interface CustomerStats {
  total: number;
  newThisWeek: number;
  newThisMonth: number;
  byLocality: { [key: string]: number };
}

@Injectable({ providedIn: 'root' })
export class PortalCustomersService {
  // STUB: Real implementation will use portal Supabase client
  // and call Edge Functions for customer data

  getCustomer(id: string): Observable<Customer> {
    console.warn('[PortalCustomersService] STUB - getCustomer not implemented');
    return throwError(() => new Error('STUB: PortalCustomersService.getCustomer not implemented'));
  }

  updateCustomer(id: string, updates: UpdateCustomer): Observable<Customer> {
    console.warn('[PortalCustomersService] STUB - updateCustomer not implemented');
    return throwError(
      () => new Error('STUB: PortalCustomersService.updateCustomer not implemented'),
    );
  }

  getCustomerStats(): Observable<CustomerStats> {
    console.warn('[PortalCustomersService] STUB - getCustomerStats not implemented');
    return of({ total: 0, newThisWeek: 0, newThisMonth: 0, byLocality: {} });
  }

  getClientsBasic(): Observable<{ id: string; name: string; surname: string; email: string }[]> {
    console.warn('[PortalCustomersService] STUB - getClientsBasic not implemented');
    return of([]);
  }

  computeCompleteness(): { complete: boolean; missingFields: string[] } {
    return { complete: false, missingFields: ['STUB'] };
  }
}
