import { Cart } from '../src/cart';

export function testSubtotalAndTotal() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450, 2);
  cart.add('pot', 'Teapot', 2100);
  assertEqual(cart.subtotal(), 3000);
  cart.applyCode('save10');
  assertEqual(cart.total(), 2700);
}

export function testRemove() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450);
  cart.remove('tea');
  assertEqual(cart.items().length, 0);
}

export function testUnknownCode() {
  assertThrows(() => new Cart().applyCode('FREE'), 'unknown code');
}

export function testReceipt() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450, 2);
  assertEqual(cart.receipt(), '2 x Tea  $9.00\nTotal  $9.00');
}

export function testShippingUnderThreshold() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450);
  assertEqual(cart.shipping(), 499);
  assertEqual(cart.grandTotal(), 949);
}
