/**
 * Portal Client User model
 * Represents the authenticated client from client_portal_users table
 */
export interface PortalClientUser {
  id: string; // Internal user id (public.users.id)
  client_id: string; // Client id from clients table
  company_id: string; // Company identifier
  auth_user_id: string; // Supabase Auth user id
  email: string;
  name?: string | null;
  surname?: string | null;
  full_name?: string | null;
  role: "client"; // Portal users are always 'client' role
  is_active: boolean;
}

/**
 * Portal Session info
 */
export interface PortalSession {
  access_token: string;
  expires_at?: number;
  refresh_token?: string;
}

/**
 * IPortalAuth — Abstracción para autenticación del portal cliente.
 *
 * Esta interfaz desacopla ClientPortalService de AuthService del CRM.
 * Permite que el portal use su propia implementación de auth (Supabase OTP)
 * sin depender del AuthService del monorepo.
 *
 * Los métodos reflejan el flujo OTP del portal:
 * - loginWithOTP: Envía OTP por email (magic link flow)
 * - logout: Cierra sesión y limpia estado
 * - getSession: Obtiene la sesión activa
 * - getCurrentClient: Obtiene el usuario portal con client_id y company_id
 */
export interface IPortalAuth {
  /**
   * Inicia sesión con OTP (magic link).
   * Envia email con enlace mágico al cliente.
   * @param email Email del cliente registrado en client_portal_users
   * @returns Observable con { success, error }
   */
  loginWithOTP(email: string): Promise<{ success: boolean; error?: string }>;

  /**
   * Cierra la sesión del portal.
   */
  logout(): Promise<void>;

  /**
   * Obtiene la sesión activa de Supabase.
   * @returns Promise con la sesión o null si no hay sesión
   */
  getSession(): Promise<import("@supabase/supabase-js").Session | null>;

  /**
   * Obtiene el usuario portal actual con client_id y company_id.
   * Este es el método principal que ClientPortalService usa para obtener
   * los datos necesarios para sus queries (client_id en quotes, invoices, etc.)
   * @returns Promise con PortalClientUser o null si no está autenticado
   */
  getCurrentClient(): Promise<PortalClientUser | null>;

  /**
   * Observable del usuario portal actual.
   * Útil para componentes que necesitan reaccionar a cambios de auth.
   */
  currentClient$: import("rxjs").Observable<PortalClientUser | null>;

  /**
   * Verifica si hay una sesión activa del portal.
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Obtiene el token de acceso para Edge Functions.
   * Con retry logic para manejar sesiones que aún se están hidratando.
   */
  requireAccessToken(): Promise<string>;
}
