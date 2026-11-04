import { OWNERS } from '../constants';
import { DAY_MS } from '../lib/dates';
import type { Lead, Level, Note, OpenStatus, Source, Status } from '../types';

/**
 * Deterministic mock data (SPEC §4 M6). Same seed → same leads.
 * Dates are relative to `now`, so the data always looks current.
 */
export const DEFAULT_SEED = 20261104;
export const DEFAULT_COUNT = 120;
export const MAX_AGE_DAYS = 90;

const HOUR_MS = 3_600_000;

const FIRST_NAMES = [
  'אבי', 'אביטל', 'אלון', 'אורית', 'בועז', 'גלית', 'גיל', 'דניאל', 'הדס', 'זיו',
  'חן', 'טל', 'יעל', 'יונתן', 'כרמית', 'ליאור', 'מאיה', 'משה', 'נטע', 'עומר',
  'עדי', 'פזית', 'רון', 'רותם', 'שירה', 'שחר', 'תמר', 'איתי', 'ענבל', 'עמית',
  'סיגל', 'רועי', 'נוי', 'אריאל', 'הילה', 'יובל', 'שני', 'אסף', 'מירב', 'אלעד',
];

const LAST_NAMES = [
  'כהן', 'לוי', 'מזרחי', 'פרץ', 'ביטון', 'דהן', 'אברהם', 'פרידמן', 'שפירא', 'גולן',
  'אזולאי', 'מלכה', 'חדד', 'עמר', 'בן דוד', 'רוזן', 'ברק', 'שמעוני', 'נחום', 'טל',
  'קפלן', 'אוחיון', 'יוסף', 'סויסה', 'וקנין', 'גבאי', 'אשכנזי', 'הרשקוביץ', 'זילברמן', 'בירנבאום',
];

const COMPANIES: { name: string; industry: string }[] = [
  { name: 'טכנולוגיות אופק', industry: 'הייטק' },
  { name: 'קוד-פלוס מערכות', industry: 'הייטק' },
  { name: 'דאטה-ליין', industry: 'הייטק' },
  { name: 'סייבר-שילד', industry: 'הייטק' },
  { name: 'נדל"ן הגליל', industry: 'נדל"ן' },
  { name: 'בוני השרון', industry: 'נדל"ן' },
  { name: 'מגדלי החוף', industry: 'נדל"ן' },
  { name: 'רשת סטייל', industry: 'קמעונאות' },
  { name: 'הבית הירוק', industry: 'קמעונאות' },
  { name: 'אופנת דרום', industry: 'קמעונאות' },
  { name: 'מרפאות שלום', industry: 'בריאות' },
  { name: 'קליניקת אור', industry: 'בריאות' },
  { name: 'מכון פיזיו-פלוס', industry: 'בריאות' },
  { name: 'אקדמיה דיגיטלית', industry: 'חינוך' },
  { name: 'מכללת הצפון', industry: 'חינוך' },
  { name: 'ייעוץ פיננסי מגן', industry: 'פיננסים' },
  { name: 'השקעות אלפא', industry: 'פיננסים' },
  { name: 'ביטוח ישיר-פלוס', industry: 'פיננסים' },
  { name: 'מאפיית השוק', industry: 'מזון ומשקאות' },
  { name: 'יקב הגבעה', industry: 'מזון ומשקאות' },
  { name: 'קפה מרום', industry: 'מזון ומשקאות' },
  { name: 'מתכת השפלה', industry: 'תעשייה' },
  { name: 'פלסטו-טק', industry: 'תעשייה' },
  { name: 'שילוח מהיר', industry: 'לוגיסטיקה' },
  { name: 'מחסני המרכז', industry: 'לוגיסטיקה' },
  { name: 'טיולי ארץ', industry: 'תיירות' },
  { name: 'מלון חוף כחול', industry: 'תיירות' },
  { name: 'משרד עו"ד לוין ושות\'', industry: 'שירותים משפטיים' },
  { name: 'סטודיו פיקסל', industry: 'שיווק ופרסום' },
  { name: 'מדיה-פרו', industry: 'שיווק ופרסום' },
];

