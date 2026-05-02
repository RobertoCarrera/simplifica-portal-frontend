/**
 * Stub types for GDPR consent records.
 * These mirror the types from the CRM's GdprComplianceService.
 */
export interface GdprConsentRecord {
  id?: string;
  subject_id?: string;
  subject_email: string;
  consent_type: 'marketing' | 'analytics' | 'data_processing' | 'third_party_sharing' | 'health_data' | 'privacy_policy';
  purpose: string;
  consent_given: boolean;
  consent_method: 'form' | 'email' | 'phone' | 'in_person' | 'website' | 'physical_document' | 'portal_digital';
  consent_evidence?: unknown;
  legal_basis?: string;
  data_processing_purposes?: string[];
  retention_period?: string;
  created_at?: string;
  withdrawn_at?: string;
}

import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';

/**
 * Stub GdprComplianceService for the client portal.
 *
 * Real implementation would:
 * - Use the portal Supabase client
 * - Call the `record-consent` Edge Function
 * - Return Observable<GdprConsentRecord>
 *
 * This stub allows the consent-gate component to compile while
 * the real portal GDPR flow is implemented.
 */
@Injectable({ providedIn: 'root' })
export class GdprComplianceService {
  recordConsent(
    _record: GdprConsentRecord,
    _context?: { companyId?: string; userId?: string },
  ): Observable<GdprConsentRecord> {
    console.warn('[GdprComplianceService] STUB — recordConsent not implemented in portal');
    return of({ ..._record, created_at: new Date().toISOString() } as GdprConsentRecord);
  }

  getConsentRecords(_subjectEmail: string): Observable<GdprConsentRecord[]> {
    console.warn('[GdprComplianceService] STUB — getConsentRecords not implemented in portal');
    return of([]);
  }
}
