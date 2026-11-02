import type {
  InstrumentAccumulator,
  InstrumentMetrics,
  MarketUpdate,
} from '../app/core/market.types';

/** Creates the zeroed-out initial accumulator state for one instrument, before any trade has occurred. */
export function createInitialAccumulator(instrument: string): InstrumentAccumulator {
  return {
    instrument,
    lastPriceCents: null,
    bidCents: null,
    askCents: null,
    bidQuantity: null,
    askQuantity: null,
    totalVolume: 0n,
    totalPriceQuantity: 0n,
  };
}

/** Applies a single MarketUpdate to an instrument's accumulator and returns the NEW accumulator (do not mutate the input). */
export function applyUpdate(
  accumulator: InstrumentAccumulator,
  update: MarketUpdate,
): InstrumentAccumulator {
  // The caller is responsible for routing updates by instrument; `instrument` is kept from the accumulator.
  const tradeQuantity = BigInt(update.tradeQuantity);

  return {
    instrument: accumulator.instrument,
    lastPriceCents: update.priceCents,
    bidCents: update.bidCents,
    askCents: update.askCents,
    bidQuantity: update.bidQuantity,
    askQuantity: update.askQuantity,
    totalVolume: accumulator.totalVolume + tradeQuantity,
    totalPriceQuantity:
      accumulator.totalPriceQuantity + BigInt(update.priceCents) * tradeQuantity,
  };
}

/**
 * Applies a whole batch of MarketUpdates (in order) to a Map of per-instrument accumulators.
 * For each update, looks up (or lazily creates via createInitialAccumulator) the accumulator for update.instrument,
 * applies it, and stores the result back. Returns a NEW Map (do not mutate the input map).
 */
export function applyBatch(
  accumulators: ReadonlyMap<string, InstrumentAccumulator>,
  updates: readonly MarketUpdate[],
): Map<string, InstrumentAccumulator> {
  const next = new Map(accumulators);

  for (const update of updates) {
    const current = next.get(update.instrument) ?? createInitialAccumulator(update.instrument);
    next.set(update.instrument, applyUpdate(current, update));
  }

  return next;
}

/** Converts one instrument's accumulator into its display-ready InstrumentMetrics. */
export function toInstrumentMetrics(accumulator: InstrumentAccumulator): InstrumentMetrics {
  const spreadCents =
    accumulator.bidCents !== null && accumulator.askCents !== null
      ? accumulator.askCents - accumulator.bidCents
      : null;

  let vwapCents: number | null = null;
  if (accumulator.totalVolume !== 0n) {
    const quotient = accumulator.totalPriceQuantity / accumulator.totalVolume;
    const remainder = accumulator.totalPriceQuantity % accumulator.totalVolume;
    const rounded = remainder * 2n >= accumulator.totalVolume ? quotient + 1n : quotient;
    vwapCents = Number(rounded);
  }

  let imbalance: number | null = null;
  if (
    accumulator.bidQuantity !== null &&
    accumulator.askQuantity !== null &&
    accumulator.bidQuantity + accumulator.askQuantity !== 0
  ) {
    imbalance =
      (accumulator.bidQuantity - accumulator.askQuantity) /
      (accumulator.bidQuantity + accumulator.askQuantity);
  }

  return {
    instrument: accumulator.instrument,
    lastPriceCents: accumulator.lastPriceCents,
    spreadCents,
    totalVolume: Number(accumulator.totalVolume),
    vwapCents,
    imbalance,
  };
}

/**
 * Converts a full accumulators map into an ordered InstrumentMetrics[] following `instrumentOrder`
 * (the full configured list of instrument symbols, so that instruments with zero trades so far still
 * appear in the output using createInitialAccumulator's zero-state, converted via toInstrumentMetrics).
 */
export function toMetricsList(
  accumulators: ReadonlyMap<string, InstrumentAccumulator>,
  instrumentOrder: readonly string[],
): InstrumentMetrics[] {
  return instrumentOrder.map((symbol) =>
    toInstrumentMetrics(accumulators.get(symbol) ?? createInitialAccumulator(symbol)),
  );
}
