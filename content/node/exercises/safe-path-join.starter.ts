export function normalize(path: string): string {
  // TODO: handle '.', '..' and repeated slashes properly.
  return path.replace(/\/+/g, '/')
}

export function safeJoin(root: string, userPath: string): string {
  return normalize(`${root}/${userPath}`)
}
