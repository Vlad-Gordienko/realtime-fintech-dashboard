import type { Mock } from 'vitest';
import type { MarketUpdate, ProducerSettings } from '../app/core/market.types';
import type { WorkerEvent } from '../app/core/worker-protocol';
import type { ProducerAdapter } from './wasm-adapter';
import { createWorkerRuntime } from './market-worker-runtime';

const SETTINGS: ProducerSettings = { instrumentCount: 2, updatesPerBatch: 5, batchIntervalMs: 500 };

function createFakeProducer(): ProducerAdapter {
  return {
    initialize: vi.fn(),
    generateBatch(): MarketUpdate[] {
      return [
        {
          instrument: 'ALFA',
          priceCents: 10000,
          tradeQuantity: 1,
          bidCents: 9990,
          askCents: 10010,
          bidQuantity: 10,
          askQuantity: 10,
        },
      ];
    },
    dispose: vi.fn(),
    getMaxBatchSize: vi.fn(() => 1000),
  };
}

function postedEvents(post: Mock<(event: WorkerEvent) => void>): WorkerEvent[] {
  return post.mock.calls.map((call) => call[0] as WorkerEvent);
}

describe('createWorkerRuntime', () => {
  let producer: ProducerAdapter;
  let post: Mock<(event: WorkerEvent) => void>;

  beforeEach(() => {
    vi.useFakeTimers();
    producer = createFakeProducer();
    post = vi.fn<(event: WorkerEvent) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('posts READY after a successful INIT', async () => {
    const loadProducer = vi.fn().mockResolvedValue(producer);
    const runtime = createWorkerRuntime({ loadProducer, post });

    await runtime.handleCommand({ type: 'INIT' });

    expect(loadProducer).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith({ type: 'READY' });
  });

  it('posts ERROR with null runId when INIT fails', async () => {
    const loadProducer = vi.fn().mockRejectedValue(new Error('wasm load failed'));
    const runtime = createWorkerRuntime({ loadProducer, post });

    await runtime.handleCommand({ type: 'INIT' });

    expect(post).toHaveBeenCalledWith({ type: 'ERROR', runId: null, message: 'wasm load failed' });
    expect(post).not.toHaveBeenCalledWith({ type: 'READY' });
  });

  it('emits running STATUS and an UPDATE with one entry per instrument on START', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });

    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });

    expect(post).toHaveBeenCalledWith({ type: 'STATUS', runId: 1, status: 'running' });
    const update = postedEvents(post).find((event) => event.type === 'UPDATE');
    expect(update).toBeDefined();
    expect(update).toMatchObject({ type: 'UPDATE', runId: 1 });
    expect((update as Extract<WorkerEvent, { type: 'UPDATE' }>).metrics).toHaveLength(2);
  });

  it('posts "Producer not initialized" when START is sent before INIT', () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });

    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });

    expect(post).toHaveBeenCalledWith({ type: 'ERROR', runId: 1, message: 'Producer not initialized' });
  });

  it('pauses the run when PAUSE has the matching runId', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });
    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });

    runtime.handleCommand({ type: 'PAUSE', runId: 1 });

    expect(post).toHaveBeenCalledWith({ type: 'STATUS', runId: 1, status: 'paused' });
  });

  it('ignores PAUSE with a stale runId', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });
    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });
    const callsBefore = post.mock.calls.length;

    runtime.handleCommand({ type: 'PAUSE', runId: 999 });

    expect(post.mock.calls.length).toBe(callsBefore);
    const pausedEvents = postedEvents(post).filter(
      (event) => event.type === 'STATUS' && event.status === 'paused',
    );
    expect(pausedEvents).toHaveLength(0);
  });

  it('resumes the run when RESUME has the matching runId after a pause', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });
    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });
    runtime.handleCommand({ type: 'PAUSE', runId: 1 });

    runtime.handleCommand({ type: 'RESUME', runId: 1 });

    expect(post).toHaveBeenLastCalledWith({ type: 'STATUS', runId: 1, status: 'running' });
  });

  it('rejects START after DISPOSE because the controller was cleared', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });
    runtime.handleCommand({ type: 'DISPOSE' });

    runtime.handleCommand({ type: 'START', runId: 2, settings: SETTINGS });

    expect(post).toHaveBeenLastCalledWith({ type: 'ERROR', runId: 2, message: 'Producer not initialized' });
  });

  it('tags events from a second START with the new runId', async () => {
    const runtime = createWorkerRuntime({ loadProducer: vi.fn().mockResolvedValue(producer), post });
    await runtime.handleCommand({ type: 'INIT' });
    runtime.handleCommand({ type: 'START', runId: 1, settings: SETTINGS });
    post.mockClear();

    runtime.handleCommand({ type: 'START', runId: 2, settings: { instrumentCount: 3, updatesPerBatch: 2, batchIntervalMs: 250 } });

    const events = postedEvents(post);
    expect(events).toContainEqual({ type: 'STATUS', runId: 2, status: 'running' });
    expect(events.some((event) => 'runId' in event && event.runId === 1)).toBe(false);
    const update = events.find((event) => event.type === 'UPDATE') as Extract<WorkerEvent, { type: 'UPDATE' }>;
    expect(update.runId).toBe(2);
    expect(update.metrics).toHaveLength(3);
  });
});
