import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslocoModule } from '@jsverse/transloco';
import { ClientPortalService } from '../../core/services/client-portal.service';

export interface MenuItem {
  id: number;
  label: string;
  icon: string;
  route: string;
  moduleKey?: string; // if set, item is shown only when module is active
}

// All possible menu items with their required module (if any)
const ALL_MENU_ITEMS: MenuItem[] = [
  { id: 1, label: 'portal.menu.dashboard', icon: 'fa-home', route: '/dashboard' },
  { id: 2, label: 'portal.menu.appointments', icon: 'fa-calendar', route: '/citas', moduleKey: 'moduloReservas' },
  { id: 3, label: 'portal.menu.quotes', icon: 'fa-file-invoice', route: '/presupuestos', moduleKey: 'moduloPresupuestos' },
  { id: 4, label: 'portal.menu.invoices', icon: 'fa-file-invoice-dollar', route: '/facturas', moduleKey: 'moduloFacturas' },
  { id: 5, label: 'portal.menu.services', icon: 'fa-tools', route: '/servicios' },
  { id: 6, label: 'portal.menu.devices', icon: 'fa-mobile-alt', route: '/dispositivos' },
];

@Component({
  selector: 'app-portal-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslocoModule],
  template: `
    <aside class="w-64 h-screen bg-slate-900 text-white flex flex-col fixed left-0 top-0">
      <!-- Logo/Brand -->
      <div class="p-6 border-b border-slate-700">
        <h1 class="text-xl font-bold text-primary-400">Simplifica</h1>
        <p class="text-xs text-slate-400 mt-1">Portal de Cliente</p>
      </div>

      <!-- Navigation -->
      <nav class="flex-1 py-4 overflow-y-auto">
        <ul class="space-y-1 px-3">
          @for (item of menuItems(); track item.id) {
            <li>
              <a
                [routerLink]="item.route"
                routerLinkActive="bg-slate-800 text-primary-400"
                [routerLinkActiveOptions]="{ exact: item.id === 1 }"
                class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              >
                <i class="fas {{ item.icon }} w-5"></i>
                <span>{{ item.label | transloco }}</span>
              </a>
            </li>
          }
        </ul>
      </nav>

      <!-- Footer -->
      <div class="p-4 border-t border-slate-700 space-y-1">
        <!-- Configuración -->
        <a
          routerLink="/settings"
          routerLinkActive="bg-slate-800 text-primary-400"
          class="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
        >
          <i class="fas fa-cog w-5"></i>
          <span>{{ 'portal.menu.settings' | transloco }}</span>
        </a>

        <!-- Logout -->
        <button
          (click)="logout()"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-slate-300 hover:bg-red-900/30 hover:text-red-400 transition-colors"
        >
          <i class="fas fa-sign-out-alt w-5"></i>
          <span>{{ 'portal.menu.logout' | transloco }}</span>
        </button>
      </div>
    </aside>
  `,
})
export class PortalSidebarComponent implements OnInit {
  private router = inject(Router);
  private clientPortal = inject(ClientPortalService);

  menuItems = signal<MenuItem[]>(ALL_MENU_ITEMS);

  ngOnInit() {
    this.loadModules();
  }

  private async loadModules() {
    const activeModules = await this.clientPortal.getActiveModules();

    // Filter items: those without moduleKey are always shown;
    // those with moduleKey are shown only when the module is active
    const filtered = ALL_MENU_ITEMS.filter(
      (item) => !item.moduleKey || activeModules.includes(item.moduleKey),
    );

    this.menuItems.set(filtered);
  }

  logout() {
    this.router.navigate(['/login']);
  }
}