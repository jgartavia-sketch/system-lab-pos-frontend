import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-stories',
  imports: [RouterLink],
  templateUrl: './stories.html',
  styleUrl: './stories.scss',
})
export class Stories {
  @ViewChild('characterCarousel') characterCarousel?: ElementRef<HTMLElement>;

  readonly chapters = [1, 2, 3, 4, 5, 6];
  readonly characters = [
    { archive: '01', name: 'Tripulante 1', image: '', role: 'Por revelar', origin: 'Clasificado', mission: 'Información reservada' },
    { archive: '02', name: 'Tripulante 2', image: '', role: 'Por revelar', origin: 'Clasificado', mission: 'Información reservada' },
    { archive: '03', name: 'Tripulante 3', image: '', role: 'Por revelar', origin: 'Clasificado', mission: 'Información reservada' },
    { archive: '04', name: 'Tripulante 4', image: '', role: 'Por revelar', origin: 'Clasificado', mission: 'Información reservada' },
  ];
  selectedChapter = 1;
  expandedCharacter: number | null = null;

  selectChapter(chapter: number): void {
    this.selectedChapter = chapter;
  }

  toggleCharacter(index: number): void {
    this.expandedCharacter = this.expandedCharacter === index ? null : index;
  }

  scrollCharacters(direction: -1 | 1): void {
    this.characterCarousel?.nativeElement.scrollBy({
      left: direction * 310,
      behavior: 'smooth',
    });
  }
}
