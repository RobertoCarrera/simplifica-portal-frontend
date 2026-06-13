import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../../core/services/client-portal.service';

interface ChatMessage {
  id: string;
  author: 'me' | 'team';
  text: string;
  created_at: string;
}

/**
 * Portal chat page.
 *
 * Real-time chat is not yet wired up to the BFF; this component renders the
 * layout (header, message list, composer) so the navigation works and the
 * structure is in place. The composer is functional but only echoes the
 * message locally until a BFF endpoint is added.
 */
@Component({
  selector: 'app-portal-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoModule],
  template: `
    <div class="max-w-3xl mx-auto p-4 h-full flex flex-col">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Chat con el equipo</h1>
        <span class="inline-flex items-center gap-1 text-xs text-gray-500">
          <span class="w-2 h-2 rounded-full bg-gray-400"></span>
          Sin conexión en tiempo real
        </span>
      </div>

      <div class="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl flex-1 flex flex-col overflow-hidden">
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          @if (messages().length === 0) {
            <div class="h-full flex flex-col items-center justify-center text-center text-gray-500 dark:text-gray-400">
              <p class="mb-1">No hay mensajes todavía.</p>
              <p class="text-sm">Escribe abajo para iniciar la conversación con tu equipo.</p>
            </div>
          } @else {
            @for (m of messages(); track m.id) {
              <div [class]="m.author === 'me'
                ? 'flex justify-end'
                : 'flex justify-start'">
                <div [class]="m.author === 'me'
                  ? 'max-w-[75%] rounded-lg bg-blue-600 text-white px-3 py-2 text-sm'
                  : 'max-w-[75%] rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 text-sm'">
                  <p class="whitespace-pre-wrap break-words">{{ m.text }}</p>
                  <p [class]="m.author === 'me'
                    ? 'text-[10px] text-blue-100 mt-1 text-right'
                    : 'text-[10px] text-gray-500 mt-1'">
                    {{ m.created_at | date: 'short' }}
                  </p>
                </div>
              </div>
            }
          }
        </div>

        <form
          (ngSubmit)="send()"
          class="border-t border-gray-200 dark:border-gray-700 p-3 flex gap-2"
        >
          <input
            type="text"
            [(ngModel)]="draft"
            name="draft"
            placeholder="Escribe un mensaje…"
            class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
            [disabled]="sending()"
          />
          <button
            type="submit"
            [disabled]="sending() || !draft.trim()"
            class="px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  `,
})
export class PortalChatComponent implements OnInit {
  private portal = inject(ClientPortalService);

  messages = signal<ChatMessage[]>([]);
  draft = '';
  sending = signal<boolean>(false);

  ngOnInit() {}

  send() {
    const text = this.draft.trim();
    if (!text) return;
    this.sending.set(true);
    // Local echo. Replace with a BFF call once /chat messages endpoint ships.
    this.messages.update((list) => [
      ...list,
      {
        id: crypto.randomUUID(),
        author: 'me',
        text,
        created_at: new Date().toISOString(),
      },
    ]);
    this.draft = '';
    this.sending.set(false);
  }
}
