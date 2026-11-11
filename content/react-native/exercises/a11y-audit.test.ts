import { auditA11y } from './index'

export function testCleanTree() {
  assertEqual(auditA11y({
    type: 'View',
    children: [
      { type: 'Pressable', role: 'button', width: 48, height: 48, children: [{ type: 'Text', text: 'Save' }] },
      { type: 'Image', decorative: true },
      { type: 'Image', label: 'Profile photo' },
    ],
  }), [])
}

export function testIconButton() {
  assertEqual(auditA11y({ type: 'View', children: [{ type: 'Text', text: 'Title' }, { type: 'Pressable', width: 24, height: 24, children: [{ type: 'Image', decorative: true }] }] }), [
    'View>Pressable[1]: missing label',
    'View>Pressable[1]: missing role',
    'View>Pressable[1]: target too small',
  ])
}

export function testHitSlopAndEmptyText() {
  assertEqual(auditA11y({ type: 'Pressable', role: 'button', width: 24, height: 30, hitSlop: 10, children: [{ type: 'Text', text: '  ' }] }), ['Pressable: missing label'])
}

export function testNestedImages() {
  assertEqual(auditA11y({ type: 'View', children: [{ type: 'View', children: [{ type: 'Text' }, { type: 'Image' }] }] }), ['View>View[0]>Image[1]: image needs label or decorative'])
}
