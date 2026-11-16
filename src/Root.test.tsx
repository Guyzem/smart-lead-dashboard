import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Root from './Root';
import { generateLeads } from './data/generateLeads';
import { AirtableError, ERROR_MESSAGES } from './lib/airtable';
import { CREDENTIALS_KEY } from './lib/credentials';
import { FAKE_TOKEN } from './test/airtableFixtures';
import { NOW } from './test/fixtures';

const leads = generateLeads({ count: 30, now: NOW });
const tokenInput = () => screen.getByLabelText(/טוקן גישה/);
const kpiTotal = () => within(screen.getByTestId('kpi-total')).getByTestId('kpi-value').textContent;

async function connect(user: ReturnType<typeof userEvent.setup>, { remember = false, token = FAKE_TOKEN } = {}) {
  await user.type(tokenInput(), token);
  if (remember) await user.click(screen.getByLabelText('זכור אותי במחשב הזה'));
  await user.click(screen.getByRole('button', { name: 'התחבר והצג נתונים' }));
}

describe('Root: Airtable connection gate', () => {
  it('shows only the connection screen before a token is entered', () => {
    const fetchLeads = vi.fn();
    render(<Root fetchLeads={fetchLeads} />);
    expect(screen.getByRole('heading', { name: /התחברות ל-Airtable/ })).toBeInTheDocument();
    expect(screen.queryByTestId('kpi-total')).not.toBeInTheDocument();
    expect(fetchLeads).not.toHaveBeenCalled();
  });

  it('validates the token format locally without calling Airtable', async () => {
    const user = userEvent.setup();
    const fetchLeads = vi.fn();
    render(<Root fetchLeads={fetchLeads} />);
    await connect(user, { token: 'not-a-token' });
    expect(screen.getByRole('alert')).toHaveTextContent('הטוקן לא נראה תקין');
    expect(fetchLeads).not.toHaveBeenCalled();
  });

  it('loads leads after connecting; token goes to sessionStorage only, never localStorage', async () => {
    const user = userEvent.setup();
    const fetchLeads = vi.fn().mockResolvedValue(leads);
    render(<Root fetchLeads={fetchLeads} />);
    await connect(user);
    await waitFor(() => expect(kpiTotal()).toBe(String(leads.length)));
    expect(fetchLeads).toHaveBeenCalledWith({ token: FAKE_TOKEN, baseId: 'appIES3oUATmgV2YL', table: 'לידים' });
    expect(window.sessionStorage.getItem(CREDENTIALS_KEY)).toContain(FAKE_TOKEN);
    expect(window.localStorage.getItem(CREDENTIALS_KEY)).toBeNull();
  });

  it('"remember me" keeps the token in localStorage and restores the session on reload', async () => {
    const user = userEvent.setup();
    const fetchLeads = vi.fn().mockResolvedValue(leads);
    const first = render(<Root fetchLeads={fetchLeads} />);
    await connect(user, { remember: true });
    await waitFor(() => expect(kpiTotal()).toBe(String(leads.length)));
    expect(window.localStorage.getItem(CREDENTIALS_KEY)).toContain(FAKE_TOKEN);
    first.unmount();
    render(<Root fetchLeads={fetchLeads} />);
    await waitFor(() => expect(kpiTotal()).toBe(String(leads.length)));
    expect(screen.queryByLabelText(/טוקן גישה/)).not.toBeInTheDocument();
  });

  it('invalid token shows a clear error and stores nothing', async () => {
    const user = userEvent.setup();
    const fetchLeads = vi.fn().mockRejectedValue(new AirtableError('invalid-token', ERROR_MESSAGES['invalid-token']));
    render(<Root fetchLeads={fetchLeads} />);
    await connect(user, { remember: true });
    expect(await screen.findByRole('alert')).toHaveTextContent('הטוקן לא תקין או שפג תוקפו');
    expect(window.localStorage.getItem(CREDENTIALS_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(CREDENTIALS_KEY)).toBeNull();
    expect(screen.queryByTestId('kpi-total')).not.toBeInTheDocument();
  });

  it('a saved token that was revoked is dropped and the form is shown with the error', async () => {
    window.localStorage.setItem(CREDENTIALS_KEY, JSON.stringify({ token: FAKE_TOKEN, baseId: 'appIES3oUATmgV2YL', table: 'לידים' }));
    const fetchLeads = vi.fn().mockRejectedValue(new AirtableError('invalid-token', ERROR_MESSAGES['invalid-token']));
    render(<Root fetchLeads={fetchLeads} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('הטוקן לא תקין');
    expect(tokenInput()).toBeInTheDocument();
    expect(window.localStorage.getItem(CREDENTIALS_KEY)).toBeNull();
  });

  it('disconnect removes the token and returns to the connection screen', async () => {
    const user = userEvent.setup();
    render(<Root fetchLeads={vi.fn().mockResolvedValue(leads)} />);
    await connect(user, { remember: true });
    await waitFor(() => expect(kpiTotal()).toBe(String(leads.length)));
    await user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /התנתקות מ-Airtable/ }));
    expect(tokenInput()).toHaveValue('');
    expect(window.localStorage.getItem(CREDENTIALS_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(CREDENTIALS_KEY)).toBeNull();
  });
});
