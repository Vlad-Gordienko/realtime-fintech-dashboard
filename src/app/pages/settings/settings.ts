import { Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { form, FormField, FormRoot } from '@angular/forms/signals';
import { MarketService } from '../../core/market.service';
import { DEFAULT_SETTINGS, SETTINGS_BOUNDS } from '../../core/settings';
import { validateIntegerField } from './settings.meta';
import { SettingsToast } from './settings.types';
import { ProducerSettings } from '../../core/market.types';

const TOAST_DURATION_MS = 3000;

@Component({
  selector: 'app-settings',
  imports: [FormField, FormRoot],
  templateUrl: './settings.html',
  styleUrl: './settings.scss',
})
export class Settings {
  private readonly marketService = inject(MarketService);
  private readonly destroyRef = inject(DestroyRef);

  readonly bounds = SETTINGS_BOUNDS;

  private readonly settingsModel = signal<ProducerSettings>(DEFAULT_SETTINGS);

  readonly form = form(this.settingsModel, (path) => {
    validateIntegerField(path.instrumentCount, 'Instrument count', SETTINGS_BOUNDS.instrumentCount);
    validateIntegerField(path.updatesPerBatch, 'Updates per batch', SETTINGS_BOUNDS.updatesPerBatch);
    validateIntegerField(path.batchIntervalMs, 'Batch interval (ms)', SETTINGS_BOUNDS.batchIntervalMs);
  });

  readonly isValid = computed(() => this.form().valid());

  /** Transient feedback shown after Apply: success immediately, or an error if the new run fails to start. */
  readonly toast = signal<SettingsToast | null>(null);

  /** The run id we're watching for a possible post-Apply failure, or null when not watching. */
  private readonly watchedRunId = signal<number | null>(null);

  private toastTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      const state = this.marketService.state();
      const watched = this.watchedRunId();
      if (watched !== null && state.activeRunId === watched && state.status === 'error') {
        this.showToast('error', state.error ?? 'Failed to apply settings.');
        this.watchedRunId.set(null);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.toastTimeoutId !== null) {
        clearTimeout(this.toastTimeoutId);
      }
    });
  }

  apply(): void {
    if (this.form().invalid()) return;
    this.marketService.apply(this.form().value());

    const runId = this.marketService.state().activeRunId;
    this.watchedRunId.set(runId);
    this.showToast('success', 'Settings applied — new run started.');
  }

  private showToast(type: SettingsToast['type'], message: string): void {
    this.toast.set({ type, message });
    if (this.toastTimeoutId !== null) {
      clearTimeout(this.toastTimeoutId);
    }
    this.toastTimeoutId = setTimeout(() => this.toast.set(null), TOAST_DURATION_MS);
  }
}
