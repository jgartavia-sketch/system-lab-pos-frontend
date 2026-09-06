import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { StoriesAuthService, StoriesDashboard } from '../../services/stories-auth.service';

@Component({
  selector: 'app-stories-account',
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './stories-account.html',
  styleUrl: './stories-account.scss',
})
export class StoriesAccount implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(StoriesAuthService);

  mode: 'registro' | 'login' = 'registro';
  loading = false;
  loadingAccount = false;
  showPassword = false;
  showConfirmation = false;
  error = '';
  notice = '';
  copied = false;
  dashboard: StoriesDashboard | null = null;

  readonly registerForm = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.minLength(8)]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmation: ['', [Validators.required]],
    referralCode: [''],
    accept: [false, [Validators.requiredTrue]],
  });
  readonly loginForm = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const requestedMode = params.get('modo');
      if (requestedMode === 'login' || requestedMode === 'registro') this.mode = requestedMode;
      const referralCode = params.get('ref');
      if (referralCode) this.registerForm.controls.referralCode.setValue(referralCode.toUpperCase());
    });
    if (this.auth.hasSession()) this.loadDashboard();
  }

  selectMode(mode: 'registro' | 'login'): void {
    this.mode = mode;
    this.error = '';
    this.notice = '';
    void this.router.navigate([], { relativeTo: this.route, queryParams: { modo: mode }, queryParamsHandling: 'merge' });
  }

  register(): void {
    this.error = '';
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      this.error = 'Revisá los campos obligatorios antes de continuar.';
      return;
    }
    const value = this.registerForm.getRawValue();
    if (value.password !== value.confirmation) {
      this.error = 'Las contraseñas no coinciden.';
      return;
    }
    this.loading = true;
    this.auth.register({
      full_name: value.fullName,
      email: value.email,
      phone: value.phone,
      password: value.password,
      referral_code: value.referralCode.trim() || undefined,
    }).pipe(finalize(() => this.loading = false)).subscribe({
      next: () => { this.notice = 'Cuenta creada. Bienvenido a bordo.'; this.loadDashboard(); },
      error: (response) => this.error = response.error?.detail ?? 'No fue posible crear la cuenta.',
    });
  }

  login(): void {
    this.error = '';
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.error = 'Ingresá un correo y una contraseña válidos.';
      return;
    }
    this.loading = true;
    this.auth.login(this.loginForm.getRawValue()).pipe(finalize(() => this.loading = false)).subscribe({
      next: () => this.loadDashboard(),
      error: (response) => this.error = response.error?.detail ?? 'No fue posible iniciar sesión.',
    });
  }

  logout(): void {
    this.auth.logout();
    this.dashboard = null;
    this.mode = 'login';
    this.notice = 'Sesión cerrada correctamente.';
  }

  async copyReferral(): Promise<void> {
    if (!this.dashboard) return;
    const url = `${globalThis.location?.origin ?? ''}/stories/mi-cuenta?modo=registro&ref=${this.dashboard.referrals.referral_code}`;
    await globalThis.navigator?.clipboard?.writeText(url);
    this.copied = true;
    globalThis.setTimeout(() => this.copied = false, 1800);
  }

  private loadDashboard(): void {
    this.loadingAccount = true;
    this.auth.getDashboard().pipe(finalize(() => this.loadingAccount = false)).subscribe({
      next: (dashboard) => this.dashboard = dashboard,
      error: () => {
        this.auth.logout();
        this.dashboard = null;
        this.mode = 'login';
        this.error = 'Tu sesión venció. Iniciá sesión nuevamente.';
      },
    });
  }
}
