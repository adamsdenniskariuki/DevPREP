function parts(version: string) {
  return version.split('.').map(part => Number.parseInt(part, 10) || 0)
}

/** Compares x.y.z versions: negative when a is older than b. */
export function compareVersions(a: string, b: string): number {
  const left = parts(a)
  const right = parts(b)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

/** Releases newer than `since` and no newer than `current`; falls back to the newest release up to current, or the newest. */
export function releasesSince<T extends { version: string }>(releases: readonly T[], current: string, since?: string): T[] {
  const upToCurrent = releases.filter(release => compareVersions(release.version, current) <= 0)
  const newer = since ? upToCurrent.filter(release => compareVersions(release.version, since) > 0) : []
  if (newer.length) return newer
  return upToCurrent.length ? [upToCurrent[0]] : releases.slice(0, 1)
}
