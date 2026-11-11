"""Fulfilling orders against stock."""
from inventory.stock import OutOfStock


def fulfil(stock, lines):
    """Take every (sku, quantity) line out of stock, or none of them. Returns the units taken."""
    wanted = {}
    for sku, quantity in lines:
        wanted[sku] = wanted.get(sku, 0) + quantity
    for sku, quantity in wanted.items():
        if stock.quantity(sku) < quantity:
            raise OutOfStock(f"{sku}: wanted {quantity}, have {stock.quantity(sku)}")
    for sku, quantity in wanted.items():
        stock.remove(sku, quantity)
    return sum(wanted.values())
