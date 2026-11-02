import type { InstrumentAccumulator, MarketUpdate } from '../app/core/market.types';
import {
  applyBatch,
  applyUpdate,
  createInitialAccumulator,
  toInstrumentMetrics,
  toMetricsList,
} from './market-aggregator';

function buildUpdate(overrides: Partial<MarketUpdate> = {}): MarketUpdate {
  return {
    instrument: 'ALFA',
    priceCents: 10000,
    tradeQuantity: 10,
    bidCents: 9990,
    askCents: 10010,
    bidQuantity: 100,
    askQuantity: 100,
    ...overrides,
  };
}

describe('market-aggregator', () => {
  describe('createInitialAccumulator / toInstrumentMetrics (initial state)', () => {
    it('reports the "before first trade" state for a fresh instrument', () => {
      const metrics = toInstrumentMetrics(createInitialAccumulator('ALFA'));

      expect(metrics).toEqual({
        instrument: 'ALFA',
        lastPriceCents: null,
        spreadCents: null,
        totalVolume: 0,
        vwapCents: null,
        imbalance: null,
      });
    });
  });

  describe('lastPriceCents', () => {
    it('reflects the price of the most recent update', () => {
      const first = applyUpdate(createInitialAccumulator('ALFA'), buildUpdate({ priceCents: 10000 }));
      expect(toInstrumentMetrics(first).lastPriceCents).toBe(10000);

      const second = applyUpdate(first, buildUpdate({ priceCents: 10200 }));
      expect(toInstrumentMetrics(second).lastPriceCents).toBe(10200);
    });
  });

  describe('spreadCents', () => {
    it('is askCents minus bidCents', () => {
      const acc = applyUpdate(
        createInitialAccumulator('ALFA'),
        buildUpdate({ bidCents: 9990, askCents: 10010 }),
      );

      expect(toInstrumentMetrics(acc).spreadCents).toBe(20);
    });
  });

  describe('totalVolume', () => {
    it('sums trade quantities across updates instead of overwriting them', () => {
      let acc = createInitialAccumulator('ALFA');
      acc = applyUpdate(acc, buildUpdate({ tradeQuantity: 10 }));
      acc = applyUpdate(acc, buildUpdate({ tradeQuantity: 30 }));

      expect(toInstrumentMetrics(acc).totalVolume).toBe(40);
    });
  });

  describe('vwapCents', () => {
    it('computes the volume-weighted average price from the spec example', () => {
      let acc = createInitialAccumulator('ALFA');
      acc = applyUpdate(acc, buildUpdate({ priceCents: 10000, tradeQuantity: 10 }));
      acc = applyUpdate(acc, buildUpdate({ priceCents: 10200, tradeQuantity: 30 }));

      const metrics = toInstrumentMetrics(acc);
      expect(metrics.lastPriceCents).toBe(10200);
      expect(metrics.totalVolume).toBe(40);
      expect(metrics.vwapCents).toBe(10150);
    });

    it('is null when no volume has traded', () => {
      const metrics = toInstrumentMetrics(createInitialAccumulator('ALFA'));

      expect(metrics.totalVolume).toBe(0);
      expect(metrics.vwapCents).toBeNull();
    });
  });

  describe('imbalance', () => {
    it('is positive when bid quantity exceeds ask quantity', () => {
      const acc = applyUpdate(
        createInitialAccumulator('ALFA'),
        buildUpdate({ bidQuantity: 150, askQuantity: 50 }),
      );

      expect(toInstrumentMetrics(acc).imbalance).toBeCloseTo(0.5, 10);
    });

    it('is negative when ask quantity exceeds bid quantity', () => {
      const acc = applyUpdate(
        createInitialAccumulator('ALFA'),
        buildUpdate({ bidQuantity: 50, askQuantity: 150 }),
      );

      expect(toInstrumentMetrics(acc).imbalance).toBeCloseTo(-0.5, 10);
    });

    it('is null when bid and ask quantities are both zero', () => {
      const acc = applyUpdate(
        createInitialAccumulator('ALFA'),
        buildUpdate({ bidQuantity: 0, askQuantity: 0 }),
      );

      expect(toInstrumentMetrics(acc).imbalance).toBeNull();
    });

  });

  describe('instrument independence (applyBatch)', () => {
    it('keeps ALFA and BETA totals separate', () => {
      const batch = [
        buildUpdate({ instrument: 'ALFA', priceCents: 10000, tradeQuantity: 5 }),
        buildUpdate({ instrument: 'BETA', priceCents: 20000, tradeQuantity: 7 }),
      ];

      const result = applyBatch(new Map(), batch);

      expect(result.get('ALFA')?.totalVolume).toBe(5n);
      expect(result.get('BETA')?.totalVolume).toBe(7n);
    });

    it('does not change BETA when only ALFA receives further updates', () => {
      const afterFirst = applyBatch(new Map(), [
        buildUpdate({ instrument: 'ALFA', priceCents: 10000, tradeQuantity: 5 }),
        buildUpdate({ instrument: 'BETA', priceCents: 20000, tradeQuantity: 7 }),
      ]);
      const betaBefore = afterFirst.get('BETA');
      const betaSnapshot = { ...betaBefore } as InstrumentAccumulator;

      const afterSecond = applyBatch(afterFirst, [
        buildUpdate({ instrument: 'ALFA', priceCents: 10500, tradeQuantity: 3 }),
      ]);

      expect(afterSecond.get('BETA')).toBe(betaBefore);
      expect(afterSecond.get('BETA')).toEqual(betaSnapshot);
      expect(afterSecond.get('ALFA')?.totalVolume).toBe(8n);
    });
  });

  describe('no double counting (applyBatch)', () => {
    const batch = [
      buildUpdate({ tradeQuantity: 2 }),
      buildUpdate({ tradeQuantity: 4 }),
      buildUpdate({ tradeQuantity: 6 }),
    ];

    it('counts each update in a batch exactly once when the same batch is applied in two separate calls', () => {
      const firstCall = applyBatch(new Map(), batch);
      const secondCall = applyBatch(new Map(), batch);

      expect(firstCall.get('ALFA')?.totalVolume).toBe(12n);
      expect(secondCall.get('ALFA')?.totalVolume).toBe(12n);
    });

    it('sums exactly the trade quantities of the batch for a single instrument', () => {
      const result = applyBatch(new Map(), batch);

      expect(result.get('ALFA')?.totalVolume).toBe(2n + 4n + 6n);
      expect(result.get('ALFA')?.totalVolume).not.toBe(24n);
    });
  });

  describe('toMetricsList', () => {
    it('fills instruments with no accumulator using the zero state, in the requested order', () => {
      const accumulators = applyBatch(new Map(), [
        buildUpdate({ instrument: 'ALFA', priceCents: 10000, tradeQuantity: 10 }),
      ]);

      const list = toMetricsList(accumulators, ['ALFA', 'BETA', 'GAMA']);

      expect(list).toHaveLength(3);
      expect(list.map((m) => m.instrument)).toEqual(['ALFA', 'BETA', 'GAMA']);

      expect(list[0]).toMatchObject({
        instrument: 'ALFA',
        lastPriceCents: 10000,
        totalVolume: 10,
      });

      for (const unseen of [list[1], list[2]]) {
        expect(unseen).toEqual({
          instrument: unseen.instrument,
          lastPriceCents: null,
          spreadCents: null,
          totalVolume: 0,
          vwapCents: null,
          imbalance: null,
        });
      }
    });
  });

  describe('immutability', () => {
    it('applyUpdate returns a new object and leaves the input accumulator unchanged', () => {
      const input = applyUpdate(createInitialAccumulator('ALFA'), buildUpdate({ tradeQuantity: 5 }));
      const before = { ...input };

      const output = applyUpdate(input, buildUpdate({ priceCents: 10500, tradeQuantity: 3 }));

      expect(output).not.toBe(input);
      expect(input).toEqual(before);
      expect(output.totalVolume).toBe(8n);
    });

    it('applyBatch does not mutate the input map', () => {
      const original = applyBatch(new Map(), [buildUpdate({ instrument: 'ALFA', tradeQuantity: 5 })]);
      const sizeBefore = original.size;
      const entriesBefore = [...original.entries()].map(([k, v]) => [k, { ...v }] as const);

      const result = applyBatch(original, [
        buildUpdate({ instrument: 'ALFA', tradeQuantity: 1 }),
        buildUpdate({ instrument: 'BETA', tradeQuantity: 1 }),
      ]);

      expect(result).not.toBe(original);
      expect(original.size).toBe(sizeBefore);
      expect([...original.entries()].map(([k, v]) => [k, { ...v }] as const)).toEqual(entriesBefore);
      expect(original.has('BETA')).toBe(false);
    });
  });
});
