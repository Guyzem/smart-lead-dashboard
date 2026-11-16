import { describe, expect, it, vi } from 'vitest';
import { FRANKFURTER_RESPONSE, jsonResponse } from '../test/rateFixtures';
import {
  FRANKFURTER_BASE_URL,
  ILS_MONEY,
  RATES_CACHE_KEY,
  RATES_TTL_MS,
  convertFromIls,
  loadExchangeRates,
  moneyFor,
  parseRates,
  ratesUrl,
} from './exchangeRates';
import { formatCompactMoney, formatMoney } from './format';

const T0 = Date.UTC(2026, 10, 16, 10, 0, 0);
const okFetch = () => vi.fn(async () => jsonResponse(FRANKFURTER_RESPONSE)) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
const storage = () => window.sessionStorage;

describe('Frankfurter exchange rates (SPEC X1, D16)', () => {
  it('calls the single latest endpoint from ILS to USD, EUR, GBP', async () => {
    const fetchImpl = okFetch();
    const rates = await loadExchangeRates({ fetchImpl, storage: storage(), now: () => T0 });
    expect(ratesUrl()).toBe(`${FRANKFURTER_BASE_URL}/latest?from=ILS&to=USD,EUR,GBP`);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(ratesUrl());
    expect(rates).toEqual({ date: '2026-11-13', rates: { USD: 0.25, EUR: 0.2, GBP: 0.125 } });
  });

  it('converts ₪ amounts with the rate and keeps missing values empty', () => {
    const usd = moneyFor('USD', parseRates(FRANKFURTER_RESPONSE));
    expect(usd).toEqual({ currency: 'USD', rate: 0.25 });
    expect(convertFromIls(40_000, usd)).toBe(10_000);
    expect(convertFromIls(null, usd)).toBeNull();
    expect(formatMoney(40_000, usd)).toBe(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(10_000));
    expect(formatMoney(null, usd)).toBe('—');
    expect(formatCompactMoney(4_000_000, usd)).toContain('$');
  });

  it('ILS (or no rates yet) means rate 1 and the original ₪ format', () => {
    expect(moneyFor('ILS', parseRates(FRANKFURTER_RESPONSE))).toEqual(ILS_MONEY);
    expect(moneyFor('EUR', null)).toEqual(ILS_MONEY);
    expect(formatMoney(12_345)).toBe(new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 }).format(12_345));
  });

  it('caches rates in sessionStorage for one hour, then fetches again', async () => {
    const fetchImpl = okFetch();
    await loadExchangeRates({ fetchImpl, storage: storage(), now: () => T0 });
    expect(storage().getItem(RATES_CACHE_KEY)).toContain('"fetchedAt"');
    await loadExchangeRates({ fetchImpl, storage: storage(), now: () => T0 + RATES_TTL_MS - 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await loadExchangeRates({ fetchImpl, storage: storage(), now: () => T0 + RATES_TTL_MS });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('edge: corrupt cache is ignored and rates are fetched', async () => {
    storage().setItem(RATES_CACHE_KEY, '{not json');
    const fetchImpl = okFetch();
    await expect(loadExchangeRates({ fetchImpl, storage: storage(), now: () => T0 })).resolves.toMatchObject({ date: '2026-11-13' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('error: HTTP failure, network failure and invalid answers reject and are not cached', async () => {
    const http = vi.fn(async () => jsonResponse({ message: 'not found' }, 404)) as unknown as typeof fetch;
    await expect(loadExchangeRates({ fetchImpl: http, storage: storage(), now: () => T0 })).rejects.toThrow('404');
    const offline = vi.fn(async () => { throw new TypeError('Failed to fetch'); }) as unknown as typeof fetch;
    await expect(loadExchangeRates({ fetchImpl: offline, storage: storage(), now: () => T0 })).rejects.toThrow();
    const missingGbp = vi.fn(async () => jsonResponse({ ...FRANKFURTER_RESPONSE, rates: { USD: 0.25, EUR: 0.2 } })) as unknown as typeof fetch;
    await expect(loadExchangeRates({ fetchImpl: missingGbp, storage: storage(), now: () => T0 })).rejects.toThrow('invalid');
    expect(storage().getItem(RATES_CACHE_KEY)).toBeNull();
  });

  it('parseRates rejects bad dates and non-positive rates', () => {
    expect(parseRates(null)).toBeNull();
    expect(parseRates({ ...FRANKFURTER_RESPONSE, date: 'yesterday' })).toBeNull();
    expect(parseRates({ ...FRANKFURTER_RESPONSE, rates: { USD: 0, EUR: 0.2, GBP: 0.1 } })).toBeNull();
  });
});
