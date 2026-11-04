import { describe, expect, it } from 'vitest';
import { UNASSIGNED } from '../constants';
import { generateLeads } from '../data/generateLeads';
import { NOW, daysAgo, makeLead } from '../test/fixtures';
import { EMPTY_FILTERS, filterLeads, isFiltered, sortLeads } from './filters';
import { enrichLeads } from './scoring';

const leads = generateLeads({ now: NOW });
const f = (patch: Partial<typeof EMPTY_FILTERS>) => ({ ...EMPTY_FILTERS, ...patch });

describe('search (SPEC M4, D3)', () => {
  it('empty filters return everything', () => {
    expect(filterLeads(leads, EMPTY_FILTERS, NOW)).toHaveLength(leads.length);
    expect(isFiltered(EMPTY_FILTERS)).toBe(false);
  });

  it('search by client name returns only matching records', () => {
    const target = leads[5].name.split(' ')[0];
    const res = filterLeads(leads, f({ query: target }), NOW);
    expect(res.length).toBeGreaterThan(0);
    for (const l of res) expect(`${l.name} ${l.company ?? ''}`).toContain(target);
  });

  it('search ignores surrounding whitespace', () => {
    const name = leads[0].name;
    expect(filterLeads(leads, f({ query: `  ${name}  ` }), NOW).map((l) => l.id)).toContain(leads[0].id);
  });

  it('search also matches company, and leads with no company do not crash', () => {
    const data = [makeLead({ company: null }), makeLead({ id: 'T-2', company: 'אלפא בע"מ', name: 'משה' })];
    expect(filterLeads(data, f({ query: 'אלפא' }), NOW).map((l) => l.id)).toEqual(['T-2']);
  });

  it('edge case: search with no results returns an empty list', () => {
    expect(filterLeads(leads, f({ query: 'zzzz-לא-קיים' }), NOW)).toEqual([]);
  });
});

describe('filters (SPEC M4, D4)', () => {
  it('status filter returns only that status', () => {
    const res = filterLeads(leads, f({ status: 'qualified' }), NOW);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((l) => l.status === 'qualified')).toBe(true);
    expect(res).toHaveLength(leads.filter((l) => l.status === 'qualified').length);
  });

  it('source and owner filters', () => {
    const bySource = filterLeads(leads, f({ source: 'Referral' }), NOW);
    expect(bySource.every((l) => l.source === 'Referral')).toBe(true);
    const owner = leads.find((l) => l.owner)!.owner!;
    const byOwner = filterLeads(leads, f({ owner }), NOW);
    expect(byOwner.length).toBeGreaterThan(0);
    expect(byOwner.every((l) => l.owner === owner)).toBe(true);
  });

  it('unassigned owner filter returns leads with no owner', () => {
    const res = filterLeads(leads, f({ owner: UNASSIGNED }), NOW);
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((l) => l.owner === null)).toBe(true);
  });

  it('stale-only filter', () => {
    const data = [makeLead({ lastActivityAt: daysAgo(10) }), makeLead({ id: 'T-2', lastActivityAt: daysAgo(1) })];
    expect(filterLeads(data, f({ staleOnly: true }), NOW).map((l) => l.id)).toEqual(['T-1']);
  });

  it('edge case: a filter combination that matches nothing returns empty', () => {
    expect(filterLeads(leads, f({ status: 'won', staleOnly: true }), NOW)).toEqual([]);
  });

  it('filters combine with AND', () => {
    const res = filterLeads(leads, f({ status: 'new', source: 'Google Ads' }), NOW);
    expect(res.every((l) => l.status === 'new' && l.source === 'Google Ads')).toBe(true);
  });
});

describe('sorting', () => {
  const scored = enrichLeads(leads, NOW);
  it('sorts by score descending', () => {
    const s = sortLeads(scored, 'score', 'desc');
    for (let i = 1; i < s.length; i++) expect(s[i].score.total).toBeLessThanOrEqual(s[i - 1].score.total);
  });
  it('sorts by value ascending with missing values first', () => {
    const s = sortLeads(scored, 'value', 'asc');
    expect(s[0].value).toBeNull();
  });
  it('does not mutate the input', () => {
    const copy = [...scored];
    sortLeads(scored, 'name', 'asc');
    expect(scored).toEqual(copy);
  });
});
