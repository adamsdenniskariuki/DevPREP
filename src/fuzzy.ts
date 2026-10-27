/* A small fuzzy matcher for the command palette: no dependencies, tuned for short titles. */

const normalise = (text: string) => text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
const isWordChar = (char: string | undefined) => !!char && /[a-z0-9]/.test(char)
/** A word starts at the beginning of the text or after any character that is not a letter or digit. */
const wordStart = (text: string, at: number) => isWordChar(text[at]) && !isWordChar(text[at - 1])

/** Scores one query word against the text, or returns null when its letters do not all appear in order. */
function scoreToken(token: string, text: string): number | null {
  let from = text.indexOf(token)
  if (from >= 0) {
    // A whole-word or word-prefix hit beats a hit in the middle of a word.
    let best = from
    while (from >= 0 && !wordStart(text, from)) from = text.indexOf(token, from + 1)
    if (from >= 0) best = from
    const atWord = wordStart(text, best)
    const wholeWord = atWord && !isWordChar(text[best + token.length])
    return token.length * 10 + (atWord ? 40 : 15) + (wholeWord ? 15 : 0) + (best === 0 ? 30 : 0)
  }
  // Subsequence: every letter in order, rewarding word starts and runs of adjacent letters.
  let score = 0
  let previous = -2
  let at = 0
  for (const char of token) {
    let found = -1
    // Prefer the next word start that has this letter, unless the letter follows on directly.
    if (text[previous + 1] === char && previous >= 0) found = previous + 1
    else {
      for (let index = at; index < text.length; index++) if (text[index] === char && wordStart(text, index)) { found = index; break }
      if (found < 0) found = text.indexOf(char, at)
    }
    if (found < 0) return null
    score += 4
    if (wordStart(text, found)) score += 8
    if (found === previous + 1) score += 6
    else if (previous >= 0) score -= Math.min(found - previous - 1, 6)
    previous = found
    at = found + 1
  }
  return score
}

/**
 * How well a query matches a text: higher is better, null when it does not match at all.
 * Every word of the query must match (as a substring or as letters in order); whole-text and
 * prefix matches and word starts score higher, and shorter texts win ties.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const q = normalise(query)
  const t = normalise(text)
  if (!q) return 0
  let total = 0
  for (const token of q.split(' ')) {
    const score = scoreToken(token, t)
    if (score === null) return null
    total += score
  }
  if (t === q) total += 120
  else if (t.startsWith(q)) total += 60
  else if (t.includes(q)) total += 20
  return total - t.length * 0.25
}
