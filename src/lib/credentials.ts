import type { AirtableConfig } from './airtable';

/**
 * Keeps the Airtable connection only in this browser (Practice §6: no tokens in Git).
 * "Remember me" → localStorage (survives closing the browser); otherwise sessionStorage
 * (cleared when the tab closes). Disconnect removes it from both.
 */
export const CREDENTIALS_KEY = 'lead-dashboard:airtable-connection';

export interface SavedConnection extends AirtableConfig {
  remember: boolean;
}

function stores(): { local?: Storage; session?: Storage } {
  try {
    return typeof window === 'undefined' ? {} : { local: window.localStorage, session: window.sessionStorage };
  } catch {
    return {};
  }
}

function parse(raw: string | null, remember: boolean): SavedConnection | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.token !== 'string' || typeof v.baseId !== 'string' || typeof v.table !== 'string' || !v.token) return null;
    return { token: v.token, baseId: v.baseId, table: v.table, remember };
  } catch {
    return null;
  }
}

export function loadConnection(): SavedConnection | null {
  const { local, session } = stores();
  return parse(session?.getItem(CREDENTIALS_KEY) ?? null, false) ?? parse(local?.getItem(CREDENTIALS_KEY) ?? null, true);
}

export function saveConnection({ remember, ...config }: SavedConnection): void {
  const { local, session } = stores();
  clearConnection();
  try {
    (remember ? local : session)?.setItem(CREDENTIALS_KEY, JSON.stringify(config));
  } catch {
    // Storage blocked: stay connected for this page view only.
  }
}

export function clearConnection(): void {
  const { local, session } = stores();
  try {
    local?.removeItem(CREDENTIALS_KEY);
    session?.removeItem(CREDENTIALS_KEY);
  } catch {
    // ignore
  }
}

/** Last base/table used, without the token, so the form can be pre-filled after disconnect. */
export const LAST_TARGET_KEY = 'lead-dashboard:airtable-target';

export function loadLastTarget(): { baseId: string; table: string } | null {
  try {
    const v = JSON.parse(stores().local?.getItem(LAST_TARGET_KEY) ?? 'null') as { baseId?: unknown; table?: unknown } | null;
    return v && typeof v.baseId === 'string' && typeof v.table === 'string' ? { baseId: v.baseId, table: v.table } : null;
  } catch {
    return null;
  }
}

export function saveLastTarget(baseId: string, table: string): void {
  try {
    stores().local?.setItem(LAST_TARGET_KEY, JSON.stringify({ baseId, table }));
  } catch {
    // ignore
  }
}
