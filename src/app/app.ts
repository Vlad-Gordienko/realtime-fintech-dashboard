import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MarketService } from './core/market.service';
import { ToastViewport } from './core/toast/toast-viewport';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastViewport],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly marketService = inject(MarketService);

  constructor() {
    // Starts the single app-lifetime Worker. Safe to call again (no-op) if App is ever re-created.
    this.marketService.init();
  }
}
