import { itemLayout, visibleRange } from './index'

export function testItemLayout() {
  assertEqual(itemLayout(0, 50), { length: 50, offset: 0, index: 0 })
  assertEqual(itemLayout(7, 50), { length: 50, offset: 350, index: 7 })
}

export function testTopOfList() {
  assertEqual(visibleRange({ offset: 0, viewport: 200, itemHeight: 50, count: 100, overscan: 0 }), { first: 0, last: 3 })
}

export function testPartialRows() {
  assertEqual(visibleRange({ offset: 125, viewport: 200, itemHeight: 50, count: 100, overscan: 0 }), { first: 2, last: 6 })
}

export function testOverscanIsClamped() {
  assertEqual(visibleRange({ offset: 50, viewport: 100, itemHeight: 50, count: 100, overscan: 3 }), { first: 0, last: 5 })
  assertEqual(visibleRange({ offset: 4800, viewport: 200, itemHeight: 50, count: 100, overscan: 3 }), { first: 93, last: 99 })
}

export function testEmptyList() {
  assertEqual(visibleRange({ offset: 0, viewport: 200, itemHeight: 50, count: 0, overscan: 2 }), { first: 0, last: -1 })
}
