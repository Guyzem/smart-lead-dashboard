import { describe, expect, it } from 'vitest';
import { generateLeads } from '../data/generateLeads';
import { NOW, daysAgo, makeLead } from '../test/fixtures';
import { MAX_SCORE, budgetPoints, enrichLeads, isStale, priorityOf, recencyPoints, scoreLead } from './scoring';

describe('Lead Score formula (SPEC S1, D7)', () => {
  it('max score is 100', () => expect(MAX_SCORE).toBe(100));

  it('scores a perfect lead as 100', () => {
    const lead = makeLead({ source: 'Referral', interest: 'high', value: 80_000, urgency: 'high', createdAt: daysAgo(1) });
    expect(scoreLead(lead, NOW)).toEqual({ source: 25, interest: 25, budget: 20, urgency: 15, recency: 15, total: 100 });
  });

  it('scores a weak old lead with the minimum components', () => {
    const lead = makeLead({ source: 'Facebook', interest: 'low', value: 5_000, urgency: 'low', createdAt: daysAgo(60) });
    expect(scoreLead(lead, NOW)).toEqual({ source: 10, interest: 5, budget: 5, urgency: 2, recency: 0, total: 22 });
  });

  it('scores a mid lead exactly as the documented example', () => {
    // Google Ads 20 + medium 15 + ₪30,000 → 12 + medium 8 + 10 days → 10 = 65
    const lead = makeLead({ source: 'Google Ads', interest: 'medium', value: 30_000, urgency: 'medium', createdAt: daysAgo(10) });
    expect(scoreLead(lead, NOW).total).toBe(65);
  });

  it('budget tier boundaries', () => {
    expect(budgetPoints(50_000)).toBe(20);
    expect(budgetPoints(49_999)).toBe(12);
    expect(budgetPoints(20_000)).toBe(12);
    expect(budgetPoints(19_999)).toBe(5);
    expect(budgetPoints(null)).toBe(5); // missing value → lowest tier
  });

  it('recency tier boundaries', () => {
    expect(recencyPoints(daysAgo(0), NOW)).toBe(15);
    expect(recencyPoints(daysAgo(3), NOW)).toBe(15);
    expect(recencyPoints(daysAgo(4), NOW)).toBe(10);
    expect(recencyPoints(daysAgo(14), NOW)).toBe(10);
    expect(recencyPoints(daysAgo(15), NOW)).toBe(5);
    expect(recencyPoints(daysAgo(30), NOW)).toBe(5);
    expect(recencyPoints(daysAgo(31), NOW)).toBe(0);
  });

  it('every generated lead scores within 0–100 and total equals the sum of parts', () => {
    for (const l of generateLeads({ now: NOW })) {
      const s = scoreLead(l, NOW);
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
      expect(s.total).toBe(s.source + s.interest + s.budget + s.urgency + s.recency);
    }
  });
});

describe('priority and stale flags (SPEC S2, S3)', () => {
  it('maps score to hot / warm / cold for open leads', () => {
    const open = makeLead({ status: 'contacted' });
    expect(priorityOf(open, 70)).toBe('hot');
    expect(priorityOf(open, 69)).toBe('warm');
    expect(priorityOf(open, 40)).toBe('warm');
    expect(priorityOf(open, 39)).toBe('cold');
  });

  it('closed leads have no priority', () => {
    expect(priorityOf(makeLead({ status: 'won' }), 95)).toBeNull();
    expect(priorityOf(makeLead({ status: 'lost', lostAtStage: 'new' }), 95)).toBeNull();
  });

  it('flags open leads with 7+ days of inactivity', () => {
    expect(isStale(makeLead({ lastActivityAt: daysAgo(7) }), NOW)).toBe(true);
    expect(isStale(makeLead({ lastActivityAt: daysAgo(6) }), NOW)).toBe(false);
    expect(isStale(makeLead({ status: 'won', lastActivityAt: daysAgo(40) }), NOW)).toBe(false);
  });

  it('enrichLeads attaches score, priority and stale', () => {
    const [e] = enrichLeads([makeLead({ lastActivityAt: daysAgo(9) })], NOW);
    expect(e.score.total).toBe(scoreLead(e, NOW).total);
    expect(e.priority).not.toBeNull();
    expect(e.stale).toBe(true);
  });
});
