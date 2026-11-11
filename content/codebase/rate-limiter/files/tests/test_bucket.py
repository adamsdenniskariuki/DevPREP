from limiter.bucket import TokenBucket
from limiter.clock import FakeClock


def test_allows_a_burst_up_to_capacity():
    bucket = TokenBucket(3, 1, FakeClock())
    assert [bucket.allow() for _ in range(4)] == [True, True, True, False]


def test_refills_over_time():
    clock = FakeClock()
    bucket = TokenBucket(2, 1, clock)
    bucket.allow()
    bucket.allow()
    clock.advance(1)
    assert bucket.allow()
    assert not bucket.allow()


def test_costly_requests():
    bucket = TokenBucket(5, 1, FakeClock())
    assert bucket.allow(4)
    assert not bucket.allow(2)
