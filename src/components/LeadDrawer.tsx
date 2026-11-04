import { AlarmClock, Building2, Calendar, MessageSquarePlus, Phone, User, Wallet, X } from 'lucide-react';
import type { FormEvent, ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { INTEREST_LABELS, SOURCE_META, STALE_DAYS, URGENCY_LABELS } from '../constants';
import { daysSince } from '../lib/dates';
import { formatCurrency, formatDate, orEmpty } from '../lib/format';
import type { ScoredLead, Status } from '../types';
import { StatusSelect } from './LeadsTable';
import { PriorityBadge, ScorePill } from './ui';

function Row({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-slate-400">{icon}</span>
      <span className="w-24 shrink-0 text-sm text-slate-500">{label}</span>
      <span className="min-w-0 truncate text-sm font-medium text-slate-800">{children}</span>
    </div>
  );
}

export function LeadDrawer({ lead, now, onClose, onStatusChange, onAddNote }: {
  lead: ScoredLead | null;
  now: Date;
  onClose: () => void;
  onStatusChange: (id: string, s: Status) => void;
  onAddNote: (id: string, text: string) => void;
}) {
  const [draft, setDraft] = useState('');
  useEffect(() => setDraft(''), [lead?.id]);
  useEffect(() => {
    if (!lead) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lead, onClose]);

  if (!lead) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    onAddNote(lead.id, draft);
    setDraft('');
  };

  const parts = [
    { label: `מקור (${lead.source})`, value: lead.score.source, max: 25 },
    { label: `רמת עניין (${INTEREST_LABELS[lead.interest]})`, value: lead.score.interest, max: 25 },
    { label: `תקציב (${formatCurrency(lead.value)})`, value: lead.score.budget, max: 20 },
    { label: `דחיפות (${URGENCY_LABELS[lead.urgency]})`, value: lead.score.urgency, max: 15 },
    { label: `טריות (${daysSince(lead.createdAt, now)} ימים)`, value: lead.score.recency, max: 15 },
  ];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={`כרטיס ליד: ${lead.name}`}>
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px]" onClick={onClose} data-testid="drawer-backdrop" />
      <aside className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col bg-white shadow-2xl" data-testid="lead-drawer">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">{lead.id}</p>
            <h2 className="truncate text-lg font-bold text-slate-900">{lead.name}</h2>
            <p className="truncate text-sm text-slate-500">{orEmpty(lead.company)} · {orEmpty(lead.industry)}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="סגירה" className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-slate-100">
            <X className="size-5" />
          </button>
        </header>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusSelect lead={lead} onChange={(s) => onStatusChange(lead.id, s)} />
            <PriorityBadge priority={lead.priority} />
            {lead.stale && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700 ring-1 ring-inset ring-rose-600/20">
                <AlarmClock className="size-3" /> ממתין לטיפול {daysSince(lead.lastActivityAt, now)} ימים
              </span>
            )}
          </div>

          <div className="divide-y divide-slate-100 rounded-xl border border-slate-100 px-3">
            <Row icon={<Building2 className="size-4" />} label="מקור">{SOURCE_META[lead.source].label}</Row>
            <Row icon={<User className="size-4" />} label="נציג">{lead.owner ?? 'לא משויך'}</Row>
            <Row icon={<Wallet className="size-4" />} label="שווי משוער">{formatCurrency(lead.value)}</Row>
            <Row icon={<Calendar className="size-4" />} label="תאריך קבלה">{formatDate(lead.createdAt)}</Row>
            <Row icon={<Calendar className="size-4" />} label="פעילות אחרונה">{formatDate(lead.lastActivityAt)}</Row>
            <Row icon={<Phone className="size-4" />} label="טלפון"><span dir="ltr">{lead.phone}</span></Row>
          </div>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">למה הציון הוא {lead.score.total}?</h3>
              <ScorePill score={lead.score.total} />
            </div>
            <ul className="space-y-2" data-testid="score-breakdown">
              {parts.map((p) => (
                <li key={p.label}>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>{p.label}</span>
                    <span className="tabular-nums">{p.value}/{p.max}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(p.value / p.max) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-400">ציון מבוסס חוקים קבועים ושקופים, לא חיזוי של בינה מלאכותית.</p>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">הערות ואינטראקציות ({lead.notes.length})</h3>
            <form onSubmit={submit} className="mb-3 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="תיעוד שיחה, פגישה או הערה…"
                aria-label="הערה חדשה"
                className="w-full resize-none rounded-xl border border-slate-200 p-3 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button type="submit" disabled={!draft.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-40">
                <MessageSquarePlus className="size-4" /> הוספת הערה
              </button>
            </form>
            {lead.notes.length === 0 ? (
              <p className="text-sm text-slate-400">אין הערות עדיין.</p>
            ) : (
              <ol className="space-y-2" data-testid="notes-list">
                {[...lead.notes].reverse().map((n) => (
                  <li key={n.id} className="rounded-xl bg-slate-50 p-3">
                    <p className="text-sm text-slate-700">{n.text}</p>
                    <p className="mt-1 text-xs text-slate-400">{formatDate(n.createdAt)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <p className="text-xs text-slate-400">ליד פתוח ללא פעילות {STALE_DAYS} ימים ומעלה מסומן "ממתין לטיפול".</p>
        </div>
      </aside>
    </div>
  );
}
