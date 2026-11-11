"""Fulfilling orders against stock."""
from inventory.stock import OutOfStock


def fulfil(stock, lines):
    """Take every (sku, quantity) line out of stock, or none of them. Returns the units taken."""
    for sku, quantity in lines:
        if stock.quantity(sku) < quantity:
            raise OutOfStock(f"{sku}: wanted {quantity}, have {stock.quantity(sku)}")
    for sku, quantity in lines:
        stock.remove(sku, quantity)
    return sum(quantity for _, quantity in lines)
