export function normalize(path: string): string {
  const absolute = path.startsWith('/')
  const stack: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (stack.length && stack[stack.length - 1] !== '..') stack.pop()
      else if (!absolute) stack.push('..')
    } else {
      stack.push(part)
    }
  }
  const joined = stack.join('/')
  if (absolute) return '/' + joined
  return joined || '.'
}

export function safeJoin(root: string, userPath: string): string {
  if (userPath.includes('\0') || userPath.startsWith('/')) throw new Error(`Path is outside root: ${userPath}`)
  const base = normalize(root)
  const target = normalize(`${base}/${userPath}`)
  const prefix = base === '/' ? '/' : base + '/'
  if (target !== base && !target.startsWith(prefix)) throw new Error(`Path is outside root: ${userPath}`)
  return target
}