const NOTE_TEMPLATES: Record<Exclude<Status, 'new'>, string[]> = {
  contacted: ['שיחה ראשונה, ביקש חומר כתוב', 'נשלח מייל היכרות', 'לא ענה, נשלחה הודעה'],
  qualified: ['יש תקציב מאושר לרבעון', 'מקבל ההחלטות זוהה', 'צורך ברור, מתאים לחבילה המורחבת'],
  proposal: ['נשלחה הצעת מחיר', 'מבקש הנחה של 10%', 'פגישת הצגה נקבעה'],
  won: ['נחתם הסכם', 'התקבלה מקדמה', 'הועבר לצוות ההטמעה'],
  lost: ['בחר במתחרה', 'אין תקציב כרגע', 'לא רלוונטי בשלב זה'],
};

/** mulberry32: tiny seeded PRNG, returns floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  count?: number;
  seed?: number;
  now?: Date;
}

export function generateLeads({ count = DEFAULT_COUNT, seed = DEFAULT_SEED, now = new Date() }: GenerateOptions = {}): Lead[] {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)];
  const weighted = <T extends string>(weights: Record<T, number>): T => {
    const entries = Object.entries(weights) as [T, number][];
    let r = rnd() * entries.reduce((s, [, w]) => s + w, 0);
    for (const [key, w] of entries) {
      r -= w;
      if (r < 0) return key;
    }
    return entries[entries.length - 1][0];
  };

  const nowMs = now.getTime();
  const leads: Lead[] = [];

  for (let i = 0; i < count; i++) {
    // Skew toward recent leads.
    const ageDays = Math.floor(Math.pow(rnd(), 1.3) * MAX_AGE_DAYS);
    const createdMs = nowMs - ageDays * DAY_MS - Math.floor(rnd() * 10) * HOUR_MS;

    const status: Status =
      ageDays <= 3
        ? weighted<Status>({ new: 6, contacted: 3, qualified: 1, proposal: 0, won: 0, lost: 0 })
        : ageDays <= 14
          ? weighted<Status>({ new: 25, contacted: 25, qualified: 20, proposal: 12, won: 8, lost: 10 })
          : weighted<Status>({ new: 8, contacted: 12, qualified: 15, proposal: 15, won: 25, lost: 25 });

    const source = weighted<Source>({ 'Google Ads': 30, SEO: 22, Facebook: 22, Referral: 12, Direct: 14 });
    const interest =
      status === 'won' ? weighted<Level>({ high: 6, medium: 3, low: 1 }) : weighted<Level>({ high: 3, medium: 4, low: 3 });
    const urgency = weighted<Level>({ high: 3, medium: 4, low: 3 });

    // A few records with missing data, to exercise edge cases (SPEC §5).
    const privateCustomer = rnd() < 0.05;
    const company = privateCustomer ? null : pick(COMPANIES);
    const unassigned = status === 'new' && rnd() < 0.2;
    const unvalued = status === 'new' && rnd() < 0.15;
    const value = unvalued ? null : Math.round((5_000 + Math.pow(rnd(), 1.6) * 115_000) / 500) * 500;

    const lostAtStage: OpenStatus | null =
      status === 'lost' ? weighted<OpenStatus>({ new: 1, contacted: 3, qualified: 3, proposal: 3 }) : null;

    let lastActivityMs = createdMs;
    if (status !== 'new') {
      const span = nowMs - createdMs;
      const factor = status === 'won' || status === 'lost' ? rnd() : Math.pow(rnd(), 1.8);
      lastActivityMs = nowMs - factor * span;
    }

    const notes: Note[] = [];
    if (status !== 'new') {
      const templates = NOTE_TEMPLATES[status];
      const n = 1 + Math.floor(rnd() * 2);
      for (let k = 0; k < n; k++) {
        const at = k === n - 1 ? lastActivityMs : createdMs + rnd() * (lastActivityMs - createdMs);
        notes.push({ id: `n-${i}-${k}`, text: pick(templates), createdAt: new Date(at).toISOString() });
      }
      notes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }

    const phoneDigits = Array.from({ length: 7 }, () => Math.floor(rnd() * 10)).join('');

    leads.push({
      id: `L-${1001 + i}`,
      name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
      company: company?.name ?? null,
      industry: company?.industry ?? null,
      phone: `05${pick(['0', '2', '3', '4', '8'])}-${phoneDigits}`,
      source,
      createdAt: new Date(createdMs).toISOString(),
      status,
      owner: unassigned ? null : pick(OWNERS),
      value,
      interest,
      urgency,
      lastActivityAt: new Date(lastActivityMs).toISOString(),
      lostAtStage,
      notes,
    });
  }

  return leads;
}
