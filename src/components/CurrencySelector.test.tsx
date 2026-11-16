import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { generateLeads } from '../data/generateLeads';
import { RATES_ERROR_MESSAGE, parseRates } from '../lib/exchangeRates';
import type { ExchangeRates } from '../lib/exchangeRates';
import { formatCompactMoney, formatMoney } from '../lib/format';
import { computeKpis } from '../lib/metrics';
import { enrichLeads } from '../lib/scoring';
import { NOW } from '../test/fixtures';
import { FRANKFURTER_RESPONSE } from '../test/rateFixtures';

const RATES = parseRates(FRANKFURTER_RESPONSE) as ExchangeRates;
const scored = enrichLeads(generateLeads({ now: NOW }), NOW);
const kpis = computeKpis(scored, NOW);
const scoreTexts = () => within(screen.getByTestId('priority-list')).getAllByTitle('ציון מבוסס חוקים (0–100)').map((e) => e.textContent);
const pipeline = () => within(screen.getByTestId('kpi-pipeline')).getByTestId('kpi-value');

describe('X1 currency selector (component, D16)', () => {
  it('USD converts KPI amounts, shows the rate date and leaves Lead Score unchanged', async () => {
    const user = userEvent.setup();
    const loadRates = vi.fn(async () => RATES);
    render(<App now={NOW} loadRates={loadRates} />);
    expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue));
    const scoresBefore = scoreTexts();
    expect(scoresBefore.length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('מטבע תצוגה'), 'USD');
    const usd = { currency: 'USD' as const, rate: 0.25 };
    await waitFor(() => expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue, usd)));
    expect(pipeline()).toHaveAttribute('title', formatMoney(kpis.pipelineValue, usd));
    expect(screen.getByTestId('rate-note')).toHaveTextContent('שער נכון ל-13.11.2026 · מקור: Frankfurter / ECB');
    // Same leads and same Lead Scores in the priority list; only the money part changed.
    expect(scoreTexts()).toEqual(scoresBefore);
    expect(within(screen.getByTestId('priority-list')).getAllByText(/\$/).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('מטבע תצוגה'), 'ILS');
    expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue));
    expect(screen.queryByTestId('rate-note')).toBeNull();
  });

  it('shows a loading note while rates are fetched', async () => {
    const user = userEvent.setup();
    let resolve!: (r: ExchangeRates) => void;
    render(<App now={NOW} loadRates={() => new Promise((r) => { resolve = r; })} />);
    await user.selectOptions(screen.getByLabelText('מטבע תצוגה'), 'EUR');
    expect(screen.getByRole('status')).toHaveTextContent('טוען שערי מטבע');
    expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue)); // still ₪
    resolve(RATES);
    await waitFor(() => expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue, { currency: 'EUR', rate: 0.2 })));
  });

  it('error: falls back to ₪ with a Hebrew message', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} loadRates={async () => { throw new Error('offline'); }} />);
    await user.selectOptions(screen.getByLabelText('מטבע תצוגה'), 'GBP');
    expect(await screen.findByTestId('rates-error')).toHaveTextContent(RATES_ERROR_MESSAGE);
    expect(screen.getByLabelText('מטבע תצוגה')).toHaveValue('ILS');
    expect(pipeline().textContent).toBe(formatCompactMoney(kpis.pipelineValue));
  });
});
