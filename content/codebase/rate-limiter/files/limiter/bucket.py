"""A token bucket: bursts up to capacity, refilling at rate tokens per second."""


class TokenBucket:
    def __init__(self, capacity, rate, clock):
        if capacity <= 0 or rate <= 0:
            raise ValueError("capacity and rate must be positive")
        self.capacity = capacity
        self.rate = rate
        self._clock = clock
        self._tokens = float(capacity)
        self._updated = clock.now()

    def _refill(self):
        now = self._clock.now()
        self._tokens = min(self.capacity, self._tokens + (now - self._updated) * self.rate)
        self._updated = now

    def tokens(self):
        self._refill()
        return self._tokens

    def allow(self, cost=1):
        self._refill()
        if cost <= self._tokens:
            self._tokens -= cost
            return True
        return False
