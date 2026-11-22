import { AlertCircle, Loader2, LogOut, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import App from './App';
import { ConnectScreen } from './components/ConnectScreen';
import type { AirtableConfig } from './lib/airtable';
import { AirtableError, ERROR_MESSAGES, fetchAirtableLeads } from './lib/airtable';
import { clearConnection, loadConnection, loadLastTarget, saveConnection, saveLastTarget } from './lib/credentials';
import { airtableStorageKey } from './lib/storage';
import type { Lead } from './types';

type State =
  | { phase: 'connect'; error: string | null; busy: boolean }
  | { phase: 'restoring'; config: AirtableConfig; error: string | null }
  | { phase: 'ready'; config: AirtableConfig; leads: Lead[]; loadedAt: Date; refreshing: boolean; refreshError: string | null };

const messageOf = (e: unknown) => (e instanceof AirtableError ? e.message : ERROR_MESSAGES.unknown);
/** Errors that mean the saved connection itself is wrong, so it is dropped and the form is shown. */
const isCredentialError = (e: unknown) => e instanceof AirtableError && ['invalid-token', 'forbidden', 'not-found'].includes(e.code);

/**
 * Gate in front of the dashboard: nothing is shown until leads were loaded from Airtable
 * with the token the user entered (SPEC §4 "מקור נתונים: Airtable").
 */
export default function Root({ fetchLeads = fetchAirtableLeads }: { fetchLeads?: typeof fetchAirtableLeads }) {
  const [state, setState] = useState<State>(() => {
    const saved = loadConnection();
    return saved ? { phase: 'restoring', config: saved, error: null } : { phase: 'connect', error: null, busy: false };
  });
  const attempt = useRef(0);

  const load = useCallback(
    async (config: AirtableConfig, onError: (e: unknown) => void) => {
      const id = ++attempt.current;
      try {
        const leads = await fetchLeads(config);
        if (id === attempt.current) setState({ phase: 'ready', config, leads, loadedAt: new Date(), refreshing: false, refreshError: null });
        return true;
      } catch (e) {
        if (id === attempt.current) onError(e);
        return false;
      }
    },
    [fetchLeads],
  );

  const restore = useCallback(
    (config: AirtableConfig) => {
      setState({ phase: 'restoring', config, error: null });
      void load(config, (e) => {
        if (isCredentialError(e)) {
          clearConnection();
          setState({ phase: 'connect', error: messageOf(e), busy: false });
        } else setState({ phase: 'restoring', config, error: messageOf(e) });
      });
    },
    [load],
  );

  // Saved connection ("remember me" or same tab): load it once on start.
  const restoredOnce = useRef(false);
  useEffect(() => {
    if (restoredOnce.current) return;
    restoredOnce.current = true;
    if (state.phase === 'restoring') restore(state.config);
  }, [state, restore]);

  const connect = async (config: AirtableConfig, remember: boolean) => {
    setState({ phase: 'connect', error: null, busy: true });
    saveLastTarget(config.baseId, config.table);
    const ok = await load(config, (e) => setState({ phase: 'connect', error: messageOf(e), busy: false }));
    if (ok) saveConnection({ ...config, remember });
  };

  const disconnect = useCallback(() => {
    attempt.current++;
    clearConnection();
    setState({ phase: 'connect', error: null, busy: false });
  }, []);

  const refresh = useCallback(() => {
    if (state.phase !== 'ready') return;
    const { config } = state;
    setState({ ...state, refreshing: true, refreshError: null });
    void load(config, (e) => {
      if (isCredentialError(e)) {
        clearConnection();
        setState({ phase: 'connect', error: messageOf(e), busy: false });
      } else setState((s) => (s.phase === 'ready' ? { ...s, refreshing: false, refreshError: messageOf(e) } : s));
    });
  }, [state, load]);

  if (state.phase === 'connect') {
    return <ConnectScreen onConnect={connect} busy={state.busy} error={state.error} initial={loadLastTarget() ?? undefined} />;
  }

  if (state.phase === 'restoring') {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
        <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 text-center shadow-sm" data-testid="restore-screen">
          {state.error ? (
            <>
              <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-start text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
                <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{state.error}</span>
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => restore(state.config)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500">
                  <RefreshCw className="size-4" /> נסה שוב
                </button>
                <button type="button" onClick={disconnect} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  <LogOut className="size-4" /> התנתק
                </button>
              </div>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-indigo-500" /> טוען לידים מ-Airtable…
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <App
      key={`${state.config.baseId}:${state.config.table}`}
      leads={state.leads}
      storageKey={airtableStorageKey(state.config.baseId, state.config.table)}
      connection={{ config: state.config, loadedAt: state.loadedAt, refreshing: state.refreshing, refreshError: state.refreshError, onRefresh: refresh, onDisconnect: disconnect }}
    />
  );
}
