import { expect, test, type Page } from '@playwright/test';
import { generateLeads } from '../src/data/generateLeads';
import { FAKE_TOKEN, pages, toAirtableRecord } from '../src/test/airtableFixtures';
import { FRANKFURTER_RESPONSE } from '../src/test/rateFixtures';

/**
 * End-to-end checks for SPEC §5 criteria that need a real browser (D1, D5, D8–D12).
 * Airtable is stubbed with page.route: no real token or network call is ever used.
 */

/**
 * Stateful fake of the "לידים" table: GET pages through the records, PATCH (SPEC X2) updates them,
 * so a reload shows what was written. `patchStatus` makes writes fail with that HTTP status.
 */
async function stubAirtable(page: Page, status = 200, { patchStatus = 200 }: { patchStatus?: number } = {}) {
  const records = generateLeads().map(toAirtableRecord);
  const patches: { id: string; fields: Record<string, unknown> }[][] = [];
  await page.route('https://api.airtable.com/**', (route) => {
    if (status !== 200) return route.fulfill({ status, json: { error: { type: 'AUTHENTICATION_REQUIRED' } } });
    const req = route.request();
    if (req.method() === 'PATCH') {
      const body = req.postDataJSON() as { records: { id: string; fields: Record<string, unknown> }[] };
      patches.push(body.records);
      if (patchStatus !== 200) return route.fulfill({ status: patchStatus, json: { error: { type: 'INVALID_PERMISSIONS' } } });
      for (const u of body.records) {
        const rec = records.find((r) => r.id === u.id);
        if (rec) for (const [k, v] of Object.entries(u.fields)) { if (v === null) delete rec.fields[k]; else rec.fields[k] = v; }
      }
      return route.fulfill({ json: { records: body.records } });
    }
    const offset = new URL(req.url()).searchParams.get('offset');
    const index = offset ? Number(offset.replace('itr', '')) / 100 : 0;
    return route.fulfill({ json: pages(records)[index] });
  });
  return patches;
}

async function connect(page: Page) {
  await page.getByLabel(/טוקן גישה/).fill(FAKE_TOKEN);
  await page.getByRole('button', { name: 'התחבר והצג נתונים' }).click();
  await expect(page.getByTestId('kpi-total')).toBeVisible();
}

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  return errors;
}

async function noHorizontalScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

const kpi = (page: Page, id: string) => page.getByTestId(`kpi-${id}`).getByTestId('kpi-value');

test.describe('D12: Airtable connection screen', () => {
  test('nothing is shown before a token; invalid token shows a clear error', async ({ page }) => {
    await stubAirtable(page, 401);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /התחברות ל-Airtable/ })).toBeVisible();
    await expect(page.getByTestId('kpi-total')).toHaveCount(0);
    await page.getByLabel(/טוקן גישה/).fill(FAKE_TOKEN);
    await page.getByRole('button', { name: 'התחבר והצג נתונים' }).click();
    await expect(page.getByRole('alert')).toContainText('הטוקן לא תקין');
    await expect(page.getByTestId('kpi-total')).toHaveCount(0);
  });

  test('connect loads leads from Airtable, disconnect returns to the screen', async ({ page }) => {
    await stubAirtable(page);
    await page.goto('/');
    await connect(page);
    await expect(page.getByTestId('source-badge')).toContainText('Airtable');
    await page.getByRole('button', { name: /התנתקות מ-Airtable/ }).click();
    await expect(page.getByRole('heading', { name: /התחברות ל-Airtable/ })).toBeVisible();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(FAKE_TOKEN.slice(0, 10));
  });
});

