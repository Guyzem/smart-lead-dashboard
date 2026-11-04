import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import App from './App';
import { generateLeads } from './data/generateLeads';
import { STORAGE_KEY } from './lib/storage';
import { NOW } from './test/fixtures';

const leads = generateLeads({ now: NOW });
const kpi = (id: string) => within(screen.getByTestId(`kpi-${id}`)).getByTestId('kpi-value').textContent;
const toLeads = async (user: ReturnType<typeof userEvent.setup>) =>
  user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /כל הלידים/ }));

describe('App (component)', () => {
  it('D1/D2: shows all generated leads and KPIs computed from them', () => {
    render(<App now={NOW} />);
    expect(screen.getByTestId('result-count')).toHaveTextContent(`מציג ${leads.length} מתוך ${leads.length}`);
    expect(kpi('total')).toBe(String(leads.length));
    expect(kpi('won')).toBe(String(leads.filter((l) => l.status === 'won').length));
    expect(kpi('new')).toBe(String(leads.filter((l) => l.status === 'new').length));
  });

  it('D3: search by name shows only matching rows', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await toLeads(user);
    const target = leads[3].name;
    await user.type(screen.getByLabelText('חיפוש לפי שם לקוח או חברה'), target);
    const names = screen.getAllByTestId('lead-name').map((n) => n.textContent);
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((n) => n === target)).toBe(true);
  });

  it('edge: search with no results shows an empty state and zero KPIs', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await toLeads(user);
    await user.type(screen.getByLabelText('חיפוש לפי שם לקוח או חברה'), 'שם-שלא-קיים');
    expect(screen.getByTestId('empty-state')).toHaveTextContent('לא נמצאו לידים');
    expect(kpi('total')).toBe('0');
    expect(kpi('conversion')).toBe('0.0%');
    await user.click(within(screen.getByTestId('empty-state')).getByRole('button', { name: 'נקה סינון' }));
    expect(kpi('total')).toBe(String(leads.length));
  });

  it('D4: status filter shows only leads in that status', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await toLeads(user);
    await user.selectOptions(screen.getByLabelText('סינון לפי סטטוס'), 'proposal');
    const expected = leads.filter((l) => l.status === 'proposal').length;
    expect(kpi('total')).toBe(String(expected));
    const selects = screen.getAllByLabelText(/^שינוי סטטוס עבור/) as HTMLSelectElement[];
    expect(selects.every((s) => s.value === 'proposal')).toBe(true);
  });

  it('D5/D11: changing a status updates KPIs immediately and is saved to localStorage', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await toLeads(user);
    const wonBefore = Number(kpi('won'));
    const select = screen.getAllByLabelText(/^שינוי סטטוס עבור/).find((s) => (s as HTMLSelectElement).value !== 'won')!;
    await user.selectOptions(select, 'won');
    expect(Number(kpi('won'))).toBe(wonBefore + 1);
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('"won"');
  });

  it('S4/S5: opens a lead card with score breakdown and saves a new note', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await toLeads(user);
    await user.click(screen.getAllByTestId('lead-row')[0]);
    const drawer = screen.getByTestId('lead-drawer');
    expect(within(drawer).getByTestId('score-breakdown').children).toHaveLength(5);
    await user.type(within(drawer).getByLabelText('הערה חדשה'), 'שיחת המשך נקבעה');
    await user.click(within(drawer).getByRole('button', { name: /הוספת הערה/ }));
    expect(within(drawer).getByTestId('notes-list')).toHaveTextContent('שיחת המשך נקבעה');
    expect(window.localStorage.getItem(STORAGE_KEY)).toContain('שיחת המשך נקבעה');
  });

  it('S5: restores saved changes on a fresh mount', async () => {
    const user = userEvent.setup();
    const first = render(<App now={NOW} />);
    await toLeads(user);
    const lostBefore = leads.filter((l) => l.status === 'lost').length;
    const select = screen.getAllByLabelText(/^שינוי סטטוס עבור/).find((s) => (s as HTMLSelectElement).value !== 'lost')!;
    await user.selectOptions(select, 'lost');
    first.unmount();
    render(<App now={NOW} />);
    await toLeads(user);
    await user.selectOptions(screen.getByLabelText('סינון לפי סטטוס'), 'lost');
    expect(kpi('total')).toBe(String(lostBefore + 1));
  });

  it('edge: corrupt localStorage falls back to default data', () => {
    window.localStorage.setItem(STORAGE_KEY, '{broken');
    render(<App now={NOW} />);
    expect(kpi('total')).toBe(String(leads.length));
  });

  it('stale nav shows only leads waiting for treatment', async () => {
    const user = userEvent.setup();
    render(<App now={NOW} />);
    await user.click(within(screen.getByRole('complementary', { name: 'תפריט ראשי' })).getByRole('button', { name: /ממתינים לטיפול/ }));
    const rows = screen.getAllByTestId('lead-row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => within(r).queryByTestId('stale-flag'))).toBe(true);
  });
});
