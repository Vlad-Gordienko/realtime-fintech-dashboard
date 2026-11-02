import { signal } from '@angular/core';
import { vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';
import { MarketState } from '../market.types';

export function buildMarketState(overrides: Partial<MarketState> = {}): MarketState {
  return {
    status: 'running',
    activeRunId: 1,
    settings: DEFAULT_SETTINGS,
    instruments: [],
    error: null,
    ...overrides,
  };
}

export function createFakeMarketService(initialState: Partial<MarketState> = {}) {
  const stateSignal = signal<MarketState>(buildMarketState(initialState));
  return {
    state: stateSignal.asReadonly(),
    setState: (next: MarketState) => stateSignal.set(next),
    init: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    apply: vi.fn(),
    dispose: vi.fn(),
  };
}
