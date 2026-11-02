import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { instantiateProducer, ProducerAdapter } from './wasm-adapter';
import { instrumentSymbols } from '../app/core/instrument-symbols';

function loadWasmBytes(): Uint8Array<ArrayBuffer> {
  return new Uint8Array(readFileSync(join(__dirname, '../wasm/generated/producer.wasm'))) as Uint8Array<ArrayBuffer>;
}

describe('wasm adapter', () => {
  let adapter: ProducerAdapter;

  beforeEach(async () => {
    adapter = await instantiateProducer(loadWasmBytes());
  });

  afterEach(() => {
    adapter.dispose();
  });

  it('returns exactly batchSize MarketUpdate objects', () => {
    adapter.initialize(5, 42);
    const updates = adapter.generateBatch(10);

    expect(Array.isArray(updates)).toBe(true);
    expect(updates).toHaveLength(10);
  });

  it('resolves every instrument to a string symbol from instrumentSymbols(5)', () => {
    adapter.initialize(5, 42);
    const symbols = instrumentSymbols(5);
    const updates = adapter.generateBatch(10);

    for (const update of updates) {
      expect(typeof update.instrument).toBe('string');
      expect(update.instrument.length).toBeGreaterThan(0);
      expect(symbols).toContain(update.instrument);
    }
  });

  it('keeps every field within the MarketUpdate invariants', () => {
    adapter.initialize(5, 42);
    const updates = adapter.generateBatch(200);

    for (const update of updates) {
      expect(update.priceCents).toBeGreaterThan(0);
      expect(update.tradeQuantity).toBeGreaterThan(0);
      expect(update.bidCents).toBeGreaterThan(0);
      expect(update.askCents).toBeGreaterThan(update.bidCents);
      expect(update.bidQuantity).toBeGreaterThanOrEqual(0);
      expect(update.askQuantity).toBeGreaterThanOrEqual(0);
      expect(update.priceCents === update.bidCents || update.priceCents === update.askCents).toBe(true);
    }
  });

  it('advances state between consecutive generateBatch calls', () => {
    adapter.initialize(5, 42);
    const first = adapter.generateBatch(10);
    const second = adapter.generateBatch(10);

    expect(second).not.toEqual(first);
  });

  it('reports a max batch size of 1000', () => {
    expect(adapter.getMaxBatchSize()).toBe(1000);
  });

  it('uses only the symbols for the configured instrument count', async () => {
    adapter.initialize(3, 7);
    const allowed = ['ALFA', 'BETA', 'GAMA'];
    const updates = adapter.generateBatch(300);

    for (const update of updates) {
      expect(allowed).toContain(update.instrument);
      expect(update.instrument).not.toBe('DELTA');
      expect(update.instrument).not.toBe('OMEGA');
      expect(update.instrument.startsWith('UNKNOWN_')).toBe(false);
    }
  });
});
