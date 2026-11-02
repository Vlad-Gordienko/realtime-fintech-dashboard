import { TestBed } from '@angular/core/testing';
import { MarketService, WORKER_FACTORY, WorkerLike } from './market.service';
import { WorkerCommand, WorkerEvent } from './worker-protocol';
import { DEFAULT_SETTINGS } from './settings';
import { InstrumentMetrics, ProducerSettings } from './market.types';

function createFakeWorker() {
  const postMessage = vi.fn<(command: WorkerCommand) => void>();
  const fake: WorkerLike = {
    postMessage,
    onmessage: null,
    onerror: null,
  };
  return { fake, postMessage };
}

function emit(fake: WorkerLike, event: WorkerEvent): void {
  fake.onmessage?.({ data: event } as MessageEvent<WorkerEvent>);
}

function setup() {
  const { fake, postMessage } = createFakeWorker();
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [{ provide: WORKER_FACTORY, useValue: () => fake }],
  });
  const service = TestBed.inject(MarketService);
  return { service, fake, postMessage };
}

/** Runs init() and the READY handshake, so the service has auto-started run 1. */
function bootstrap() {
  const ctx = setup();
  ctx.service.init();
  emit(ctx.fake, { type: 'READY' });
  return ctx;
}

const ALFA_METRICS: InstrumentMetrics[] = [
  {
    instrument: 'ALFA',
    lastPriceCents: 10000,
    spreadCents: 20,
    totalVolume: 5,
    vwapCents: 10000,
    imbalance: 0.1,
  },
];

const NEW_SETTINGS: ProducerSettings = {
  instrumentCount: 3,
  updatesPerBatch: 50,
  batchIntervalMs: 200,
};

describe('MarketService', () => {
  it('init() sends INIT only once', () => {
    const { service, postMessage } = setup();

    service.init();
    service.init();

    const initCalls = postMessage.mock.calls.filter(([cmd]) => cmd.type === 'INIT');
    expect(initCalls).toHaveLength(1);
    expect(initCalls[0][0]).toEqual({ type: 'INIT' });
  });

  it('READY triggers auto-start with DEFAULT_SETTINGS and zeroed instruments', () => {
    const { service, fake, postMessage } = setup();
    service.init();

    emit(fake, { type: 'READY' });

    expect(postMessage).toHaveBeenLastCalledWith({
      type: 'START',
      runId: 1,
      settings: DEFAULT_SETTINGS,
    });
    const state = service.state();
    expect(state.activeRunId).toBe(1);
    expect(state.instruments).toHaveLength(DEFAULT_SETTINGS.instrumentCount);
    for (const metrics of state.instruments) {
      expect(metrics.lastPriceCents).toBeNull();
      expect(metrics.totalVolume).toBe(0);
    }
  });

  it('STATUS with matching runId updates status', () => {
    const { service, fake } = bootstrap();

    emit(fake, { type: 'STATUS', runId: 1, status: 'running' });

    expect(service.state().status).toBe('running');
  });

  it('STATUS with stale runId is ignored', () => {
    const { service, fake } = bootstrap();
    emit(fake, { type: 'STATUS', runId: 1, status: 'running' });

    emit(fake, { type: 'STATUS', runId: 999, status: 'paused' });

    expect(service.state().status).not.toBe('paused');
    expect(service.state().status).toBe('running');
  });

  it('UPDATE with matching runId replaces instrument metrics', () => {
    const { service, fake } = bootstrap();

    emit(fake, { type: 'UPDATE', runId: 1, metrics: ALFA_METRICS });

    expect(service.state().instruments).toEqual(ALFA_METRICS);
  });

  it('UPDATE with stale runId is ignored', () => {
    const { service, fake } = bootstrap();
    emit(fake, { type: 'UPDATE', runId: 1, metrics: ALFA_METRICS });

    emit(fake, { type: 'UPDATE', runId: 999, metrics: [] });

    expect(service.state().instruments).toEqual(ALFA_METRICS);
  });

  it('ERROR with null runId always applies', () => {
    const { service, fake } = setup();
    service.init();

    emit(fake, { type: 'ERROR', runId: null, message: 'wasm failed' });

    expect(service.state().status).toBe('error');
    expect(service.state().error).toBe('wasm failed');
  });

  it('ERROR with stale non-null runId is ignored', () => {
    const { service, fake } = bootstrap();

    emit(fake, { type: 'ERROR', runId: 999, message: 'old run failed' });

    expect(service.state().status).toBe('initializing');
    expect(service.state().error).toBeNull();
  });

  it('apply() starts a new run with a fresh runId, settings, and cleared error', () => {
    const { service, fake, postMessage } = bootstrap();
    emit(fake, { type: 'ERROR', runId: null, message: 'wasm failed' });

    service.apply(NEW_SETTINGS);

    expect(postMessage).toHaveBeenLastCalledWith({
      type: 'START',
      runId: 2,
      settings: NEW_SETTINGS,
    });
    const state = service.state();
    expect(state.activeRunId).toBe(2);
    expect(state.settings).toEqual(NEW_SETTINGS);
    expect(state.instruments).toHaveLength(3);
    expect(state.error).toBeNull();
  });

  it('events from the old run after apply() are ignored', () => {
    const { service, fake } = bootstrap();
    service.apply(NEW_SETTINGS);
    const statusBefore = service.state().status;

    emit(fake, { type: 'STATUS', runId: 1, status: 'paused' });

    expect(service.state().status).not.toBe('paused');
    expect(service.state().status).toBe(statusBefore);
  });

  it('pause() and resume() send the current runId', () => {
    const { service, postMessage } = bootstrap();
    service.apply(NEW_SETTINGS);

    service.pause();
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'PAUSE', runId: 2 });

    service.resume();
    expect(postMessage).toHaveBeenLastCalledWith({ type: 'RESUME', runId: 2 });
  });

  it('pause() and resume() are no-ops before any run exists', () => {
    const { service, postMessage } = setup();

    service.pause();
    service.resume();

    const controlCalls = postMessage.mock.calls.filter(
      ([cmd]) => cmd.type === 'PAUSE' || cmd.type === 'RESUME',
    );
    expect(controlCalls).toHaveLength(0);
  });

  it('dispose() sends DISPOSE', () => {
    const { service, postMessage } = bootstrap();

    service.dispose();

    expect(postMessage).toHaveBeenLastCalledWith({ type: 'DISPOSE' });
  });
});
