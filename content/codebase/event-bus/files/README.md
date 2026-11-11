# Signals

A tiny in-process event bus used by a front-end app to decouple widgets.

## Layout

- `src/bus.ts` holds `EventBus`: `on`, `once`, `off`, `emit` and `count`.
- `src/recorder.ts` is a test helper that records what a bus emitted.
- `src/index.ts` re-exports the public API.
- `tests/` has the suite. Tests are exported `test*` functions in `tests/*.test.ts`. They use the global helpers `assert`, `assertEqual` and `assertThrows`.

## Rules

- Handlers run in the order they were added.
- `emit` returns how many handlers it called.
- A `once` handler runs on the next emit only, then removes itself.
