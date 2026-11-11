import { interpolate } from './index'

const fade = { inputRange: [0, 100], outputRange: [0, 1] }

export function testInsideRange() {
  assertEqual(interpolate(50, fade), 0.5)
  assertEqual(interpolate(0, fade), 0)
  assertEqual(interpolate(100, fade), 1)
}

export function testMultipleSegments() {
  const config = { inputRange: [0, 50, 100], outputRange: [0, 10, 0] }
  assertEqual(interpolate(25, config), 5)
  assertEqual(interpolate(75, config), 5)
  assertEqual(interpolate(-50, { inputRange: [-100, 0, 100], outputRange: [1, 0, 1] }), 0.5)
}

export function testExtrapolationModes() {
  assertEqual(interpolate(150, fade), 1.5)
  assertEqual(interpolate(-50, fade), -0.5)
  assertEqual(interpolate(150, { ...fade, extrapolate: 'clamp' }), 1)
  assertEqual(interpolate(-50, { ...fade, extrapolate: 'clamp' }), 0)
  assertEqual(interpolate(150, { ...fade, extrapolate: 'identity' }), 150)
  assertEqual(interpolate(-50, { ...fade, extrapolateLeft: 'clamp' }), 0)
  assertEqual(interpolate(150, { ...fade, extrapolateLeft: 'clamp' }), 1.5)
}

export function testFlatSegment() {
  assertEqual(interpolate(10, { inputRange: [0, 10, 10, 20], outputRange: [0, 1, 5, 6] }), 1)
}

export function testValidation() {
  assertThrows(() => interpolate(1, { inputRange: [10, 0], outputRange: [0, 1] }), /inputRange/)
  assertThrows(() => interpolate(1, { inputRange: [0, 1, 2], outputRange: [0, 1] }), /inputRange/)
}
