"""Stock levels per SKU."""


class OutOfStock(Exception):
    """Raised when stock cannot cover a request."""


class Stock:
    def __init__(self):
        self._levels = {}

    def add(self, sku, quantity):
        if quantity <= 0:
            raise ValueError("quantity must be positive")
        self._levels[sku] = self._levels.get(sku, 0) + quantity

    def remove(self, sku, quantity):
        if quantity <= 0:
            raise ValueError("quantity must be positive")
        have = self._levels.get(sku, 0)
        if quantity > have:
            raise OutOfStock(f"{sku}: wanted {quantity}, have {have}")
        self._levels[sku] = have - quantity

    def quantity(self, sku):
        return self._levels.get(sku, 0)

    def skus(self):
        return sorted(self._levels)

    def low(self, threshold):
        """(sku, quantity) pairs at or below threshold, lowest first, ties by SKU."""
        if threshold < 0:
            raise ValueError("threshold must not be negative")
        rows = [(sku, level) for sku, level in self._levels.items() if level <= threshold]
        return sorted(rows, key=lambda row: (row[1], row[0]))
