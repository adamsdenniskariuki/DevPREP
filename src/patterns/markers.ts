const MARKER = /\s*(?:\/\/|#)@([a-z][a-z0-9-]*)\s*$/

/** Removes `//@key` and `#@key` line markers and returns the 1-based line of each key. */
export function stripMarkers(code: string): { code: string; lines: Record<string, number> } {
  const lines: Record<string, number> = {}
  const out = code.split('\n').map((line, index) => {
    const match = MARKER.exec(line)
    if (!match) return line
    lines[match[1]] = index + 1
    return line.slice(0, match.index)
  })
  return { code: out.join('\n'), lines }
}
