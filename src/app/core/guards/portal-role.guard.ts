import { Injectable, inject } from '@angular/core';
import { CanActivate, Router, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { combineLatest, Observable, of } from 'rxjs';
import { filter, take, timeout, map, catchError } from 'rxjs/operators';
import { PortalAuthService } from '../../core/services/portal-auth.service';

// STUB: Phase 3 - ClientRoleGuard verifies portal client access
// Real implementation will check role='client' from portal auth

@Injectable({ providedIn: 'root' })
export class PortalRoleGuard implements CanActivate {
  private auth = inject(PortalAuthService);
  private router = inject(Router);

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean> {
    return this.auth.portalUser$.pipe(
      timeout(15000),
      map((user) => {
        if (!user) {
          // No portal user - redirect to login
          this.router.navigate(['/login']);
          return false;
        }
        // STUB: In real implementation, we would check user.role === 'client'
        // For now, any authenticated portal user passes
        return true;
      }),
      catchError(() => {
        this.router.navigate(['/login']);
        return of(false);
      }),
    );
  }
}
