export interface A11yNode {
  type: 'View' | 'Text' | 'Image' | 'Pressable'
  label?: string; role?: string; text?: string
  width?: number; height?: number; hitSlop?: number; decorative?: boolean
  children?: A11yNode[]
}

const MIN_TARGET = 44

function hasText(node: A11yNode): boolean {
  if (node.type === 'Text' && node.text && node.text.trim()) return true
  return (node.children ?? []).some(hasText)
}

export function auditA11y(root: A11yNode): string[] {
  const issues: string[] = []
  const visit = (node: A11yNode, path: string) => {
    if (node.type === 'Pressable') {
      if (!node.label && !hasText(node)) issues.push(`${path}: missing label`)
      if (!node.role) issues.push(`${path}: missing role`)
      const slop = (node.hitSlop ?? 0) * 2
      const small = (node.width !== undefined && node.width + slop < MIN_TARGET) || (node.height !== undefined && node.height + slop < MIN_TARGET)
      if (small) issues.push(`${path}: target too small`)
    }
    if (node.type === 'Image' && !node.label && !node.decorative) issues.push(`${path}: image needs label or decorative`)
    node.children?.forEach((child, index) => visit(child, `${path}>${child.type}[${index}]`))
  }
  visit(root, root.type)
  return issues
}
