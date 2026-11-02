# Realtime Fintech Dashboard

Client-side Angular SPA simulating a financial market: live last price, spread,
volume, VWAP and order-book imbalance per instrument. No backend — trades are
generated locally by a WebAssembly producer running in a Web Worker.

## Architecture

```
Settings Apply / Pause / Resume
        │
        ▼
MarketService ─▶ Worker ─▶ WASM producer (PRNG, price evolution)
                   │
        aggregates every trade, throttled updates (~10/s)
                   ▼
        MarketService (Signals, runId filter) ─▶ Dashboard
```

Angular never touches WASM directly. One Worker for the app's lifetime.
Every run has a `runId`; stale messages from old runs are ignored. No trade
history is kept — only running per-instrument aggregates.

**Stack:** Angular 22 (Signals, Reactive Forms) · TypeScript · AssemblyScript → WebAssembly · Web Worker · Vitest

## Setup

```bash
npm install
cd wasm-producer && npm install && npm run asbuild && cd ..
npm start   # http://localhost:4200
```

Rebuild WASM (`cd wasm-producer && npm run asbuild`) after editing `wasm-producer/assembly/`.

```bash
npm run build   # production build
npm test        # unit tests
```

## Structure

```
src/app/core/            domain types, settings, MarketService
src/app/pages/           dashboard/, settings/
src/worker/              worker entry, scheduler, aggregator, wasm adapter
src/wasm/generated/      compiled producer.wasm
wasm-producer/assembly/  AssemblyScript source (generator, PRNG)
```

## Live demo

https://vlad-gordienko.github.io/realtime-fintech-dashboard/

## CI/CD

`.github/workflows/ci.yml` builds WASM, builds Angular, runs tests on every push.
