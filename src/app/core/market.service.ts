import { Injectable, InjectionToken, Signal, inject, signal } from '@angular/core';
import { InstrumentMetrics, MarketState, ProducerSettings } from './market.types';
import { WorkerCommand, WorkerEvent } from './worker-protocol';
import { DEFAULT_SETTINGS } from './settings';
import { instrumentSymbols } from './instrument-symbols';

/** Minimal shape MarketService needs from a Worker — lets tests substitute a fake. */
export interface WorkerLike {
  postMessage(command: WorkerCommand): void;
  onmessage: ((event: MessageEvent<WorkerEvent>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  terminate?(): void;
}

/** Creates the real market Worker. Overridden in tests to inject a fake WorkerLike. */
export const WORKER_FACTORY = new InjectionToken<() => WorkerLike>('WORKER_FACTORY', {
  providedIn: 'root',
  factory: () => () =>
    new Worker(new URL('../../worker/market.worker', import.meta.url), { type: 'module' }),
});

function zeroMetrics(instrument: string): InstrumentMetrics {
  return {
    instrument,
    lastPriceCents: null,
    spreadCents: null,
    totalVolume: 0,
    vwapCents: null,
    imbalance: null,
  };
}

function initialInstruments(settings: ProducerSettings): InstrumentMetrics[] {
  return instrumentSymbols(settings.instrumentCount).map(zeroMetrics);
}

/**
 * The single owner of the market Web Worker for the whole app lifetime. Exposes read-only
 * reactive state via Signals; pages read `state()` and call `pause()/resume()/apply()` — they
 * never talk to the Worker directly.
 */
@Injectable({ providedIn: 'root' })
export class MarketService {
  private readonly worker: WorkerLike;
  private nextRunId = 1;
  private started = false;

  private readonly stateSignal = signal<MarketState>({
    status: 'initializing',
    activeRunId: 0,
    settings: DEFAULT_SETTINGS,
    instruments: initialInstruments(DEFAULT_SETTINGS),
    error: null,
  });

  readonly state: Signal<MarketState> = this.stateSignal.asReadonly();

  constructor() {
    const workerFactory = inject(WORKER_FACTORY);
    this.worker = workerFactory();
    this.worker.onmessage = (event: MessageEvent<WorkerEvent>) => this.handleEvent(event.data);
    this.worker.onerror = (event: ErrorEvent) =>
      this.handleEvent({
        type: 'ERROR',
        runId: null,
        message: event.message || 'Worker error',
      });
  }

  /** Starts the Worker lifecycle. Safe to call more than once — only the first call has any effect. */
  init(): void {
    if (this.started) return;
    this.started = true;
    this.worker.postMessage({ type: 'INIT' });
  }

  /** Pauses the current run. No-op if there is no active run. */
  pause(): void {
    const current = this.stateSignal();
    if (current.activeRunId === 0) return;
    this.worker.postMessage({ type: 'PAUSE', runId: current.activeRunId });
  }

  /** Resumes the current run. No-op if there is no active run. */
  resume(): void {
    const current = this.stateSignal();
    if (current.activeRunId === 0) return;
    this.worker.postMessage({ type: 'RESUME', runId: current.activeRunId });
  }

  /** Applies new settings: always starts a brand-new run (new runId, reset metrics). */
  apply(settings: ProducerSettings): void {
    this.startRun(settings);
  }

  /** Releases the Worker. Intended for app teardown only — never called by page components. */
  dispose(): void {
    this.worker.postMessage({ type: 'DISPOSE' });
    this.worker.terminate?.();
  }

  private startRun(settings: ProducerSettings): void {
    const runId = this.nextRunId++;
    this.stateSignal.update((current) => ({
      ...current,
      activeRunId: runId,
      settings,
      instruments: initialInstruments(settings),
      error: null,
    }));
    this.worker.postMessage({ type: 'START', runId, settings });
  }

  private handleEvent(event: WorkerEvent): void {
    switch (event.type) {
      case 'READY':
        this.startRun(DEFAULT_SETTINGS);
        return;

      case 'STATUS': {
        if (event.runId !== this.stateSignal().activeRunId) return;
        this.stateSignal.update((current) => ({ ...current, status: event.status }));
        return;
      }

      case 'UPDATE': {
        if (event.runId !== this.stateSignal().activeRunId) return;
        this.stateSignal.update((current) => ({ ...current, instruments: event.metrics }));
        return;
      }

      case 'ERROR': {
        if (event.runId !== null && event.runId !== this.stateSignal().activeRunId) return;
        this.stateSignal.update((current) => ({
          ...current,
          status: 'error',
          error: event.message,
        }));
        return;
      }
    }
  }
}
