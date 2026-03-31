import { Component, inject, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { IPortalAuth } from "../../../core/ports/iportal-auth";

// STUB: Phase 3 - needs ClientDevicesModalComponent

@Component({
  selector: "app-portal-devices",
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="p-6 h-full w-full overflow-hidden flex flex-col">
      <div class="text-gray-500 dark:text-gray-400">
        Dispositivos - Phase 3 integration needed
      </div>
      <!-- STUB: Phase 3 will integrate ClientDevicesModalComponent -->
    </div>
  `,
})
export class PortalDevicesComponent {
  // STUB: Phase 3 - needs auth service and ClientDevicesModalComponent
}
