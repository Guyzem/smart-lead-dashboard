import { describe, expect, it, vi } from 'vitest';
import { generateLeads } from '../data/generateLeads';
import { FAKE_TOKEN, pages, toAirtableRecord } from '../test/airtableFixtures';
import { NOW } from '../test/fixtures';
import { AirtableError, DEFAULT_BASE_ID, DEFAULT_TABLE, FIELDS, fetchAirtableLeads, mapRecord, validateConfig } from './airtable';

const config = { token: FAKE_TOKEN, baseId: DEFAULT_BASE_ID, table: DEFAULT_TABLE };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('mapRecord', () => {
  it('maps Hebrew Airtable values back to the lead model', () => {
    const leads = generateLeads({ now: NOW });
    leads.forEach((l, i) => {
      const m = mapRecord(toAirtableRecord(l, i), NOW)!;
      expect(m).toMatchObject({
        id: l.id, name: l.name, company: l.company, industry: l.industry, phone: l.phone, source: l.source,
        status: l.status, owner: l.owner, value: l.value, interest: l.interest, urgency: l.urgency, lostAtStage: l.lostAtStage,
      });
      expect(m.createdAt.slice(0, 10)).toBe(l.createdAt.slice(0, 10));
      expect(m.notes.map((n) => n.text)).toEqual(l.notes.map((n) => n.text));
    });
  });

  it('skips rows without a name and fills safe defaults for missing fields', () => {
    expect(mapRecord({ id: 'rec1', fields: {} }, NOW)).toBeNull();
    const m = mapRecord({ id: 'recABC', createdTime: '2026-10-01T08:00:00.000Z', fields: { [FIELDS.name]: 'דוד' } }, NOW)!;
    expect(m).toMatchObject({ id: 'recABC', status: 'new', source: 'Direct', owner: null, value: null, interest: 'medium', lostAtStage: null, notes: [] });
    expect(m.lastActivityAt).toBe(m.createdAt);
  });

  it('accepts select values as {name} objects and English source names', () => {
    const m = mapRecord({ id: 'r', fields: { [FIELDS.name]: 'א', [FIELDS.status]: { name: 'אבוד' }, [FIELDS.source]: 'Referral' } }, NOW)!;
    expect(m.status).toBe('lost');
    expect(m.lostAtStage).toBe('new');
    expect(m.source).toBe('Referral');
  });

  it('splits notes joined with " | " (as imported from the CSV) or by lines', () => {
    const m = mapRecord({ id: 'r', fields: { [FIELDS.name]: 'א', [FIELDS.notes]: 'נשלחה הצעת מחיר | יש תקציב\nשיחה שנייה' } }, NOW)!;
    expect(m.notes.map((n) => n.text)).toEqual(['נשלחה הצעת מחיר', 'יש תקציב', 'שיחה שנייה']);
  });
});

describe('validateConfig', () => {
  it('rejects empty or malformed input before any request', () => {
    expect(validateConfig({ ...config, token: '' })).toMatch('יש להזין טוקן');
    expect(validateConfig({ ...config, token: 'abc' })).toMatch('לא נראה תקין');
    expect(validateConfig({ ...config, baseId: 'xyz' })).toMatch('מזהה הבסיס');
    expect(validateConfig({ ...config, table: ' ' })).toMatch('טבלה');
    expect(validateConfig(config)).toBeNull();
  });
});

describe('fetchAirtableLeads', () => {
  it('follows pagination, sends the token as a Bearer header and returns every lead', async () => {
    const all = generateLeads({ count: 250, now: NOW }).map(toAirtableRecord);
    const queue = pages(all);
    const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      void url;
      expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
      return json(queue.shift());
    });
    const leads = await fetchAirtableLeads(config, { now: NOW, fetchImpl: fetchImpl as typeof fetch });
    expect(leads).toHaveLength(250);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(String(fetchImpl.mock.calls[0][0])).toContain(`https://api.airtable.com/v0/${DEFAULT_BASE_ID}/${encodeURIComponent(DEFAULT_TABLE)}?pageSize=100`);
    expect(String(fetchImpl.mock.calls[1][0])).toContain('offset=itr100');
  });

  it.each([
    [401, 'invalid-token', 'הטוקן לא תקין'],
    [403, 'forbidden', 'אין הרשאה'],
    [404, 'not-found', 'לא נמצאו'],
    [429, 'rate-limit', 'ריבוי בקשות'],
    [500, 'unknown', 'קוד 500'],
  ])('HTTP %i → %s with a Hebrew message', async (status, code, text) => {
    const fetchImpl = async () => json({ error: 'x' }, status);
    const err = await fetchAirtableLeads(config, { fetchImpl: fetchImpl as typeof fetch }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AirtableError);
    expect((err as AirtableError).code).toBe(code);
    expect((err as AirtableError).message).toContain(text);
  });

  it('network failure and empty table get their own messages', async () => {
    const down = async () => { throw new TypeError('Failed to fetch'); };
    await expect(fetchAirtableLeads(config, { fetchImpl: down as typeof fetch })).rejects.toMatchObject({ code: 'network' });
    const empty = async () => json({ records: [] });
    await expect(fetchAirtableLeads(config, { fetchImpl: empty as typeof fetch })).rejects.toMatchObject({ code: 'empty' });
  });
});
