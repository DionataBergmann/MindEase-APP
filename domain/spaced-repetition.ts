/** Domínio: regras de repetição espaçada (sem I/O). */

/** Intervalos em dias por nível (1º 1d, 2º 3d, … 5º 30d). */
export const SPACED_INTERVALS_DAYS = [1, 3, 7, 14, 30] as const;
const MAX_LEVEL = SPACED_INTERVALS_DAYS.length - 1;

/** Calcula a data (YYYY-MM-DD) da próxima revisão a partir do nível. */
export function getNextReviewDateFromLevel(level: number): string {
  const safeLevel = Math.min(Math.max(0, level), MAX_LEVEL);
  const days = SPACED_INTERVALS_DAYS[safeLevel];
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Hoje em YYYY-MM-DD. */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Diz se está na hora de revisar (nextReviewAt ≤ hoje). */
export function isDueForReview(nextReviewAt: string | undefined): boolean {
  if (!nextReviewAt) return false;
  return nextReviewAt <= todayISO();
}

/** Nível por classificação do card (difícil=0, médio=1, fácil=2). */
export const CARD_RATING_LEVEL = { dificil: 0, medio: 1, facil: 2 } as const;
export const CARD_RATING_DAYS: Record<keyof typeof CARD_RATING_LEVEL, number> = {
  dificil: SPACED_INTERVALS_DAYS[0],
  medio: SPACED_INTERVALS_DAYS[1],
  facil: SPACED_INTERVALS_DAYS[2],
};

/** Diz se o card está due para revisão (nunca revisado ou nextReviewAt ≤ hoje). */
export function isCardDueForReview(card: { nextReviewAt?: string }): boolean {
  if (!card.nextReviewAt) return true;
  return card.nextReviewAt <= todayISO();
}
