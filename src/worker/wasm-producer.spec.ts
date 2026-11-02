import { readFileSync } from 'node:fs';
import { join } from 'node:path';

async function loadProducer(): Promise<WebAssembly.Instance> {
  const wasmPath = join(__dirname, '../wasm/generated/producer.wasm');
  const bytes = readFileSync(wasmPath);
  const module = await WebAssembly.compile(bytes);
  // AssemblyScript runtime imports env.abort; surface any abort as a test failure.
  const imports = {
    env: {
      abort: (message: number, file: number, line: number, column: number) => {
        throw new Error(`WASM abort(${message}, ${file}, ${line}, ${column})`);
      },
    },
  };
  return new WebAssembly.Instance(module, imports);
}

interface ProducerExports {
  initialize(instrumentCount: number, seed: number): void;
  generateBatch(batchSize: number): number;
  dispose(): void;
  getMaxBatchSize(): number;
  memory: WebAssembly.Memory;
}

function exportsOf(instance: WebAssembly.Instance): ProducerExports {
  return instance.exports as unknown as ProducerExports;
}

/** Copies `count` events out of WASM memory. Must be called right after generateBatch. */
function readEvents(exp: ProducerExports, pointer: number, count: number): number[][] {
  const flat = new Int32Array(exp.memory.buffer, pointer, count * 7);
  const events: number[][] = [];
  for (let i = 0; i < count; i++) {
    events.push(Array.from(flat.slice(i * 7, i * 7 + 7)));
  }
  return events;
}

// Field indexes within one event row.
const INSTRUMENT_ID = 0;
const PRICE_CENTS = 1;
const TRADE_QUANTITY = 2;
const BID_CENTS = 3;
const ASK_CENTS = 4;
const BID_QUANTITY = 5;
const ASK_QUANTITY = 6;

function generateEvents(exp: ProducerExports, count: number): number[][] {
  const pointer = exp.generateBatch(count);
  return readEvents(exp, pointer, count);
}

describe('wasm producer', () => {
  let exp: ProducerExports;

  beforeEach(async () => {
    exp = exportsOf(await loadProducer());
  });

  afterEach(() => {
    exp.dispose();
  });

  describe('batch generation', () => {
    it('returns exactly the requested number of events', () => {
      exp.initialize(5, 1);
      const pointer = exp.generateBatch(37);
      const flat = new Int32Array(exp.memory.buffer, pointer, 37 * 7);

      expect(flat.length).toBe(37 * 7);
      expect(flat.length / 7).toBe(37);
      expect(readEvents(exp, pointer, 37)).toHaveLength(37);
    });
  });

  describe('event invariants', () => {
    it('keeps instrumentId within [0, instrumentCount - 1]', () => {
      exp.initialize(5, 1);
      const events = [...generateEvents(exp, 100), ...generateEvents(exp, 100)];

      for (const event of events) {
        expect(event[INSTRUMENT_ID]).toBeGreaterThanOrEqual(0);
        expect(event[INSTRUMENT_ID]).toBeLessThanOrEqual(4);
      }
    });

    it('produces positive priceCents and bidCents', () => {
      exp.initialize(5, 1);
      const events = generateEvents(exp, 200);

      for (const event of events) {
        expect(event[PRICE_CENTS]).toBeGreaterThan(0);
        expect(event[BID_CENTS]).toBeGreaterThan(0);
      }
    });

    it('keeps askCents strictly greater than bidCents', () => {
      exp.initialize(5, 1);
      const events = generateEvents(exp, 200);

      for (const event of events) {
        expect(event[ASK_CENTS]).toBeGreaterThan(event[BID_CENTS]);
      }
    });

    it('produces positive tradeQuantity', () => {
      exp.initialize(5, 1);
      const events = generateEvents(exp, 200);

      for (const event of events) {
        expect(event[TRADE_QUANTITY]).toBeGreaterThan(0);
      }
    });

    it('keeps bidQuantity and askQuantity non-negative', () => {
      exp.initialize(5, 1);
      const events = generateEvents(exp, 200);

      for (const event of events) {
        expect(event[BID_QUANTITY]).toBeGreaterThanOrEqual(0);
        expect(event[ASK_QUANTITY]).toBeGreaterThanOrEqual(0);
      }
    });

    it('matches the trade price to either the bid or the ask', () => {
      exp.initialize(5, 1);
      const events = generateEvents(exp, 200);

      for (const event of events) {
        const matches = event[PRICE_CENTS] === event[BID_CENTS] || event[PRICE_CENTS] === event[ASK_CENTS];
        expect(matches).toBe(true);
      }
    });
  });

  describe('state and determinism', () => {
    it('carries PRNG state across consecutive generateBatch calls', async () => {
      const instance = exportsOf(await loadProducer());
      try {
        instance.initialize(5, 1);

        // Copy each batch out immediately: the buffer is overwritten on every call.
        const first = generateEvents(instance, 10);
        const second = generateEvents(instance, 10);

        expect(JSON.stringify(second)).not.toBe(JSON.stringify(first));
      } finally {
        instance.dispose();
      }
    });

    it('reproduces identical output for the same seed on independent instances', async () => {
      const a = exportsOf(await loadProducer());
      const b = exportsOf(await loadProducer());
      try {
        a.initialize(5, 777);
        b.initialize(5, 777);

        const eventsA = generateEvents(a, 20);
        const eventsB = generateEvents(b, 20);

        expect(eventsA).toEqual(eventsB);
      } finally {
        a.dispose();
        b.dispose();
      }
    });

    it('produces different output for different seeds', async () => {
      const a = exportsOf(await loadProducer());
      const b = exportsOf(await loadProducer());
      try {
        a.initialize(5, 1);
        b.initialize(5, 2);

        const eventsA = generateEvents(a, 20);
        const eventsB = generateEvents(b, 20);

        expect(JSON.stringify(eventsA)).not.toBe(JSON.stringify(eventsB));
      } finally {
        a.dispose();
        b.dispose();
      }
    });
  });

  describe('limits', () => {
    it('reports a max batch size of 1000', () => {
      expect(exp.getMaxBatchSize()).toBe(1000);
    });

    it('generates a full max-size batch with all invariants holding', () => {
      exp.initialize(10, 5);
      const events = generateEvents(exp, 1000);

      expect(events).toHaveLength(1000);
      for (const event of events) {
        expect(event[PRICE_CENTS]).toBeGreaterThan(0);
        expect(event[BID_CENTS]).toBeGreaterThan(0);
        expect(event[ASK_CENTS]).toBeGreaterThan(event[BID_CENTS]);
        expect(event[TRADE_QUANTITY]).toBeGreaterThan(0);
        expect(event[BID_QUANTITY]).toBeGreaterThanOrEqual(0);
        expect(event[ASK_QUANTITY]).toBeGreaterThanOrEqual(0);
        expect(event[PRICE_CENTS] === event[BID_CENTS] || event[PRICE_CENTS] === event[ASK_CENTS]).toBe(true);
      }
    });
  });
});
