import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateLeads } from '../data/generateLeads';
import type { Lead, Status } from '../types';
import type { LeadOverride, Overrides } from '../lib/storage';
import { STORAGE_KEY, applyOverrides, defaultStorage, loadOverrides, noteAdded, saveOverrides, statusChange } from '../lib/storage';

const NONE: Overrides = {};

export interface LeadStore {
  leads: Lead[];
  setStatus: (id: string, status: Status) => void;
  addNote: (id: string, text: string) => void;
  reset: () => void;
  /** Changes not yet written to Airtable (SPEC X2). Persisted per base/table (SPEC S5). */
  overrides: Overrides;
  /**
   * SPEC X2: marks a lead's change as saved in Airtable. Only if the change is still the one that
   * was sent (`sent`, by reference); a newer change stays pending. Saved changes are kept in memory
   * until the next load from Airtable, which already contains them.
   */
  commit: (id: string, sent: LeadOverride) => void;
}

/**
 * `source` = leads loaded from Airtable. Without it, the deterministic mock data is used
 * (tests and offline development). Local edits are stored under `storageKey`.
 */
export function useLeadStore(
  now: Date,
  storage: Storage | undefined = defaultStorage(),
  source?: Lead[],
  storageKey: string = STORAGE_KEY,
): LeadStore {
  const base = useMemo(() => source ?? generateLeads({ now }), [source, now]);
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides(storage, storageKey));
  const [committed, setCommitted] = useState<{ base: Lead[]; overrides: Overrides }>({ base, overrides: {} });
  // A fresh load from Airtable replaces whatever was committed on top of the previous load.
  const saved = committed.base === base ? committed.overrides : NONE;
  const savedBase = useMemo(() => applyOverrides(base, saved), [base, saved]);

  useEffect(() => saveOverrides(overrides, storage, storageKey), [overrides, storage, storageKey]);

  const leads = useMemo(() => applyOverrides(savedBase, overrides), [savedBase, overrides]);

  const update = useCallback(
    (id: string, make: (lead: Lead) => LeadOverride | null) =>
      setOverrides((prev) => {
        const baseLead = savedBase.find((l) => l.id === id);
        if (!baseLead) return prev;
        const change = make({ ...baseLead, ...prev[id] });
        return change ? { ...prev, [id]: { ...prev[id], ...change } } : prev;
      }),
    [savedBase],
  );

  const setStatus = useCallback(
    (id: string, status: Status) => update(id, (l) => (l.status === status ? null : statusChange(l, status, new Date()))),
    [update],
  );
  const addNote = useCallback((id: string, text: string) => update(id, (l) => noteAdded(l, text, new Date())), [update]);
  const reset = useCallback(() => setOverrides({}), []);

  const commit = useCallback(
    (id: string, sent: LeadOverride) => {
      setOverrides((prev) => {
        if (prev[id] !== sent) return prev;
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });
      setCommitted((c) => {
        const current = c.base === base ? c.overrides : NONE;
        return { base, overrides: { ...current, [id]: { ...current[id], ...sent } } };
      });
    },
    [base],
  );

  return { leads, setStatus, addNote, reset, overrides, commit };
}
