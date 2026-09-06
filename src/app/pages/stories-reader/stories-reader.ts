import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { StoriesAuthService, StoriesChapter } from '../../services/stories-auth.service';

@Component({
  selector: 'app-stories-reader',
  imports: [RouterLink],
  templateUrl: './stories-reader.html',
  styleUrl: './stories-reader.scss',
})
export class StoriesReader implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(StoriesAuthService);
  private readonly cdr = inject(ChangeDetectorRef);

  private storySlug = '';
  private seasonNumber = 0;
  private chapterNumber = 0;
  private slowTimer?: number;

  chapter: StoriesChapter | null = null;
  loading = true;
  error = '';
  loadingMessage = 'Preparando el capítulo…';
  readingProgress = 0;

  ngOnInit(): void {
    if (!this.auth.hasSession()) {
      void this.router.navigate(['/stories/mi-cuenta'], { queryParams: { modo: 'login' } });
      return;
    }
    this.storySlug = this.route.snapshot.paramMap.get('storySlug') ?? '';
    this.seasonNumber = Number(this.route.snapshot.paramMap.get('season'));
    this.chapterNumber = Number(this.route.snapshot.paramMap.get('chapter'));
    this.loadChapter();

    globalThis.addEventListener?.('scroll', this.updateProgress, { passive: true });
  }

  loadChapter(): void {
    this.loading = true;
    this.error = '';
    this.chapter = null;
    this.loadingMessage = 'Preparando el capítulo…';
    globalThis.clearTimeout(this.slowTimer);
    this.slowTimer = globalThis.setTimeout(() => {
      this.loadingMessage = 'El servidor está despertando. Ya casi abrimos el libro…';
      this.cdr.detectChanges();
    }, 5000);

    this.auth
      .getChapter(this.storySlug, this.seasonNumber, this.chapterNumber)
      .pipe(
        finalize(() => {
          globalThis.clearTimeout(this.slowTimer);
          this.loading = false;
          this.cdr.detectChanges();
        }),
      )
      .subscribe({
        next: (content) => {
          this.chapter = content;
          this.cdr.detectChanges();
        },
        error: (response) => {
          if (response.status === 401) this.auth.logout();
          this.error = response.error?.detail ?? 'No fue posible abrir este capítulo.';
          this.cdr.detectChanges();
        },
      });
  }

  ngOnDestroy(): void {
    globalThis.clearTimeout(this.slowTimer);
    globalThis.removeEventListener?.('scroll', this.updateProgress);
  }

  readonly updateProgress = (): void => {
    const root = document.documentElement;
    const scrollable = root.scrollHeight - root.clientHeight;
    this.readingProgress = scrollable > 0 ? Math.min(100, (root.scrollTop / scrollable) * 100) : 0;
  };

  isScene(text: string): boolean {
    return /^ESCENA\s+\d+/i.test(text);
  }
  isDialogue(text: string): boolean {
    return /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ ]{1,22}:/.test(text);
  }
  speaker(text: string): string {
    return text.slice(0, text.indexOf(':'));
  }
  dialogue(text: string): string {
    return text.slice(text.indexOf(':') + 1).trim();
  }
}
