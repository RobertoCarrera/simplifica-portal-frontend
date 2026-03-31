import { Injectable, inject } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, Router } from '@angular/router';
import { PortalAuthService } from '../../core/services/portal-auth.service';

// STUB: Phase 3 - Validates invite token before rendering invite component
// Real implementation will validate token via portal Edge Function

@Injectable({ providedIn: 'root' })
export class PortalInviteTokenGuard implements CanActivate {
  private router = inject(Router);
  private auth = inject(PortalAuthService);

  canActivate(route: ActivatedRouteSnapshot): boolean {
    const token = route.queryParamMap.get('token') || this.extractHashParam('token');

    if (token) {
      // STUB: Real implementation will call auth.validateInviteToken(token)
      // For now, just validate that token exists
      console.warn('[PortalInviteTokenGuard] STUB - token validation not implemented');
      return true;
    }

    // No token - redirect to home
    this.router.navigate(['/']);
    return false;
  }

  private extractHashParam(param: string): string | null {
    if (typeof window === 'undefined') return null;
    const hash = window.location.hash.replace(/^#/, '');
    const params = new URLSearchParams(hash);
    return params.get(param);
  }
}
