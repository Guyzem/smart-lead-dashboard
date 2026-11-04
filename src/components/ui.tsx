import type { ReactNode } from 'react';
import { PRIORITY_META, STATUS_META } from '../constants';
import type { Priority, Status } from '../types';

export function Card({ title, subtitle, action, children, className = '' }: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm ${className}`}>
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-base font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatusBadge({ status }: { status: Status }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      <span className="size-1.5 rounded-full" style={{ backgroundColor: m.color }} />
      {m.label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | null }) {
  if (!priority) return <span className="text-xs text-slate-400">—</span>;
  const m = PRIORITY_META[priority];
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.badge}`}>
      {priority === 'hot' && '🔥 '}
      {m.label}
    </span>
  );
}

export function ScorePill({ score }: { score: number }) {
  const tone = score >= 70 ? 'bg-rose-500' : score >= 40 ? 'bg-amber-400' : 'bg-sky-400';
  return (
    <span className="inline-flex items-center gap-2" title="ציון מבוסס חוקים (0–100)">
      <span className="relative h-1.5 w-12 overflow-hidden rounded-full bg-slate-100">
        <span className={`absolute inset-y-0 start-0 rounded-full ${tone}`} style={{ width: `${score}%` }} />
      </span>
      <span className="w-6 text-sm font-semibold tabular-nums text-slate-700">{score}</span>
    </span>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center" data-testid="empty-state">
      <div className="text-3xl">🔍</div>
      <p className="font-medium text-slate-700">{title}</p>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
      {action}
    </div>
  );
}
