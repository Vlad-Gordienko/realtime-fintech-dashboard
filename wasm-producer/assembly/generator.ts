import { Random } from "./random";

const MIN_SPREAD_CENTS: i32 = 1;
const MAX_SPREAD_CENTS: i32 = 50;
const MAX_PRICE_STEP_CENTS: i32 = 20;
const MIN_PRICE_CENTS: i32 = 100;
const MIN_TRADE_QTY: i32 = 1;
const MAX_TRADE_QTY: i32 = 500;
const MIN_BOOK_QTY: i32 = 0;
const MAX_BOOK_QTY: i32 = 1000;

/** Mutable per-instrument state: just the last traded price, carried between generated events. */
export class InstrumentState {
  instrumentId: i32;
  lastPriceCents: i32;

  constructor(instrumentId: i32, initialPriceCents: i32) {
    this.instrumentId = instrumentId;
    this.lastPriceCents = initialPriceCents;
  }
}

/** One generated trade event, in flat field form matching the wire/transport layout. */
export class GeneratedEvent {
  instrumentId: i32;
  priceCents: i32;
  tradeQuantity: i32;
  bidCents: i32;
  askCents: i32;
  bidQuantity: i32;
  askQuantity: i32;
}

/**
 * Generates one market event for `state`'s instrument, mutating `state.lastPriceCents`
 * to the new trade price, and returns the event. Guarantees:
 *   priceCents > 0, tradeQuantity > 0, bidCents > 0, askCents > bidCents,
 *   bidQuantity >= 0, askQuantity >= 0, priceCents == bidCents OR priceCents == askCents.
 */
export function generateEvent(state: InstrumentState, random: Random): GeneratedEvent {
  const step = random.nextInt(-MAX_PRICE_STEP_CENTS, MAX_PRICE_STEP_CENTS);
  let midCents = state.lastPriceCents + step;
  if (midCents < MIN_PRICE_CENTS) midCents = MIN_PRICE_CENTS;

  const spread = random.nextInt(MIN_SPREAD_CENTS, MAX_SPREAD_CENTS);
  let halfSpread = spread / 2;
  if (halfSpread <= 0) {
    halfSpread = 1;
  }
  let bidCents = midCents - halfSpread;
  if (bidCents < 1) {
    bidCents = 1;
  }
  let askCents = bidCents + spread;

  const tradeOnBid = random.nextInt(0, 1) == 0;
  const priceCents = tradeOnBid ? bidCents : askCents;

  const tradeQuantity = random.nextInt(MIN_TRADE_QTY, MAX_TRADE_QTY);
  const bidQuantity = random.nextInt(MIN_BOOK_QTY, MAX_BOOK_QTY);
  const askQuantity = random.nextInt(MIN_BOOK_QTY, MAX_BOOK_QTY);

  state.lastPriceCents = priceCents;

  const event = new GeneratedEvent();
  event.instrumentId = state.instrumentId;
  event.priceCents = priceCents;
  event.tradeQuantity = tradeQuantity;
  event.bidCents = bidCents;
  event.askCents = askCents;
  event.bidQuantity = bidQuantity;
  event.askQuantity = askQuantity;
  return event;
}
