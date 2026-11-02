import { Random } from "./random";
import { InstrumentState, generateEvent } from "./generator";

/** Each event is 7 consecutive int32 fields: instrumentId, priceCents, tradeQuantity, bidCents, askCents, bidQuantity, askQuantity. */
const FIELDS_PER_EVENT: i32 = 7;

/** Upper bound on batch size this module will ever be asked to generate (matches the app's "Updates per batch" max setting). */
const MAX_BATCH_SIZE: i32 = 1000;

const BUFFER_BYTES: i32 = MAX_BATCH_SIZE * FIELDS_PER_EVENT * 4;

let instruments: InstrumentState[] = [];
let random: Random = new Random(1);
let bufferPointer: usize = 0;

/**
 * (Re)initializes the producer: allocates the output buffer once (reused across calls),
 * creates `instrumentCount` instruments with deterministic starting prices, and seeds the PRNG.
 * Safe to call multiple times (e.g. on Apply with new settings) — re-seeds and resets instrument state each time.
 */
export function initialize(instrumentCount: i32, seed: i32): void {
  if (bufferPointer == 0) {
    bufferPointer = heap.alloc(BUFFER_BYTES);
  }

  random = new Random(<u32>seed);

  instruments = new Array<InstrumentState>(instrumentCount);
  for (let i = 0; i < instrumentCount; i++) {
    // Deterministic, spread-out starting price per instrument index so instruments don't all start identical.
    const startPriceCents: i32 = 5000 + (i * 137) % 20000;
    instruments[i] = new InstrumentState(i, startPriceCents);
  }
}

/**
 * Generates exactly `batchSize` events (batchSize must be <= getMaxBatchSize()), writing them into the
 * reusable internal buffer, and returns the buffer's pointer. The buffer is overwritten on every call —
 * the caller must read out the data before calling generateBatch again. Instrument is picked uniformly
 * at random per event (an instrument may appear more than once per batch, or not at all).
 */
export function generateBatch(batchSize: i32): usize {
  const instrumentCount = instruments.length;
  for (let i = 0; i < batchSize; i++) {
    const instrumentIndex = random.nextInt(0, instrumentCount - 1);
    const event = generateEvent(instruments[instrumentIndex], random);

    const offset: usize = bufferPointer + <usize>(i * FIELDS_PER_EVENT * 4);
    store<i32>(offset, event.instrumentId);
    store<i32>(offset + 4, event.priceCents);
    store<i32>(offset + 8, event.tradeQuantity);
    store<i32>(offset + 12, event.bidCents);
    store<i32>(offset + 16, event.askCents);
    store<i32>(offset + 20, event.bidQuantity);
    store<i32>(offset + 24, event.askQuantity);
  }
  return bufferPointer;
}

/** Releases the internal buffer and clears instrument state. Safe to call even if initialize() was never called. */
export function dispose(): void {
  if (bufferPointer != 0) {
    heap.free(bufferPointer);
    bufferPointer = 0;
  }
  instruments = [];
}

/** The maximum batchSize that generateBatch() supports (the internal buffer is sized for exactly this many events). */
export function getMaxBatchSize(): i32 {
  return MAX_BATCH_SIZE;
}
