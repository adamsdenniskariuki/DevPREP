import { formatCents } from '../src/money';
import { discountFor, parseCode } from '../src/discounts';

export function testFormatsCents() {
  assertEqual(formatCents(1205), '$12.05');
  assertEqual(formatCents(7), '$0.07');
}

export function testCodesAreCaseInsensitive() {
  assertEqual(parseCode(' save10 '), 'SAVE10');
  assertEqual(parseCode('BOGUS'), null);
}

export function testFlatDiscountNeverExceedsSubtotal() {
  assertEqual(discountFor('FLAT5', 300), 300);
}
