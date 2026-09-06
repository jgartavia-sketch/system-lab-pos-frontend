import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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

  chapter: StoriesChapter | null = null;
  loading = true;
  error = '';
  readingProgress = 0;

  ngOnInit(): void {
    if (!this.auth.hasSession()) {
      void this.router.navigate(['/stories/mi-cuenta'], { queryParams: { modo: 'login' } });
      return;
    }
    const storySlug = this.route.snapshot.paramMap.get('storySlug') ?? '';
    const season = Number(this.route.snapshot.paramMap.get('season'));
    const chapter = Number(this.route.snapshot.paramMap.get('chapter'));
    this.auth.getChapter(storySlug, season, chapter).pipe(
      finalize(() => this.loading = false),
    ).subscribe({
      next: (content) => this.chapter = content,
      error: (response) => {
        if (response.status === 401) this.auth.logout();
        this.error = response.error?.detail ?? 'No fue posible abrir este capítulo.';
      },
    });

    globalThis.addEventListener?.('scroll', this.updateProgress, { passive: true });
  }

  ngOnDestroy(): void {
    globalThis.removeEventListener?.('scroll', this.updateProgress);
  }

  readonly updateProgress = (): void => {
    const root = document.documentElement;
    const scrollable = root.scrollHeight - root.clientHeight;
    this.readingProgress = scrollable > 0 ? Math.min(100, (root.scrollTop / scrollable) * 100) : 0;
  };

  isScene(text: string): boolean { return /^ESCENA\s+\d+/i.test(text); }
  isDialogue(text: string): boolean { return /^[A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚáéíóúÑñ ]{1,22}:/.test(text); }
  speaker(text: string): string { return text.slice(0, text.indexOf(':')); }
  dialogue(text: string): string { return text.slice(text.indexOf(':') + 1).trim(); }
}
