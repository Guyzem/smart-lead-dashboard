import { AlarmClock, Search, X } from 'lucide-react';
import { OWNERS, SOURCE_META, STATUS_META, UNASSIGNED, UNASSIGNED_LABEL } from '../constants';
import type { LeadFilters } from '../lib/filters';
import { EMPTY_FILTERS, isFiltered } from '../lib/filters';
import { SOURCES, STATUSES } from '../types';
import type { Source, Status } from '../types';

const selectCls =
  'h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

export function FilterBar({ filters, onChange, shown, total }: {
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  shown: number;
  total: number;
}) {
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]">
        <label className="relative col-span-2 lg:col-span-1">
          <span className="sr-only">חיפוש</span>
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={filters.query}
            onChange={(e) => set({ query: e.target.value })}
            placeholder="חיפוש לפי שם לקוח או חברה…"
            aria-label="חיפוש לפי שם לקוח או חברה"
            className={`${selectCls} ps-9`}
          />
        </label>
        <select aria-label="סינון לפי סטטוס" className={selectCls} value={filters.status} onChange={(e) => set({ status: e.target.value as Status | 'all' })}>
          <option value="all">כל הסטטוסים</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
        <select aria-label="סינון לפי מקור" className={selectCls} value={filters.source} onChange={(e) => set({ source: e.target.value as Source | 'all' })}>
          <option value="all">כל המקורות</option>
          {SOURCES.map((s) => <option key={s} value={s}>{SOURCE_META[s].label}</option>)}
        </select>
        <select aria-label="סינון לפי נציג" className={`${selectCls} col-span-2 sm:col-span-1`} value={filters.owner} onChange={(e) => set({ owner: e.target.value })}>
          <option value="all">כל הנציגים</option>
          {OWNERS.map((o) => <option key={o} value={o}>{o}</option>)}
          <option value={UNASSIGNED}>{UNASSIGNED_LABEL}</option>
        </select>
        <button
          type="button"
          onClick={() => set({ staleOnly: !filters.staleOnly })}
          aria-pressed={filters.staleOnly}
          className={`col-span-2 inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-sm font-medium shadow-sm sm:col-span-1 ${
            filters.staleOnly ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
          }`}
        >
          <AlarmClock className="size-4" aria-hidden />
          ממתינים לטיפול
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
        <p className="text-slate-500" data-testid="result-count">
          מציג <span className="font-semibold text-slate-900">{shown}</span> מתוך {total} לידים
        </p>
        {isFiltered(filters) && (
          <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-indigo-600 hover:bg-indigo-50">
            <X className="size-4" aria-hidden /> נקה סינון
          </button>
        )}
      </div>
    </div>
  );
}
