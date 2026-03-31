import {
  Component,
  ElementRef,
  ViewChild,
  Output,
  EventEmitter,
  Input,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';

// STUB: Phase 3 - Signature pad requires portal-specific canvas handling
// Real implementation will use portal's signing workflow

@Component({
  selector: 'app-signature-pad',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="signature-container border border-gray-300 rounded-lg bg-white relative">
      <div class="w-full h-full flex items-center justify-center bg-gray-50">
        <span class="text-gray-400 text-sm">Firma no disponible (STUB)</span>
      </div>
      <div class="absolute bottom-2 right-2">
        <button
          (click)="clear()"
          class="text-xs text-gray-500 hover:text-red-500 bg-white/80 p-1 px-2 rounded border border-gray-200 shadow-sm"
        >
          Borrar
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .signature-container {
        height: 200px;
        width: 100%;
      }
    `,
  ],
})
export class PortalSignaturePadComponent implements OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @Output() signatureChange = new EventEmitter<string | null>();
  @Input() penColor = 'rgb(0, 0, 0)';

  isEmpty = true;

  ngOnDestroy() {
    // Cleanup
  }

  clear() {
    this.isEmpty = true;
    this.signatureChange.emit(null);
  }

  getSignatureData(): string | null {
    console.warn('[PortalSignaturePad] STUB - getSignatureData not implemented');
    return null;
  }
}
