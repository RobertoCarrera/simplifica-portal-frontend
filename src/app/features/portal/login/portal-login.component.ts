import { Component, inject, signal, OnDestroy, OnInit } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PortalAuthService } from '../../../core/services/portal-auth.service';
import { ToastService } from '../../../shared/services/toast.service';

@Component({
  selector: 'app-portal-login',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-shell">
      <div class="brand-side">
        <div class="brand-content">
          <div class="brand-top">
            <div class="logo-circle"><i class="bi bi-person-circle"></i></div>
            <h1>Portal Cliente</h1>
            <p class="subtitle">Accedé a tus citas, presupuestos y facturas desde un solo lugar.</p>
          </div>
          <ul class="feature-list">
            <li><i class="bi bi-check2-circle"></i> Consultá tus citas y reservas</li>
            <li><i class="bi bi-check2-circle"></i> Revisá presupuestos y facturas</li>
            <li><i class="bi bi-check2-circle"></i> Solicitá servicios online</li>
            <li><i class="bi bi-check2-circle"></i> Acceso seguro con enlace mágico</li>
          </ul>
          <div class="footer-note">© {{ currentYear }} Simplifica</div>
        </div>
      </div>

      <div class="form-side">
        <div class="form-wrapper">
          <div class="mobile-header">
            <div class="logo-circle small"><i class="bi bi-person-circle"></i></div>
            <h2>Portal Cliente</h2>
            <p class="subtitle">Acceso seguro a tu información</p>
          </div>
          <h3 class="form-title">Iniciar sesión</h3>

          @if (!magicLinkSent()) {
            <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" novalidate>
              <div class="mb-4">
                <label class="form-label">Email</label>
                <div class="input-wrapper" [class.invalid]="emailInvalid()">
                  <i class="bi bi-at"></i>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    formControlName="email"
                    (blur)="loginForm.get('email')?.markAsTouched()"
                  />
                </div>
                @if (emailInvalid()) {
                  <div class="field-error">Ingresá un email válido</div>
                }
              </div>
              <button
                class="btn-primary w-full"
                type="submit"
                [disabled]="loginForm.get('email')?.invalid || loading() || cooldownRemaining() > 0"
              >
                @if (loading()) {
                  <span class="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full inline-block mr-2"></span>
                  Enviando...
                } @else if (cooldownRemaining() > 0) {
                  Reenviar en {{ cooldownRemaining() }}s
                } @else {
                  <i class="bi bi-magic mr-2"></i>
                  Enviar enlace mágico
                }
              </button>
            </form>
          } @else {
            <div class="text-center py-6">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                <i class="bi bi-envelope-check text-2xl text-green-600 dark:text-green-400"></i>
              </div>
              <h4 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">¡Enlace enviado!</h4>
              <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Revisá tu bandeja de entrada y hacé click en el enlace para acceder.
              </p>
              <button
                class="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                (click)="resetForm()"
              >
                Usar otro email
              </button>
            </div>
          }

          @if (errorMessage()) {
            <div class="p-3 mb-4 text-sm text-red-700 bg-red-100 rounded-lg dark:bg-red-200 dark:text-red-800 flex items-center mt-4">
              <i class="bi bi-exclamation-triangle mr-2"></i>{{ errorMessage() }}
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100vh; width: 100%; overflow: hidden; }
    .login-shell {
      height: 100vh; width: 100%; display: flex;
      background: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      overflow: hidden;
    }

    /* Brand Panel */
    .brand-side {
      flex: 1.2;
      background: linear-gradient(145deg, #1e40af 0%, #1e3a8a 40%, #1e40af 100%);
      position: relative; overflow: hidden; padding: 3rem 2.5rem;
      display: flex; flex-direction: column; color: white;
    }
    .brand-side::before {
      content: ''; position: absolute; top: -50%; right: -30%;
      width: 100%; height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%);
      pointer-events: none;
    }
    .brand-content {
      height: 100%; display: flex; flex-direction: column;
      justify-content: space-between; position: relative; z-index: 1;
    }
    .brand-top { margin-bottom: 2rem; }
    .logo-circle {
      width: 64px; height: 64px; border-radius: 16px;
      background: rgba(255,255,255,0.15);
      display: flex; align-items: center; justify-content: center;
      font-size: 1.75rem; backdrop-filter: blur(8px);
      margin-bottom: 1.5rem; border: 1px solid rgba(255,255,255,0.2);
    }
    .logo-circle.small {
      width: 48px; height: 48px; font-size: 1.4rem;
      margin-bottom: 1rem; margin-left: auto; margin-right: auto;
    }
    .brand-side h1 {
      font-size: 2.5rem; font-weight: 700; letter-spacing: -0.02em;
      margin-bottom: 0.75rem; color: white;
    }
    .subtitle { font-size: 1.05rem; opacity: 0.9; line-height: 1.4; color: rgba(255,255,255,0.9); margin: 0; }
    .feature-list {
      list-style: none; padding: 0; margin: 0; flex: 1;
      display: flex; flex-direction: column; justify-content: center; gap: 1rem;
    }
    .feature-list li { display: flex; align-items: center; gap: 0.75rem; font-size: 0.95rem; opacity: 0.95; color: white; }
    .feature-list i { color: #10b981; font-size: 1.1rem; }
    .footer-note { font-size: 0.8rem; opacity: 0.7; text-align: center; color: rgba(255,255,255,0.7); margin-top: 1rem; }

    /* Form Panel */
    .form-side {
      flex: 1; background: #ffffff; display: flex;
      align-items: center; justify-content: center;
      padding: 2rem 1.5rem; overflow-y: auto;
    }
    .form-wrapper {
      width: 100%; max-width: 400px; padding: 2.5rem 2rem 2rem;
      background: white; border-radius: 24px;
      box-shadow: 0 10px 40px -12px rgba(0,0,0,0.15), 0 4px 16px -8px rgba(0,0,0,0.1);
      border: 1px solid rgba(0,0,0,0.05);
    }
    .mobile-header { display: none; text-align: center; margin-bottom: 2rem; }
    .mobile-header h2 { font-size: 1.75rem; font-weight: 700; margin: 0.75rem 0 0.5rem; color: #1e293b; }
    .mobile-header .subtitle { color: #64748b; font-size: 0.9rem; margin: 0; }
    .form-title { font-size: 1.5rem; font-weight: 600; color: #1e293b; margin-bottom: 1.75rem; }

    /* Form Elements */
    .form-label {
      font-weight: 600; font-size: 0.8rem; text-transform: uppercase;
      letter-spacing: 0.5px; color: #64748b; margin-bottom: 0.5rem; display: block;
    }
    .input-wrapper {
      position: relative; display: flex; align-items: center;
      background: #fff; border: 2px solid #e2e8f0; border-radius: 12px;
      padding: 0.875rem 1rem; gap: 0.75rem; transition: all 0.2s ease; margin-bottom: 0.5rem;
    }
    .input-wrapper.invalid { border-color: #ef4444; background: #fef2f2; }
    .input-wrapper:focus-within { border-color: #3b82f6; background: #f8fafc; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
    .input-wrapper i { font-size: 1.1rem; color: #94a3b8; flex-shrink: 0; }
    .input-wrapper input {
      flex: 1; border: none; outline: none; background: transparent;
      font-size: 1rem; font-weight: 500; color: #1e293b;
    }
    .input-wrapper input::placeholder { color: #94a3b8; font-weight: 400; }
    .field-error { font-size: 0.75rem; color: #ef4444; margin-top: 0.25rem; font-weight: 500; }
    .btn-primary {
      background: #2563eb; color: white; border: none; padding: 0.875rem;
      border-radius: 12px; font-weight: 600; font-size: 1rem; cursor: pointer;
      transition: all 0.2s ease; display: flex; justify-content: center; align-items: center;
    }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary:not(:disabled):hover { transform: translateY(-1px); box-shadow: 0 8px 25px -8px rgba(59,130,246,0.4); }

    /* Mobile */
    @media (max-width: 991px) {
      .brand-side { display: none !important; }
      .mobile-header { display: block; }
      .form-side { padding: 1.5rem 1rem; background: linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%); }
      .form-wrapper { padding: 2rem 1.5rem; border-radius: 20px; max-width: 360px; }
    }
    @media (max-width: 480px) {
      .form-side { padding: 1rem 0.75rem; }
      .form-wrapper { padding: 1.75rem 1.25rem; border-radius: 16px; }
      .form-title { font-size: 1.25rem; }
    }

    /* Dark mode */
    @media (prefers-color-scheme: dark) {
      .login-shell, .form-side { background: #0f172a; }
      .form-wrapper { background: #1e293b; border-color: #334155; box-shadow: 0 10px 40px -12px rgba(0,0,0,0.4); }
      .form-title, .mobile-header h2 { color: #f1f5f9; }
      .mobile-header .subtitle { color: #94a3b8; }
      .form-label { color: #94a3b8; }
      .input-wrapper { background: #0f172a !important; border-color: #475569 !important; }
      .input-wrapper i { color: #64748b; }
      .input-wrapper input { color: #f1f5f9 !important; background: transparent !important; }
      .input-wrapper input::placeholder { color: #64748b !important; }
      .logo-circle { background: rgba(59,130,246,0.2); border-color: rgba(59,130,246,0.3); color: #60a5fa; }
    }
  `],
})
export class PortalLoginComponent implements OnInit, OnDestroy {
  private auth = inject(PortalAuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private toastService = inject(ToastService);

  loading = signal(false);
  errorMessage = signal('');
  magicLinkSent = signal(false);
  cooldownRemaining = signal(0);
  currentYear = new Date().getFullYear();

  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Pre-fill the email field when arriving from the consent page via
   * `/login?email=foo@bar`. Saves the user one keystroke and removes the
   * risk of typos that would send the magic link to the wrong address.
   */
  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  ngOnInit(): void {
    const presetEmail = this.route.snapshot.queryParamMap.get('email');
    if (presetEmail && presetEmail.trim()) {
      this.loginForm.patchValue({ email: presetEmail.trim().toLowerCase() });
    }
  }

  emailInvalid = () => {
    const control = this.loginForm.get('email');
    return control?.invalid && control?.touched;
  };

  async onSubmit() {
    if (this.loading() || this.cooldownRemaining() > 0) return;

    if (this.loginForm.get('email')?.invalid) {
      this.loginForm.get('email')?.markAsTouched();
      return;
    }

    const email = this.loginForm.get('email')?.value;
    if (!email) return;

    this.loading.set(true);
    this.errorMessage.set('');

    try {
      const result = await this.auth.loginWithOTP(email);
      if (result.success) {
        this.magicLinkSent.set(true);
        this.toastService.info('Revisá tu bandeja de entrada', 'Enlace enviado');
        this.startCooldown();
      } else {
        this.errorMessage.set(result.error || 'Error al enviar el enlace');
      }
    } catch {
      this.errorMessage.set('Error inesperado. Intentá de nuevo.');
    } finally {
      this.loading.set(false);
    }
  }

  resetForm() {
    this.magicLinkSent.set(false);
    this.errorMessage.set('');
    this.loginForm.reset();
  }

  private startCooldown() {
    this.cooldownRemaining.set(60);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.cooldownRemaining() - 1;
      if (remaining <= 0) {
        this.cooldownRemaining.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.cooldownRemaining.set(remaining);
      }
    }, 1000);
  }

  ngOnDestroy() {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }
}
