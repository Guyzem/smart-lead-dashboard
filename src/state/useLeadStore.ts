import { useCallback, useEffect, useMemo, useState } from 'react';
import { generateLeads } from '../data/generateLeads';
import type { Lead, Status } from '../types';
import type { LeadOverride, Overrides } from '../lib/storage';
import { applyOverrides, defaultStorage, loadOverrides, noteAdded, saveOverrides, statusChange } from '../lib/storage';

export interface LeadStore {
  leads: Lead[];
  setStatus: (id: string, status: Status) => void;
  addNote: (id: string, text: string) => void;
  reset: () => void;
}

export function useLeadStore(now: Date, storage: Storage | undefined = defaultStorage()): LeadStore {
  const base = useMemo(() => generateLeads({ now }), [now]);
  const [overrides, setOverrides] = useState<Overrides>(() => loadOverrides(storage));

  useEffect(() => saveOverrides(overrides, storage), [overrides, storage]);

  const leads = useMemo(() => applyOverrides(base, overrides), [base, overrides]);

  const update = useCallback(
    (id: string, make: (lead: Lead) => LeadOverride | null) =>
      setOverrides((prev) => {
        const baseLead = base.find((l) => l.id === id);
        if (!baseLead) return prev;
        const change = make({ ...baseLead, ...prev[id] });
        return change ? { ...prev, [id]: { ...prev[id], ...change } } : prev;
      }),
    [base],
  );

  const setStatus = useCallback(
    (id: string, status: Status) => update(id, (l) => (l.status === status ? null : statusChange(l, status, new Date()))),
    [update],
  );
  const addNote = useCallback((id: string, text: string) => update(id, (l) => noteAdded(l, text, new Date())), [update]);
  const reset = useCallback(() => setOverrides({}), []);

  return { leads, setStatus, addNote, reset };
}
