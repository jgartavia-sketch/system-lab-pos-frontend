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
    {
      archive: '01',
      name: 'Andrew',
      tagline: 'El arquitecto de la vida',
      image: '/images/voyager/characters/andrew-horizon-academy.webp',
      age: '16–17 años',
      origin: 'Costa Rica, Tierra',
      academy: 'Horizon Academy',
      specialty: 'Biología, bioingeniería y soporte vital',
      personality: 'Curioso, introvertido, observador, soñador y determinado.',
      contribution: 'Diseña ecosistemas capaces de sostener vida humana fuera de la Tierra.',
    },
    {
      archive: '02',
      name: 'Frank',
      tagline: 'El constructor del futuro',
      image: '/images/voyager/characters/frank-horizon-academy.webp',
      age: '16–17 años',
      origin: 'Costa Rica, Tierra',
      academy: 'Horizon Academy',
      specialty: 'Ingeniería mecánica y construcción espacial',
      personality: 'Frío, calculador, estratégico, disciplinado y preciso.',
      contribution: 'Convierte ideas monumentales en estructuras, sistemas y tecnología real.',
    },
    {
      archive: '03',
      name: 'Jenni',
      tagline: 'La mente que observa el panorama completo',
      image: '/images/voyager/characters/jenni-horizon-academy.webp',
      age: '16–17 años',
      origin: 'Costa Rica, Tierra',
      academy: 'Horizon Academy',
      specialty: 'Análisis de datos y visión sistémica',
      personality: 'Inteligente, firme, analítica, equilibrada y clara.',
      contribution: 'Mide las consecuencias y anticipa hacia dónde puede conducir cada decisión.',
    },
    {
      archive: '04',
      name: 'Wilber',
      tagline: 'El que sospecha de todo',
      image: '/images/voyager/characters/wilber-horizon-academy.webp',
      age: '16–17 años',
      origin: 'Costa Rica, Tierra',
      academy: 'Horizon Academy',
      specialty: 'Análisis, investigación y patrones ocultos',
      personality: 'Inquieto, brillante, conspiranoico e intuitivo.',
      contribution: 'Detecta el peligro y cuestiona las intenciones que nadie más percibe.',
    },
    {
      archive: '05',
      name: 'Charlie',
      tagline: 'El escéptico',
      image: '/images/voyager/characters/charlie-horizon-academy.webp',
      age: '16–17 años',
      origin: 'Costa Rica, Tierra',
      academy: 'Horizon Academy',
      specialty: 'Pensamiento crítico y debate racional',
      personality: 'Seguro, directo, provocador y difícil de impresionar.',
      contribution: 'Obliga al grupo a defender cada idea con razones y evidencia.',
    },
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
