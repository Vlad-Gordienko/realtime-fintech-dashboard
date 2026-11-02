import { InstrumentMetrics, ProducerSettings, ProducerStatus } from './market.types';

/** Commands sent from the Angular main thread to the market Web Worker. */
export type WorkerCommand =
  | { type: 'INIT' }
  | { type: 'START'; runId: number; settings: ProducerSettings }
  | { type: 'PAUSE'; runId: number }
  | { type: 'RESUME'; runId: number }
  | { type: 'DISPOSE' };

/** Events sent from the market Web Worker back to the Angular main thread. */
export type WorkerEvent =
  | { type: 'READY' }
  | { type: 'STATUS'; runId: number; status: ProducerStatus }
  | { type: 'UPDATE'; runId: number; metrics: InstrumentMetrics[] }
  | { type: 'ERROR'; runId: number | null; message: string };
