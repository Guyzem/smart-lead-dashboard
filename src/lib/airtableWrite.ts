import { STATUS_META } from '../constants';
import type { Lead } from '../types';
import type { AirtableConfig } from './airtable';
import { API, ERROR_MESSAGES, FIELDS } from './airtable';
import { isStale } from './scoring';
import type { LeadOverride } from './storage';

/**
 * SPEC X2: writes dashboard changes (status, notes) back to the Airtable "לידים" table with
 * the REST API. Pure helpers + one fetch call; `fetch` is injectable for tests.
 * The token is only ever sent to api.airtable.com in the Authorization header.
 */

export type WriteErrorCode = 'invalid-token' | 'write-forbidden' | 'write-not-found' | 'rate-limit' | 'network' | 'server' | 'unknown';

export const WRITE_ERROR_MESSAGES: Record<WriteErrorCode, string> = {
  'invalid-token': ERROR_MESSAGES['invalid-token'],
  'write-forbidden': 'לטוקן אין הרשאת כתיבה. הוסף לו את ההרשאה data.records:write (ורק לבסיס Lead Dashboard).',
  'write-not-found': 'הרשומה או השדה לא נמצאו ב-Airtable. ייתכן ששם עמודה או אפשרות ב-Select השתנו.',
  'rate-limit': ERROR_MESSAGES['rate-limit'],
  network: 'אין חיבור ל-Airtable. השינוי יישמר כשהחיבור יחזור.',
  server: 'Airtable לא זמין כרגע. נסה שוב בעוד רגע.',
  unknown: 'אירעה שגיאה לא צפויה בשמירה ל-Airtable.',
};

export class AirtableWriteError extends Error {
  constructor(public code: WriteErrorCode, message: string = WRITE_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'AirtableWriteError';
  }
}

/** Network, 429 and 5xx are retried automatically; 401/403/404/422 are not (SPEC X2). */
export const isRetryable = (e: unknown) =>
  e instanceof AirtableWriteError && (e.code === 'network' || e.code === 'rate-limit' || e.code === 'server');

/** Backoff before retry n (0-based): 2s, 4s, 8s; at least 30s after a 429 (Airtable's guidance). */
export const RETRY_DELAYS_MS = [2000, 4000, 8000] as const;
export const RATE_LIMIT_DELAY_MS = 30_000;
export const MAX_BATCH = 10;

/** Calendar day in Israel as YYYY-MM-DD, for the date-only "פעילות אחרונה" field. */
export function israelDate(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/**
 * Fields to PATCH for a lead, given the unsynced override: only fields that changed.
 * Status change → status, lost-at-stage, last activity, stale flag. Note → notes, last activity, stale flag.
 */
export function fieldsForChange(lead: Lead, change: LeadOverride, now: Date): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if ('status' in change) {
    out[FIELDS.status] = STATUS_META[lead.status].label;
    out[FIELDS.lostAtStage] = lead.status === 'lost' && lead.lostAtStage ? STATUS_META[lead.lostAtStage].label : null;
  }
  if ('notes' in change) out[FIELDS.notes] = lead.notes.map((n) => n.text).join('\n');
  if ('status' in change || 'notes' in change || 'lastActivityAt' in change) {
    out[FIELDS.lastActivityAt] = israelDate(lead.lastActivityAt);
    out[FIELDS.stale] = isStale(lead, now);
  }
  return out;
}

export interface RecordUpdate {
  id: string; // rec…
  fields: Record<string, unknown>;
}

function errorFromStatus(status: number): AirtableWriteError {
  if (status === 401) return new AirtableWriteError('invalid-token');
  if (status === 403) return new AirtableWriteError('write-forbidden');
  if (status === 404 || status === 422) return new AirtableWriteError('write-not-found');
  if (status === 429) return new AirtableWriteError('rate-limit');
  if (status >= 500) return new AirtableWriteError('server');
  return new AirtableWriteError('unknown', `${WRITE_ERROR_MESSAGES.unknown} (קוד ${status})`);
}

/** One PATCH with up to 10 records. `typecast: false` so a wrong value fails instead of adding a select option. */
export async function patchRecords(
  config: AirtableConfig,
  updates: RecordUpdate[],
  { fetchImpl = globalThis.fetch.bind(globalThis) }: { fetchImpl?: typeof fetch } = {},
): Promise<void> {
  if (updates.length === 0) return;
  if (updates.length > MAX_BATCH) throw new RangeError(`Airtable accepts at most ${MAX_BATCH} records per request`);
  const url = `${API}/${encodeURIComponent(config.baseId.trim())}/${encodeURIComponent(config.table.trim())}`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${config.token.trim()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: updates, typecast: false }),
    });
  } catch {
    throw new AirtableWriteError('network');
  }
  if (!res.ok) throw errorFromStatus(res.status);
}

export const chunk = <T,>(items: T[], size = MAX_BATCH): T[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, (i + 1) * size));
