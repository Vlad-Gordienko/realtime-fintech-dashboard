import { WorkerCommand, WorkerEvent } from '../app/core/worker-protocol';
import { InstrumentMetrics, ProducerStatus } from '../app/core/market.types';
import { ProducerAdapter } from './wasm-adapter';
import { ProducerController, ProducerControllerCallbacks } from './producer-controller';

export interface WorkerRuntimeDeps {
  /** Loads and instantiates the WASM producer module. Injected so tests don't need a real WASM/fetch environment. */
  loadProducer(): Promise<ProducerAdapter>;
  /** Sends an event back to the main thread. Injected so tests don't need a real `postMessage`. */
  post(event: WorkerEvent): void;
}

export interface WorkerRuntime {
  handleCommand(command: WorkerCommand): void | Promise<void>;
}

/**
 * Pure, environment-agnostic Worker command dispatcher. Owns the ProducerController lifecycle and
 * runId bookkeeping (every outgoing event is tagged with the currently active runId, so the main
 * thread can defensively filter stale messages). Producer loading and message posting are injected,
 * so this is testable without a real Worker/self/fetch environment.
 */
export function createWorkerRuntime(deps: WorkerRuntimeDeps): WorkerRuntime {
  let controller: ProducerController | null = null;
  let activeRunId = 0;

  const callbacks: ProducerControllerCallbacks = {
    onStatus: (status: ProducerStatus) => deps.post({ type: 'STATUS', runId: activeRunId, status }),
    onUpdate: (metrics: InstrumentMetrics[]) => deps.post({ type: 'UPDATE', runId: activeRunId, metrics }),
    onError: (message: string) => deps.post({ type: 'ERROR', runId: activeRunId, message }),
  };

  async function handleInit(): Promise<void> {
    try {
      const producer = await deps.loadProducer();
      controller = new ProducerController(producer, callbacks);
      deps.post({ type: 'READY' });
    } catch (error) {
      deps.post({
        type: 'ERROR',
        runId: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  function handleStart(command: Extract<WorkerCommand, { type: 'START' }>): void {
    if (!controller) {
      deps.post({ type: 'ERROR', runId: command.runId, message: 'Producer not initialized' });
      return;
    }
    activeRunId = command.runId;
    controller.start(command.settings, command.runId);
  }

  function handlePause(command: Extract<WorkerCommand, { type: 'PAUSE' }>): void {
    if (!controller || command.runId !== activeRunId) return;
    controller.pause();
  }

  function handleResume(command: Extract<WorkerCommand, { type: 'RESUME' }>): void {
    if (!controller || command.runId !== activeRunId) return;
    controller.resume();
  }

  function handleDispose(): void {
    controller?.dispose();
    controller = null;
  }

  function handleCommand(command: WorkerCommand): void | Promise<void> {
    switch (command.type) {
      case 'INIT':
        return handleInit();
      case 'START':
        return handleStart(command);
      case 'PAUSE':
        return handlePause(command);
      case 'RESUME':
        return handleResume(command);
      case 'DISPOSE':
        return handleDispose();
    }
  }

  return { handleCommand };
}
