/** One generated market trade event + order book snapshot for a single instrument. */
export interface MarketUpdate {
  instrument: string;
  priceCents: number;
  tradeQuantity: number;
  bidCents: number;
  askCents: number;
  bidQuantity: number;
  askQuantity: number;
}

/** Aggregated, display-ready metrics for one instrument. All monetary/derived fields are null until the instrument has at least one event. */
export interface InstrumentMetrics {
  instrument: string;
  lastPriceCents: number | null;
  spreadCents: number | null;
  totalVolume: number;
  vwapCents: number | null;
  imbalance: number | null;
}

/**
 * Internal running-total state the aggregator keeps per instrument between batches.
 * totalVolume and totalPriceQuantity use bigint to avoid losing integer precision
 * over a long-running session (see Number.MAX_SAFE_INTEGER concerns).
 */
export interface InstrumentAccumulator {
  instrument: string;
  lastPriceCents: number | null;
  bidCents: number | null;
  askCents: number | null;
  bidQuantity: number | null;
  askQuantity: number | null;
  totalVolume: bigint;
  totalPriceQuantity: bigint;
}

/** User-configurable generator parameters. All fields are integers. */
export interface ProducerSettings {
  instrumentCount: number;
  updatesPerBatch: number;
  batchIntervalMs: number;
}

/** Lifecycle status of the generator/producer, mirrored in the UI. */
export type ProducerStatus =
  | 'initializing'
  | 'running'
  | 'paused'
  | 'error'
  | 'disposed';

/** Full reactive application state exposed by MarketService to the UI. */
export interface MarketState {
  status: ProducerStatus;
  activeRunId: number;
  settings: ProducerSettings;
  instruments: InstrumentMetrics[];
  error: string | null;
}
