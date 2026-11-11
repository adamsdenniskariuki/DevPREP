export interface LineSplitter {
  push(chunk: string): string[]
  end(): string[]
}

const trimCr = (line: string) => (line.endsWith('\r') ? line.slice(0, -1) : line)

export function createLineSplitter(): LineSplitter {
  let tail = ''
  return {
    push(chunk) {
      const parts = (tail + chunk).split('\n')
      tail = parts.pop()!
      return parts.map(trimCr)
    },
    end() {
      const rest = trimCr(tail)
      tail = ''
      return rest ? [rest] : []
    },
  }
}
