import { utf8Encode, byteLength } from './index'

const hex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(' ')

export function testAscii() {
  assertEqual(hex(utf8Encode('Hi!')), '48 69 21')
  assertEqual(byteLength('Hi!'), 3)
}

export function testTwoAndThreeByteCharacters() {
  assertEqual(hex(utf8Encode('é')), 'c3 a9')
  assertEqual(hex(utf8Encode('€')), 'e2 82 ac')
  assertEqual(byteLength('héllo'), 6)
}

export function testSurrogatePairsBecomeFourBytes() {
  const rocket = String.fromCodePoint(0x1f680)
  assertEqual(rocket.length, 2)
  assertEqual(hex(utf8Encode(rocket)), 'f0 9f 9a 80')
  assertEqual(byteLength(`go ${rocket}`), 7)
}

export function testLoneSurrogateBecomesReplacement() {
  assertEqual(hex(utf8Encode('a\ud800b')), '61 ef bf bd 62')
  assertEqual(byteLength('\udc00'), 3)
}

export function testEmptyString() {
  assertEqual(utf8Encode('').length, 0)
  assertEqual(byteLength(''), 0)
}
