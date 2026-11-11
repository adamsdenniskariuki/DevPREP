import { parseListQuery } from './index'

const SORTS = ['createdAt', 'name']

export function testDefaults() {
  assertEqual(parseListQuery('', SORTS), { ok: true, value: { limit: 20, sort: { field: 'createdAt', dir: 'asc' }, tags: [] } })
}

export function testParsesEverything() {
  assertEqual(parseListQuery('?limit=50&cursor=abc&sort=-name&tag=red&tag=blue', SORTS), {
    ok: true,
    value: { limit: 50, cursor: 'abc', sort: { field: 'name', dir: 'desc' }, tags: ['red', 'blue'] },
  })
}

export function testRejectsBadLimits() {
  for (const raw of ['0', '101', '2.5', 'ten', '']) {
    assertEqual(parseListQuery(`limit=${raw}`, SORTS), { ok: false, errors: ['limit must be an integer from 1 to 100'] }, raw)
  }
}

export function testRejectsUnknownSortField() {
  assertEqual(parseListQuery('sort=-password', SORTS), { ok: false, errors: ["sort field 'password' is not allowed"] })
}

export function testCollectsEveryError() {
  const result = parseListQuery('limit=500&sort=secret', SORTS)
  assertEqual(result.ok, false)
  if (!result.ok) assertEqual(result.errors.length, 2)
}

export function testEmptyCursorIsIgnored() {
  const result = parseListQuery('cursor=', SORTS)
  assert(result.ok && result.value.cursor === undefined, 'empty cursor should be undefined')
}
