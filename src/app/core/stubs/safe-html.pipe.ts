import { Pipe, PipeTransform, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

// STUB: Phase 3 - SafeHtml pipe for portal
// Real implementation will use DOMPurify for HTML sanitization

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
