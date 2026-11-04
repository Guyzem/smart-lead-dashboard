import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SOURCE_META, STATUS_META } from '../constants';
import type { CountRow, FunnelRow, TrendPoint } from '../lib/metrics';
import { formatCurrency, formatNumber, formatPercent } from '../lib/format';
import type { Source, Status } from '../types';
import { Card, EmptyState } from './ui';

const tooltipStyle = { borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12, direction: 'rtl' as const };

export function SourceChart({ rows, active, onSelect }: { rows: CountRow<Source>[]; active: Source | 'all'; onSelect: (s: Source | 'all') => void }) {
  const total = rows.reduce((s, r) => s + r.count, 0);
  const data = rows.filter((r) => r.count > 0).map((r) => ({ ...r, name: SOURCE_META[r.key].label }));
  return (
    <Card title="לידים לפי מקור" subtitle="לחיצה על פלח מסננת את הדאשבורד">
      {total === 0 ? <EmptyState title="אין נתונים להצגה" /> : (
        <div className="flex flex-col items-center gap-4 sm:flex-row" data-testid="chart-source">
          <div className="relative h-52 w-full sm:w-1/2">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={data} dataKey="count" nameKey="name" innerRadius="58%" outerRadius="90%" paddingAngle={2}
                  onClick={(_, i) => { const k = data[i].key; onSelect(active === k ? 'all' : k); }} cursor="pointer">
                  {data.map((r) => (
                    <Cell key={r.key} fill={SOURCE_META[r.key].color} opacity={active === 'all' || active === r.key ? 1 : 0.3} stroke="#fff" />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} לידים`, '']} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div><p className="text-2xl font-bold text-slate-900">{formatNumber(total)}</p><p className="text-xs text-slate-500">לידים</p></div>
            </div>
          </div>
          <ul className="w-full space-y-2 sm:w-1/2">
            {rows.map((r) => (
              <li key={r.key}>
                <button type="button" onClick={() => onSelect(active === r.key ? 'all' : r.key)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-slate-50 ${active === r.key ? 'bg-slate-100' : ''}`}>
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_META[r.key].color }} />
                  <span className="flex-1 truncate text-start text-slate-600">{SOURCE_META[r.key].label}</span>
                  <span className="font-semibold tabular-nums text-slate-900" data-testid={`source-count-${r.key}`}>{r.count}</span>
                  <span className="w-12 text-end text-xs tabular-nums text-slate-400">{formatPercent(total ? r.count / total : 0)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export function StatusChart({ rows, active, onSelect }: { rows: CountRow<Status>[]; active: Status | 'all'; onSelect: (s: Status | 'all') => void }) {
  const data = rows.map((r) => ({ ...r, name: STATUS_META[r.key].label }));
  const total = rows.reduce((s, r) => s + r.count, 0);
  return (
    <Card title="לידים לפי סטטוס" subtitle="לחיצה על עמודה מסננת לפי הסטטוס">
      {total === 0 ? <EmptyState title="אין נתונים להצגה" /> : (
        // dir="ltr" so SVG text-anchor works as expected; Hebrew glyphs still render correctly.
        <div className="h-64" data-testid="chart-status" dir="ltr">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 0, left: 8, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" reversed allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="name" orientation="right" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={false} width={84} interval={0} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={tooltipStyle} formatter={(v) => [`${formatNumber(Number(v))} לידים`, '']} />
              <Bar dataKey="count" radius={[8, 0, 0, 8]} cursor="pointer" maxBarSize={28}
                onClick={(_, i) => { const k = data[i].key; onSelect(active === k ? 'all' : k); }}>
                {data.map((r) => (
                  <Cell key={r.key} fill={STATUS_META[r.key].color} opacity={active === 'all' || active === r.key ? 1 : 0.3} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function TrendChart({ points }: { points: TrendPoint[] }) {
  const total = points.reduce((s, p) => s + p.leads, 0);
  return (
    <Card title="מגמת כניסת לידים" subtitle="לידים חדשים לפי שבוע קבלה, 13 השבועות האחרונים"
      action={
        <div className="flex shrink-0 flex-col gap-1 text-xs text-slate-600 sm:flex-row sm:gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-indigo-500" />לידים שהתקבלו</span>
          <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-full bg-emerald-500" />מתוכם הומרו</span>
        </div>
      }>
      {total === 0 ? <EmptyState title="אין נתונים להצגה" /> : (
        <div className="h-64" data-testid="chart-trend">
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gWon" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" reversed tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis orientation="right" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip contentStyle={tooltipStyle} labelFormatter={(l) => `שבוע מ-${l}`} />
              <Area type="monotone" dataKey="leads" name="לידים שהתקבלו" stroke="#6366f1" strokeWidth={2} fill="url(#gLeads)" />
              <Area type="monotone" dataKey="won" name="מתוכם הומרו" stroke="#10b981" strokeWidth={2} fill="url(#gWon)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

export function FunnelChart({ rows, wonValue }: { rows: FunnelRow[]; wonValue: number }) {
  const top = rows[0]?.count ?? 0;
  return (
    <Card title="משפך המרות" subtitle="כמה לידים הגיעו לכל שלב (כולל לידים שאבדו בהמשך)">
      {top === 0 ? <EmptyState title="אין נתונים להצגה" /> : (
        <ol className="space-y-2.5" data-testid="chart-funnel">
          {rows.map((r, i) => (
            <li key={r.stage}>
              <div className="mb-1 flex items-baseline justify-between text-sm">
                <span className="font-medium text-slate-700">{STATUS_META[r.stage].label}</span>
                <span className="tabular-nums text-slate-500">
                  <span className="font-semibold text-slate-900" data-testid={`funnel-count-${r.stage}`}>{r.count}</span>
                  {i > 0 && <span className="ms-2 text-xs">({formatPercent(r.rateFromPrev)} מהשלב הקודם)</span>}
                </span>
              </div>
              <div className="h-7 overflow-hidden rounded-lg bg-slate-100">
                <div className="h-full rounded-lg transition-all duration-500"
                  style={{ width: `${Math.max(r.rateFromTop * 100, r.count ? 2 : 0)}%`, backgroundColor: STATUS_META[r.stage].color }} />
              </div>
            </li>
          ))}
          <li className="pt-1 text-xs text-slate-500">שווי עסקאות שנסגרו: <span className="font-semibold text-emerald-600">{formatCurrency(wonValue)}</span></li>
        </ol>
      )}
    </Card>
  );
}
