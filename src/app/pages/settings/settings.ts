import { Component, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MarketService } from '../../core/market.service';
import { DEFAULT_SETTINGS, SETTINGS_BOUNDS } from '../../core/settings';
import { ToastService } from '../../core/toast/toast.service';
import { validateIntegerField } from './settings.meta';
import { ProducerSettings } from '../../core/market.types';
import { NumericField } from '../../shared/form-controls/numeric-field';

@Component({
  selector: 'app-settings',
  imports: [FormField, FormRoot, NumericField],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly marketService = inject(MarketService);
  private readonly toastService = inject(ToastService);

  private readonly settingsModel = signal<ProducerSettings>(DEFAULT_SETTINGS);

  readonly form = form(this.settingsModel, (path) => {
    validateIntegerField(path.instrumentCount, 'Instrument count', SETTINGS_BOUNDS.instrumentCount);
    validateIntegerField(path.updatesPerBatch, 'Updates per batch', SETTINGS_BOUNDS.updatesPerBatch);
    validateIntegerField(path.batchIntervalMs, 'Batch interval (ms)', SETTINGS_BOUNDS.batchIntervalMs);
  });

  readonly isValid = computed(() => this.form().valid());

  /** The run id we're watching for a possible post-Apply failure, or null when not watching. */
  private readonly watchedRunId = signal<number | null>(null);

  constructor() {
    effect(() => {
      const state = this.marketService.state();
      const watched = this.watchedRunId();
      if (watched !== null && state.activeRunId === watched && state.status === 'error') {
        this.toastService.error(state.error ?? 'Failed to apply settings.');
        this.watchedRunId.set(null);
      }
    });
  }

  apply(): void {
    if (this.form().invalid()) return;
    this.marketService.apply(this.form().value());

    const runId = this.marketService.state().activeRunId;
    this.watchedRunId.set(runId);
    this.toastService.success('Settings applied — new run started.');
  }
}
