import { Component, OnInit, inject } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ActivatedRoute } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { RuntimeConfigService } from "../../../core/config/runtime-config.service";
import { TranslocoPipe } from "@ng-js-core/transloco";

@Component({
  selector: "app-consent-portal",
  standalone: true,
  imports: [FormsModule, TranslocoPipe],
  template: `
    <div
      class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4"
    >
      <div class="max-w-xl w-full space-y-6 bg-white p-6 rounded-lg shadow">
        <div class="text-center">
          <h1 class="text-2xl font-bold">Preferencias de Consentimiento</h1>
          @if (!loaded) {
            <p class="text-gray-600">Cargando solicitud...</p>
          }
        </div>

        @if (loaded) {
          @if (error) {
            <div class="p-3 bg-red-50 text-red-700 rounded">{{ error }}</div>
          }
          @if (!error && !done) {
            <div class="space-y-4">
              <div class="text-sm text-gray-600 bg-blue-50 p-4 rounded-lg">
                <p><strong>Empresa:</strong> {{ companyName }}</p>
                <p><strong>Para:</strong> {{ clientName }} ({{ email }})</p>
              </div>
              <div class="border-t pt-4">
                <h2 class="font-semibold mb-4 text-lg">Tus Preferencias</h2>
                <div class="space-y-3">
                  <label
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      [(ngModel)]="prefs.data_processing"
                      disabled
                      class="mt-1"
                    />
                    <div>
                      <span class="font-medium block"
                        >Tratamiento de Datos</span
                      >
                      <span class="text-sm text-gray-500"
                        >Aceptación obligatoria de política de privacidad</span
                      >
                    </div>
                  </label>
                  <label
                    class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                  >
                    <input
                      type="checkbox"
                      [(ngModel)]="prefs.marketing"
                      class="mt-1"
                    />
                    <div>
                      <span class="font-medium block"
                        >Comunicaciones Comerciales</span
                      >
                      <span class="text-sm text-gray-500"
                        >Acepto recibir ofertas y promociones</span
                      >
                    </div>
                  </label>
                </div>
              </div>
              <div class="flex flex-col sm:flex-row gap-3 pt-4">
                <button
                  (click)="accept()"
                  [disabled]="busy"
                  class="flex-1 px-4 py-2.5 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2"
                >
                  @if (busy) {
                    <span class="animate-spin text-lg">⟳</span>
                  }
                  <span>Aceptar y Validar</span>
                </button>
                <button
                  (click)="decline()"
                  [disabled]="busy"
                  class="px-4 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Rechazar Todo
                </button>
              </div>
            </div>
          }
          @if (done) {
            <div class="text-center py-8">
              <div class="text-5xl mb-4">✅</div>
              <h2 class="text-xl font-bold text-gray-900 mb-2">¡Gracias!</h2>
              <p class="text-gray-600">
                Tus preferencias han sido registradas correctamente.
              </p>
            </div>
          }
        }
      </div>
    </div>
  `,
})
export class ConsentPortalComponent implements OnInit {
  private route = inject(ActivatedRoute);

  token = "";
  loaded = false;
  error = "";
  busy = false;

  clientName = "";
  email = "";
  companyName = "";
  done = false;

  prefs = {
    data_processing: true,
    marketing: false,
  };

  ngOnInit() {
    // STUB: Phase 3 - complete consent flow
    this.loaded = true;
  }

  async accept() {
    // STUB: Phase 3 - RPC call
    this.busy = true;
    await new Promise((r) => setTimeout(r, 500));
    this.busy = false;
    this.done = true;
  }

  async decline() {
    if (!confirm("¿Estás seguro de que deseas rechazar el consentimiento?"))
      return;
    // STUB: Phase 3 - RPC call
    this.busy = true;
    await new Promise((r) => setTimeout(r, 500));
    this.busy = false;
    this.done = true;
  }
}
