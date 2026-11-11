import { normalize, safeJoin } from './index'

export function testNormalizeCollapsesSegments() {
  assertEqual(normalize('/a//b/./c/../d/'), '/a/b/d')
  assertEqual(normalize('a/./b/..'), 'a')
}

export function testNormalizeEdgeCases() {
  assertEqual(normalize('/../x'), '/x')
  assertEqual(normalize('../a/../../b'), '../../b')
  assertEqual(normalize('./'), '.')
  assertEqual(normalize('/'), '/')
}

export function testSafeJoinInsideRoot() {
  assertEqual(safeJoin('/srv/uploads', 'photos/../cat.png'), '/srv/uploads/cat.png')
  assertEqual(safeJoin('/srv/uploads', '.'), '/srv/uploads')
}

export function testSafeJoinBlocksTraversal() {
  assertThrows(() => safeJoin('/srv/uploads', '../../etc/passwd'), 'outside root')
  assertThrows(() => safeJoin('/srv/uploads', 'a/../../uploads-old/x'), 'outside root')
}

export function testSafeJoinBlocksAbsoluteAndNullBytes() {
  assertThrows(() => safeJoin('/srv/uploads', '/etc/passwd'), 'outside root')
  assertThrows(() => safeJoin('/srv/uploads', 'a.png\0.txt'), 'outside root')
}
