import { Routes } from '@angular/router';
import { PortalLayoutComponent } from './layout/portal/portal-layout.component';
import { PortalRoleGuard } from './core/guards/portal-role.guard';
import { PortalInviteTokenGuard } from './core/guards/portal-invite-token.guard';

// Portal routes - These replace the CRM routes when deployed to portal.simplificacrm.es
// The routes are at root level (not under /portal prefix) for cleaner URLs

export const PORTAL_ROUTES: Routes = [
  // Default redirect to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Layout wrapper for authenticated routes
  {
    path: '',
    component: PortalLayoutComponent,
    canActivate: [PortalRoleGuard],
    children: [
      // Dashboard
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/portal/dashboard/portal-dashboard.component').then(
            (m) => m.PortalDashboardComponent,
          ),
      },
      // Appointments (Citas)
      {
        path: 'citas',
        loadComponent: () =>
          import('./features/portal/tickets/portal-tickets.component').then(
            (m) => m.PortalTicketsComponent,
          ),
      },
      // Quotes (Presupuestos)
      {
        path: 'presupuestos',
        loadComponent: () =>
          import('./features/quotes/portal/list/portal-quotes.component').then(
            (m) => m.PortalQuotesComponent,
          ),
      },
      {
        path: 'presupuestos/:id',
        loadComponent: () =>
          import('./features/quotes/portal/detail/portal-quote-detail.component').then(
            (m) => m.PortalQuoteDetailComponent,
          ),
      },
      // Invoices (Facturas)
      {
        path: 'facturas',
        loadComponent: () =>
          import('./features/invoices/portal/list/portal-invoices.component').then(
            (m) => m.PortalInvoicesComponent,
          ),
      },
      {
        path: 'facturas/:id',
        loadComponent: () =>
          import('./features/invoices/portal/detail/portal-invoice-detail.component').then(
            (m) => m.PortalInvoiceDetailComponent,
          ),
      },
      // Services (Servicios)
      {
        path: 'servicios',
        loadComponent: () =>
          import('./features/services/portal-services/portal-services.component').then(
            (m) => m.PortalServicesComponent,
          ),
      },
      // Devices (Dispositivos)
      {
        path: 'dispositivos',
        loadComponent: () =>
          import('./features/devices/portal-devices/portal-devices.component').then(
            (m) => m.PortalDevicesComponent,
          ),
      },
      // Settings (Configuración)
      {
        path: 'settings',
        loadComponent: () =>
          import('./features/portal/settings/portal-settings.component').then(
            (m) => m.PortalSettingsComponent,
          ),
      },
    ],
  },

  // Public invite route (no layout, no auth guard - just token validation)
  {
    path: 'invite',
    loadComponent: () =>
      import('./features/portal/invite/portal-invite.component').then(
        (m) => m.PortalInviteComponent,
      ),
    canActivate: [PortalInviteTokenGuard],
  },

  // Catch-all - redirect to dashboard
  { path: '**', redirectTo: 'dashboard' },
];
