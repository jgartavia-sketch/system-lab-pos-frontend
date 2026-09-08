import { AfterViewInit, ChangeDetectorRef, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing',
  imports: [RouterLink],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements AfterViewInit, OnDestroy {
  menuOpen = false;
  canScrollClientsBack = false;
  canScrollClientsForward = false;

  @ViewChild('clientsCarousel') private clientsCarousel?: ElementRef<HTMLElement>;
  private carouselResizeObserver?: ResizeObserver;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    const track = this.clientsCarousel?.nativeElement;
    if (!track) return;

    this.updateClientsCarousel();
    this.changeDetector.detectChanges();
    this.carouselResizeObserver = new ResizeObserver(() => {
      this.updateClientsCarousel();
      this.changeDetector.detectChanges();
    });
    this.carouselResizeObserver.observe(track);
  }

  ngOnDestroy(): void {
    this.carouselResizeObserver?.disconnect();
  }

  updateClientsCarousel(): void {
    const track = this.clientsCarousel?.nativeElement;
    if (!track) return;
    this.canScrollClientsBack = track.scrollLeft > 1;
    this.canScrollClientsForward = track.scrollLeft + track.clientWidth < track.scrollWidth - 1;
  }

  scrollClients(direction: -1 | 1): void {
    const track = this.clientsCarousel?.nativeElement;
    const card = track?.querySelector<HTMLElement>('.project-card');
    if (!track || !card) return;
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    this.scrollClientsTo(track.scrollLeft + direction * (card.offsetWidth + gap));
  }

  onClientsCarouselKey(event: KeyboardEvent): void {
    if (event.target !== event.currentTarget) return;
    switch (event.key) {
      case 'ArrowLeft':
        event.preventDefault();
        this.scrollClients(-1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        this.scrollClients(1);
        break;
      case 'Home':
        event.preventDefault();
        this.scrollClientsTo(0);
        break;
      case 'End':
        event.preventDefault();
        this.scrollClientsTo(this.clientsCarousel?.nativeElement.scrollWidth ?? 0);
        break;
    }
  }

  private scrollClientsTo(left: number): void {
    const track = this.clientsCarousel?.nativeElement;
    if (!track) return;
    track.scrollTo({
      left: Math.max(0, Math.min(track.scrollWidth - track.clientWidth, left)),
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  }

  toggleMenu(): void {
    this.menuOpen = !this.menuOpen;
  }

  closeMenu(): void {
    this.menuOpen = false;
  }
}
