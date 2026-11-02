import type { Mock } from 'vitest';
import type { InstrumentMetrics, MarketUpdate, ProducerSettings, ProducerStatus } from '../app/core/market.types';
import type { ProducerAdapter } from './wasm-adapter';
import { ProducerController, ProducerControllerCallbacks } from './producer-controller';

interface FakeProducer extends ProducerAdapter {
  initializeCalls: Array<[number, number]>;
  generateBatchCalls: number[];
  disposed: boolean;
  failure: Error | null;
}

function createFakeProducer(): FakeProducer {
  let callCount = 0;
  const fake: FakeProducer = {
    initializeCalls: [],
    generateBatchCalls: [],
    disposed: false,
    failure: null,
    initialize(instrumentCount: number, seed: number) {
      fake.initializeCalls.push([instrumentCount, seed]);
    },
    generateBatch(batchSize: number): MarketUpdate[] {
      fake.generateBatchCalls.push(batchSize);
      if (fake.failure) {
        throw fake.failure;
      }
      callCount++;
      // One fake trade per call so accumulation is observable.
      return [
        {
          instrument: 'ALFA',
          priceCents: 10000 + callCount,
          tradeQuantity: 1,
          bidCents: 9990,
          askCents: 10010,
          bidQuantity: 10,
          askQuantity: 10,
        },
      ];
    },
    dispose() {
      fake.disposed = true;
    },
    getMaxBatchSize() {
      return 1000;
    },
  };
  return fake;
}

function createCallbacks() {
  const callbacks: ProducerControllerCallbacks = {
    onStatus: vi.fn<(status: ProducerStatus) => void>(),
    onUpdate: vi.fn<(metrics: InstrumentMetrics[]) => void>(),
    onError: vi.fn<(message: string) => void>(),
  };
  return callbacks as {
    onStatus: Mock<(status: ProducerStatus) => void>;
    onUpdate: Mock<(metrics: InstrumentMetrics[]) => void>;
    onError: Mock<(message: string) => void>;
  };
}

const SETTINGS: ProducerSettings = { instrumentCount: 2, updatesPerBatch: 5, batchIntervalMs: 100 };

describe('ProducerController', () => {
  let producer: FakeProducer;
  let callbacks: ReturnType<typeof createCallbacks>;
  let controller: ProducerController;

  beforeEach(() => {
    vi.useFakeTimers();
    producer = createFakeProducer();
    callbacks = createCallbacks();
    controller = new ProducerController(producer, callbacks);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('(a) start() initializes the producer, reports running, and publishes immediately', () => {
    controller.start(SETTINGS, 42);

    expect(producer.initializeCalls).toEqual([[2, 42]]);
    expect(callbacks.onStatus).toHaveBeenCalledWith('running');
    expect(controller.getStatus()).toBe('running');
    expect(callbacks.onUpdate).toHaveBeenCalled();
    expect(producer.generateBatchCalls.length).toBe(0);
  });

  it('(b) schedules batches sequentially on the configured interval', () => {
    controller.start(SETTINGS, 42);

    vi.advanceTimersByTime(100);
    expect(producer.generateBatchCalls).toEqual([5]);

    vi.advanceTimersByTime(100);
    expect(producer.generateBatchCalls.length).toBe(2);
  });

  it('(c) pause() stops scheduling and reports paused', () => {
    controller.start(SETTINGS, 42);
    vi.advanceTimersByTime(100);
    expect(producer.generateBatchCalls.length).toBe(1);

    controller.pause();
    expect(callbacks.onStatus).toHaveBeenCalledWith('paused');

    vi.advanceTimersByTime(1000);
    expect(producer.generateBatchCalls.length).toBe(1);
  });

  it('(d) resume() continues generation without re-initializing the producer', () => {
    controller.start(SETTINGS, 42);
    vi.advanceTimersByTime(100);
    controller.pause();
    const countWhilePaused = producer.generateBatchCalls.length;

    controller.resume();
    expect(callbacks.onStatus).toHaveBeenCalledWith('running');
    expect(producer.initializeCalls.length).toBe(1);

    vi.advanceTimersByTime(100);
    expect(producer.generateBatchCalls.length).toBe(countWhilePaused + 1);
  });

  it('(e) start() while running begins a fresh run with reset metrics', () => {
    controller.start(SETTINGS, 42);
    vi.advanceTimersByTime(200);
    expect(producer.generateBatchCalls.length).toBe(2);

    const freshSettings: ProducerSettings = { instrumentCount: 3, updatesPerBatch: 7, batchIntervalMs: 100 };
    callbacks.onUpdate.mockClear();
    controller.start(freshSettings, 7);

    expect(producer.initializeCalls).toEqual([
      [2, 42],
      [3, 7],
    ]);
    expect(callbacks.onUpdate).toHaveBeenCalled();

    const lastMetrics = callbacks.onUpdate.mock.calls.at(-1)![0] as InstrumentMetrics[];
    expect(lastMetrics.length).toBe(3);
    const alfa = lastMetrics.find((m) => m.instrument === 'ALFA')!;
    expect(alfa.totalVolume).toBe(0);
    expect(alfa.lastPriceCents).toBeNull();

    vi.advanceTimersByTime(100);
    expect(producer.generateBatchCalls.at(-1)).toBe(7);
  });

  it('(f) a generateBatch error reports error, stops scheduling, and does not retry', () => {
    controller.start(SETTINGS, 42);
    producer.failure = new Error('boom');

    vi.advanceTimersByTime(100);
    expect(callbacks.onStatus).toHaveBeenCalledWith('error');
    expect(callbacks.onError).toHaveBeenCalledWith(expect.stringContaining('boom'));
    expect(controller.getStatus()).toBe('error');

    const callsAfterError = producer.generateBatchCalls.length;
    vi.advanceTimersByTime(1000);
    expect(producer.generateBatchCalls.length).toBe(callsAfterError);
  });

  it('(g) dispose() reports disposed, releases the producer, and stops scheduling', () => {
    controller.start(SETTINGS, 42);

    controller.dispose();
    expect(callbacks.onStatus).toHaveBeenCalledWith('disposed');
    expect(controller.getStatus()).toBe('disposed');
    expect(producer.disposed).toBe(true);

    const callsAfterDispose = producer.generateBatchCalls.length;
    vi.advanceTimersByTime(1000);
    expect(producer.generateBatchCalls.length).toBe(callsAfterDispose);
  });

  it('(h) throttles onUpdate while still generating and aggregating every batch', () => {
    controller.start({ instrumentCount: 2, updatesPerBatch: 5, batchIntervalMs: 10 }, 42);
    const updatesBefore = callbacks.onUpdate.mock.calls.length;
    const batchesBefore = producer.generateBatchCalls.length;

    vi.advanceTimersByTime(50);

    expect(producer.generateBatchCalls.length - batchesBefore).toBe(5);
    expect(callbacks.onUpdate.mock.calls.length - updatesBefore).toBeLessThan(5);
  });
});
