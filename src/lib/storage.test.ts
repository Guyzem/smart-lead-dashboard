import { beforeEach, describe, expect, it } from 'vitest';
import { NOW, makeLead } from '../test/fixtures';
import { STORAGE_KEY, applyOverrides, loadOverrides, noteAdded, saveOverrides, statusChange } from './storage';

const storage = window.localStorage;

describe('localStorage persistence (SPEC S5, D11)', () => {
  beforeEach(() => storage.clear());

  it('round-trips overrides', () => {
    const o = { 'L-1001': { status: 'won' as const, lostAtStage: null, lastActivityAt: NOW.toISOString() } };
    saveOverrides(o, storage);
    expect(loadOverrides(storage)).toEqual(o);
  });

  it('removes the key when there are no overrides', () => {
    storage.setItem(STORAGE_KEY, 'x');
    saveOverrides({}, storage);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('edge case: missing storage returns empty overrides', () => {
    expect(loadOverrides(undefined)).toEqual({});
    expect(loadOverrides(storage)).toEqual({});
  });

  it('edge case: corrupt JSON is ignored', () => {
    storage.setItem(STORAGE_KEY, '{not json');
    expect(loadOverrides(storage)).toEqual({});
  });

  it('edge case: wrong version or shape is ignored', () => {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 99, overrides: { a: { status: 'won' } } }));
    expect(loadOverrides(storage)).toEqual({});
    storage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadOverrides(storage)).toEqual({});
  });

  it('edge case: invalid fields are dropped, valid ones kept', () => {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, overrides: { a: { status: 'bogus' }, b: { status: 'won', notes: [{ id: 1 }, { id: 'n', text: 't', createdAt: 'c' }] } } }),
    );
    expect(loadOverrides(storage)).toEqual({ b: { status: 'won', notes: [{ id: 'n', text: 't', createdAt: 'c' }] } });
  });

  it('applyOverrides merges by id and leaves others untouched', () => {
    const a = makeLead({ id: 'A' });
    const b = makeLead({ id: 'B' });
    const [a2, b2] = applyOverrides([a, b], { A: { status: 'won' } });
    expect(a2.status).toBe('won');
    expect(b2).toBe(b);
  });
});

describe('lead updates (SPEC M3, S4)', () => {
  it('status change records activity time', () => {
    const o = statusChange(makeLead({ status: 'contacted' }), 'qualified', NOW);
    expect(o).toEqual({ status: 'qualified', lostAtStage: null, lastActivityAt: NOW.toISOString() });
  });

  it('marking as lost remembers the stage it was lost at', () => {
    expect(statusChange(makeLead({ status: 'proposal' }), 'lost', NOW).lostAtStage).toBe('proposal');
  });

  it('adding a note appends it and trims text', () => {
    const o = noteAdded(makeLead(), '  התקשרתי  ', NOW)!;
    expect(o.notes).toHaveLength(1);
    expect(o.notes![0].text).toBe('התקשרתי');
    expect(o.lastActivityAt).toBe(NOW.toISOString());
  });

  it('edge case: blank note is rejected', () => {
    expect(noteAdded(makeLead(), '   ', NOW)).toBeNull();
  });
});
