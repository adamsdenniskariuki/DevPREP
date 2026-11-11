# Throttle

A token-bucket rate limiter for an API gateway.

Each caller gets a bucket holding up to `capacity` tokens. Every request spends tokens; the bucket refills at `rate` tokens per second, but never holds more than `capacity`. That allows short bursts while capping the long-run rate.

## Layout

- `limiter/clock.py` has `FakeClock`, so tests control time.
- `limiter/bucket.py` has `TokenBucket`.
- `limiter/registry.py` keeps one bucket per caller key.
- `tests/` has the suite. Every `test_*` function in a `tests/test_*.py` file is run.
