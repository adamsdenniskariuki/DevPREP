from inventory.orders import fulfil
from inventory.stock import OutOfStock, Stock


def test_split_lines_over_stock_leave_stock_untouched():
    stock = Stock()
    stock.add("mug", 3)
    stock.add("bowl", 4)
    try:
        fulfil(stock, [("bowl", 1), ("mug", 2), ("mug", 2)])
    except OutOfStock as error:
        assert "mug" in str(error)
    else:
        raise AssertionError("expected OutOfStock")
    assert stock.quantity("mug") == 3
    assert stock.quantity("bowl") == 4


def test_split_lines_within_stock_still_work():
    stock = Stock()
    stock.add("mug", 4)
    assert fulfil(stock, [("mug", 1), ("mug", 3)]) == 4
    assert stock.quantity("mug") == 0
