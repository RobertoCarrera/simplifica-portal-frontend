import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';

// STUB: Phase 3 - Contract signing requires portal-specific contract management
// The full implementation will use portal's Edge Functions for PDF generation
// and contract lifecycle management

export interface Contract {
  id: string;
  company_id: string;
  client_id: string;
  title: string;
  content_html: string;
  status: 'draft' | 'sent' | 'signed' | 'rejected';
  signature_data?: string;
  metadata?: any;
  signed_pdf_url?: string;
  created_at: string;
  updated_at: string;
  signed_at?: string;
}

@Injectable({ providedIn: 'root' })
export class PortalContractsService {
  // STUB: Real implementation will manage contracts via portal Edge Functions

  getClientContracts(): Observable<Contract[]> {
    console.warn('[PortalContractsService] STUB - getClientContracts not implemented');
    return of([]);
  }

  getContract(id: string): Observable<Contract> {
    console.warn('[PortalContractsService] STUB - getContract not implemented');
    return throwError(() => new Error('STUB: PortalContractsService.getContract not implemented'));
  }

  signContract(contractId: string, signatureData: string): Observable<Contract> {
    console.warn('[PortalContractsService] STUB - signContract not implemented');
    return throwError(() => new Error('STUB: PortalContractsService.signContract not implemented'));
  }

  getContractPdfUrl(path: string): Observable<string | null> {
    console.warn('[PortalContractsService] STUB - getContractPdfUrl not implemented');
    return of(null);
  }
}
