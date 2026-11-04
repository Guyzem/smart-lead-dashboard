import { INTEREST_LABELS, PRIORITY_THRESHOLDS, SOURCE_META, STALE_DAYS, URGENCY_LABELS } from '../constants';
import { BUDGET_TIERS, INTEREST_POINTS, MAX_SCORE, RECENCY_TIERS, SOURCE_POINTS, URGENCY_POINTS } from '../lib/scoring';
import { formatCurrency } from '../lib/format';
import type { Level, Source } from '../types';
import { Card, PriorityBadge } from './ui';

const LEVELS: Level[] = ['high', 'medium', 'low'];

function Block({ title, max, rows }: { title: string; max: number; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-slate-100 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500">עד {max} נק'</span>
      </div>
      <ul className="space-y-1 text-sm">
        {rows.map(([label, pts]) => (
          <li key={label} className="flex justify-between text-slate-600">
            <span>{label}</span><span className="font-medium tabular-nums text-slate-900">{pts}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Explains the rule-based score using the same constants the code uses (SPEC S1). */
export function ScoringPage() {
  const tiers = BUDGET_TIERS.map((t, i) => [
    i === 0 ? `${formatCurrency(t.min)} ומעלה` : i === BUDGET_TIERS.length - 1 ? `פחות מ-${formatCurrency(BUDGET_TIERS[i - 1].min)} / לא הוערך` : `${formatCurrency(t.min)} עד ${formatCurrency(BUDGET_TIERS[i - 1].min - 1)}`,
    t.points,
  ] as [string, number]);
  const recency: [string, number][] = [...RECENCY_TIERS.map((t) => [`עד ${t.maxDays} ימים`, t.points] as [string, number]), [`מעל ${RECENCY_TIERS[RECENCY_TIERS.length - 1].maxDays} ימים`, 0]];

  return (
    <div className="space-y-6">
      <Card title="איך מחושב ה-Lead Score?" subtitle={`ציון 0–${MAX_SCORE} שמחושב מחמישה רכיבים לפי חוקים קבועים`}>
        <p className="mb-4 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-900">
          הציון הוא <strong>נוסחה מבוססת חוקים</strong>, שקופה וניתנת לבדיקה. הוא <strong>אינו</strong> חיזוי של מודל בינה מלאכותית.
          בכרטיס של כל ליד מוצג פירוק הציון לרכיביו.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <Block title="מקור הליד" max={25} rows={(Object.keys(SOURCE_POINTS) as Source[]).map((s) => [SOURCE_META[s].label, SOURCE_POINTS[s]])} />
          <Block title="רמת עניין" max={25} rows={LEVELS.map((l) => [INTEREST_LABELS[l], INTEREST_POINTS[l]])} />
          <Block title="תקציב משוער" max={20} rows={tiers} />
          <Block title="דחיפות" max={15} rows={LEVELS.map((l) => [URGENCY_LABELS[l], URGENCY_POINTS[l]])} />
          <Block title="זמן מאז הפנייה" max={15} rows={recency} />
        </div>
      </Card>
      <Card title="עדיפות טיפול וסימון לידים ממתינים">
        <ul className="space-y-2 text-sm text-slate-700">
          <li className="flex items-center gap-2"><PriorityBadge priority="hot" /> ציון {PRIORITY_THRESHOLDS.hot} ומעלה</li>
          <li className="flex items-center gap-2"><PriorityBadge priority="warm" /> ציון {PRIORITY_THRESHOLDS.warm}–{PRIORITY_THRESHOLDS.hot - 1}</li>
          <li className="flex items-center gap-2"><PriorityBadge priority="cold" /> ציון מתחת ל-{PRIORITY_THRESHOLDS.warm}</li>
          <li>לידים שהומרו או אבדו אינם מקבלים עדיפות טיפול.</li>
          <li>ליד פתוח ללא פעילות (שינוי סטטוס או הערה) {STALE_DAYS} ימים ומעלה מסומן <strong>"ממתין לטיפול"</strong>.</li>
        </ul>
      </Card>
    </div>
  );
}
