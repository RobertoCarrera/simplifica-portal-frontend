import { Injectable, signal, inject, NgZone } from "@angular/core";
import {
  createClient,
  SupabaseClient,
  User,
  Session,
} from "@supabase/supabase-js";
import { BehaviorSubject, Observable, from, of } from "rxjs";
import { map, filter, take, switchMap } from "rxjs/operators";
import {
  IPortalAuth,
  PortalClientUser,
  PortalSession,
} from "../ports/iportal-auth";
import { RuntimeConfigService } from "../config/runtime-config.service";
import { Router } from "@angular/router";
import { environment } from '@env/environment';

/**
 * PortalAuthService — Implementación de IPortalAuth para el portal cliente.
 *
 * Esta clase es la abstracción de auth para el portal separado.
 * NO depende de AuthService del CRM — es completamente standalone.
 *
 * Flujo de auth:
 * 1. Cliente recibe OTP/magic link vía send-company-invite edge function
 * 2. Cliente hace click en enlace mágico → se autentica con Supabase Auth
 * 3. PortalAuthService detecta sesión y obtiene profile del portal
 * 4. ClientPortalService usa getCurrentClient() para obtener client_id
 *
 * El AuthService del CRM no existe en este repo — toda la auth es específica
 * del portal y usa Supabase Auth OTP (magic links) en lugar de password.
 */
@Injectable({ providedIn: "root" })
export class PortalAuthService implements IPortalAuth {
  private supabase!: SupabaseClient;
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private runtimeConfig = inject(RuntimeConfigService);

  // Session timeout: 1 hour max
  private static readonly SESSION_MAX_AGE_MS = 60 * 60 * 1000;
  private static readonly SESSION_CHECK_INTERVAL_MS = 60 * 1000;
  private static readonly SESSION_START_KEY = 'portal_session_start';
  private sessionCheckTimer: ReturnType<typeof setInterval> | null = null;

  // Reactive state
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  private portalUserSubject = new BehaviorSubject<PortalClientUser | null>(
    null,
  );
  private loadingSubject = new BehaviorSubject<boolean>(true);

  // Signals
  authState = signal<boolean>(false);

  // Observables públicos
  currentUser$ = this.currentUserSubject.asObservable();
  portalUser$ = this.portalUserSubject.asObservable();
  currentClient$: Observable<PortalClientUser | null> =
    this.portalUserSubject.asObservable();
  loading$ = this.loadingSubject.asObservable();

  constructor() {
    this.initializeClient();
  }

  private initializeClient(): void {
    // RuntimeConfigService is loaded via APP_INITIALIZER before any service is instantiated,
    // so runtimeConfig.get() is already populated when this constructor runs.
    const supabaseConfig = this.runtimeConfig.getSupabase();
    const supabaseUrl = supabaseConfig?.url?.trim() || environment.supabase.url || '';
    const supabaseAnonKey = supabaseConfig?.anonKey?.trim() || environment.supabase.anonKey || '';

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn(
        "⚠️ PortalAuth: SUPABASE_URL or SUPABASE_ANON_KEY not configured",
      );
      this.loadingSubject.next(false);
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Initialize auth state
    this.initializeAuth();
  }

