"""One bucket per caller key (user id, API token, IP address)."""
from limiter.bucket import TokenBucket


class Registry:
    def __init__(self, capacity, rate, clock):
        self._capacity = capacity
        self._rate = rate
        self._clock = clock
        self._buckets = {}

    def bucket(self, key):
        if key not in self._buckets:
            self._buckets[key] = TokenBucket(self._capacity, self._rate, self._clock)
        return self._buckets[key]

    def allow(self, key, cost=1):
        return self.bucket(key).allow(cost)
