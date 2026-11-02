import { Component, computed, inject } from '@angular/core';
import { MarketService } from '../../core/market.service';
import { formatImbalance, formatPriceCents, formatVolume } from '../../core/formatters';
import { InstrumentRow } from './dashboard.types';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly marketService = inject(MarketService);

  readonly state = this.marketService.state;

  readonly isLoading = computed(() => this.state().status === 'initializing');
  readonly isPaused = computed(() => this.state().status === 'paused');
  readonly isRunning = computed(() => this.state().status === 'running');
  readonly canToggle = computed(() => this.isRunning() || this.isPaused());

  readonly rows = computed<InstrumentRow[]>(() =>
    this.state().instruments.map((m) => ({
      instrument: m.instrument,
      lastPrice: formatPriceCents(m.lastPriceCents),
      spread: formatPriceCents(m.spreadCents),
      volume: formatVolume(m.totalVolume),
      vwap: formatPriceCents(m.vwapCents),
      imbalance: formatImbalance(m.imbalance),
    })),
  );

  togglePause(): void {
    if (this.isPaused()) {
      this.marketService.resume();
    } else {
      this.marketService.pause();
    }
  }
}
