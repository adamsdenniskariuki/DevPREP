from limiter.bucket import TokenBucket
from limiter.clock import FakeClock


def close(a, b):
    return abs(a - b) < 1e-9


def test_zero_when_allowed_now():
    assert TokenBucket(3, 1, FakeClock()).retry_after() == 0


def test_accounts_for_cost_and_partial_refill():
    clock = FakeClock()
    bucket = TokenBucket(10, 2, clock)
    bucket.allow(10)
    clock.advance(1)
    assert close(bucket.retry_after(5), 1.5)


def test_waiting_that_long_is_enough():
    clock = FakeClock()
    bucket = TokenBucket(4, 3, clock)
    bucket.allow(4)
    wait = bucket.retry_after(2)
    clock.advance(wait)
    assert bucket.allow(2)


def test_does_not_spend_tokens():
    bucket = TokenBucket(3, 1, FakeClock())
    bucket.retry_after(3)
    assert bucket.allow(3)


def test_impossible_cost_is_rejected():
    try:
        TokenBucket(3, 1, FakeClock()).retry_after(4)
    except ValueError:
        return
    raise AssertionError("expected ValueError")
