import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-stories',
  imports: [RouterLink],
  templateUrl: './stories.html',
  styleUrl: './stories.scss',
})
export class Stories {
  readonly chapters = [1, 2, 3, 4, 5, 6];
  readonly characterSlots = [1, 2, 3, 4];
}
