export interface LineSplitter {
  push(chunk: string): string[]
  end(): string[]
}

export function createLineSplitter(): LineSplitter {
  return {
    // TODO: keep partial lines between chunks.
    push: chunk => chunk.split('\n').filter(line => line !== ''),
    end: () => [],
  }
}
