import { AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import type { AirtableSync, LeadSyncState } from '../state/useAirtableSync';

/** SPEC X2: header indicator for writes to Airtable. Text hides below `md` (icon only at 375px). */
export function SyncStatus({ sync }: { sync: AirtableSync }) {
  if (sync.errorCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs text-rose-700 ring-1 ring-inset ring-rose-600/20" data-testid="sync-status" data-state="error" title={sync.error ?? undefined}>
        <AlertCircle className="size-3.5 shrink-0" aria-hidden />
        <span className="hidden md:inline">שגיאת שמירה ב-Airtable ({sync.errorCount})</span>
        <button type="button" onClick={sync.retry} className="inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline" aria-label="נסה שוב לשמור ב-Airtable">
          <RefreshCw className="size-3.5 md:hidden" aria-hidden /> <span className="hidden md:inline">· נסה שוב</span>
        </button>
      </span>
    );
  }
  if (sync.pendingCount > 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs text-amber-800 ring-1 ring-inset ring-amber-600/20" data-testid="sync-status" data-state="pending" role="status" aria-label={`שומר ב-Airtable… (${sync.pendingCount})`}>
        <Loader2 className="size-3.5 shrink-0 animate-spin" aria-hidden />
        <span className="hidden md:inline">שומר ב-Airtable… ({sync.pendingCount})</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700 ring-1 ring-inset ring-emerald-600/20" data-testid="sync-status" data-state="saved" role="status" aria-label="נשמר ב-Airtable">
      <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
      <span className="hidden md:inline">נשמר ב-Airtable</span>
    </span>
  );
}

const LEAD_LABELS: Record<LeadSyncState, { text: string; cls: string }> = {
  saved: { text: 'נשמר ב-Airtable', cls: 'text-emerald-700' },
  pending: { text: 'ממתין לשמירה', cls: 'text-amber-700' },
  error: { text: 'לא נשמר', cls: 'text-rose-700' },
};

/** SPEC X2: per-lead state in the lead card, next to the status. */
export function LeadSyncBadge({ state }: { state: LeadSyncState }) {
  const { text, cls } = LEAD_LABELS[state];
  return (
    <span className={`text-xs font-medium ${cls}`} data-testid="lead-sync" data-state={state}>
      {text}
    </span>
  );
}