  private async initializeAuth(): Promise<void> {
    try {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();

      if (session?.user) {
        await this.setCurrentUser(session.user);
        this.startSessionTimer();
      } else {
        this.clearUserData();
      }
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error initializing auth:", error);
    } finally {
      this.loadingSubject.next(false);
    }

    // Listen for auth state changes
    this.supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
        if (session?.user) {
          this.setCurrentUser(session.user);
          this.startSessionTimer();
        }
      } else if (event === "SIGNED_OUT") {
        this.clearUserData();
        this.stopSessionTimer();
      }
    });
  }

  private async setCurrentUser(user: User): Promise<void> {
    this.loadingSubject.next(true);
    this.currentUserSubject.next(user);
    this.authState.set(true);

    try {
      // Fetch portal user profile from client_portal_users + users
      const portalUser = await this.fetchPortalUser(user);
      if (portalUser) {
        this.portalUserSubject.next(portalUser);
      } else {
        console.warn(
          "⚠️ PortalAuth: No portal user found for auth user:",
          user.id,
        );
      }
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error fetching portal user:", error);
    } finally {
      this.loadingSubject.next(false);
    }
  }

  private async fetchPortalUser(user: User): Promise<PortalClientUser | null> {
    try {
      // First, get the client portal user record
      const { data: portalUser, error } = await this.supabase
        .from("client_portal_users")
        .select("*, client:clients(*)")
        .eq("auth_user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !portalUser) {
        console.warn(
          "⚠️ PortalAuth: client_portal_users not found for:",
          user.id,
        );
        return null;
      }

      // Get user details from public.users
      const { data: appUser } = await this.supabase
        .from("users")
        .select("*")
        .eq("id", portalUser.user_id || portalUser.client_id)
        .maybeSingle();

      // Build the portal user object
      return {
        id: appUser?.id || portalUser.user_id || portalUser.client_id,
        client_id: portalUser.client_id,
        company_id: portalUser.company_id,
        auth_user_id: user.id,
        email: user.email || portalUser.email,
        name: appUser?.name || null,
        surname: appUser?.surname || null,
        full_name: appUser
          ? `${appUser.name || ""} ${appUser.surname || ""}`.trim()
          : null,
        role: "client",
        is_active: portalUser.is_active,
      };
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error fetching portal user:", error);
      return null;
    }
  }

  private clearUserData(): void {
    this.currentUserSubject.next(null);
    this.portalUserSubject.next(null);
    this.authState.set(false);
    this.stopSessionTimer();
    try { sessionStorage.removeItem(PortalAuthService.SESSION_START_KEY); } catch { /* noop */ }
  }

  private startSessionTimer(): void {
    // Record session start if not already set
    if (!sessionStorage.getItem(PortalAuthService.SESSION_START_KEY)) {
      sessionStorage.setItem(
        PortalAuthService.SESSION_START_KEY,
        Date.now().toString(),
      );
    }

    this.stopSessionTimer();

    this.ngZone.runOutsideAngular(() => {
      this.sessionCheckTimer = setInterval(() => {
        this.checkSessionExpiry();
      }, PortalAuthService.SESSION_CHECK_INTERVAL_MS);
    });

    // Also check immediately
    this.checkSessionExpiry();
  }

  private stopSessionTimer(): void {
    if (this.sessionCheckTimer) {
      clearInterval(this.sessionCheckTimer);
      this.sessionCheckTimer = null;
    }
  }

  private checkSessionExpiry(): void {
    const startStr = sessionStorage.getItem(PortalAuthService.SESSION_START_KEY);
    if (!startStr) return;

    const elapsed = Date.now() - parseInt(startStr, 10);
    if (elapsed >= PortalAuthService.SESSION_MAX_AGE_MS) {
      console.warn('⏰ Portal session expired after 1 hour — logging out');
      this.ngZone.run(() => {
        this.expireSession();
      });
    }
  }

  private async expireSession(): Promise<void> {
    this.stopSessionTimer();
    this.clearUserData();
    try { await this.supabase.auth.signOut(); } catch { /* noop */ }
    this.router.navigate(['/login'], {
      replaceUrl: true,
      queryParams: { reason: 'session_expired' },
    });
  }

  /**
   * Login with OTP (magic link)
   * Sends a magic link email to the client.
   * The email is validated against client_portal_users table by the edge function.
   */
  async loginWithOTP(
    email: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!email || !emailRegex.test(email.trim())) {
        return { success: false, error: "Email inválido" };
      }

      const { error } = await this.supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Redirect to portal after magic link click
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          shouldCreateUser: false, // Only existing portal users
        },
      });

      if (error) {
        // Anti-enumeration: treat "user not found" as success
        if (
          error.status === 422 ||
          error.status === 401 ||
          error.message?.includes("not found") ||
          error.message?.includes("not authorized")
        ) {
          return { success: true }; // Pretend success to avoid enumeration
        }
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message || "Error inesperado" };
    }
  }

  async logout(): Promise<void> {
    try {
      this.clearUserData();
      await this.supabase.auth.signOut();
    } catch (error) {
      console.warn("⚠️ PortalAuth: Error during logout:", error);
    }
  }

  async getSession(): Promise<Session | null> {
    try {
      const { data } = await this.supabase.auth.getSession();
      return data.session;
    } catch (error) {
      return null;
    }
  }

  async getCurrentClient(): Promise<PortalClientUser | null> {
    return this.portalUserSubject.value;
  }

  async isAuthenticated(): Promise<boolean> {
    const session = await this.getSession();
    return !!session?.user;
  }

  async requireAccessToken(): Promise<string> {
    for (let attempt = 1; attempt <= 3; attempt++) {
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (session?.access_token) return session.access_token;

      try {
        await this.supabase.auth.refreshSession();
      } catch {
        /* ignore */
      }

      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
    throw new Error("No hay una sesión válida. Inicia sesión de nuevo.");
  }

  /**
   * Get the Supabase client for direct queries.
   * Exposed for services that need to make queries outside of the auth layer.
   */
  get client(): SupabaseClient {
    return this.supabase;
  }

  /**
   * Get the Supabase URL (used for BFF fetch calls).
   */
  get supabaseUrl(): string {
    // Access via bracket notation to avoid TS protected-member error
    // The property exists at runtime on SupabaseClient instance
    return (this.supabase as any)['supabaseUrl'] as string;
  }

  /**
   * Get the Supabase anon key (used for BFF fetch calls).
   */
  get supabaseKey(): string {
    // Access via bracket notation to avoid TS protected-member error
    // The property exists at runtime on SupabaseClient instance
    return (this.supabase as any)['supabaseKey'] as string;
  }
}
