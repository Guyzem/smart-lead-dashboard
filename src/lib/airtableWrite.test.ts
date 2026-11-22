import { describe, expect, it, vi } from 'vitest';
import { generateLeads } from '../data/generateLeads';
import { FAKE_TOKEN } from '../test/airtableFixtures';
import { NOW } from '../test/fixtures';
import type { Lead } from '../types';
import { FIELDS } from './airtable';
import { AirtableWriteError, WRITE_ERROR_MESSAGES, chunk, fieldsForChange, isRetryable, israelDate, patchRecords } from './airtableWrite';
import { noteAdded, statusChange } from './storage';

// SPEC X2 / D17
const config = { token: FAKE_TOKEN, baseId: 'appIES3oUATmgV2YL', table: 'לידים' };
const lead: Lead = { ...generateLeads({ count: 1, now: NOW })[0], status: 'contacted', notes: [], recordId: 'recAAAAAAAAAAAAAA' };

describe('fieldsForChange', () => {
  it('status change writes only status, lost-at-stage, last activity and the stale flag', () => {
    const change = statusChange(lead, 'proposal', NOW);
    const f = fieldsForChange({ ...lead, ...change }, change, NOW);
    expect(Object.keys(f).sort()).toEqual([FIELDS.lastActivityAt, FIELDS.lostAtStage, FIELDS.stale, FIELDS.status].sort());
    expect(f[FIELDS.status]).toBe('הצעת מחיר');
    expect(f[FIELDS.lostAtStage]).toBeNull();
    expect(f[FIELDS.stale]).toBe(false);
    expect(f[FIELDS.lastActivityAt]).toBe(israelDate(NOW.toISOString()));
  });

  it('lost writes the stage it was lost at as its Hebrew label', () => {
    const change = statusChange(lead, 'lost', NOW);
    const f = fieldsForChange({ ...lead, ...change }, change, NOW);
    expect(f[FIELDS.status]).toBe('אבוד');
    expect(f[FIELDS.lostAtStage]).toBe('נוצר קשר');
  });

  it('a note writes all notes, one per line, and no status', () => {
    const one = noteAdded(lead, 'שיחה ראשונה', NOW)!;
    const l1 = { ...lead, ...one };
    const two = noteAdded(l1, 'נשלחה הצעה', NOW)!;
    const f = fieldsForChange({ ...l1, ...two }, two, NOW);
    expect(f[FIELDS.notes]).toBe('שיחה ראשונה\nנשלחה הצעה');
    expect(f).not.toHaveProperty(FIELDS.status);
    expect(f).toHaveProperty(FIELDS.lastActivityAt);
  });
});

describe('israelDate', () => {
  it('uses the calendar day in Israel', () => {
    expect(israelDate('2026-11-21T23:30:00.000Z')).toBe('2026-11-22');
    expect(israelDate('2026-11-22T10:00:00.000Z')).toBe('2026-11-22');
  });
});

describe('patchRecords', () => {
  it('sends one PATCH with the token only in the header and typecast off', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    await patchRecords(config, [{ id: 'recAAAAAAAAAAAAAA', fields: { [FIELDS.status]: 'חדש' } }], { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(`https://api.airtable.com/v0/appIES3oUATmgV2YL/${encodeURIComponent('לידים')}`);
    expect(url).not.toContain(FAKE_TOKEN);
    expect(init.method).toBe('PATCH');
    expect(init.headers.Authorization).toBe(`Bearer ${FAKE_TOKEN}`);
    expect(JSON.parse(init.body)).toEqual({ records: [{ id: 'recAAAAAAAAAAAAAA', fields: { [FIELDS.status]: 'חדש' } }], typecast: false });
  });

  it.each([
    [401, 'invalid-token', false],
    [403, 'write-forbidden', false],
    [404, 'write-not-found', false],
    [422, 'write-not-found', false],
    [429, 'rate-limit', true],
    [503, 'server', true],
  ] as const)('HTTP %i → %s (retry: %s)', async (status, code, retry) => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('{}', { status }));
    const err = await patchRecords(config, [{ id: 'rec1', fields: {} }], { fetchImpl }).catch((e) => e);
    expect(err).toBeInstanceOf(AirtableWriteError);
    expect(err.code).toBe(code);
    expect(isRetryable(err)).toBe(retry);
  });

  it('network failure is retryable with a Hebrew message', async () => {
    const err = await patchRecords(config, [{ id: 'rec1', fields: {} }], { fetchImpl: vi.fn().mockRejectedValue(new TypeError('fetch failed')) }).catch((e) => e);
    expect(err.code).toBe('network');
    expect(err.message).toBe(WRITE_ERROR_MESSAGES.network);
    expect(isRetryable(err)).toBe(true);
  });

  it('403 tells the user to add data.records:write', () => {
    expect(WRITE_ERROR_MESSAGES['write-forbidden']).toContain('data.records:write');
  });

  it('refuses more than 10 records per request; chunk splits by 10', async () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ id: `rec${i}`, fields: {} }));
    await expect(patchRecords(config, many, { fetchImpl: vi.fn() })).rejects.toThrow(RangeError);
    expect(chunk(many).map((c) => c.length)).toEqual([10, 1]);
  });
});
