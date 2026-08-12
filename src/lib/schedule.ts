/**
 * When a card comes back.
 *
 * The Leitner boxes existed before this did, but only as a sort key — every card
 * appeared in every review, so a word answered correctly five times running kept
 * turning up forever. Boxes without intervals are half a Leitner system; this is
 * the other half.
 *
 * Intervals are in whole days rather than hours: "come back in three hours" is
 * not a thing anyone wants from a vocabulary app, and a card reviewed late one
 * evening should be due the morning it is next needed, not that same hour.
 */
import type { Flashcard } from '@/types'

/**
 * Days before a card at each level is due again. Index = box - 1.
 *
 * Level 1 is zero on purpose. Answering correctly moves a card up and out of the
 * way for two days; the only cards that stay at level 1 are the ones just missed,
 * and those should come back the same sitting rather than tomorrow.
 */
export const INTERVAL_DAYS = [0, 2, 5, 14, 30]

export function intervalDays(box: number): number {
  return INTERVAL_DAYS[Math.min(Math.max(box, 1), INTERVAL_DAYS.length) - 1]!
}

/** Local midnight `days` after the day containing `ts`. DST-safe. */
function dayAfter(ts: number, days: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

/**
 * When this card next becomes due. A card that has never been reviewed is due
 * now, whatever box it claims to be in — including one just added by hand.
 */
export function dueAt(card: Flashcard): number {
  if (!card.lastReviewedAt) return 0
  return dayAfter(card.lastReviewedAt, intervalDays(card.box ?? 1))
}

export function isDue(card: Flashcard, now = Date.now()): boolean {
  return dueAt(card) <= now
}

/** The soonest a card in this set comes back, or null if something is due now. */
export function nextDueAt(cards: Flashcard[], now = Date.now()): number | null {
  let soonest: number | null = null
  for (const card of cards) {
    const at = dueAt(card)
    if (at <= now) return null
    if (soonest === null || at < soonest) soonest = at
  }
  return soonest
}

/** "tomorrow" / "in 3 days" — for telling someone when to come back. */
export function describeDue(at: number, now = Date.now()): string {
  const days = Math.round((dayAfter(at, 0) - dayAfter(now, 0)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days < 7) return `in ${days} days`
  const weeks = Math.round(days / 7)
  if (weeks === 1) return 'in a week'
  if (days < 45) return `in ${weeks} weeks`
  return 'in about a month'
}
