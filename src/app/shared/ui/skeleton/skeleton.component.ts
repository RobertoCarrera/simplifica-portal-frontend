import { Component, Input } from "@angular/core";
import { CommonModule } from "@angular/common";

@Component({
  selector: "app-skeleton",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="skeleton" [class.animate]="animate">
      <div
        class="skeleton-line"
        *ngFor="let line of lines"
        [style.width.%]="line.width"
      ></div>
    </div>
  `,
  styles: [
    `
      .skeleton {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .skeleton-line {
        height: 16px;
        background: #e2e8f0;
        border-radius: 4px;
      }
      .animate .skeleton-line {
        animation: pulse 1.5s ease-in-out infinite;
      }
      @keyframes pulse {
        0%,
        100% {
          opacity: 1;
        }
        50% {
          opacity: 0.5;
        }
      }
    `,
  ],
})
export class SkeletonComponent {
  @Input() lines: { width: number }[] = [{ width: 100 }];
  @Input() animate = true;
}
