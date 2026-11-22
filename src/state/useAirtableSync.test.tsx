import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { generateLeads } from '../data/generateLeads';
import { FIELDS } from '../lib/airtable';
import { airtableStorageKey } from '../lib/storage';
import { FAKE_TOKEN } from '../test/airtableFixtures';
import { NOW } from '../test/fixtures';

// SPEC X2 / D17: write-back to Airtable, with a mocked fetch.
const config = { token: FAKE_TOKEN, baseId: 'appIES3oUATmgV2YL', table: 'לידים' };
const key = airtableStorageKey(config.baseId, config.table);
const leads = generateLeads({ count: 30, now: NOW }).map((l, i) => ({ ...l, recordId: `rec${String(i).padStart(14, '0')}` }));
const connection = { config, loadedAt: NOW, refreshing: false, refreshError: null, onRefresh: () => {}, onDisconnect: () => {} };
const ok = () => Promise.resolve(new Response('{}', { status: 200 }));
const fast = { debounceMs: 20, retryDelays: [0, 0, 0], rateLimitDelay: 0 };

function renderApp(fetchImpl: ReturnType<typeof vi.fn>, opts: { withConnection?: boolean } = {}) {
  return render(
    <App now={NOW} leads={leads} storageKey={key} connection={opts.withConnection === false ? undefined : connection} syncOptions={{ ...fast, fetchImpl: fetchImpl as unknown as typeof fetch }} />,
  );
}

async function changeFirstStatus(user: ReturnType<typeof userEvent.setup>, to = 'won') {
  await user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /כל הלידים/ }));
  const select = screen.getAllByLabelText(/^שינוי סטטוס עבור/).find((s) => (s as HTMLSelectElement).value !== to) as HTMLSelectElement;
  const name = select.getAttribute('aria-label')!.replace('שינוי סטטוס עבור ', '');
  await user.selectOptions(select, to);
  return leads.find((l) => l.name === name)!;
}

const bodyOf = (fetchImpl: ReturnType<typeof vi.fn>, i = 0) => JSON.parse(fetchImpl.mock.calls[i][1].body);
const syncState = () => screen.getByTestId('sync-status').getAttribute('data-state');

describe('useAirtableSync (SPEC X2)', () => {
  it('status change sends one PATCH with only the changed fields, by record id, then shows saved', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(ok);
    renderApp(fetchImpl);
    expect(syncState()).toBe('saved');
    const lead = await changeFirstStatus(user);
    expect(syncState()).toBe('pending');
    await waitFor(() => expect(syncState()).toBe('saved'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const { records, typecast } = bodyOf(fetchImpl);
    expect(typecast).toBe(false);
    expect(records).toHaveLength(1);
    expect(records[0].id).toBe(lead.recordId);
    expect(Object.keys(records[0].fields).sort()).toEqual([FIELDS.lastActivityAt, FIELDS.lostAtStage, FIELDS.stale, FIELDS.status].sort());
    expect(records[0].fields[FIELDS.status]).toBe('הומר ללקוח');
    // Saved changes are no longer kept as pending local overrides.
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it('two quick changes to the same lead are sent as one request with the latest state', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(ok);
    render(<App now={NOW} leads={leads} storageKey={key} connection={connection} syncOptions={{ ...fast, debounceMs: 300, fetchImpl: fetchImpl as unknown as typeof fetch }} />);
    await user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /כל הלידים/ }));
    const select = screen.getAllByLabelText(/^שינוי סטטוס עבור/)[0] as HTMLSelectElement;
    await user.selectOptions(select, select.value === 'qualified' ? 'proposal' : 'qualified');
    await user.selectOptions(select, 'lost');
    await waitFor(() => expect(syncState()).toBe('saved'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(bodyOf(fetchImpl).records[0].fields[FIELDS.status]).toBe('אבוד');
  });

  it('adding a note writes all notes as multi-line text', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(ok);
    renderApp(fetchImpl);
    await user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /כל הלידים/ }));
    await user.click(screen.getAllByTestId('lead-row')[0]);
    const drawer = screen.getByTestId('lead-drawer');
    await user.type(within(drawer).getByLabelText('הערה חדשה'), 'שיחת המשך');
    await user.click(within(drawer).getByRole('button', { name: /הוספת הערה/ }));
    expect(within(drawer).getByTestId('lead-sync')).toHaveAttribute('data-state', 'pending');
    await waitFor(() => expect(within(drawer).getByTestId('lead-sync')).toHaveAttribute('data-state', 'saved'));
    const fields = bodyOf(fetchImpl).records[0].fields;
    expect(fields[FIELDS.notes].split('\n').at(-1)).toBe('שיחת המשך');
    expect(fields).not.toHaveProperty(FIELDS.status);
  });

  it('network failure: 3 retries, then an error with "נסה שוב" that succeeds', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    renderApp(fetchImpl);
    await changeFirstStatus(user);
    await waitFor(() => expect(syncState()).toBe('error'));
    expect(fetchImpl).toHaveBeenCalledTimes(4); // first try + 3 retries
    expect(screen.getByTestId('sync-error')).toHaveTextContent('אין חיבור ל-Airtable');
    fetchImpl.mockImplementation(ok);
    await user.click(within(screen.getByTestId('sync-error')).getByRole('button', { name: 'נסה שוב' }));
    await waitFor(() => expect(syncState()).toBe('saved'));
    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(screen.queryByTestId('sync-error')).not.toBeInTheDocument();
  });

  it('403 is not retried and asks for data.records:write', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 403 })));
    renderApp(fetchImpl);
    await changeFirstStatus(user);
    await waitFor(() => expect(syncState()).toBe('error'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-error')).toHaveTextContent('data.records:write');
  });

  it('an unsaved change survives a reload and is sent again automatically', async () => {
    const user = userEvent.setup();
    const failing = vi.fn(() => Promise.resolve(new Response('{}', { status: 403 })));
    const first = renderApp(failing);
    const lead = await changeFirstStatus(user);
    await waitFor(() => expect(syncState()).toBe('error'));
    expect(window.localStorage.getItem(key)).toContain(lead.id);
    first.unmount();
    const fetchImpl = vi.fn(ok);
    renderApp(fetchImpl);
    await waitFor(() => expect(fetchImpl).toHaveBeenCalledTimes(1));
    expect(bodyOf(fetchImpl).records[0].id).toBe(lead.recordId);
    await waitFor(() => expect(syncState()).toBe('saved'));
  });

  it('mock data mode (no Airtable connection) never writes', async () => {
    const user = userEvent.setup();
    const fetchImpl = vi.fn(ok);
    renderApp(fetchImpl, { withConnection: false });
    await changeFirstStatus(user);
    await new Promise((r) => setTimeout(r, 60));
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
  });
});
