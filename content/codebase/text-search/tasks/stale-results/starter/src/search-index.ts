import { tokenize } from './tokenize';

export class SearchIndex {
  /** word -> (doc id -> occurrences) */
  private postings = new Map<string, Map<string, number>>();
  private docs = new Map<string, string[]>();

  add(id: string, text: string): void {
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

  search(query: string): string[] {
    const terms = tokenize(query);
    if (terms.length === 0) return [];
    let scores: Map<string, number> | null = null;
    for (const term of terms) {
      const posting = this.postings.get(term) ?? new Map<string, number>();
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
}
