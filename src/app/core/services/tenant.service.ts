import { Injectable } from "@angular/core";

/**
 * TenantService — Provides tenant detection and configuration for Simplifica.
 *
 * In the portal context, this service helps detect whether the app is running
 * in the client portal context (portal.simplificacrm.es) vs the staff app
 * (app.simplificacrm.es).
 */
@Injectable({ providedIn: "root" })
export class TenantService {
  private readonly PORTAL_HOSTS = [
    "portal.simplificacrm.es",
    "localhost:4200",
    "localhost:4300",
  ];

  private readonly APP_HOSTS = ["app.simplificacrm.es", "localhost:5000"];

  /**
   * Check if the current request is from the client portal.
   */
  isClientPortal(): boolean {
    if (typeof window === "undefined") return false;

    const host = window.location.host.toLowerCase();
    return this.PORTAL_HOSTS.some(
      (portalHost) =>
        host === portalHost.toLowerCase() ||
        host.startsWith(portalHost.toLowerCase() + ":"),
    );
  }

  /**
   * Check if the current request is from the staff app.
   */
  isStaffApp(): boolean {
    if (typeof window === "undefined") return false;

    const host = window.location.host.toLowerCase();
    return this.APP_HOSTS.some(
      (appHost) =>
        host === appHost.toLowerCase() ||
        host.startsWith(appHost.toLowerCase() + ":"),
    );
  }

  /**
   * Get the current tenant type based on hostname.
   */
  getCurrentTenantType(): "portal" | "app" | "unknown" {
    if (this.isClientPortal()) return "portal";
    if (this.isStaffApp()) return "app";
    return "unknown";
  }

  /**
   * Get the portal URL.
   */
  getPortalUrl(): string {
    return "https://portal.simplificacrm.es";
  }

  /**
   * Get the app URL.
   */
  getAppUrl(): string {
    return "https://app.simplificacrm.es";
  }
}
