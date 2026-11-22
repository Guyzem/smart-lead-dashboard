import { AlertCircle, ExternalLink, Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Zap } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import type { AirtableConfig } from '../lib/airtable';
import { DEFAULT_BASE_ID, DEFAULT_TABLE, validateConfig } from '../lib/airtable';

const inputCls =
  'h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100';

/** Connection screen shown before any data (SPEC §4 "מקור נתונים: Airtable"). */
export function ConnectScreen({ onConnect, busy, error, initial }: {
  onConnect: (config: AirtableConfig, remember: boolean) => void;
  busy: boolean;
  error: string | null;
  initial?: { baseId?: string; table?: string };
}) {
  const [token, setToken] = useState('');
  const [baseId, setBaseId] = useState(initial?.baseId ?? DEFAULT_BASE_ID);
  const [table, setTable] = useState(initial?.table ?? DEFAULT_TABLE);
  const [remember, setRemember] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const config = { token: token.trim(), baseId: baseId.trim(), table: table.trim() };
    const problem = validateConfig(config);
    setLocalError(problem);
    if (!problem) onConnect(config, remember);
  };

  const shownError = localError ?? error;

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid size-10 place-items-center rounded-xl bg-indigo-500 text-white"><Zap className="size-5" /></span>
          <div>
            <p className="text-lg font-bold text-slate-900">LeadPulse</p>
            <p className="text-xs text-slate-500">ניהול לידים חכם</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm" aria-label="התחברות ל-Airtable" noValidate>
          <header className="space-y-1">
            <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900"><KeyRound className="size-5 text-indigo-500" /> התחברות ל-Airtable</h1>
            <p className="text-sm text-slate-500">כדי להציג את הלידים, הזן Personal Access Token של Airtable עם הרשאות קריאה וכתיבה לבסיס הלידים.</p>
          </header>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-slate-700">טוקן גישה (Personal Access Token)</span>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pat..."
                autoComplete="off"
                spellCheck={false}
                dir="ltr"
                className={`${inputCls} ps-11 font-mono text-start`}
                aria-invalid={Boolean(shownError)}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                className="absolute end-1.5 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={showToken ? 'הסתרת הטוקן' : 'הצגת הטוקן'}
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">מזהה בסיס (Base ID)</span>
              <input value={baseId} onChange={(e) => setBaseId(e.target.value)} dir="ltr" spellCheck={false} className={`${inputCls} font-mono text-start`} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium text-slate-700">טבלה (שם או מזהה)</span>
              <input value={table} onChange={(e) => setTable(e.target.value)} className={inputCls} />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 rounded border-slate-300 accent-indigo-500" />
            זכור אותי במחשב הזה
          </label>

          {shownError && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/20">
              <AlertCircle className="mt-0.5 size-4 shrink-0" /> <span>{shownError}</span>
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? <><Loader2 className="size-4 animate-spin" /> טוען לידים מ-Airtable…</> : 'התחבר והצג נתונים'}
          </button>

          <div className="space-y-2 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
            <p className="flex items-start gap-1.5">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              <span>
                הטוקן נשמר רק בדפדפן שלך ונשלח רק ל-Airtable. בלי "זכור אותי" הוא נמחק כשסוגרים את הלשונית.
                אפשר להתנתק בכל רגע מהתפריט.
              </span>
            </p>
            <p>
              אין לך טוקן?{' '}
              <a href="https://airtable.com/create/tokens" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:underline">
                ליצירת טוקן ב-Airtable <ExternalLink className="size-3" />
              </a>
              {' '}בחר הרשאות <span dir="ltr" className="font-mono">data.records:read</span> ו-<span dir="ltr" className="font-mono">data.records:write</span> והוסף רק את הבסיס של הלידים.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
