import type { Lead } from '../types';

export const NOW = new Date('2026-11-04T12:00:00.000Z');

export function daysAgo(days: number): string {
  return new Date(NOW.getTime() - days * 86_400_000).toISOString();
}

export function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'T-1',
    name: 'ישראל ישראלי',
    company: 'חברת בדיקה',
    industry: 'הייטק',
    phone: '050-0000000',
    source: 'SEO',
    createdAt: daysAgo(10),
    status: 'new',
    owner: 'דנה כהן',
    value: 30_000,
    interest: 'medium',
    urgency: 'medium',
    lastActivityAt: daysAgo(10),
    lostAtStage: null,
    notes: [],
    ...overrides,
  };
}
