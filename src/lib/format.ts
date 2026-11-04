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
