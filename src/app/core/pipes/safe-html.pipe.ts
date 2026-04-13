import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * SafeHtmlPipe — Sanitizes HTML content for safe rendering.
 *
 * WARNING: This pipe trusts HTML input. Only use with content you control.
 * For user-generated content, sanitize server-side or use a library.
 *
 * @security ⚠️ CRITICAL: This pipe calls `bypassSecurityTrustHtml()`, which
 * disables Angular's built-in HTML sanitization entirely. This is a XSS attack
 * vector if untrusted user content reaches this pipe.
 *
 * When `contracts.service.ts` is no longer a stub and connects to the real
 * backend, the `content_html` field MUST be sanitized server-side using
 * DOMPurify (or equivalent) BEFORE being sent to the client. Never rely on
 * this pipe to sanitize untrusted input.
 */
@Pipe({
  name: "safeHtml",
  standalone: true,
})
export class SafeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined): SafeHtml {
    if (!value) return "";
    return this.sanitizer.bypassSecurityTrustHtml(value);
  }
}