test.describe('dashboard (connected)', () => {
test.beforeEach(async ({ page }) => {
  await stubAirtable(page);
  await page.goto('/');
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload();
  await connect(page);
});

test('D8: Hebrew RTL document', async ({ page }) => {
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('סקירה כללית');
});

test('D1: at least 100 leads on load', async ({ page }) => {
  const total = Number(await kpi(page, 'total').innerText());
  expect(total).toBeGreaterThanOrEqual(100);
  await expect(page.getByTestId('result-count')).toContainText(`מציג ${total} מתוך ${total}`);
});

for (const width of [1440, 375]) {
  test(`D9/D10: no horizontal scroll and no JS errors at ${width}px`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width, height: 900 });
    await page.reload();
    await expect(page.getByTestId('chart-status')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    if (width < 1024) await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /כל הלידים/ }).click();
    await expect(page.getByTestId('lead-row').first()).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);

    // Click the name cell: the row's centre can land on the status dropdown, which intentionally doesn't open the card.
    await page.getByTestId('lead-row').first().getByTestId('lead-name').click();
    await expect(page.getByTestId('lead-drawer')).toBeVisible();
    expect(await noHorizontalScroll(page)).toBe(true);
    await page.keyboard.press('Escape');

    if (width < 1024) await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /שיטת הניקוד/ }).click();
    expect(await noHorizontalScroll(page)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('D5/D11/D17: status change updates KPIs live, is written to Airtable and survives reload', async ({ page }) => {
  const errors = trackErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /כל הלידים/ }).click();
  const before = Number(await kpi(page, 'won').innerText());

  const firstRow = page.getByTestId('lead-row').first();
  const name = await firstRow.getByTestId('lead-name').innerText();
  const select = page.getByLabel(`שינוי סטטוס עבור ${name}`).first();
  const current = await select.inputValue();
  test.skip(current === 'won', 'top lead already won');
  await select.selectOption('won');
  await expect(kpi(page, 'won')).toHaveText(String(before + 1));
  await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'saved');

  // Reload reads from the (fake) Airtable table, which now holds the change.
  await page.reload();
  await expect(kpi(page, 'won')).toHaveText(String(before + 1));
  expect(errors).toEqual([]);
});

test('edge: search with no results shows empty state', async ({ page }) => {
  await page.getByLabel('חיפוש לפי שם לקוח או חברה').fill('אין-כזה-לקוח');
  await expect(kpi(page, 'total')).toHaveText('0');
  await expect(page.getByTestId('result-count')).toContainText('מציג 0');
});
/** SPEC X1: Frankfurter is stubbed too. Returns a counter of rate requests. */
async function stubRates(page: Page, status = 200) {
  const calls = { count: 0 };
  await page.route('https://api.frankfurter.dev/**', (route) => {
    calls.count++;
    return status === 200 ? route.fulfill({ json: FRANKFURTER_RESPONSE }) : route.fulfill({ status, json: { message: 'error' } });
  });
  return calls;
}
const digits = (s: string) => Number(s.replace(/[^\d]/g, ''));

