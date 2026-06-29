import { Routes } from '@angular/router';
import { PortalLayoutComponent } from './layout/portal/portal-layout.component';
import { PortalRoleGuard } from './core/guards/portal-role.guard';
import { PortalInviteTokenGuard } from './core/guards/portal-invite-token.guard';

// Portal routes - These replace the CRM routes when deployed to portal.simplificacrm.es
// The routes are at root level (not under /portal prefix) for cleaner URLs

export const PORTAL_ROUTES: Routes = [
  // Default redirect to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Login (no auth guard)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/portal/login/portal-login.component').then(
        (m) => m.PortalLoginComponent,
      ),
  },

  // Auth callback (handles magic link redirect)
  {
    path: 'auth/callback',
    loadComponent: () =>
      import('./features/portal/auth-callback/portal-auth-callback.component').then(
        (m) => m.PortalAuthCallbackComponent,
      ),
  },

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
      // English alias for the quote detail page. Loads the same component
      // as /portal/presupuestos/:id so both URLs render the same view
      // (the component is locale-agnostic and reads its own copy via
      // transloco). Kept as a separate route instead of a redirect so
      // users landing on the English URL don't see a flicker when the
      // router replaces the URL.
      {
        path: 'portal/quotes/:id',
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
      // Projects (Proyectos) — portal client can list / create their own
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/portal/projects/projects/portal-projects.component').then(
            (m) => m.PortalProjectsComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/portal/projects/components/project-dialog/portal-project-dialog.component').then(
            (m) => m.PortalProjectDialogComponent,
          ),
      },
      // Notifications (placeholder structure, BFF endpoint pending)
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/portal/notifications/portal-notifications.component').then(
            (m) => m.PortalNotificationsComponent,
          ),
      },
      // Chat (placeholder structure, real-time pending)
      {
        path: 'chat',
        loadComponent: () =>
          import('./features/portal/chat/portal-chat.component').then(
            (m) => m.PortalChatComponent,
          ),
      },
      // Services (catálogo de la company + contratados del cliente)
      {
        path: 'services',
        loadComponent: () =>
          import('./features/portal/services/portal-services.component').then(
            (m) => m.PortalServicesComponent,
          ),
      },
      // Reservas (wired to BFF /appointments)
      {
        path: 'reservas',
        loadComponent: () =>
          import('./features/portal/reservas/portal-reservas.component').then(
            (m) => m.PortalReservasComponent,
          ),
      },
      // Redsys return URL — user lands here after the hosted payment page.
      // Re-fetches the services list and shows a feedback card.
      {
        path: 'redsys-return',
        loadComponent: () =>
          import('./features/portal/redsys-return/portal-redsys-return.component').then(
            (m) => m.PortalRedsysReturnComponent,
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

  // Alias for invite route: the CRM send-company-invite function generates
  // links to /accept-invite (see e867cdf3 "simplify client invite redirect URL").
  // Keep both paths pointing to the same component so existing email links
  // and the current /invite URL both work.
  {
    path: 'accept-invite',
    loadComponent: () =>
      import('./features/portal/invite/portal-invite.component').then(
        (m) => m.PortalInviteComponent,
      ),
    canActivate: [PortalInviteTokenGuard],
  },

  // Public RGPD consent landing page — token-based, no auth.
  // The component itself validates the token via the get_client_consent_request
  // RPC and shows a friendly error for invalid/expired tokens. No guard
  // needed because the public RPCs (get_client_consent_request,
  // process_client_consent) only operate on the token — there is no way
  // to enumerate or escalate from this route.
  {
    path: 'consent',
    loadComponent: () =>
      import('./features/portal/consent/consent-portal.component').then(
        (m) => m.ConsentPortalComponent,
      ),
  },

  // Catch-all - redirect to dashboard
  { path: '**', redirectTo: 'dashboard' },
];
