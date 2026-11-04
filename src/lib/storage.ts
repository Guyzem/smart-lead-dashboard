import type { Lead, Note, OpenStatus, Status } from '../types';
import { OPEN_STATUSES, STATUSES, isOpenStatus } from '../types';

/**
 * Persists only user changes (status, notes, activity) on top of the deterministic mock data
 * (SPEC §4 S5). Corrupt or unknown data is ignored, never crashes the app.
 */
export const STORAGE_KEY = 'lead-dashboard:v1';

export interface LeadOverride {
  status?: Status;
  lostAtStage?: OpenStatus | null;
  lastActivityAt?: string;
  notes?: Note[];
}
export type Overrides = Record<string, LeadOverride>;

export function defaultStorage(): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    return undefined;
  }
}

const isString = (v: unknown): v is string => typeof v === 'string';

function sanitizeNote(v: unknown): Note | null {
  if (!v || typeof v !== 'object') return null;
  const n = v as Record<string, unknown>;
  return isString(n.id) && isString(n.text) && isString(n.createdAt) ? { id: n.id, text: n.text, createdAt: n.createdAt } : null;
}

function sanitizeOverride(v: unknown): LeadOverride | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const out: LeadOverride = {};
  if (isString(o.status) && (STATUSES as readonly string[]).includes(o.status)) out.status = o.status as Status;
  if (o.lostAtStage === null) out.lostAtStage = null;
  else if (isString(o.lostAtStage) && (OPEN_STATUSES as readonly string[]).includes(o.lostAtStage)) out.lostAtStage = o.lostAtStage as OpenStatus;
  if (isString(o.lastActivityAt) && !Number.isNaN(Date.parse(o.lastActivityAt))) out.lastActivityAt = o.lastActivityAt;
  if (Array.isArray(o.notes)) out.notes = o.notes.map(sanitizeNote).filter((n): n is Note => n !== null);
  return Object.keys(out).length ? out : null;
}

export function loadOverrides(storage: Storage | undefined = defaultStorage()): Overrides {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || (parsed as { version?: unknown }).version !== 1) return {};
    const src = (parsed as { overrides?: unknown }).overrides;
    if (!src || typeof src !== 'object') return {};
    const out: Overrides = {};
    for (const [id, v] of Object.entries(src)) {
      const o = sanitizeOverride(v);
      if (o) out[id] = o;
    }
    return out;
  } catch {
    return {};
  }
}

export function saveOverrides(overrides: Overrides, storage: Storage | undefined = defaultStorage()): void {
  if (!storage) return;
  try {
    if (Object.keys(overrides).length === 0) storage.removeItem(STORAGE_KEY);
    else storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, overrides }));
  } catch {
    // Storage full or blocked: keep working in memory.
  }
}

export function applyOverrides(base: Lead[], overrides: Overrides): Lead[] {
  return base.map((l) => (overrides[l.id] ? { ...l, ...overrides[l.id] } : l));
}

/** Override produced by changing a lead's status (SPEC §4 M3). */
export function statusChange(lead: Lead, status: Status, at: Date): LeadOverride {
  const lostAtStage: OpenStatus | null =
    status === 'lost' ? (isOpenStatus(lead.status) ? lead.status : lead.lostAtStage ?? 'proposal') : null;
  return { status, lostAtStage, lastActivityAt: at.toISOString() };
}

/** Override produced by adding a note (SPEC §4 S4). Returns null for blank text. */
export function noteAdded(lead: Lead, text: string, at: Date): LeadOverride | null {
  const clean = text.trim();
  if (!clean) return null;
  const note: Note = { id: `u-${at.getTime()}-${lead.notes.length}`, text: clean, createdAt: at.toISOString() };
  return { notes: [...lead.notes, note], lastActivityAt: at.toISOString() };
}
