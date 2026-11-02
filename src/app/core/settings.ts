import { ProducerSettings } from './market.types';

/** Default generator parameters used when the user has not changed anything. */
export const DEFAULT_SETTINGS: ProducerSettings = {
  instrumentCount: 5,
  updatesPerBatch: 100,
  batchIntervalMs: 500,
};

/** Inclusive min/max bounds for each user-configurable generator field. */
export const SETTINGS_BOUNDS: Readonly<Record<keyof ProducerSettings, { min: number; max: number }>> = {
  instrumentCount: { min: 1, max: 50 },
  updatesPerBatch: { min: 1, max: 1000 },
  batchIntervalMs: { min: 50, max: 2000 },
};
