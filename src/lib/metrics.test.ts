import { describe, expect, it } from 'vitest';
import { generateLeads } from '../data/generateLeads';
import { NOW, daysAgo, makeLead } from '../test/fixtures';
import { STATUSES } from '../types';
import { computeKpis, countBySource, countByStatus, funnel, repPerformance, weeklyTrend } from './metrics';

const leads = generateLeads({ now: NOW });

describe('computeKpis (SPEC M1, M7, D2)', () => {
  const k = computeKpis(leads, NOW);

  it('matches a manual count over the same data', () => {
    expect(k.total).toBe(leads.length);
    expect(k.newCount).toBe(leads.filter((l) => l.status === 'new').length);
    expect(k.inProgress).toBe(leads.filter((l) => ['contacted', 'qualified', 'proposal'].includes(l.status)).length);
    expect(k.won).toBe(leads.filter((l) => l.status === 'won').length);
    expect(k.conversionRate).toBeCloseTo(k.won / k.total);
  });

  it('status buckets add up to the total', () => {
    expect(k.newCount + k.inProgress + k.won + k.lost).toBe(k.total);
  });

  it('pipeline value is the sum of open leads only (missing value counts as 0)', () => {
    const expected = leads
      .filter((l) => l.status !== 'won' && l.status !== 'lost')
      .reduce((s, l) => s + (l.value ?? 0), 0);
    expect(k.pipelineValue).toBe(expected);
    expect(k.pipelineValue).toBeGreaterThan(0);
  });

  it('edge case: empty list gives zeros and no division by zero', () => {
    expect(computeKpis([], NOW)).toEqual({
      total: 0, newCount: 0, inProgress: 0, won: 0, lost: 0, conversionRate: 0, pipelineValue: 0, wonValue: 0, staleCount: 0,
    });
  });

  it('edge case: leads with missing value do not produce NaN', () => {
    const r = computeKpis([makeLead({ value: null }), makeLead({ id: 'T-2', value: 1000 })], NOW);
    expect(r.pipelineValue).toBe(1000);
  });
});

describe('chart data (SPEC M5, D6)', () => {
  it('source counts sum to total and match manual counts', () => {
    const rows = countBySource(leads);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(leads.length);
    for (const r of rows) expect(r.count).toBe(leads.filter((l) => l.source === r.key).length);
  });

  it('status counts include every status and sum to total', () => {
    const rows = countByStatus(leads);
    expect(rows.map((r) => r.key)).toEqual([...STATUSES]);
    expect(rows.reduce((s, r) => s + r.count, 0)).toBe(leads.length);
  });

  it('weekly trend covers 13 weeks and sums to total (all leads < 90 days old)', () => {
    const t = weeklyTrend(leads, NOW);
    expect(t).toHaveLength(13);
    expect(t.reduce((s, p) => s + p.leads, 0)).toBe(leads.length);
    expect(t.reduce((s, p) => s + p.won, 0)).toBe(leads.filter((l) => l.status === 'won').length);
  });

  it('weekly trend puts a lead in the right bucket', () => {
    const t = weeklyTrend([makeLead({ createdAt: daysAgo(0) }), makeLead({ id: 'T-2', createdAt: daysAgo(8) })], NOW);
    expect(t[12].leads).toBe(1);
    expect(t[11].leads).toBe(1);
  });

  it('funnel starts at total, never increases, and ends at won', () => {
    const f = funnel(leads);
    expect(f[0].count).toBe(leads.length);
    for (let i = 1; i < f.length; i++) expect(f[i].count).toBeLessThanOrEqual(f[i - 1].count);
    expect(f[f.length - 1].count).toBe(leads.filter((l) => l.status === 'won').length);
  });

  it('funnel counts lost leads up to the stage they were lost at', () => {
    const f = funnel([makeLead({ status: 'lost', lostAtStage: 'qualified' })]);
    expect(f.map((r) => r.count)).toEqual([1, 1, 1, 0, 0]);
  });

  it('edge case: empty funnel has zero rates', () => {
    expect(funnel([]).every((r) => r.count === 0 && r.rateFromTop === 0)).toBe(true);
  });

  it('rep performance totals add up to all leads', () => {
    const rows = repPerformance(leads, NOW);
    expect(rows.reduce((s, r) => s + r.total, 0)).toBe(leads.length);
    expect(rows.reduce((s, r) => s + r.won, 0)).toBe(computeKpis(leads, NOW).won);
  });
});
