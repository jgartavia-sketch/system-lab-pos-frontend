import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-pos',
  imports: [],
  templateUrl: './pos.html',
  styleUrl: './pos.scss',
})
export class Pos {
  protected readonly title = signal('systemlab-pos-front');
  protected readonly isSidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((currentValue) => !currentValue);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}