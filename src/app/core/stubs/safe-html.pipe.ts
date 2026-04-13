import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// STUB: Phase 3 - SafeHtml pipe for portal
// Real implementation will use DOMPurify for HTML sanitization
//
// @security ⚠️ CRITICAL: This pipe calls `bypassSecurityTrustHtml()`, which
// disables Angular's built-in HTML sanitization entirely. This is a XSS attack
// vector if untrusted user content reaches this pipe.
//
// When `contracts.service.ts` is no longer a stub and connects to the real
// backend, the `content_html` field MUST be sanitized server-side using
// DOMPurify (or equivalent) BEFORE being sent to the client. Never rely on
// this pipe to sanitize untrusted input.

@Pipe({
  name: 'safeHtml',
  standalone: true,
})
export class PortalSafeHtmlPipe implements PipeTransform {
  private sanitizer = inject(DomSanitizer);

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return '';
    // STUB: Real implementation will use DOMPurify.sanitize
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
