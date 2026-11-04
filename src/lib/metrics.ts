import { OWNERS, UNASSIGNED } from '../constants';
import type { FunnelStage, Lead, Source, Status } from '../types';
import { FUNNEL_STAGES, SOURCES, STATUSES, isOpenStatus } from '../types';
import { DAY_MS, daysSince } from './dates';
import { formatShortDate } from './format';
import { isStale } from './scoring';

/** All KPIs and chart series are derived from the same lead array (SPEC §4 M7). */

export interface Kpis {
  total: number;
  newCount: number;
  inProgress: number;
  won: number;
  lost: number;
  conversionRate: number;
  pipelineValue: number;
  wonValue: number;
  staleCount: number;
}

export function computeKpis(leads: Lead[], now: Date): Kpis {
  let newCount = 0, inProgress = 0, won = 0, lost = 0, pipelineValue = 0, wonValue = 0, staleCount = 0;
  for (const l of leads) {
    const v = l.value ?? 0;
    if (l.status === 'new') newCount++;
    else if (l.status === 'won') { won++; wonValue += v; }
    else if (l.status === 'lost') lost++;
    else inProgress++;
    if (isOpenStatus(l.status)) pipelineValue += v;
    if (isStale(l, now)) staleCount++;
  }
  const total = leads.length;
  return {
    total, newCount, inProgress, won, lost,
    conversionRate: total === 0 ? 0 : won / total,
    pipelineValue, wonValue, staleCount,
  };
}

export interface CountRow<K extends string> { key: K; count: number; value: number }

export function countBySource(leads: Lead[]): CountRow<Source>[] {
  return SOURCES.map((key) => {
    const rows = leads.filter((l) => l.source === key);
    return { key, count: rows.length, value: rows.reduce((s, l) => s + (l.value ?? 0), 0) };
  });
}

export function countByStatus(leads: Lead[]): CountRow<Status>[] {
  return STATUSES.map((key) => {
    const rows = leads.filter((l) => l.status === key);
    return { key, count: rows.length, value: rows.reduce((s, l) => s + (l.value ?? 0), 0) };
  });
}

export interface TrendPoint { label: string; weekStart: string; leads: number; won: number }

/** Leads received per week, oldest → newest. Leads older than `weeks` are ignored. */
export function weeklyTrend(leads: Lead[], now: Date, weeks = 13): TrendPoint[] {
  const points: TrendPoint[] = Array.from({ length: weeks }, (_, i) => {
    const weeksAgo = weeks - 1 - i;
    const start = new Date(now.getTime() - (weeksAgo * 7 + 6) * DAY_MS);
    return { label: formatShortDate(start), weekStart: start.toISOString(), leads: 0, won: 0 };
  });
  for (const l of leads) {
    const weeksAgo = Math.floor(daysSince(l.createdAt, now) / 7);
    if (weeksAgo >= weeks) continue;
    const p = points[weeks - 1 - weeksAgo];
    p.leads++;
    if (l.status === 'won') p.won++;
  }
  return points;
}

export interface FunnelRow { stage: FunnelStage; count: number; rateFromTop: number; rateFromPrev: number }

function stageIndex(lead: Lead): number {
  if (lead.status === 'lost') return lead.lostAtStage ? FUNNEL_STAGES.indexOf(lead.lostAtStage) : 0;
  return FUNNEL_STAGES.indexOf(lead.status);
}

/** A lead counts at every stage up to the furthest stage it reached. Always non-increasing. */
export function funnel(leads: Lead[]): FunnelRow[] {
  const counts = FUNNEL_STAGES.map((_, i) => leads.filter((l) => stageIndex(l) >= i).length);
  return FUNNEL_STAGES.map((stage, i) => ({
    stage,
    count: counts[i],
    rateFromTop: counts[0] === 0 ? 0 : counts[i] / counts[0],
    rateFromPrev: i === 0 ? 1 : counts[i - 1] === 0 ? 0 : counts[i] / counts[i - 1],
  }));
}

export interface RepRow { owner: string; total: number; open: number; won: number; conversionRate: number; pipelineValue: number; wonValue: number; stale: number }

export function repPerformance(leads: Lead[], now: Date): RepRow[] {
  const owners: string[] = [...OWNERS];
  if (leads.some((l) => !l.owner)) owners.push(UNASSIGNED);
  return owners
    .map((owner) => {
      const rows = leads.filter((l) => (owner === UNASSIGNED ? !l.owner : l.owner === owner));
      const k = computeKpis(rows, now);
      return {
        owner, total: k.total, open: k.newCount + k.inProgress, won: k.won,
        conversionRate: k.conversionRate, pipelineValue: k.pipelineValue, wonValue: k.wonValue, stale: k.staleCount,
      };
    })
    .filter((r) => r.total > 0);
}
