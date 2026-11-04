import { AlarmClock, ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { SOURCE_META, STATUS_META } from '../constants';
import type { SortDir, SortKey } from '../lib/filters';
import { sortLeads } from '../lib/filters';
import { EMPTY, formatCurrency, formatDate, orEmpty } from '../lib/format';
import { STATUSES } from '../types';
import type { ScoredLead, Status } from '../types';
import { Card, EmptyState, PriorityBadge, ScorePill } from './ui';

const PAGE_SIZE = 15;

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'name', label: 'שם הלקוח' },
  { key: 'company', label: 'חברה' },
  { key: 'source', label: 'מקור' },
  { key: 'createdAt', label: 'תאריך קבלה' },
  { key: 'status', label: 'סטטוס' },
  { key: 'owner', label: 'נציג' },
  { key: 'value', label: 'שווי משוער' },
  { key: 'score', label: 'Lead Score' },
];

export function StatusSelect({ lead, onChange, className = '' }: { lead: ScoredLead; onChange: (s: Status) => void; className?: string }) {
  const m = STATUS_META[lead.status];
  return (
    <select
      aria-label={`שינוי סטטוס עבור ${lead.name}`}
      value={lead.status}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value as Status)}
      className={`cursor-pointer rounded-full border-0 py-1 pe-7 ps-3 text-xs font-medium ring-1 ring-inset focus:outline-none focus:ring-2 ${m.badge} ${className}`}
    >
      {STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
    </select>
  );
}

export function LeadsTable({ leads, onOpen, onStatusChange, onClearFilters, filterKey }: {
  leads: ScoredLead[];
  onOpen: (id: string) => void;
  onStatusChange: (id: string, s: Status) => void;
  onClearFilters: () => void;
  filterKey: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [filterKey, sortKey, sortDir]);

  const sorted = useMemo(() => sortLeads(leads, sortKey, sortDir), [leads, sortKey, sortDir]);
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const rows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir(key === 'name' || key === 'company' || key === 'owner' ? 'asc' : 'desc'); }
  };

  return (
    <Card title="טבלת לידים" subtitle="לחיצה על שורה פותחת את כרטיס הליד · מיון לפי לחיצה על כותרת" className="!p-0 [&>header]:px-5 [&>header]:pt-5">
      {leads.length === 0 ? (
        <EmptyState title="לא נמצאו לידים התואמים לחיפוש" hint="נסה לשנות את מילות החיפוש או את המסננים"
          action={<button type="button" onClick={onClearFilters} className="mt-2 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-700">נקה סינון</button>} />
      ) : (
        <>
          <div className="overflow-x-auto" data-testid="leads-table-scroll">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="border-y border-slate-100 bg-slate-50/70 text-xs text-slate-500">
                <tr>
                  {COLUMNS.map((c) => (
                    <th key={c.key} scope="col" className="px-4 py-3 text-start font-medium"
                      aria-sort={sortKey === c.key ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                      <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-slate-800">
                        {c.label}
                        {sortKey === c.key && (sortDir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-start font-medium">עדיפות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((l) => (
                  <tr key={l.id} data-testid="lead-row" onClick={() => onOpen(l.id)} className="cursor-pointer transition-colors hover:bg-indigo-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">{l.name.charAt(0)}</span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900" data-testid="lead-name">{l.name}</p>
                          <p className="text-xs text-slate-400">{l.id}</p>
                        </div>
                        {l.stale && <span title="ממתין לטיפול 7 ימים ומעלה" className="text-rose-500" data-testid="stale-flag"><AlarmClock className="size-4" aria-label="ממתין לטיפול" /></span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{orEmpty(l.company)}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-slate-600">
                        <span className="size-2 rounded-full" style={{ backgroundColor: SOURCE_META[l.source].color }} />{l.source}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">{formatDate(l.createdAt)}</td>
                    <td className="px-4 py-3"><StatusSelect lead={l} onChange={(s) => onStatusChange(l.id, s)} /></td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600">{l.owner ?? <span className="text-slate-400">לא משויך</span>}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums text-slate-800">{l.value == null ? EMPTY : formatCurrency(l.value)}</td>
                    <td className="px-4 py-3" data-testid="lead-score"><ScorePill score={l.score.total} /></td>
                    <td className="px-4 py-3"><PriorityBadge priority={l.priority} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-2 px-5 py-3 text-sm text-slate-500">
            <span>עמוד {current + 1} מתוך {pages}</span>
            <div className="flex gap-1">
              <button type="button" aria-label="עמוד קודם" disabled={current === 0} onClick={() => setPage(current - 1)}
                className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronRight className="size-4" /></button>
              <button type="button" aria-label="עמוד הבא" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}
                className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"><ChevronLeft className="size-4" /></button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}
