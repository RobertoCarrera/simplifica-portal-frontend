import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface PortalCommentItem {
  id: string;
  user_id?: string | null;
  client_id?: string | null;
  content: string;
  created_at?: string;
}

@Component({
  selector: 'app-portal-project-dialog-comments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex-1 overflow-hidden flex flex-col bg-gray-50/30 dark:bg-gray-900/10">
      <div class="flex-1 overflow-y-auto p-6 space-y-6">
        @if (isLoading) {
          <div class="flex justify-center py-8">
            <div class="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        }
        @if (!isLoading && comments.length === 0) {
          <div class="flex flex-col items-center justify-center h-full text-center text-gray-400 space-y-3">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p class="text-sm">No hay comentarios aún. ¡Sé el primero en comentar!</p>
          </div>
        }
        @for (comment of comments; track comment.id) {
          <div class="flex space-x-3 group w-full">
            <div
              class="flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs uppercase"
              [ngClass]="{
                'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400': comment.user_id,
                'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400': comment.client_id && !comment.user_id,
              }"
            >
              {{ comment.user_id ? 'E' : 'C' }}
            </div>
            <div class="flex-1 space-y-1 min-w-0">
              <div class="flex items-center space-x-2">
                <span class="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {{ comment.user_id ? 'Equipo' : 'Tú' }}
                </span>
                <span class="text-xs text-gray-400">{{ comment.created_at | date: 'medium' }}</span>
              </div>
              <div class="text-sm text-gray-700 dark:text-gray-300 leading-relaxed bg-white dark:bg-gray-800 p-3 rounded-tr-xl rounded-bl-xl rounded-br-xl shadow-sm border border-gray-100 dark:border-gray-700 break-words whitespace-pre-wrap">
                {{ comment.content }}
              </div>
            </div>
          </div>
        }
      </div>
      <div class="p-4 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 relative">
        <div class="flex items-end space-x-2">
          <textarea
            [(ngModel)]="newComment"
            rows="2"
            class="flex-1 w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
            placeholder="Escribe un comentario..."
            (keydown.control.enter)="onSend()"
          ></textarea>
          <button
            (click)="onSend()"
            [disabled]="!newComment.trim()"
            class="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div class="text-xs text-gray-400 mt-2 text-right">
          Presiona <span class="font-mono bg-gray-100 dark:bg-gray-700 px-1 rounded">Ctrl + Enter</span> para enviar
        </div>
      </div>
    </div>
  `,
})
export class PortalProjectDialogCommentsComponent {
  @Input() comments: PortalCommentItem[] = [];
  @Input() isLoading = false;
  @Output() commentAdd = new EventEmitter<string>();

  newComment = '';

  onSend() {
    const content = this.newComment.trim();
    if (!content) return;
    this.commentAdd.emit(content);
    this.newComment = '';
  }
}
