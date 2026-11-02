import { MarketUpdate } from '../app/core/market.types';
import { instrumentSymbols } from '../app/core/instrument-symbols';

const FIELDS_PER_EVENT = 7;

interface ProducerExports {
  initialize(instrumentCount: number, seed: number): void;
  generateBatch(batchSize: number): number;
  dispose(): void;
  getMaxBatchSize(): number;
  memory: WebAssembly.Memory;
}

/** High-level, memory-layout-free wrapper around the compiled WASM producer module. */
export interface ProducerAdapter {
  /** (Re)initializes the generator with a fixed instrument count and PRNG seed. */
  initialize(instrumentCount: number, seed: number): void;
  /** Generates exactly `batchSize` MarketUpdate events, with instrumentId already resolved to string symbols. */
  generateBatch(batchSize: number): MarketUpdate[];
  /** Releases the WASM module's internal buffer. */
  dispose(): void;
  /** The maximum batchSize the module supports in one generateBatch call. */
  getMaxBatchSize(): number;
}

/** Compiles and instantiates the WASM module from raw bytes, returning a typed, symbol-resolving adapter. */
export async function instantiateProducer(wasmBytes: BufferSource): Promise<ProducerAdapter> {
  const module = await WebAssembly.compile(wasmBytes);
  const instance = new WebAssembly.Instance(module, {
    env: {
      abort: () => {
        throw new Error('wasm producer aborted');
      },
    },
  });
  const exports = instance.exports as unknown as ProducerExports;

  let symbols: string[] = [];

  return {
    initialize(instrumentCount: number, seed: number): void {
      symbols = instrumentSymbols(instrumentCount);
      exports.initialize(instrumentCount, seed);
    },

    generateBatch(batchSize: number): MarketUpdate[] {
      const pointer = exports.generateBatch(batchSize);
      const flat = new Int32Array(exports.memory.buffer, pointer, batchSize * FIELDS_PER_EVENT);

      const updates: MarketUpdate[] = new Array(batchSize);
      for (let i = 0; i < batchSize; i++) {
        const base = i * FIELDS_PER_EVENT;
        const instrumentId = flat[base];
        updates[i] = {
          instrument: symbols[instrumentId] ?? `UNKNOWN_${instrumentId}`,
          priceCents: flat[base + 1],
          tradeQuantity: flat[base + 2],
          bidCents: flat[base + 3],
          askCents: flat[base + 4],
          bidQuantity: flat[base + 5],
          askQuantity: flat[base + 6],
        };
      }
      return updates;
    },

    dispose(): void {
      exports.dispose();
    },

    getMaxBatchSize(): number {
      return exports.getMaxBatchSize();
    },
  };
}
