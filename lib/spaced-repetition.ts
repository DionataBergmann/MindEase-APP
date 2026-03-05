/**
 * Spaced repetition helpers — aligned with mindease-web domain.
 */

const SPACED_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
const MAX_LEVEL = SPACED_INTERVALS_DAYS.length - 1;

export function getNextReviewDateFromLevel(level: number): string {
  const safeLevel = Math.min(Math.max(0, level), MAX_LEVEL);
  const days = SPACED_INTERVALS_DAYS[safeLevel];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isDueForReview(nextReviewAt: string | undefined): boolean {
  if (!nextReviewAt) return false;
  return nextReviewAt <= todayISO();
}

export function isCardDueForReview(card: { nextReviewAt?: string }): boolean {
  if (!card.nextReviewAt) return true;
  return card.nextReviewAt <= todayISO();
}

export const SPACED_INTERVALS_DAYS_EXPORT = SPACED_INTERVALS_DAYS;
export const CARD_RATING_LEVEL = { dificil: 0, medio: 1, facil: 2 } as const;
export const CARD_RATING_DAYS: Record<keyof typeof CARD_RATING_LEVEL, number> = {
  dificil: SPACED_INTERVALS_DAYS[0],
  medio: SPACED_INTERVALS_DAYS[1],
  facil: SPACED_INTERVALS_DAYS[2],
};
