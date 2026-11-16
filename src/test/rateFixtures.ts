// SPEC X1: a Frankfurter answer used by unit and E2E tests. No real network in tests.
export const FRANKFURTER_RESPONSE = {
  amount: 1,
  base: 'ILS',
  date: '2026-11-13',
  rates: { EUR: 0.2, GBP: 0.125, USD: 0.25 },
} as const;

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
