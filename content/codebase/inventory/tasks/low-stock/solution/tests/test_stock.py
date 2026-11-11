from inventory.stock import OutOfStock, Stock


def test_add_and_remove():
    stock = Stock()
    stock.add("mug", 5)
    stock.remove("mug", 2)
    assert stock.quantity("mug") == 3


def test_unknown_sku_is_empty():
    assert Stock().quantity("lamp") == 0


def test_cannot_go_below_zero():
    stock = Stock()
    stock.add("mug", 1)
    try:
        stock.remove("mug", 2)
    except OutOfStock:
        pass
    else:
        raise AssertionError("expected OutOfStock")
    assert stock.quantity("mug") == 1


def test_low_lists_lowest_first():
    stock = Stock()
    stock.add("mug", 5)
    stock.add("bowl", 1)
    stock.add("cup", 2)
    assert stock.low(2) == [("bowl", 1), ("cup", 2)]
