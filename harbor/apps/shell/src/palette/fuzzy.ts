/**
 * Fuzzy match for the command palette. Every word of the query must appear in
 * the text as a subsequence. Higher scores are better matches: whole-word and
 * word-start hits beat scattered letters, and earlier hits beat later ones.
 * Returns null when the text does not match.
 */
export function fuzzyScore(query: string, text: string): number | null {
  const haystack = text.toLowerCase()
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return 0
  let total = 0
  for (const word of words) {
    const score = wordScore(word, haystack)
    if (score === null) return null
    total += score
  }
  return total
}

function wordScore(word: string, haystack: string): number | null {
  // Best case: the word appears intact.
  const exact = haystack.indexOf(word)
  if (exact >= 0) {
    const atWordStart = exact === 0 || /[\s\-_/.:]/.test(haystack[exact - 1] ?? '')
    return 100 + word.length * 4 + (atWordStart ? 40 : 0) - Math.min(exact, 30)
  }
  // Otherwise its letters must appear in order; runs and word starts score more.
  let score = 0
  let from = 0
  let previous = -2
  for (const letter of word) {
    const at = haystack.indexOf(letter, from)
    if (at < 0) return null
    const atWordStart = at === 0 || /[\s\-_/.:]/.test(haystack[at - 1] ?? '')
    score += 2 + (at === previous + 1 ? 6 : 0) + (atWordStart ? 8 : 0)
    previous = at
    from = at + 1
  }
  return score - Math.min(haystack.length, 40) / 8
}

/** Rank items for a query, best first. An empty query keeps the given order. */
export function rank<T>(items: readonly T[], query: string, textOf: (item: T) => string, limit: number): T[] {
  if (!query.trim()) return items.slice(0, limit)
  return items
    .map((item, index) => ({ item, index, score: fuzzyScore(query, textOf(item)) }))
    .filter((entry): entry is { item: T; index: number; score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item)
}
