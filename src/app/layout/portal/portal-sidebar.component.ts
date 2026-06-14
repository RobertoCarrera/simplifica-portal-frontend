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
  ChevronDown,
  Building2,
  Check,
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
  devMode?: boolean;
  visibleToClients?: boolean;
}

interface CompanyOption {
  id: string;
  name: string;
  isActive: boolean;
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
        ChevronDown,
        Building2,
        Check,
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

  // Multi-tenant company switcher
  readonly companies = signal<CompanyOption[]>([]);
  readonly activeCompanyId = this.portalAuth.activeCompanyId;
  readonly activeCompanyName = computed(() => {
    const id = this.activeCompanyId();
    const fromList = this.companies().find((c) => c.id === id)?.name;
    if (fromList) return fromList;
    // Fallback: when the company list is not loaded yet, show the company
    // name from the current portal user so the footer is never empty.
    return this.portalUser()?.company_name ?? '';
  });
  readonly companySwitcherOpen = signal<boolean>(false);
  readonly switchingCompany = signal<boolean>(false);

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
    LogOut,
    Smartphone,
    Calendar,
    LayoutGrid,
    MessageCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
    Building2,
    Check,
  };

  // All possible menu items for portal clients — routes must match portal.routes.ts
  private readonly allMenuItems: MenuItem[] = [
    { id: 1, label: 'nav.inicio', icon: 'home', route: '/dashboard' },
    { id: 2, label: 'nav.notificaciones', icon: 'bell', route: '/notifications' },
    { id: 3, label: 'nav.tickets', icon: 'ticket', route: '/citas', moduleKey: 'moduloSAT' },
    { id: 4, label: 'nav.presupuestos', icon: 'file-text', route: '/presupuestos', moduleKey: 'moduloPresupuestos' },
    { id: 5, label: 'nav.facturas', icon: 'receipt', route: '/facturas', moduleKey: 'moduloFacturas' },
    { id: 6, label: 'nav.servicios', icon: 'wrench', route: '/services', moduleKey: 'moduloServicios' },
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
    return this.activeCompanyName() || this.portalUser()?.company_name || '';
  }

  ngOnInit() {
    if (this.isMobile()) {
      this.sidebarState.setCollapsed(false);
      this.sidebarState.setOpen(false);
    } else {
      this.sidebarState.loadSavedState();
    }
    this.loadModules();
    this.loadCompanies();
  }

  @HostListener('window:resize', ['$event'])
  onResize(_event: Event) {
    if (this.isMobile()) {
      this.sidebarState.setCollapsed(false);
      this.sidebarState.setOpen(false);
    }
  }

  private async loadModules() {
    const moduleInfo = await this.clientPortal.getActiveModules();
    const moduleMap = new Map<string, { enabled: boolean; devMode: boolean; visibleToClients: boolean }>();
    (moduleInfo || []).forEach((m: any) => {
      moduleMap.set(m.key, {
        enabled: m.enabled ?? false,
        devMode: m.devMode ?? false,
        visibleToClients: m.visibleToClients ?? true,
      });
    });

    const filtered = this.allMenuItems.filter((item) => {
      if (!item.moduleKey) return true;
      const info = moduleMap.get(item.moduleKey);
      if (!info) return false;
      if (info.devMode) return false;
      if (info.visibleToClients === false) return false;
      return info.enabled;
    });

    this._menuItems.set(filtered);
  }

  private async loadCompanies() {
    const list = await this.clientPortal.getCompanies();
    this.companies.set(list);
  }

  toggleCompanySwitcher() {
    if (this.switchingCompany()) return;
    this.companySwitcherOpen.update((v) => !v);
  }

  closeCompanySwitcher() {
    this.companySwitcherOpen.set(false);
  }

  async selectCompany(companyId: string) {
    if (this.switchingCompany()) return;
    if (companyId === this.activeCompanyId()) {
      this.closeCompanySwitcher();
      return;
    }
    this.switchingCompany.set(true);
    const ok = await this.clientPortal.switchCompany(companyId);
    this.switchingCompany.set(false);
    if (ok) {
      // Refresh local state: mark new company active, reload modules
      const updated = this.companies().map((c) => ({ ...c, isActive: c.id === companyId }));
      this.companies.set(updated);
      this.companySwitcherOpen.set(false);
      await this.loadModules();
      // Soft reload of the current page so scoped data (invoices, quotes,
      // tickets, profile) refetches for the new active company without
      // requiring the user to navigate manually.
      const currentUrl = this.router.url;
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigateByUrl(currentUrl);
      });
    } else {
      console.error('[PortalSidebar] switchCompany failed');
    }
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
