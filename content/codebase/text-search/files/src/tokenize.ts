const STOP_WORDS = new Set(['a', 'an', 'and', 'the', 'of', 'to', 'in', 'is']);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}
