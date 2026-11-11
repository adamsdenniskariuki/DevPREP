from limiter.bucket import TokenBucket
from limiter.clock import FakeClock
from limiter.registry import Registry


def test_tokens_never_exceed_capacity():
    clock = FakeClock()
    bucket = TokenBucket(5, 2, clock)
    clock.advance(3600)
    assert bucket.tokens() == 5


def test_quiet_caller_gets_one_burst_only():
    clock = FakeClock()
    registry = Registry(2, 1, clock)
    registry.allow("alice")
    clock.advance(1000)
    assert [registry.allow("alice") for _ in range(3)] == [True, True, False]


def test_partial_refill_still_works():
    clock = FakeClock()
    bucket = TokenBucket(4, 2, clock)
    assert bucket.allow(4)
    clock.advance(0.5)
    assert bucket.tokens() == 1
