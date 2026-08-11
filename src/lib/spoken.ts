/**
 * Comparing a spoken flashcard answer against the expected word.
 *
 * Speech-to-text is imperfect and learners aren't typing, so an exact string
 * match would reject plenty of correct answers. This is deliberately forgiving
 * about accents, punctuation, case and articles, and allows a small number of
 * character slips — but not so loose that a different word passes.
 */

/** Lowercase, strip accents and punctuation, collapse whitespace. */
export function normalise(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[\p{P}\p{S}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Leading articles are noise when checking a single word or phrase. */
const ARTICLES = /^(el|la|los|las|un|una|unos|unas|il|lo|gli|le|i|uno|der|die|das|le|les|des|du)\s+/

function withoutArticle(s: string): string {
  return s.replace(ARTICLES, '')
}

/** Classic Levenshtein distance. */
function distance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j]! + 1,
        row[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    prev = row
  }
  return prev[b.length]!
}

export interface SpokenResult {
  correct: boolean
  /** What we compared against, for showing the learner. */
  heard: string
}

/**
 * Did the learner say the expected word?
 *
 * Short answers must match exactly once accents and punctuation are stripped —
 * a single character often separates two real words ("cuenta"/"cuento"), and
 * wrongly accepting one teaches the learner the wrong thing. Longer phrases get
 * a little slack for transcription noise. A false reject is recoverable: the
 * grade buttons stay available so the learner can overrule the check.
 */
export function checkSpoken(heard: string, expected: string): SpokenResult {
  const h = normalise(heard)
  const e = normalise(expected)
  if (!h) return { correct: false, heard }

  const candidates = [
    [h, e],
    [withoutArticle(h), withoutArticle(e)],
  ]

  for (const [a, b] of candidates) {
    if (a === b) return { correct: true, heard }
    const tolerance = b.length <= 7 ? 0 : Math.floor(b.length / 8)
    if (distance(a, b) <= tolerance) return { correct: true, heard }
  }
  return { correct: false, heard }
}
