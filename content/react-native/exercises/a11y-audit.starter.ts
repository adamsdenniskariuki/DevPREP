export interface A11yNode {
  type: 'View' | 'Text' | 'Image' | 'Pressable'
  label?: string; role?: string; text?: string
  width?: number; height?: number; hitSlop?: number; decorative?: boolean
  children?: A11yNode[]
}

export function auditA11y(root: A11yNode): string[] {
  const issues: string[] = []
  // TODO: walk the whole tree
  if (root.type === 'Pressable' && !root.label) issues.push(`${root.type}: missing label`)
  return issues
}
