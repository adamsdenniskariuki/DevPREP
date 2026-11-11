"""Clocks for the limiter. Tests use FakeClock so time only moves when they say so."""


class FakeClock:
    def __init__(self, start=0.0):
        self._now = float(start)

    def now(self):
        return self._now

    def advance(self, seconds):
        if seconds < 0:
            raise ValueError("time only moves forward")
        self._now += seconds
