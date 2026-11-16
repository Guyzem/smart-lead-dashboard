// SPEC X1: display-currency rates from the free Frankfurter API (daily ECB rates, no key or token).

/** The only place the Frankfurter address is defined. api.frankfurter.app redirects here. */
export const FRANKFURTER_BASE_URL = 'https://api.frankfurter.dev/v1';

export const CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type Currency = (typeof CURRENCIES)[number];
export type ForeignCurrency = Exclude<Currency, 'ILS'>;
export const FOREIGN_CURRENCIES = CURRENCIES.filter((c): c is ForeignCurrency => c !== 'ILS');

export const CURRENCY_LABELS: Record<Currency, string> = {
  ILS: '₪ שקל',
  USD: '$ דולר',
  EUR: '€ אירו',
  GBP: '£ לירה שטרלינג',
};

/** Rates are kept for one hour from the moment they were fetched (SPEC X1 "מטמון"). */
export const RATES_TTL_MS = 60 * 60 * 1000;
export const RATES_CACHE_KEY = 'leadpulse.fxRates.v1';

export const RATES_ERROR_MESSAGE = 'לא ניתן לטעון שערי מטבע כרגע. הסכומים מוצגים בשקלים.';

export interface ExchangeRates {
  /** Date the ECB rates refer to (YYYY-MM-DD). */
  date: string;
  /** Units of each currency per ₪1. */
  rates: Record<ForeignCurrency, number>;
}

interface CachedRates extends ExchangeRates {
  fetchedAt: number;
}

export function ratesUrl(): string {
  return `${FRANKFURTER_BASE_URL}/latest?from=ILS&to=${FOREIGN_CURRENCIES.join(',')}`;
}

/** Validates an API (or cache) payload; returns null when anything required is missing. */
export function parseRates(payload: unknown): ExchangeRates | null {
  if (!payload || typeof payload !== 'object') return null;
  const { date, rates } = payload as { date?: unknown; rates?: unknown };
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !rates || typeof rates !== 'object') return null;
  const out = {} as Record<ForeignCurrency, number>;
  for (const c of FOREIGN_CURRENCIES) {
    const r = (rates as Record<string, unknown>)[c];
    if (typeof r !== 'number' || !Number.isFinite(r) || r <= 0) return null;
    out[c] = r;
  }
  return { date, rates: out };
}

export function readCachedRates(storage: Storage | undefined, now: number): ExchangeRates | null {
  try {
    const raw = storage?.getItem(RATES_CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw) as Partial<CachedRates>;
    const fetchedAt = cached.fetchedAt;
    if (typeof fetchedAt !== 'number' || now - fetchedAt < 0 || now - fetchedAt >= RATES_TTL_MS) return null;
    return parseRates(cached);
  } catch {
    return null;
  }
}

function writeCachedRates(storage: Storage | undefined, rates: ExchangeRates, now: number) {
  try {
    storage?.setItem(RATES_CACHE_KEY, JSON.stringify({ ...rates, fetchedAt: now } satisfies CachedRates));
  } catch {
    // Storage full or blocked: rates still work for this render, just not cached.
  }
}

/**
 * Returns ILS→USD/EUR/GBP rates: from sessionStorage if fetched within the last hour,
 * otherwise from Frankfurter. Throws on network error or an invalid answer.
 */
export async function loadExchangeRates({
  fetchImpl = (...args: Parameters<typeof fetch>) => fetch(...args),
  storage = typeof window === 'undefined' ? undefined : window.sessionStorage,
  now = () => Date.now(),
}: { fetchImpl?: typeof fetch; storage?: Storage; now?: () => number } = {}): Promise<ExchangeRates> {
  const cached = readCachedRates(storage, now());
  if (cached) return cached;

  const res = await fetchImpl(ratesUrl(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Frankfurter HTTP ${res.status}`);
  const rates = parseRates(await res.json());
  if (!rates) throw new Error('Frankfurter: invalid response');
  writeCachedRates(storage, rates, now());
  return rates;
}

/** What the UI needs to show money: target currency and units per ₪1 (1 for ILS). */
export interface Money {
  currency: Currency;
  rate: number;
}

export const ILS_MONEY: Money = { currency: 'ILS', rate: 1 };

export function moneyFor(currency: Currency, rates: ExchangeRates | null): Money {
  if (currency === 'ILS' || !rates) return ILS_MONEY;
  return { currency, rate: rates.rates[currency] };
}

/** ₪ amount → amount in the display currency. Null (no estimate) stays null. */
export function convertFromIls(valueIls: number | null | undefined, money: Money): number | null {
  return valueIls == null ? null : valueIls * money.rate;
}
