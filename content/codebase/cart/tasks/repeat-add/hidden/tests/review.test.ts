import { Cart } from '../src/cart';

export function testRepeatAddsAccumulate() {
  const cart = new Cart();
  cart.add('mug', 'Mug', 800);
  cart.add('mug', 'Mug', 800);
  cart.add('mug', 'Mug', 800, 2);
  assertEqual(cart.items(), [{ sku: 'mug', name: 'Mug', unitCents: 800, qty: 4 }]);
  assertEqual(cart.subtotal(), 3200);
}

export function testReceiptShowsCombinedLine() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450);
  cart.add('pot', 'Teapot', 2100);
  cart.add('tea', 'Tea', 450);
  assertEqual(cart.receipt(), '2 x Tea  $9.00\n1 x Teapot  $21.00\nTotal  $30.00');
}

export function testItemsAreCopies() {
  const cart = new Cart();
  cart.add('tea', 'Tea', 450);
  cart.items()[0].qty = 99;
  assertEqual(cart.subtotal(), 450);
}
