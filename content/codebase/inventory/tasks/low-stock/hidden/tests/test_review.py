from inventory.stock import Stock


def make_stock():
    stock = Stock()
    stock.add("plate", 2)
    stock.add("bowl", 2)
    stock.add("mug", 9)
    stock.add("jug", 1)
    stock.remove("jug", 1)
    return stock


def test_low_includes_sold_out_skus():
    assert make_stock().low(0) == [("jug", 0)]


def test_low_breaks_ties_by_sku():
    assert make_stock().low(2) == [("jug", 0), ("bowl", 2), ("plate", 2)]


def test_low_threshold_is_inclusive_and_can_cover_everything():
    assert [sku for sku, _ in make_stock().low(9)] == ["jug", "bowl", "plate", "mug"]


def test_low_rejects_negative_threshold():
    try:
        make_stock().low(-1)
    except ValueError:
        return
    raise AssertionError("expected ValueError")


def test_low_on_empty_stock():
    assert Stock().low(5) == []
