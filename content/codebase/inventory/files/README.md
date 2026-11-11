# Stockroom

A tiny warehouse service. It keeps a stock level per SKU and fulfils customer orders against it.

## Layout

- `inventory/stock.py` holds `Stock`, which tracks how many units of each SKU are on the shelf.
- `inventory/orders.py` holds `fulfil()`, which takes an order's lines out of stock.
- `tests/` has the test suite. Every `test_*` function in a `tests/test_*.py` file is run.

## Rules

- Quantities are whole, positive numbers.
- Stock never goes below zero. Asking for more than is on the shelf raises `OutOfStock`.
- An order is all or nothing: if any line cannot be met, no stock moves.

## Running

Press **Run tests** to run the visible suite. **Submit** also runs the review tests.
