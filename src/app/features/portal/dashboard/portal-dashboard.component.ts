import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { ClientPortalService } from "../../../core/services/client-portal.service";

@Component({
  selector: "app-portal-dashboard",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="max-w-6xl mx-auto p-4">
      <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold">Portal Cliente</h1>
      </div>

      @if (loading()) {
        <div class="text-gray-600">Cargando...</div>
      } @else {
        <div class="grid md:grid-cols-2 gap-6">
          <section class="bg-white rounded-xl shadow p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold">Tus Tickets</h2>
              <span class="text-sm text-gray-500"
                >{{ tickets.length }} total</span
              >
            </div>
            @if (tickets.length === 0) {
              <div class="text-gray-500">No tienes tickets abiertos</div>
            }
            <ul class="divide-y">
              @for (t of tickets; track t) {
                <li class="py-3 flex items-start justify-between">
                  <div>
                    <h3
                      class="font-medium"
                      [class.font-extrabold]="t.is_opened === false"
                    >
                      {{ t.title }}
                    </h3>
                    @if (t.description) {
                      <p class="text-sm text-gray-600 line-clamp-2">
                        {{ t.description }}
                      </p>
                    }
                    <p class="text-xs text-gray-400 mt-1">
                      Actualizado {{ t.updated_at | date: "short" }}
                    </p>
                  </div>
                </li>
              }
            </ul>
          </section>

          <section class="bg-white rounded-xl shadow p-4">
            <div class="flex items-center justify-between mb-3">
              <h2 class="text-lg font-semibold">Tus Presupuestos</h2>
              <span class="text-sm text-gray-500"
                >{{ quotes.length }} total</span
              >
            </div>
            @if (quotes.length === 0) {
              <div class="text-gray-500">No tienes presupuestos</div>
            }
            <ul class="divide-y">
              @for (q of quotes; track q) {
                <li class="py-3">
                  <div class="font-medium">
                    {{ q.full_quote_number }} — {{ q.title }}
                  </div>
                  <div class="text-xs text-gray-500">
                    {{ q.quote_date | date }} · {{ q.status }} ·
                    {{ q.total_amount | number: "1.2-2" }} €
                  </div>
                </li>
              }
            </ul>
          </section>
        </div>
      }
    </div>
  `,
})
export class PortalDashboardComponent implements OnInit {
  private portal = inject(ClientPortalService);

  tickets: any[] = [];
  quotes: any[] = [];
  loading = signal(true);

  async ngOnInit() {
    await Promise.all([this.loadTickets(), this.loadQuotes()]);
  }

  async loadTickets() {
    const { data } = await this.portal.listTickets();
    this.tickets = data || [];
  }

  async loadQuotes() {
    const { data } = await this.portal.listQuotes();
    this.quotes = data || [];
    this.loading.set(false);
  }
}
