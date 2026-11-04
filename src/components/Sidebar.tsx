import { AlarmClock, Calculator, LayoutDashboard, RotateCcw, Users, X, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type NavId = 'overview' | 'leads' | 'stale' | 'scoring';

const NAV: { id: NavId; label: string; icon: LucideIcon }[] = [
  { id: 'overview', label: 'סקירה כללית', icon: LayoutDashboard },
  { id: 'leads', label: 'כל הלידים', icon: Users },
  { id: 'stale', label: 'ממתינים לטיפול', icon: AlarmClock },
  { id: 'scoring', label: 'שיטת הניקוד', icon: Calculator },
];

export function Sidebar({ active, staleCount, open, onNavigate, onClose, onReset }: {
  active: NavId;
  staleCount: number;
  open: boolean;
  onNavigate: (id: NavId) => void;
  onClose: () => void;
  onReset: () => void;
}) {
  return (
    <>
      {open && <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} />}
      <aside
        className={`fixed inset-y-0 start-0 z-40 flex w-64 flex-col bg-slate-900 text-slate-300 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? 'translate-x-0' : 'translate-x-full max-lg:invisible'
        }`}
        aria-label="תפריט ראשי"
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-indigo-500 text-white"><Zap className="size-5" /></span>
            <div>
              <p className="font-bold text-white">LeadPulse</p>
              <p className="text-xs text-slate-400">ניהול לידים חכם</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1 hover:bg-slate-800 lg:hidden" aria-label="סגירת תפריט"><X className="size-5" /></button>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              aria-current={active === id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                active === id ? 'bg-indigo-500/15 text-white' : 'hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className={`size-5 ${active === id ? 'text-indigo-400' : ''}`} />
              <span className="flex-1 text-start">{label}</span>
              {id === 'stale' && staleCount > 0 && (
                <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">{staleCount}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="space-y-3 border-t border-slate-800 p-4">
          <button type="button" onClick={onReset} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white">
            <RotateCcw className="size-4" /> איפוס נתוני דמה
          </button>
          <p className="px-2 text-[11px] leading-relaxed text-slate-500">כל הנתונים במערכת הם נתוני דמה (Mock Data) לצורכי תרגול.</p>
        </div>
      </aside>
    </>
  );
}
