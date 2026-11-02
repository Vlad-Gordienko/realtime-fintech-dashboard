import { InstrumentAccumulator, InstrumentMetrics, ProducerSettings, ProducerStatus } from '../app/core/market.types';
import { instrumentSymbols } from '../app/core/instrument-symbols';
import { ProducerAdapter } from './wasm-adapter';
import { applyBatch, toMetricsList } from './market-aggregator';

/** Minimum milliseconds between onUpdate publishes, to cap UI update frequency independent of generation rate. */
const PUBLISH_INTERVAL_MS = 100;

export interface ProducerControllerCallbacks {
  onStatus(status: ProducerStatus): void;
  onUpdate(metrics: InstrumentMetrics[]): void;
  onError(message: string): void;
}

/**
 * Orchestrates one generator run: schedules batch generation sequentially (never overlapping),
 * aggregates every generated trade, and throttles how often onUpdate fires. Owns no WASM/timer
 * globals beyond setTimeout/clearTimeout, so it's fully unit-testable with a fake ProducerAdapter
 * and fake timers.
 */
export class ProducerController {
  private status: ProducerStatus = 'initializing';
  private settings: ProducerSettings | null = null;
  private instrumentOrder: string[] = [];
  private accumulators: Map<string, InstrumentAccumulator> = new Map();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastPublishAt = 0;

  constructor(
    private readonly producer: ProducerAdapter,
    private readonly callbacks: ProducerControllerCallbacks,
  ) {}

  getStatus(): ProducerStatus {
    return this.status;
  }

  /** Starts a brand-new run: re-initializes the producer, resets all accumulated metrics, begins scheduling. */
  start(settings: ProducerSettings, seed: number): void {
    this.cancelTimer();
    this.settings = settings;
    this.instrumentOrder = instrumentSymbols(settings.instrumentCount);
    this.accumulators = new Map();
    this.lastPublishAt = 0;

    try {
      this.producer.initialize(settings.instrumentCount, seed);
    } catch (error) {
      this.fail(error);
      return;
    }

    this.setStatus('running');
    this.publish(true);
    this.scheduleNext();
  }

  /** Stops scheduling new batches. Keeps all accumulated state so Resume can continue seamlessly. */
  pause(): void {
    if (this.status !== 'running') return;
    this.cancelTimer();
    this.setStatus('paused');
    this.publish(true);
  }

  /** Resumes scheduling with the current settings, without resetting any accumulated state. */
  resume(): void {
    if (this.status !== 'paused') return;
    this.setStatus('running');
    this.scheduleNext();
  }

  /** Permanently stops this controller and releases the underlying producer's resources. */
  dispose(): void {
    this.cancelTimer();
    try {
      this.producer.dispose();
    } catch {
      // Disposal errors are not actionable; proceed to mark the controller disposed regardless.
    }
    this.setStatus('disposed');
  }

  private scheduleNext(): void {
    const intervalMs = this.settings!.batchIntervalMs;
    this.timer = setTimeout(() => this.tick(), intervalMs);
  }

  private tick(): void {
    if (this.status !== 'running') return;

    try {
      const batch = this.producer.generateBatch(this.settings!.updatesPerBatch);
      this.accumulators = applyBatch(this.accumulators, batch);
      this.publish(false);
    } catch (error) {
      this.fail(error);
      return;
    }

    this.scheduleNext();
  }

  private publish(force: boolean): void {
    const now = Date.now();
    if (!force && now - this.lastPublishAt < PUBLISH_INTERVAL_MS) {
      return;
    }
    this.lastPublishAt = now;
    this.callbacks.onUpdate(toMetricsList(this.accumulators, this.instrumentOrder));
  }

  private fail(error: unknown): void {
    this.cancelTimer();
    this.setStatus('error');
    this.callbacks.onError(error instanceof Error ? error.message : String(error));
  }

  private setStatus(status: ProducerStatus): void {
    this.status = status;
    this.callbacks.onStatus(status);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
