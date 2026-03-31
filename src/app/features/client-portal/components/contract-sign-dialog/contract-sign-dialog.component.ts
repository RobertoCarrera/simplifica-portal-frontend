import {
  Component,
  ContentChild,
  ElementRef,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  inject,
  signal,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { SignaturePadComponent } from "../../../shared/components/signature-pad/signature-pad.component";
import { SafeHtmlPipe } from "../../../core/pipes/safe-html.pipe";

// STUB: Phase 3 - needs ContractsService integration

export interface Contract {
  id: string;
  title: string;
  content_html: string;
  created_at: string;
}

@Component({
  selector: "app-contract-sign-dialog",
  standalone: true,
  imports: [CommonModule, SignaturePadComponent, SafeHtmlPipe],
  template: `
    <div
      *ngIf="visible()"
      class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      (click)="close()"
    >
      <div
        class="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col"
        (click)="$event.stopPropagation()"
      >
        <div
          class="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center"
        >
          <div>
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">
              {{ contract()?.title }}
            </h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              Por favor, lee el documento y firma al final.
            </p>
          </div>
          <button
            (click)="close()"
            class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <i class="fas fa-times text-xl"></i>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-8 bg-gray-50 dark:bg-slate-900">
          <div
            class="bg-white text-black p-10 shadow-sm mx-auto max-w-3xl min-h-[600px] prose prose-sm"
          >
            <div [innerHTML]="contract()?.content_html | safeHtml"></div>
          </div>
        </div>
        <div
          class="p-6 border-t border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-b-2xl"
        >
          <div *ngIf="isSigning()" class="space-y-4">
            <p class="font-medium text-gray-700 dark:text-gray-200">
              Tu firma:
            </p>
            <app-signature-pad
              #signaturePad
              (signatureChange)="onSignatureChange($event)"
            ></app-signature-pad>
            <div
              class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400"
            >
              <input
                type="checkbox"
                id="consent"
                [checked]="consentChecked"
                (change)="toggleConsent()"
                class="rounded"
              />
              <label for="consent"
                >He leído y acepto los términos y condiciones de este
                contrato.</label
              >
            </div>
            <div class="flex justify-end gap-3 mt-4">
              <button
                (click)="cancelSigning()"
                class="px-4 py-2 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                (click)="confirmSign()"
                [disabled]="!hasSignature || !consentChecked || processing()"
                class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium shadow-md transition-all flex items-center gap-2"
              >
                <i *ngIf="processing()" class="fas fa-spinner fa-spin"></i>
                {{ processing() ? "Procesando..." : "Firmar y Finalizar" }}
              </button>
            </div>
          </div>
          <div *ngIf="!isSigning()" class="flex justify-end">
            <button
              (click)="startSigning()"
              class="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
            >
              <i class="fas fa-pen-nib"></i> Firmar Documento
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        display: contents;
      }
    `,
  ],
})
export class ContractSignDialogComponent {
  @ViewChild("signaturePad") signaturePad!: SignaturePadComponent;
  @Output() signed = new EventEmitter<Contract>();

  visible = signal(false);
  contract = signal<Contract | null>(null);
  isSigning = signal(false);
  processing = signal(false);
  signedImage = signal<string | null>(null);

  hasSignature = false;
  consentChecked = false;
  currentSignatureData: string | null = null;

  open(contract: Contract) {
    this.contract.set(contract);
    this.visible.set(true);
    this.isSigning.set(false);
    this.consentChecked = false;
    this.hasSignature = false;
  }

  close() {
    if (this.processing()) return;
    this.visible.set(false);
  }

  startSigning() {
    this.isSigning.set(true);
  }

  cancelSigning() {
    this.isSigning.set(false);
    this.signedImage.set(null);
    this.currentSignatureData = null;
    this.hasSignature = false;
  }

  onSignatureChange(data: string | null) {
    this.hasSignature = !!data;
    this.currentSignatureData = data;
  }

  toggleConsent() {
    this.consentChecked = !this.consentChecked;
  }

  async confirmSign() {
    if (!this.consentChecked || !this.hasSignature || !this.contract()) return;

    this.processing.set(true);
    try {
      // STUB: Phase 3 - PDF generation and contract signing
      await new Promise((r) => setTimeout(r, 500));
      this.signedImage.set(this.currentSignatureData);
      this.signed.emit(this.contract()!);
      this.close();
    } catch (error) {
      console.error("Error signing contract:", error);
      alert(
        "Hubo un error al firmar el documento. Por favor, inténtalo de nuevo.",
      );
    } finally {
      this.processing.set(false);
    }
  }
}
