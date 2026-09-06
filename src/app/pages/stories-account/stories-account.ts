import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
  private readonly cdr = inject(ChangeDetectorRef);

  mode: 'registro' | 'login' = 'registro';
  loading = false;
  loadingAccount = false;
  showPassword = false;
  showConfirmation = false;
  error = '';
  notice = '';
  copied = false;
  connectingMessage = '';
  dashboard: StoriesDashboard | null = null;
  openSeason: string | null = null;

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
    this.connectingMessage = 'Creando tu cuenta segura…';
    const slowConnection = globalThis.setTimeout(() => {
      this.connectingMessage = 'Render está despertando. Tu cuenta se creará una sola vez…';
      this.cdr.detectChanges();
    }, 7000);
    this.auth.register({
      full_name: value.fullName,
      email: value.email,
      phone: value.phone,
      password: value.password,
      referral_code: value.referralCode.trim() || undefined,
    }).pipe(finalize(() => {
      globalThis.clearTimeout(slowConnection);
      this.loading = false;
      this.connectingMessage = '';
      this.cdr.detectChanges();
    })).subscribe({
      next: () => {
        this.notice = 'Cuenta creada. Bienvenido a System Lab Stories.';
        this.loadDashboard();
        this.cdr.detectChanges();
      },
      error: (response) => {
        this.error = response.error?.detail ?? 'No fue posible crear la cuenta.';
        this.cdr.detectChanges();
      },
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
    this.connectingMessage = 'Abriendo tu biblioteca…';
    this.auth.login(this.loginForm.getRawValue()).pipe(finalize(() => {
      this.loading = false;
      this.connectingMessage = '';
      this.cdr.detectChanges();
    })).subscribe({
      next: () => { this.loadDashboard(); this.cdr.detectChanges(); },
      error: (response) => {
        this.error = response.error?.detail ?? 'No fue posible iniciar sesión.';
        this.cdr.detectChanges();
      },
    });
  }

  logout(): void {
    this.auth.logout();
    this.dashboard = null;
    this.mode = 'login';
    this.notice = 'Sesión cerrada correctamente.';
  }

  seasonKey(storySlug: string, seasonNumber: number): string {
    return `${storySlug}-${seasonNumber}`;
  }

  toggleSeason(storySlug: string, seasonNumber: number): void {
    const key = this.seasonKey(storySlug, seasonNumber);
    this.openSeason = this.openSeason === key ? null : key;
  }

  openChapter(storySlug: string, seasonNumber: number, chapterNumber: number, canRead: boolean): void {
    if (!canRead) return;
    void this.router.navigate(['/stories/leer', storySlug, seasonNumber, chapterNumber]);
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
      next: (dashboard) => { this.dashboard = dashboard; this.cdr.detectChanges(); },
      error: () => {
        this.auth.logout();
        this.dashboard = null;
        this.mode = 'login';
        this.error = 'Tu sesión venció. Iniciá sesión nuevamente.';
        this.cdr.detectChanges();
      },
    });
  }
}
