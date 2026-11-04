export const STATUSES = ['new', 'contacted', 'qualified', 'proposal', 'won', 'lost'] as const;
export type Status = (typeof STATUSES)[number];

/** Funnel order (SPEC §4 M5). `lost` is not a stage; it records the stage it was lost at. */
export const FUNNEL_STAGES = ['new', 'contacted', 'qualified', 'proposal', 'won'] as const;
export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export const OPEN_STATUSES = ['new', 'contacted', 'qualified', 'proposal'] as const;
export type OpenStatus = (typeof OPEN_STATUSES)[number];

export const SOURCES = ['Google Ads', 'SEO', 'Facebook', 'Referral', 'Direct'] as const;
export type Source = (typeof SOURCES)[number];

export type Level = 'high' | 'medium' | 'low';

export interface Note {
  id: string;
  text: string;
  createdAt: string; // ISO
}

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  industry: string | null;
  phone: string;
  source: Source;
  createdAt: string; // ISO
  status: Status;
  owner: string | null;
  value: number | null; // ILS
  interest: Level;
  urgency: Level;
  lastActivityAt: string; // ISO
  lostAtStage: OpenStatus | null;
  notes: Note[];
}

export type Priority = 'hot' | 'warm' | 'cold';

export interface ScoreBreakdown {
  source: number;
  interest: number;
  budget: number;
  urgency: number;
  recency: number;
  total: number;
}

export interface ScoredLead extends Lead {
  score: ScoreBreakdown;
  priority: Priority | null;
  stale: boolean;
}

export function isOpenStatus(status: Status): status is OpenStatus {
  return (OPEN_STATUSES as readonly string[]).includes(status);
}
