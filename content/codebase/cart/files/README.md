# Checkout

The shopping cart behind a small online shop. Prices are whole cents, so no floating-point money.

## Layout

- `src/money.ts` formats cents for display.
- `src/discounts.ts` turns a discount code into an amount off.
- `src/cart.ts` holds `Cart`: line items, discount, totals and the receipt text.
- `tests/` has the suite. Tests are exported `test*` functions in `tests/*.test.ts`. They use the global helpers `assert`, `assertEqual` and `assertThrows`.

## Rules

- Adding a SKU that is already in the cart increases its quantity.
- Codes are case-insensitive. Unknown codes are rejected.
- A total never goes below zero.