test('D16: USD shows converted amounts in KPI, table and lead card, cached for the next switch', async ({ page }) => {
  const errors = trackErrors(page);
  const calls = await stubRates(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /כל הלידים/ }).click();
  // First row that has an estimated value (rows without one show '—' in every currency).
  const row = page.getByTestId('lead-row').filter({ has: page.getByTestId('lead-value').filter({ hasText: /\d/ }) }).first();
  const ilsValue = digits(await row.getByTestId('lead-value').innerText());
  const scoreBefore = await row.getByTitle('ציון מבוסס חוקים (0–100)').innerText();
  const pipelineTitle = await kpi(page, 'pipeline').getAttribute('title');
  expect(ilsValue).toBeGreaterThan(0);

  await page.getByLabel('מטבע תצוגה').selectOption('USD');
  await expect(page.getByTestId('rate-note')).toHaveText('שער נכון ל-13.11.2026 · מקור: Frankfurter / ECB');
  await expect(row.getByTestId('lead-value')).toContainText('$');
  expect(digits(await row.getByTestId('lead-value').innerText())).toBe(Math.round(ilsValue * FRANKFURTER_RESPONSE.rates.USD));
  await expect(kpi(page, 'pipeline')).toContainText('$');
  expect(digits((await kpi(page, 'pipeline').getAttribute('title')) ?? '')).toBe(Math.round(digits(pipelineTitle ?? '') * FRANKFURTER_RESPONSE.rates.USD));
  await expect(row.getByTitle('ציון מבוסס חוקים (0–100)')).toHaveText(scoreBefore);

  await row.getByTestId('lead-name').click();
  const valueRow = page.getByTestId('lead-drawer').getByText('שווי משוער').locator('..');
  await expect(valueRow).toContainText('$');
  expect(digits(await valueRow.innerText())).toBe(Math.round(ilsValue * FRANKFURTER_RESPONSE.rates.USD));
  await page.keyboard.press('Escape');

  await page.getByLabel('מטבע תצוגה').selectOption('EUR');
  await expect(row.getByTestId('lead-value')).toContainText('€');
  await page.getByLabel('מטבע תצוגה').selectOption('ILS');
  await expect(row.getByTestId('lead-value')).toContainText('₪');
  await expect(page.getByTestId('rate-note')).toHaveCount(0);
  expect(calls.count).toBe(1);
  expect(errors).toEqual([]);
});

test('D16/D9: rate note fits at 375px without horizontal scroll', async ({ page }) => {
  await stubRates(page);
  await page.setViewportSize({ width: 375, height: 900 });
  await page.getByLabel('מטבע תצוגה').selectOption('GBP');
  await expect(page.getByTestId('rate-note')).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
});

test('D16: rate error falls back to ₪ with a Hebrew message', async ({ page }) => {
  await stubRates(page, 500);
  await page.getByLabel('מטבע תצוגה').selectOption('USD');
  await expect(page.getByTestId('rates-error')).toHaveText('לא ניתן לטעון שערי מטבע כרגע. הסכומים מוצגים בשקלים.');
  await expect(page.getByLabel('מטבע תצוגה')).toHaveValue('ILS');
  await expect(kpi(page, 'pipeline')).toContainText('₪');
});
});

test.describe('D17: write-back failures', () => {
  test('a failed write shows an error, survives reload, and "ביטול שינויים מקומיים" cancels it', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const patches = await stubAirtable(page, 200, { patchStatus: 403 });
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await connect(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /כל הלידים/ }).click();
    const before = Number(await kpi(page, 'won').innerText());
    const select = page.getByLabel(/^שינוי סטטוס עבור/).first();
    test.skip((await select.inputValue()) === 'won', 'top lead already won');
    await select.selectOption('won');

    await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'error');
    await expect(page.getByTestId('sync-error')).toContainText('data.records:write');
    expect(patches).toHaveLength(1); // 403 is not retried

    page.on('dialog', (d) => d.accept()); // beforeunload + confirm
    await page.reload();
    await expect(kpi(page, 'won')).toHaveText(String(before + 1));

    await page.getByRole('button', { name: /ביטול שינויים מקומיים/ }).click();
    await expect(kpi(page, 'won')).toHaveText(String(before));
    await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'saved');
    expect(errors).toEqual([]);
  });

  test('error indicator fits at 375px without horizontal scroll', async ({ page }) => {
    await stubAirtable(page, 200, { patchStatus: 403 });
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await page.reload();
    await connect(page);
    await page.getByRole('button', { name: 'פתיחת תפריט' }).click();
    await page.getByRole('complementary', { name: 'תפריט ראשי' }).getByRole('button', { name: /כל הלידים/ }).click();
    const select = page.getByLabel(/^שינוי סטטוס עבור/).first();
    await select.selectOption((await select.inputValue()) === 'won' ? 'lost' : 'won');
    await expect(page.getByTestId('sync-status')).toHaveAttribute('data-state', 'error');
    expect(await noHorizontalScroll(page)).toBe(true);
  });
});
