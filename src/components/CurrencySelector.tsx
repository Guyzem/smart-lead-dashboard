import { Loader2 } from 'lucide-react';
import type { Currency } from '../lib/exchangeRates';
import { CURRENCIES, CURRENCY_LABELS } from '../lib/exchangeRates';
import type { DisplayCurrency } from '../state/useDisplayCurrency';

/** "2026-11-13" → "13.11.2026" without going through Date (no time-zone shift). */
export function formatRateDate(isoDay: string): string {
  const [y, m, d] = isoDay.split('-');
  return `${d}.${m}.${y}`;
}

/** SPEC X1: display-currency dropdown in the header, with the rate date and source under it. */
export function CurrencySelector({ fx }: { fx: DisplayCurrency }) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-0.5" data-testid="currency-selector">
      <select
        aria-label="מטבע תצוגה"
        value={fx.selected}
        onChange={(e) => fx.select(e.target.value as Currency)}
        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-sm text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
      >
        {CURRENCIES.map((c) => (
          <option key={c} value={c}>{CURRENCY_LABELS[c]}</option>
        ))}
      </select>
      {fx.loading ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-500" role="status">
          <Loader2 className="size-3 animate-spin" aria-hidden /> טוען שערי מטבע…
        </span>
      ) : fx.rateDate ? (
        <span className="max-w-[9.5rem] text-[11px] leading-tight text-slate-500 sm:max-w-none" data-testid="rate-note">
          שער נכון ל-{formatRateDate(fx.rateDate)} · מקור: Frankfurter / ECB
        </span>
      ) : null}
    </div>
  );
}
