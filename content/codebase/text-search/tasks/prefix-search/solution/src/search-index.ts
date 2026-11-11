import { tokenize } from './tokenize';

export class SearchIndex {
  /** word -> (doc id -> occurrences) */
  private postings = new Map<string, Map<string, number>>();
  private docs = new Map<string, string[]>();

  add(id: string, text: string): void {
    this.remove(id);
    const words = tokenize(text);
    this.docs.set(id, words);
    for (const word of words) {
      const posting = this.postings.get(word) ?? new Map<string, number>();
      posting.set(id, (posting.get(id) ?? 0) + 1);
      this.postings.set(word, posting);
    }
  }

  remove(id: string): void {
    const words = this.docs.get(id);
    if (!words) return;
    for (const word of new Set(words)) {
      const posting = this.postings.get(word);
      posting?.delete(id);
      if (posting && posting.size === 0) this.postings.delete(word);
    }
    this.docs.delete(id);
  }

  size(): number {
    return this.docs.size;
  }

  /** Documents containing every term. A term ending in * matches any word starting with it. */
  search(query: string): string[] {
    const terms = query
      .toLowerCase()
      .split(/\s+/)
      .flatMap((raw) => {
        const prefix = raw.endsWith('*');
        return tokenize(raw).map((word, index, all) => ({ word, prefix: prefix && index === all.length - 1 }));
      });
    if (terms.length === 0) return [];
    let scores: Map<string, number> | null = null;
    for (const term of terms) {
      const posting = this.matching(term.word, term.prefix);
      const next = new Map<string, number>();
      for (const [id, count] of posting) {
        if (scores === null || scores.has(id)) next.set(id, (scores?.get(id) ?? 0) + count);
      }
      scores = next;
    }
    return [...(scores ?? new Map<string, number>())]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => id);
  }

  /** Occurrences per doc for one word, or for every indexed word with that prefix. */
  private matching(word: string, prefix: boolean): Map<string, number> {
    if (!prefix) return this.postings.get(word) ?? new Map<string, number>();
    const merged = new Map<string, number>();
    for (const [indexed, posting] of this.postings) {
      if (!indexed.startsWith(word)) continue;
      for (const [id, count] of posting) merged.set(id, (merged.get(id) ?? 0) + count);
    }
    return merged;
  }
}
