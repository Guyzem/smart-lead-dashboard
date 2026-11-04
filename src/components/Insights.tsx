import { AlarmClock, ChevronLeft } from 'lucide-react';
import { UNASSIGNED, UNASSIGNED_LABEL } from '../constants';
import type { RepRow } from '../lib/metrics';
import { formatCompactCurrency, formatCurrency, formatPercent, orEmpty } from '../lib/format';
import type { ScoredLead } from '../types';
import { Card, EmptyState, PriorityBadge, ScorePill, StatusBadge } from './ui';

/** "במה לטפל היום": open leads ranked by rule-based score (SPEC S2). */
export function PriorityList({ leads, onOpen, onShowAll }: { leads: ScoredLead[]; onOpen: (id: string) => void; onShowAll: () => void }) {
  const top = leads
    .filter((l) => l.priority)
    .sort((a, b) => b.score.total - a.score.total || Number(b.stale) - Number(a.stale))
    .slice(0, 6);
  return (
    <Card title="במה לטפל היום" subtitle="לידים פתוחים לפי Lead Score (חוקים שקופים)"
      action={<button type="button" onClick={onShowAll} className="inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-sm text-indigo-600 hover:underline">לכל הלידים <ChevronLeft className="size-4" /></button>}>
      {top.length === 0 ? <EmptyState title="אין לידים פתוחים בטווח המסונן" /> : (
        <ul className="divide-y divide-slate-100" data-testid="priority-list">
          {top.map((l) => (
            <li key={l.id}>
              <button type="button" onClick={() => onOpen(l.id)} className="flex w-full items-center gap-3 py-2.5 text-start hover:bg-slate-50">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                    {l.name}
                    {l.stale && <AlarmClock className="size-3.5 shrink-0 text-rose-500" aria-label="ממתין לטיפול" />}
                  </p>
                  <p className="truncate text-xs text-slate-500">{orEmpty(l.company)} · {formatCurrency(l.value)}</p>
                </div>
                <div className="hidden sm:block"><StatusBadge status={l.status} /></div>
                <PriorityBadge priority={l.priority} />
                <ScorePill score={l.score.total} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function RepTable({ rows, onSelect }: { rows: RepRow[]; onSelect: (owner: string) => void }) {
  return (
    <Card title="ביצועי נציגים" subtitle="לחיצה על נציג מציגה רק את הלידים שלו">
      {rows.length === 0 ? <EmptyState title="אין נתונים להצגה" /> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm" data-testid="rep-table">
            <thead className="text-xs text-slate-500">
              <tr className="border-b border-slate-100">
                <th className="py-2 text-start font-medium">נציג</th>
                <th className="py-2 text-start font-medium">לידים</th>
                <th className="py-2 text-start font-medium">פתוחים</th>
                <th className="py-2 text-start font-medium">ממתינים</th>
                <th className="py-2 text-start font-medium">הומרו</th>
                <th className="py-2 text-start font-medium">שיעור המרה</th>
                <th className="py-2 text-start font-medium">צנרת פתוחה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.owner} className="cursor-pointer hover:bg-slate-50" onClick={() => onSelect(r.owner)}>
                  <td className="py-2.5 font-medium text-slate-900">{r.owner === UNASSIGNED ? UNASSIGNED_LABEL : r.owner}</td>
                  <td className="py-2.5 tabular-nums">{r.total}</td>
                  <td className="py-2.5 tabular-nums">{r.open}</td>
                  <td className={`py-2.5 tabular-nums ${r.stale ? 'font-semibold text-rose-600' : ''}`}>{r.stale}</td>
                  <td className="py-2.5 tabular-nums text-emerald-600">{r.won}</td>
                  <td className="py-2.5 tabular-nums">{formatPercent(r.conversionRate)}</td>
                  <td className="py-2.5 tabular-nums" title={formatCurrency(r.pipelineValue)}>{formatCompactCurrency(r.pipelineValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export function StaleAlert({ count, onShow }: { count: number; onShow: () => void }) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" data-testid="stale-alert">
      <span className="flex items-center gap-2">
        <AlarmClock className="size-4 shrink-0" />
        <span><strong>{count}</strong> לידים פתוחים ממתינים לטיפול 7 ימים ומעלה</span>
      </span>
      <button type="button" onClick={onShow} className="rounded-lg bg-white px-3 py-1 font-medium text-rose-700 shadow-sm hover:bg-rose-100">הצג אותם</button>
    </div>
  );
}
