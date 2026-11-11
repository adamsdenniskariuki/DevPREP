import { compare, satisfies } from './index'

export function testComparesNumerically() {
  assertEqual(compare('1.10.0', '1.9.0'), 1)
  assertEqual(compare('2.0.0', '10.0.0'), -1)
  assertEqual(compare('1.2.3', '1.2.3'), 0)
}

export function testPreReleasesAreLower() {
  assertEqual(compare('1.0.0-alpha', '1.0.0'), -1)
  assertEqual(compare('1.0.0-alpha.1', '1.0.0-alpha'), 1)
  assertEqual(compare('1.0.0-alpha.2', '1.0.0-alpha.10'), -1)
  assertEqual(compare('1.0.0-2', '1.0.0-beta'), -1)
  assertEqual(compare('1.0.0-beta', '1.0.0-alpha.9'), 1)
}

export function testCaretRanges() {
  assert(satisfies('1.9.9', '^1.2.3'))
  assert(!satisfies('2.0.0', '^1.2.3'))
  assert(!satisfies('1.2.2', '^1.2.3'))
  assert(satisfies('0.2.9', '^0.2.3'))
  assert(!satisfies('0.3.0', '^0.2.3'))
  assert(!satisfies('0.0.4', '^0.0.3'))
}

export function testTildeRanges() {
  assert(satisfies('1.2.9', '~1.2.3'))
  assert(!satisfies('1.3.0', '~1.2.3'))
}

export function testComparatorSets() {
  assert(satisfies('18.19.0', '>=18.0.0 <21.0.0'))
  assert(!satisfies('21.0.0', '>=18.0.0 <21.0.0'))
  assert(satisfies('3.1.4', '3.1.4'))
  assert(!satisfies('3.1.5', '3.1.4'))
  assert(satisfies('5.0.0', '>4.9.9'))
  assert(satisfies('5.0.0', '<=5.0.0'))
}
