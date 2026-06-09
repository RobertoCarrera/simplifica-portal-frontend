import { Component, OnInit, inject, signal, HostListener, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import {
  LucideAngularModule,
  LUCIDE_ICONS,
  LucideIconProvider,
  Home,
  Bell,
  Ticket,
  FileText,
  Receipt,
  Wrench,
  Settings,
  LogOut,
  Smartphone,
  Calendar,
  LayoutGrid,
  MessageCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-angular';
import { SidebarStateService } from '../../core/services/sidebar-state.service';
import { PortalAuthService } from '../../core/services/portal-auth.service';
import { ClientPortalService } from '../../core/services/client-portal.service';

export interface MenuItem {
  id: number;
  label: string;
  icon: string;
  route: string;
  moduleKey?: string;
}

@Component({
  selector: 'app-portal-sidebar',
  standalone: true,
  host: {
    '[class.collapsed]': 'isCollapsed()',
    '[class.expanded]': '!isCollapsed()',
    '[class.mobile-visible]': 'isOpen() && isMobile()',
    '[class.mobile-hidden]': '!isOpen() && isMobile()',
  },
  imports: [CommonModule, RouterModule, TranslocoModule, LucideAngularModule],
  providers: [
    {
      provide: LUCIDE_ICONS,
      useValue: new LucideIconProvider({
        Home,
        Bell,
        Ticket,
        FileText,
        Receipt,
        Wrench,
        Settings,
        LogOut,
        Smartphone,
        Calendar,
        LayoutGrid,
        MessageCircle,
        ChevronLeft,
        ChevronRight,
      }),
    },
  ],
  templateUrl: './portal-sidebar.component.html',
  styleUrls: ['./portal-sidebar.component.scss'],
})
export class PortalSidebarComponent implements OnInit {
  private sidebarState = inject(SidebarStateService);
  private portalAuth = inject(PortalAuthService);
  private clientPortal = inject(ClientPortalService);
  private translocoService = inject(TranslocoService);
  private router = inject(Router);

  readonly isOpen = this.sidebarState.isOpen;
  readonly isCollapsed = this.sidebarState.isCollapsed;

  private _menuItems = signal<MenuItem[]>([]);
  readonly menuItems = this._menuItems.asReadonly();

  // Tooltip state for collapsed sidebar
  hoveredLabel: string = '';
  tooltipTop: number = 0;
  tooltipLeft: number = 0;

  readonly icons = {
    Home,
    Bell,
    Ticket,
    FileText,
    Receipt,
    Wrench,
    Settings,
    LogOut,
    Smartphone,
    Calendar,
    LayoutGrid,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
  };

  // All possible menu items for portal clients — routes must match portal.routes.ts
  private readonly allMenuItems: MenuItem[] = [
    { id: 1, label: 'nav.inicio', icon: 'home', route: '/dashboard' },
    { id: 2, label: 'nav.notificaciones', icon: 'bell', route: '/notifications' },
    { id: 3, label: 'nav.tickets', icon: 'ticket', route: '/citas', moduleKey: 'moduloSAT' },
    { id: 4, label: 'nav.presupuestos', icon: 'file-text', route: '/presupuestos', moduleKey: 'moduloPresupuestos' },
    { id: 5, label: 'nav.facturas', icon: 'receipt', route: '/facturas', moduleKey: 'moduloFacturas' },
    { id: 6, label: 'nav.servicios', icon: 'wrench', route: '/servicios', moduleKey: 'moduloServicios' },
    { id: 7, label: 'nav.dispositivos', icon: 'smartphone', route: '/dispositivos', moduleKey: 'moduloSAT' },
    { id: 8, label: 'nav.proyectos', icon: 'layout-grid', route: '/projects', moduleKey: 'moduloProyectos' },
    { id: 9, label: 'nav.chat', icon: 'message-circle', route: '/chat', moduleKey: 'moduloChat' },
    { id: 10, label: 'nav.reservas', icon: 'calendar', route: '/reservas', moduleKey: 'moduloReservas' },
    { id: 11, label: 'nav.configuracion', icon: 'settings', route: '/settings' },
  ];

  // User display helpers — reactive to currentClient$ via toSignal
  readonly portalUser = toSignal(this.portalAuth.currentClient$);

  getUserInitial(): string {
    const name = this.portalUser()?.full_name;
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  getUserDisplayName(): string {
    return this.portalUser()?.full_name || this.translocoService.translate('shared.usuario');
  }

  getUserCompany(): string {
    return this.portalUser()?.company_name || '';
  }

  ngOnInit() {
    if (this.isMobile()) {
      this.sidebarState.setCollapsed(false);
      this.sidebarState.setOpen(false);
    } else {
      this.sidebarState.loadSavedState();
    }
    this.loadModules();
  }

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event) {
    if (this.isMobile()) {
      this.sidebarState.setCollapsed(false);
      this.sidebarState.setOpen(false);
    }
  }

  private async loadModules() {
    const activeModules = await this.clientPortal.getActiveModules();
    const allowedSet = new Set<string>(activeModules);

    const filtered = this.allMenuItems.filter((item) => {
      if (!item.moduleKey) return true;
      return allowedSet.has(item.moduleKey);
    });

    this._menuItems.set(filtered);
  }

  isMobile(): boolean {
    return window.innerWidth < 768;
  }

  toggleSidebar() {
    if (this.isMobile()) {
      this.sidebarState.toggleOpen();
    } else {
      this.sidebarState.toggleCollapse();
    }
  }

  closeSidebar() {
    this.sidebarState.setOpen(false);
  }

  toggleCollapse() {
    if (!this.isMobile()) {
      this.sidebarState.toggleCollapse();
    }
  }

  getSidebarClasses(): string {
    if (this.isMobile()) {
      return this.isOpen() ? 'mobile-visible' : 'mobile-hidden';
    }
    return this.isCollapsed() ? 'collapsed' : 'expanded';
  }

  async logout(): Promise<void> {
    try {
      await this.portalAuth.logout();
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  onMouseEnter(event: MouseEvent, label: string) {
    if (!this.isCollapsed()) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    this.tooltipTop = rect.top + rect.height / 2;
    this.tooltipLeft = rect.right + 10;
    this.hoveredLabel = label;
  }

  onMouseLeave() {
    this.hoveredLabel = '';
  }
}