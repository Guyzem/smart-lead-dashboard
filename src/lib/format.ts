import type { Currency, Money } from './exchangeRates';
import { ILS_MONEY, convertFromIls } from './exchangeRates';

const currency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});
const compactCurrency = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const number = new Intl.NumberFormat('he-IL');
const date = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
const shortDate = new Intl.DateTimeFormat('he-IL', { day: '2-digit', month: '2-digit' });

export const EMPTY = '—';

export function formatCurrency(value: number | null | undefined): string {
  return value == null ? EMPTY : currency.format(value);
}

export function formatCompactCurrency(value: number): string {
  return compactCurrency.format(value);
}

// SPEC X1: the same full/compact formats, in the selected display currency.
const moneyFormats = new Map<string, Intl.NumberFormat>();
function moneyFormat(currencyCode: Currency, compact: boolean): Intl.NumberFormat {
  const key = `${currencyCode}:${compact}`;
  let f = moneyFormats.get(key);
  if (!f) {
    f = new Intl.NumberFormat('he-IL', compact
      ? { style: 'currency', currency: currencyCode, notation: 'compact', maximumFractionDigits: 1 }
      : { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 });
    moneyFormats.set(key, f);
  }
  return f;
}

/** A ₪ amount shown in the display currency (SPEC X1). Missing value → "—". */
export function formatMoney(valueIls: number | null | undefined, money: Money = ILS_MONEY): string {
  const v = convertFromIls(valueIls, money);
  return v == null ? EMPTY : moneyFormat(money.currency, false).format(v);
}

export function formatCompactMoney(valueIls: number, money: Money = ILS_MONEY): string {
  return moneyFormat(money.currency, true).format(valueIls * money.rate);
}

export function formatNumber(value: number): string {
  return number.format(value);
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

export function formatDate(iso: string): string {
  return date.format(new Date(iso));
}

export function formatShortDate(d: Date): string {
  return shortDate.format(d);
}

export function orEmpty(value: string | null | undefined): string {
  return value && value.trim() ? value : EMPTY;
}
