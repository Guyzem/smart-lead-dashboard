import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AirtableConfig } from '../lib/airtable';
import type { RecordUpdate } from '../lib/airtableWrite';
import {
  AirtableWriteError, RATE_LIMIT_DELAY_MS, RETRY_DELAYS_MS, WRITE_ERROR_MESSAGES, chunk, fieldsForChange, isRetryable, patchRecords,
} from '../lib/airtableWrite';
import type { LeadOverride, Overrides } from '../lib/storage';
import type { Lead } from '../types';

/** SPEC X2: per-lead sync state shown in the lead card. */
export type LeadSyncState = 'saved' | 'pending' | 'error';

export interface AirtableSync {
  /** Leads waiting to be written or being written now. */
  pendingCount: number;
  /** Leads whose write failed after the automatic retries. */
  errorCount: number;
  /** Message of the latest failure (Hebrew), or null. */
  error: string | null;
  stateOf: (id: string) => LeadSyncState;
  retry: () => void;
}

export interface SyncOptions {
  fetchImpl?: typeof fetch;
  debounceMs?: number;
  retryDelays?: readonly number[];
  rateLimitDelay?: number;
  clock?: () => Date;
}

interface Failure { sent: LeadOverride; message: string }

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * SPEC X2: writes the store's unsynced changes back to Airtable in the background.
 * Changes within `debounceMs` are merged into one request; network/429/5xx are retried 3 times;
 * after that the lead shows an error until "נסה שוב". Without a config (mock data) nothing is sent.
 */
export function useAirtableSync(
  config: AirtableConfig | null,
  store: { leads: Lead[]; overrides: Overrides; commit: (id: string, sent: LeadOverride) => void },
  { fetchImpl, debounceMs = 1500, retryDelays = RETRY_DELAYS_MS, rateLimitDelay = RATE_LIMIT_DELAY_MS, clock = () => new Date() }: SyncOptions = {},
): AirtableSync {
  const { leads, overrides, commit } = store;
  const [inFlight, setInFlight] = useState<Record<string, true>>({});
  const [failures, setFailures] = useState<Record<string, Failure>>({});
  const [lastError, setLastError] = useState<string | null>(null);

  const latest = useRef({ leads, overrides, inFlight, failures });
  latest.current = { leads, overrides, inFlight, failures };
  const generation = useRef(0);
  const opts = useRef({ fetchImpl, retryDelays, rateLimitDelay, clock, commit });
  opts.current = { fetchImpl, retryDelays, rateLimitDelay, clock, commit };

  const failedNow = useCallback((id: string, f: Record<string, Failure>, o: Overrides) => !!f[id] && f[id].sent === o[id], []);

  const send = useCallback(
    async (cfg: AirtableConfig, updates: RecordUpdate[]) => {
      const { fetchImpl: f, retryDelays: delays, rateLimitDelay: rl } = opts.current;
      for (let attempt = 0; ; attempt++) {
        try {
          await patchRecords(cfg, updates, f ? { fetchImpl: f } : {});
          return;
        } catch (e) {
          if (!isRetryable(e) || attempt >= delays.length) throw e;
          const wait = (e as AirtableWriteError).code === 'rate-limit' ? Math.max(rl, delays[attempt]) : delays[attempt];
          await sleep(wait);
        }
      }
    },
    [],
  );

  const flush = useCallback(
    async (force = false) => {
      if (!config) return;
      const gen = generation.current;
      const { leads: ls, overrides: o, inFlight: busy, failures: f } = latest.current;
      const ids = Object.keys(o).filter((id) => !busy[id] && (force || !failedNow(id, f, o)));
      if (ids.length === 0) return;
      const byId = new Map(ls.map((l) => [l.id, l]));
      const now = opts.current.clock();
      const sent: Record<string, LeadOverride> = {};
      const updates: { leadId: string; update: RecordUpdate }[] = [];
      const missing: Record<string, Failure> = {};
      for (const id of ids) {
        sent[id] = o[id];
        const lead = byId.get(id);
        if (!lead?.recordId) missing[id] = { sent: o[id], message: WRITE_ERROR_MESSAGES['write-not-found'] };
        else updates.push({ leadId: id, update: { id: lead.recordId, fields: fieldsForChange(lead, o[id], now) } });
      }
      if (Object.keys(missing).length) {
        setFailures((prev) => ({ ...prev, ...missing }));
        setLastError(WRITE_ERROR_MESSAGES['write-not-found']);
      }
      const sending = Object.fromEntries(updates.map((u) => [u.leadId, true as const]));
      setInFlight((prev) => ({ ...prev, ...sending }));
      latest.current.inFlight = { ...latest.current.inFlight, ...sending };
      setFailures((prev) => {
        const next = { ...prev };
        for (const id of Object.keys(sending)) delete next[id];
        return next;
      });

      for (const batch of chunk(updates)) {
        try {
          await send(config, batch.map((b) => b.update));
          if (gen !== generation.current) return;
          for (const b of batch) opts.current.commit(b.leadId, sent[b.leadId]);
          setFailures((prev) => {
            const next = { ...prev };
            for (const b of batch) delete next[b.leadId];
            return next;
          });
        } catch (e) {
          if (gen !== generation.current) return;
          const message = e instanceof AirtableWriteError ? e.message : WRITE_ERROR_MESSAGES.unknown;
          setFailures((prev) => ({ ...prev, ...Object.fromEntries(batch.map((b) => [b.leadId, { sent: sent[b.leadId], message }])) }));
          setLastError(message);
        } finally {
          if (gen === generation.current) {
            setInFlight((prev) => {
              const next = { ...prev };
              for (const b of batch) delete next[b.leadId];
              return next;
            });
          }
        }
      }
    },
    [config, send, failedNow],
  );

  // A new connection (or disconnect) abandons writes that belong to the previous one.
  useEffect(() => {
    generation.current++;
    setInFlight({});
    setFailures({});
    setLastError(null);
  }, [config]);

  // Debounce: every change restarts the timer; when it fires, all due leads are sent together.
  const dueKey = useMemo(
    () => Object.keys(overrides).filter((id) => !inFlight[id] && !failedNow(id, failures, overrides)).length,
    [overrides, inFlight, failures, failedNow],
  );
  useEffect(() => {
    if (!config || dueKey === 0) return;
    const t = setTimeout(() => void flush(), debounceMs);
    return () => clearTimeout(t);
  }, [config, overrides, dueKey, debounceMs, flush]);

  const errorCount = useMemo(() => Object.keys(overrides).filter((id) => failedNow(id, failures, overrides)).length, [overrides, failures, failedNow]);
  const pendingCount = Object.keys(overrides).length - errorCount;

  // Warn before closing the tab while changes are not in Airtable yet.
  useEffect(() => {
    if (!config || pendingCount + errorCount === 0) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [config, pendingCount, errorCount]);

  const stateOf = useCallback(
    (id: string): LeadSyncState => (failedNow(id, failures, overrides) ? 'error' : overrides[id] ? 'pending' : 'saved'),
    [failures, overrides, failedNow],
  );

  const retry = useCallback(() => {
    setLastError(null);
    void flush(true);
  }, [flush]);

  return { pendingCount, errorCount, error: errorCount > 0 ? lastError : null, stateOf, retry };
}
