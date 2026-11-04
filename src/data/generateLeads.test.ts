import { describe, expect, it } from 'vitest';
import { daysSince } from '../lib/dates';
import { NOW } from '../test/fixtures';
import { SOURCES, STATUSES } from '../types';
import { DEFAULT_COUNT, MAX_AGE_DAYS, generateLeads, mulberry32 } from './generateLeads';

describe('generateLeads (SPEC M6)', () => {
  const leads = generateLeads({ now: NOW });

  it('D1: creates at least 100 leads with unique ids', () => {
    expect(leads.length).toBe(DEFAULT_COUNT);
    expect(leads.length).toBeGreaterThanOrEqual(100);
    expect(new Set(leads.map((l) => l.id)).size).toBe(leads.length);
  });

  it('is deterministic for the same seed and now', () => {
    expect(generateLeads({ now: NOW })).toEqual(leads);
    expect(generateLeads({ now: NOW, seed: 7 })).not.toEqual(leads);
  });

  it('PRNG yields values in [0,1)', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('uses Hebrew (Israeli) names', () => {
    for (const l of leads) expect(l.name).toMatch(/^[֐-׿"' ]+$/);
  });

  it('covers every source and every status', () => {
    expect(new Set(leads.map((l) => l.source))).toEqual(new Set(SOURCES));
    expect(new Set(leads.map((l) => l.status))).toEqual(new Set(STATUSES));
  });

  it('has varied industries, dates and deal values', () => {
    expect(new Set(leads.map((l) => l.industry).filter(Boolean)).size).toBeGreaterThanOrEqual(8);
    expect(new Set(leads.map((l) => daysSince(l.createdAt, NOW))).size).toBeGreaterThan(30);
    expect(new Set(leads.map((l) => l.value)).size).toBeGreaterThan(50);
  });

  it('keeps dates within the last 90 days and activity after creation', () => {
    for (const l of leads) {
      expect(daysSince(l.createdAt, NOW)).toBeLessThan(MAX_AGE_DAYS);
      expect(Date.parse(l.lastActivityAt)).toBeGreaterThanOrEqual(Date.parse(l.createdAt));
      expect(Date.parse(l.lastActivityAt)).toBeLessThanOrEqual(NOW.getTime());
    }
  });

  it('records lostAtStage only for lost leads', () => {
    for (const l of leads) {
      if (l.status === 'lost') expect(l.lostAtStage).not.toBeNull();
      else expect(l.lostAtStage).toBeNull();
    }
  });

  it('includes some records with missing data (edge cases)', () => {
    expect(leads.some((l) => l.company === null)).toBe(true);
    expect(leads.some((l) => l.owner === null)).toBe(true);
    expect(leads.some((l) => l.value === null)).toBe(true);
  });

  it('values are positive and rounded to 500', () => {
    for (const l of leads) if (l.value !== null) {
      expect(l.value).toBeGreaterThan(0);
      expect(l.value % 500).toBe(0);
    }
  });
});
