import { SOURCE_META, STATUS_META, UNASSIGNED_LABEL } from '../constants';
import type { Lead, Level, Note, OpenStatus, Source, Status } from '../types';
import { OPEN_STATUSES, SOURCES, STATUSES } from '../types';

/**
 * Reads leads from an Airtable table through the REST API and maps them to the dashboard's Lead
 * model (SPEC §4, "מקור נתונים: Airtable"). Pure functions; `fetch` is injectable for tests.
 * The token is only ever sent to api.airtable.com in the Authorization header.
 */

export interface AirtableConfig {
  token: string;
  baseId: string;
  table: string; // table name or table ID
}

/** Defaults match the "Lead Dashboard" base and its "לידים" table. They are not secrets. */
export const DEFAULT_BASE_ID = 'appIES3oUATmgV2YL';
export const DEFAULT_TABLE = 'לידים';

/** Column names in the Airtable table (Hebrew, as created from demo-leads-500.csv). */
export const FIELDS = {
  id: 'מזהה',
  name: 'שם',
  company: 'חברה',
  industry: 'תחום',
  phone: 'טלפון',
  source: 'מקור',
  status: 'סטטוס',
  owner: 'נציג',
  value: 'שווי עסקה',
  interest: 'עניין',
  urgency: 'דחיפות',
  createdAt: 'תאריך יצירה',
  lastActivityAt: 'פעילות אחרונה',
  lostAtStage: 'אבד בשלב',
  notes: 'הערות',
} as const;

export type AirtableErrorCode = 'invalid-token' | 'forbidden' | 'not-found' | 'rate-limit' | 'network' | 'empty' | 'unknown';

export class AirtableError extends Error {
  constructor(public code: AirtableErrorCode, message: string) {
    super(message);
    this.name = 'AirtableError';
  }
}

export const ERROR_MESSAGES: Record<AirtableErrorCode, string> = {
  'invalid-token': 'הטוקן לא תקין או שפג תוקפו. בדוק שהעתקת את כולו (מתחיל ב-pat) ונסה שוב.',
  forbidden: 'לטוקן אין הרשאה לבסיס הזה. ודא שהוספת לו את ההרשאה data.records:read ואת הבסיס "Lead Dashboard" תחת Access.',
  'not-found': 'הבסיס או הטבלה לא נמצאו. בדוק את מזהה הבסיס (מתחיל ב-app) ואת שם הטבלה.',
  'rate-limit': 'Airtable חסם זמנית בגלל ריבוי בקשות. המתן כחצי דקה ונסה שוב.',
  network: 'אין חיבור ל-Airtable. בדוק את החיבור לאינטרנט ונסה שוב.',
  empty: 'הטבלה ריקה, או שאף רשומה בה לא כוללת שם וטלפון.',
  unknown: 'אירעה שגיאה לא צפויה בטעינת הנתונים מ-Airtable. נסה שוב.',
};

/** Basic shape checks before any network call. Returns a Hebrew error message or null. */
export function validateConfig(c: AirtableConfig): string | null {
  const token = c.token.trim();
  if (!token) return 'יש להזין טוקן.';
  if (!/^pat[A-Za-z0-9]+\.[A-Za-z0-9]+$/.test(token)) return 'הטוקן לא נראה תקין. Personal Access Token של Airtable מתחיל ב-pat ומכיל נקודה.';
  if (!/^app[A-Za-z0-9]{14}$/.test(c.baseId.trim())) return 'מזהה הבסיס לא תקין. הוא מתחיל ב-app ואורכו 17 תווים (מופיע בכתובת של הבסיס).';
  if (!c.table.trim()) return 'יש להזין שם או מזהה של טבלה.';
  return null;
}

// ---------- mapping ----------

const invert = <K extends string>(keys: readonly K[], label: (k: K) => string) =>
  new Map<string, K>(keys.flatMap((k) => [[label(k), k] as [string, K], [k, k] as [string, K]]));

const STATUS_BY_LABEL = invert(STATUSES, (s) => STATUS_META[s].label);
const SOURCE_BY_LABEL = invert(SOURCES, (s) => SOURCE_META[s].label);
const OPEN_BY_LABEL = invert(OPEN_STATUSES, (s) => STATUS_META[s].label);
const LEVELS: Record<string, Level> = {
  גבוה: 'high', גבוהה: 'high', high: 'high',
  בינוני: 'medium', בינונית: 'medium', medium: 'medium',
  נמוך: 'low', נמוכה: 'low', low: 'low',
};

type Fields = Record<string, unknown>;

