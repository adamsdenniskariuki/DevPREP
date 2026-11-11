from inventory.orders import fulfil
from inventory.stock import OutOfStock, Stock


def make_stock():
    stock = Stock()
    stock.add("mug", 3)
    stock.add("bowl", 2)
    return stock


def test_fulfils_every_line():
    stock = make_stock()
    assert fulfil(stock, [("mug", 2), ("bowl", 1)]) == 3
    assert stock.quantity("mug") == 1
    assert stock.quantity("bowl") == 1


def test_short_order_moves_nothing():
    stock = make_stock()
    try:
        fulfil(stock, [("mug", 1), ("bowl", 5)])
    except OutOfStock:
        pass
    else:
        raise AssertionError("expected OutOfStock")
    assert stock.quantity("mug") == 3
    assert stock.quantity("bowl") == 2


def test_repeated_sku_is_checked_as_a_whole():
    stock = make_stock()
    try:
        fulfil(stock, [("mug", 2), ("mug", 2)])
    except OutOfStock:
        pass
    else:
        raise AssertionError("expected OutOfStock")
    assert stock.quantity("mug") == 3
