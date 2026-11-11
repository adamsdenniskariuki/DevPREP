import { Cart } from '../src/cart';

function cartOf(cents: number) {
  const cart = new Cart();
  cart.add('item', 'Item', cents);
  return cart;
}

export function testEmptyCartShipsFree() {
  assertEqual(new Cart().shipping(), 0);
  assertEqual(new Cart().grandTotal(), 0);
}

export function testThresholdIsInclusive() {
  assertEqual(cartOf(5000).shipping(), 0);
  assertEqual(cartOf(4999).shipping(), 499);
}

export function testDiscountCanBringShippingBack() {
  const cart = cartOf(5200);
  assertEqual(cart.shipping(), 0);
  cart.applyCode('SAVE10');
  assertEqual(cart.total(), 4680);
  assertEqual(cart.shipping(), 499);
  assertEqual(cart.grandTotal(), 5179);
}

export function testTotalIsUnchanged() {
  assertEqual(cartOf(1000).total(), 1000);
}
