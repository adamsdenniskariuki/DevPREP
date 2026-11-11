import { encode, decode } from './index'

const bytes = (...values: number[]) => Uint8Array.from(values)
const ascii = (text: string) => Uint8Array.from(text, ch => ch.charCodeAt(0))

export function testEncodesFullGroups() {
  assertEqual(encode(ascii('Man')), 'TWFu')
}

export function testPadsPartialGroups() {
  assertEqual(encode(ascii('Ma')), 'TWE=')
  assertEqual(encode(ascii('M')), 'TQ==')
  assertEqual(encode(ascii('')), '')
}

export function testUrlAlphabetWithoutPadding() {
  assertEqual(encode(bytes(0xfb, 0xff)), '+/8=')
  assertEqual(encode(bytes(0xfb, 0xff), true), '-_8')
}

export function testDecodesBothAlphabets() {
  assertEqual(Array.from(decode('TWFu')), Array.from(ascii('Man')))
  assertEqual(Array.from(decode('TQ==')), [77])
  assertEqual(Array.from(decode('-_8')), [0xfb, 0xff])
}

export function testRoundTripsEveryByte() {
  const all = Uint8Array.from({ length: 256 }, (_, i) => i)
  assertEqual(Array.from(decode(encode(all))), Array.from(all))
  assertEqual(Array.from(decode(encode(all, true))), Array.from(all))
}

export function testRejectsInvalidCharacters() {
  assertThrows(() => decode('ab$d'), 'invalid base64')
}
