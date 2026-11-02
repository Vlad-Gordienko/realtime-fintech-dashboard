import { createWorkerRuntime } from './market-worker-runtime';
import { instantiateProducer } from './wasm-adapter';

declare const self: DedicatedWorkerGlobalScope;

const runtime = createWorkerRuntime({
  async loadProducer() {
    const response = await fetch(new URL('wasm/generated/producer.wasm', self.location.href));
    const bytes = await response.arrayBuffer();
    return instantiateProducer(bytes);
  },
  post(event) {
    self.postMessage(event);
  },
});

self.addEventListener('message', (messageEvent: MessageEvent) => {
  void runtime.handleCommand(messageEvent.data);
});