/** Select values arrive as plain strings with the default cellFormat; tolerate {name} objects too. */
function text(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'object' && 'name' in (v as object)) return text((v as { name: unknown }).name);
  const s = String(v).trim();
  return s ? s : null;
}

function toIso(v: unknown, fallback: string): string {
  const s = text(v);
  if (!s) return fallback;
  // Date-only fields ("2026-09-22") are read as midday UTC so the Israeli calendar day is preserved.
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T12:00:00.000Z` : s);
  return Number.isNaN(t) ? fallback : new Date(t).toISOString();
}

function toNumber(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toNotes(v: unknown, id: string, at: string): Note[] {
  const s = text(v);
  if (!s) return [];
  return s
    .split(/\r?\n|\s\|\s/) // one note per line; the CSV import joined notes with " | "
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, i) => ({ id: `at-${id}-${i}`, text: line, createdAt: at }));
}

export interface AirtableRecord {
  id: string;
  createdTime?: string;
  fields: Fields;
}

/** Maps one Airtable record to a Lead. Returns null for rows without a name (e.g. blank rows). */
export function mapRecord(rec: AirtableRecord, now: Date): Lead | null {
  const f = rec.fields ?? {};
  const name = text(f[FIELDS.name]);
  if (!name) return null;
  const id = text(f[FIELDS.id]) ?? rec.id;
  const createdAt = toIso(f[FIELDS.createdAt], rec.createdTime ?? now.toISOString());
  const lastActivityAt = toIso(f[FIELDS.lastActivityAt], createdAt);
  const status: Status = STATUS_BY_LABEL.get(text(f[FIELDS.status]) ?? '') ?? 'new';
  const lostRaw = OPEN_BY_LABEL.get(text(f[FIELDS.lostAtStage]) ?? '') ?? null;
  const lostAtStage: OpenStatus | null = status === 'lost' ? lostRaw ?? 'new' : null;
  const owner = text(f[FIELDS.owner]);
  const source: Source = SOURCE_BY_LABEL.get(text(f[FIELDS.source]) ?? '') ?? 'Direct';
  return {
    id,
    name,
    company: text(f[FIELDS.company]),
    industry: text(f[FIELDS.industry]),
    phone: text(f[FIELDS.phone]) ?? '',
    source,
    createdAt,
    status,
    owner: owner === UNASSIGNED_LABEL ? null : owner,
    value: toNumber(f[FIELDS.value]),
    interest: LEVELS[text(f[FIELDS.interest]) ?? ''] ?? 'medium',
    urgency: LEVELS[text(f[FIELDS.urgency]) ?? ''] ?? 'medium',
    lastActivityAt,
    lostAtStage,
    notes: toNotes(f[FIELDS.notes], id, lastActivityAt),
  };
}

// ---------- fetching ----------

const API = 'https://api.airtable.com/v0';
const MAX_PAGES = 100; // 100 records per page → up to 10,000 leads

function errorFromStatus(status: number): AirtableError {
  if (status === 401) return new AirtableError('invalid-token', ERROR_MESSAGES['invalid-token']);
  if (status === 403) return new AirtableError('forbidden', ERROR_MESSAGES.forbidden);
  if (status === 404 || status === 422) return new AirtableError('not-found', ERROR_MESSAGES['not-found']);
  if (status === 429) return new AirtableError('rate-limit', ERROR_MESSAGES['rate-limit']);
  return new AirtableError('unknown', `${ERROR_MESSAGES.unknown} (קוד ${status})`);
}

export async function fetchAirtableLeads(
  config: AirtableConfig,
  { now = new Date(), fetchImpl = globalThis.fetch.bind(globalThis), signal }: { now?: Date; fetchImpl?: typeof fetch; signal?: AbortSignal } = {},
): Promise<Lead[]> {
  const base = `${API}/${encodeURIComponent(config.baseId.trim())}/${encodeURIComponent(config.table.trim())}`;
  const leads: Lead[] = [];
  let offset: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ pageSize: '100' });
    if (offset) params.set('offset', offset);
    let res: Response;
    try {
      res = await fetchImpl(`${base}?${params}`, { headers: { Authorization: `Bearer ${config.token.trim()}` }, signal });
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') throw e;
      throw new AirtableError('network', ERROR_MESSAGES.network);
    }
    if (!res.ok) throw errorFromStatus(res.status);
    const body = (await res.json()) as { records?: AirtableRecord[]; offset?: string };
    for (const rec of body.records ?? []) {
      const lead = mapRecord(rec, now);
      if (lead) leads.push(lead);
    }
    offset = body.offset;
    if (!offset) break;
  }
  if (leads.length === 0) throw new AirtableError('empty', ERROR_MESSAGES.empty);
  return leads;
}
