import { createLineSplitter } from './index'

export function testSplitsCompleteLines() {
  const s = createLineSplitter()
  assertEqual(s.push('alpha\nbeta\n'), ['alpha', 'beta'])
  assertEqual(s.end(), [])
}

export function testKeepsPartialLinesBetweenChunks() {
  const s = createLineSplitter()
  assertEqual(s.push('GET /ind'), [])
  assertEqual(s.push('ex HTTP/1.1\nHost: a'), ['GET /index HTTP/1.1'])
  assertEqual(s.push('.test\n'), ['Host: a.test'])
}

export function testHandlesCrlfSplitAcrossChunks() {
  const s = createLineSplitter()
  assertEqual(s.push('one\r'), [])
  assertEqual(s.push('\ntwo\r\n'), ['one', 'two'])
}

export function testKeepsEmptyLines() {
  const s = createLineSplitter()
  assertEqual(s.push('a\n\nb\n'), ['a', '', 'b'])
}

export function testEndFlushesTheRemainder() {
  const s = createLineSplitter()
  s.push('first\nlast')
  assertEqual(s.end(), ['last'])
  assertEqual(s.end(), [])
}
