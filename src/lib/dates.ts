export const DAY_MS = 86_400_000;

/** Whole days elapsed from `iso` until `now` (never negative). */
export function daysSince(iso: string, now: Date): number {
  const diff = now.getTime() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diff / DAY_MS));
}
