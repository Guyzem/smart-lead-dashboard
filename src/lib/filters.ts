import { UNASSIGNED } from '../constants';
import type { Lead, ScoredLead, Source, Status } from '../types';
import { isStale } from './scoring';

export interface LeadFilters {
  query: string;
  status: Status | 'all';
  source: Source | 'all';
  owner: string; // owner name, UNASSIGNED, or 'all'
  staleOnly: boolean;
}

export const EMPTY_FILTERS: LeadFilters = { query: '', status: 'all', source: 'all', owner: 'all', staleOnly: false };

export function isFiltered(f: LeadFilters): boolean {
  return f.query.trim() !== '' || f.status !== 'all' || f.source !== 'all' || f.owner !== 'all' || f.staleOnly;
}

/** Search matches client name or company, case-insensitive, ignoring surrounding spaces. */
export function matchesQuery(lead: Lead, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return lead.name.toLowerCase().includes(q) || (lead.company ?? '').toLowerCase().includes(q);
}

export function filterLeads<T extends Lead>(leads: T[], f: LeadFilters, now: Date): T[] {
  return leads.filter((l) => {
    if (!matchesQuery(l, f.query)) return false;
    if (f.status !== 'all' && l.status !== f.status) return false;
    if (f.source !== 'all' && l.source !== f.source) return false;
    if (f.owner === UNASSIGNED && l.owner) return false;
    if (f.owner !== 'all' && f.owner !== UNASSIGNED && l.owner !== f.owner) return false;
    if (f.staleOnly && !isStale(l, now)) return false;
    return true;
  });
}

export type SortKey = 'name' | 'company' | 'source' | 'createdAt' | 'status' | 'owner' | 'value' | 'score';
export type SortDir = 'asc' | 'desc';

const STATUS_ORDER: Record<Status, number> = { new: 0, contacted: 1, qualified: 2, proposal: 3, won: 4, lost: 5 };

export function sortLeads(leads: ScoredLead[], key: SortKey, dir: SortDir): ScoredLead[] {
  const sign = dir === 'asc' ? 1 : -1;
  const val = (l: ScoredLead): string | number => {
    switch (key) {
      case 'score': return l.score.total;
      case 'value': return l.value ?? -1;
      case 'createdAt': return l.createdAt;
      case 'status': return STATUS_ORDER[l.status];
      case 'company': return l.company ?? '';
      case 'owner': return l.owner ?? '';
      case 'source': return l.source;
      case 'name': return l.name;
    }
  };
  return [...leads].sort((a, b) => {
    const va = val(a), vb = val(b);
    const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'he');
    return cmp !== 0 ? cmp * sign : a.id.localeCompare(b.id);
  });
}
