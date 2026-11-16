import { createContext, useCallback, useContext, useRef, useState } from 'react';
import type { Currency, ExchangeRates, Money } from '../lib/exchangeRates';
import { ILS_MONEY, RATES_ERROR_MESSAGE, loadExchangeRates, moneyFor } from '../lib/exchangeRates';

// SPEC X1: selected display currency + live Frankfurter rates.

/** Money used by every amount on screen. Default ₪ so components work without a provider. */
export const MoneyContext = createContext<Money>(ILS_MONEY);
export const useMoney = () => useContext(MoneyContext);

export interface DisplayCurrency {
  /** Currency the amounts are shown in right now (stays ILS while rates load). */
  currency: Currency;
  /** Currency picked in the selector (may be waiting for rates). */
  selected: Currency;
  money: Money;
  loading: boolean;
  error: string | null;
  rateDate: string | null;
  select: (c: Currency) => void;
}

export function useDisplayCurrency(loadRates: () => Promise<ExchangeRates> = loadExchangeRates): DisplayCurrency {
  const [selected, setSelected] = useState<Currency>('ILS');
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wanted = useRef<Currency>('ILS');
  const request = useRef(0);

  const select = useCallback(
    (c: Currency) => {
      wanted.current = c;
      setSelected(c);
      setError(null);
      if (c === 'ILS') {
        request.current++; // a pending answer must not switch away from ₪
        setLoading(false);
        return;
      }
      setLoading(true);
      const id = ++request.current;
      loadRates().then(
        (r) => {
          if (id !== request.current) return;
          setRates(r);
          setLoading(false);
        },
        () => {
          if (id !== request.current) return;
          wanted.current = 'ILS';
          setSelected('ILS');
          setLoading(false);
          setError(RATES_ERROR_MESSAGE);
        },
      );
    },
    [loadRates],
  );

  // Rates already on screen keep showing while a re-check of the 1-hour cache runs.
  const waiting = loading && !rates;
  const currency: Currency = waiting || !rates ? 'ILS' : selected;
  return {
    currency,
    selected,
    money: moneyFor(currency, rates),
    loading: waiting,
    error,
    rateDate: currency === 'ILS' ? null : rates?.date ?? null,
    select,
  };
}
