from limiter.clock import FakeClock
from limiter.registry import Registry


def test_keys_have_separate_buckets():
    registry = Registry(1, 1, FakeClock())
    assert registry.allow("alice")
    assert not registry.allow("alice")
    assert registry.allow("bob")
