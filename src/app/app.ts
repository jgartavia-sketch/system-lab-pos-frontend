import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly title = signal('systemlab-pos-front');
  protected readonly isSidebarOpen = signal(false);

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((currentValue) => !currentValue);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }
}