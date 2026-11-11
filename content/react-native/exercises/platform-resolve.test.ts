import { platformSelect, resolveModule } from './index'

export function testSpecificKeyWins() {
  assertEqual(platformSelect('ios', { ios: 1, native: 2, default: 3 }), 1)
  assertEqual(platformSelect('android', { ios: 1, native: 2, default: 3 }), 2)
  assertEqual(platformSelect('web', { ios: 1, native: 2, default: 3 }), 3)
}

export function testFalsyValuesCount() {
  assertEqual(platformSelect('android', { android: 0, default: 5 }), 0)
  assertEqual(platformSelect('ios', { ios: '', default: 'x' }), '')
}

export function testMissingDefault() {
  assertEqual(platformSelect('web', { ios: 1 }), undefined)
}

export function testResolveOrder() {
  const files = new Set(['./Button.android.tsx', './Button.native.tsx', './Button.tsx', './Icon.ts', './Map.native.ts', './Map.web.ts'])
  assertEqual(resolveModule('./Button', 'android', files), './Button.android.tsx')
  assertEqual(resolveModule('./Button', 'ios', files), './Button.native.tsx')
  assertEqual(resolveModule('./Button', 'web', files), './Button.tsx')
  assertEqual(resolveModule('./Icon', 'ios', files), './Icon.ts')
  assertEqual(resolveModule('./Map', 'web', files), './Map.web.ts')
  assertEqual(resolveModule('./Map', 'ios', files), './Map.native.ts')
  assertEqual(resolveModule('./Missing', 'ios', files), null)
}
