import { CheckCircle2, Coins, Inbox, Percent, Timer, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Kpis } from '../lib/metrics';
import { formatCompactMoney, formatMoney, formatNumber, formatPercent } from '../lib/format';
import { useMoney } from '../state/useDisplayCurrency';

interface Item { id: string; label: string; value: string; hint: string; icon: LucideIcon; tone: string }

export function KpiCards({ kpis }: { kpis: Kpis }) {
  const money = useMoney(); // SPEC X1
  const items: Item[] = [
    { id: 'total', label: 'סה"כ לידים', value: formatNumber(kpis.total), hint: 'בטווח המסונן', icon: Users, tone: 'bg-indigo-50 text-indigo-600' },
    { id: 'new', label: 'לידים חדשים', value: formatNumber(kpis.newCount), hint: 'טרם נוצר קשר', icon: Inbox, tone: 'bg-blue-50 text-blue-600' },
    { id: 'in-progress', label: 'בטיפול', value: formatNumber(kpis.inProgress), hint: 'קשר · הסמכה · הצעה', icon: Timer, tone: 'bg-amber-50 text-amber-600' },
    { id: 'won', label: 'הומרו ללקוחות', value: formatNumber(kpis.won), hint: `${formatMoney(kpis.wonValue, money)} נסגרו`, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { id: 'conversion', label: 'שיעור המרה', value: formatPercent(kpis.conversionRate), hint: 'הומרו מתוך כלל הלידים', icon: Percent, tone: 'bg-violet-50 text-violet-600' },
    { id: 'pipeline', label: 'שווי פוטנציאלי', value: formatCompactMoney(kpis.pipelineValue, money), hint: 'סכום לידים פתוחים', icon: Coins, tone: 'bg-rose-50 text-rose-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6 xl:gap-4">
      {items.map(({ id, label, value, hint, icon: Icon, tone }) => (
        <div key={id} className="min-w-0 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm" data-testid={`kpi-${id}`}>
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">{label}</p>
            <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon className="size-4" aria-hidden />
            </span>
          </div>
          <p className="mt-2 truncate text-xl font-bold tabular-nums text-slate-900 sm:text-2xl" data-testid="kpi-value" title={id === 'pipeline' ? formatMoney(kpis.pipelineValue, money) : undefined}>
            {value}
          </p>
          <p className="mt-1 truncate text-xs text-slate-400">{hint}</p>
        </div>
      ))}
    </div>
  );
}
