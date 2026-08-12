/**
 * Comparing a spoken flashcard answer against the expected word.
 *
 * Speech-to-text is imperfect and learners aren't typing, so an exact string
 * match would reject plenty of correct answers. This is deliberately forgiving
 * about accents, punctuation, case and articles, and allows a small number of
 * character slips — but not so loose that a different word passes.
 *
 * The forgiveness is targeted rather than a bigger edit-distance budget. Raising
 * the budget accepts genuinely different words; these transforms only erase
 * distinctions a listener could not have heard either.
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

/**
 * Languages where a written h is silent, so it cannot be heard and cannot be
 * transcribed reliably: Italian "ho" comes back as "o", Spanish "hola" as "ola".
 * German is excluded — its h is pronounced, and "hat" must not match "at".
 */
const SILENT_H = new Set(['it', 'es', 'fr', 'pt'])

/**
 * Drop h only where it is silent — never as the second half of a digraph, where
 * it changes the sound of the letter before it. Italian "che" is /ke/ and "ce"
 * is /tʃe/, so stripping blindly would accept one for the other; the same guard
 * covers Portuguese lh/nh, French ph/th and Spanish ch.
 */
function withoutSilentH(s: string): string {
  return s.replace(/(^|[^cglnpstz])h/g, '$1')
}

/** Whether a written difference could have been heard at all. */
function variants(s: string, lang?: string): Set<string> {
  const out = new Set<string>()
  const add = (v: string) => {
    if (v) out.add(v)
  }
  const base = normalise(s)
  add(base)
  add(withoutArticle(base))
  // Where a transcriber puts word boundaries is not something the speaker chose:
  // "locali" comes back as "lo cali" and is not a different answer.
  for (const v of [...out]) add(v.replace(/\s+/g, ''))
  if (lang && SILENT_H.has(lang)) {
    for (const v of [...out]) add(withoutSilentH(v))
  }
  return out
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
 * Short answers must match exactly once the transforms above have run — a single
 * character often separates two real words ("cuenta"/"cuento"), and wrongly
 * accepting one teaches the learner the wrong thing. Longer phrases get a little
 * slack for transcription noise. A false reject is recoverable: the grade buttons
 * stay available so the learner can overrule the check.
 */
export function checkSpoken(heard: string, expected: string, lang?: string): SpokenResult {
  if (!normalise(heard)) return { correct: false, heard }

  const said = variants(heard, lang)
  for (const want of variants(expected, lang)) {
    if (said.has(want)) return { correct: true, heard }
    const tolerance = want.length <= 7 ? 0 : Math.floor(want.length / 8)
    if (tolerance) {
      for (const got of said) {
        if (distance(got, want) <= tolerance) return { correct: true, heard }
      }
    }
  }
  return { correct: false, heard }
}
