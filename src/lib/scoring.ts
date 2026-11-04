import { PRIORITY_THRESHOLDS, STALE_DAYS } from '../constants';
import type { Lead, Level, Priority, ScoreBreakdown, ScoredLead, Source } from '../types';
import { isOpenStatus } from '../types';
import { daysSince } from './dates';

/**
 * Rule-based Lead Score, 0–100 (SPEC §4 "נוסחת Lead Score").
 * Transparent and deterministic. This is NOT an AI prediction.
 */
export const SOURCE_POINTS: Record<Source, number> = {
  Referral: 25,
  'Google Ads': 20,
  SEO: 15,
  Direct: 15,
  Facebook: 10,
};

export const INTEREST_POINTS: Record<Level, number> = { high: 25, medium: 15, low: 5 };
export const URGENCY_POINTS: Record<Level, number> = { high: 15, medium: 8, low: 2 };

export const BUDGET_TIERS = [
  { min: 50_000, points: 20 },
  { min: 20_000, points: 12 },
  { min: 0, points: 5 },
] as const;

export const RECENCY_TIERS = [
  { maxDays: 3, points: 15 },
  { maxDays: 14, points: 10 },
  { maxDays: 30, points: 5 },
] as const;

export const MAX_SCORE = 25 + 25 + 20 + 15 + 15;

/** Missing value is treated as the lowest budget tier. */
export function budgetPoints(value: number | null): number {
  if (value == null || !Number.isFinite(value)) return BUDGET_TIERS[BUDGET_TIERS.length - 1].points;
  return BUDGET_TIERS.find((t) => value >= t.min)?.points ?? 5;
}

export function recencyPoints(createdAt: string, now: Date): number {
  const days = daysSince(createdAt, now);
  return RECENCY_TIERS.find((t) => days <= t.maxDays)?.points ?? 0;
}

export function scoreLead(lead: Lead, now: Date): ScoreBreakdown {
  const source = SOURCE_POINTS[lead.source] ?? 0;
  const interest = INTEREST_POINTS[lead.interest] ?? 0;
  const budget = budgetPoints(lead.value);
  const urgency = URGENCY_POINTS[lead.urgency] ?? 0;
  const recency = recencyPoints(lead.createdAt, now);
  return { source, interest, budget, urgency, recency, total: source + interest + budget + urgency + recency };
}

/** Closed leads (won/lost) get no handling priority. */
export function priorityOf(lead: Lead, total: number): Priority | null {
  if (!isOpenStatus(lead.status)) return null;
  if (total >= PRIORITY_THRESHOLDS.hot) return 'hot';
  if (total >= PRIORITY_THRESHOLDS.warm) return 'warm';
  return 'cold';
}

export function isStale(lead: Lead, now: Date): boolean {
  return isOpenStatus(lead.status) && daysSince(lead.lastActivityAt, now) >= STALE_DAYS;
}

export function enrichLeads(leads: Lead[], now: Date): ScoredLead[] {
  return leads.map((lead) => {
    const score = scoreLead(lead, now);
    return { ...lead, score, priority: priorityOf(lead, score.total), stale: isStale(lead, now) };
  });
}
