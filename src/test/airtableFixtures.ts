import { INTEREST_LABELS, SOURCE_META, STATUS_META, UNASSIGNED_LABEL, URGENCY_LABELS } from '../constants';
import type { AirtableRecord } from '../lib/airtable';
import { FIELDS } from '../lib/airtable';
import type { Lead } from '../types';

/** A syntactically valid but fake token, used only in tests. */
export const FAKE_TOKEN = 'patTESTtest1234567.0000000000000000000000000000000000000000000000000000000000000000';

/** Shapes a Lead the way the Airtable "לידים" table returns it (Hebrew labels, date-only fields). */
export function toAirtableRecord(l: Lead, i: number): AirtableRecord {
  return {
    id: `rec${String(i).padStart(14, '0')}`,
    createdTime: l.createdAt,
    fields: {
      [FIELDS.id]: l.id,
      [FIELDS.name]: l.name,
      ...(l.company ? { [FIELDS.company]: l.company } : {}),
      ...(l.industry ? { [FIELDS.industry]: l.industry } : {}),
      [FIELDS.phone]: l.phone,
      [FIELDS.source]: SOURCE_META[l.source].label,
      [FIELDS.status]: STATUS_META[l.status].label,
      [FIELDS.owner]: l.owner ?? UNASSIGNED_LABEL,
      ...(l.value != null ? { [FIELDS.value]: l.value } : {}),
      [FIELDS.interest]: INTEREST_LABELS[l.interest],
      [FIELDS.urgency]: URGENCY_LABELS[l.urgency],
      [FIELDS.createdAt]: l.createdAt.slice(0, 10),
      [FIELDS.lastActivityAt]: l.lastActivityAt.slice(0, 10),
      ...(l.lostAtStage ? { [FIELDS.lostAtStage]: STATUS_META[l.lostAtStage].label } : {}),
      ...(l.notes.length ? { [FIELDS.notes]: l.notes.map((n) => n.text).join('\n') } : {}),
    },
  };
}

/** Splits records into Airtable-style pages of 100 with offsets. */
export function pages(records: AirtableRecord[]): { records: AirtableRecord[]; offset?: string }[] {
  const out: { records: AirtableRecord[]; offset?: string }[] = [];
  for (let i = 0; i < records.length; i += 100) {
    out.push({ records: records.slice(i, i + 100), ...(i + 100 < records.length ? { offset: `itr${i + 100}` } : {}) });
  }
  return out;
}
