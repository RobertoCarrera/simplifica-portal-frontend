import { Pipe, PipeTransform } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";

/**
 * SafeHtmlPipe — Sanitizes HTML content for safe rendering.
 *
 * WARNING: This pipe trusts HTML input. Only use with content you control.
 * For user-generated content, sanitize server-side or use a library.
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
