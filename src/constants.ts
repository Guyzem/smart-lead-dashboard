import type { Level, Priority, Source, Status } from './types';

export const STATUS_META: Record<Status, { label: string; color: string; badge: string }> = {
  new: { label: 'חדש', color: '#3b82f6', badge: 'bg-blue-50 text-blue-700 ring-blue-600/20' },
  contacted: { label: 'נוצר קשר', color: '#8b5cf6', badge: 'bg-violet-50 text-violet-700 ring-violet-600/20' },
  qualified: { label: 'מוסמך', color: '#f59e0b', badge: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  proposal: { label: 'הצעת מחיר', color: '#f97316', badge: 'bg-orange-50 text-orange-700 ring-orange-600/20' },
  won: { label: 'הומר ללקוח', color: '#10b981', badge: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' },
  lost: { label: 'אבוד', color: '#94a3b8', badge: 'bg-slate-100 text-slate-600 ring-slate-500/20' },
};

export const SOURCE_META: Record<Source, { label: string; color: string }> = {
  'Google Ads': { label: 'Google Ads', color: '#2563eb' },
  SEO: { label: 'SEO', color: '#06b6d4' },
  Facebook: { label: 'Facebook', color: '#8b5cf6' },
  Referral: { label: 'הפניה (Referral)', color: '#10b981' },
  Direct: { label: 'ישיר (Direct)', color: '#f59e0b' },
};

export const INTEREST_LABELS: Record<Level, string> = { high: 'גבוה', medium: 'בינוני', low: 'נמוך' };
export const URGENCY_LABELS: Record<Level, string> = { high: 'גבוהה', medium: 'בינונית', low: 'נמוכה' };

export const PRIORITY_META: Record<Priority, { label: string; badge: string }> = {
  hot: { label: 'חם', badge: 'bg-rose-50 text-rose-700 ring-rose-600/20' },
  warm: { label: 'פושר', badge: 'bg-amber-50 text-amber-800 ring-amber-600/20' },
  cold: { label: 'קר', badge: 'bg-sky-50 text-sky-700 ring-sky-600/20' },
};

export const OWNERS = ['דנה כהן', 'יוסי לוי', 'מיכל אברהם', 'אורי פרידמן', 'נועה מזרחי'] as const;

/** Sentinel used by the owner filter for leads with no assigned rep. */
export const UNASSIGNED = '__unassigned__';
export const UNASSIGNED_LABEL = 'לא משויך';

/** Open lead with no activity for this many days is flagged "ממתין לטיפול" (SPEC §4 S3). */
export const STALE_DAYS = 7;

export const PRIORITY_THRESHOLDS = { hot: 70, warm: 40 } as const;
