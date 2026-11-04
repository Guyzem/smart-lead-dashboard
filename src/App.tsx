import { Menu } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { FunnelChart, SourceChart, StatusChart, TrendChart } from './components/Charts';
import { PriorityList, RepTable, StaleAlert } from './components/Insights';
import { KpiCards } from './components/KpiCards';
import { LeadDrawer } from './components/LeadDrawer';
import { LeadsTable } from './components/LeadsTable';
import { ScoringPage } from './components/ScoringPage';
import type { NavId } from './components/Sidebar';
import { Sidebar } from './components/Sidebar';
import type { LeadFilters } from './lib/filters';
import { EMPTY_FILTERS, filterLeads } from './lib/filters';
import { formatDate } from './lib/format';
import { computeKpis, countBySource, countByStatus, funnel, repPerformance, weeklyTrend } from './lib/metrics';
import { enrichLeads } from './lib/scoring';
import { defaultStorage } from './lib/storage';
import { useLeadStore } from './state/useLeadStore';

type View = 'overview' | 'leads' | 'scoring';

const TITLES: Record<View, { title: string; subtitle: string }> = {
  overview: { title: 'סקירה כללית', subtitle: 'תמונת מצב של הלידים, המקורות וההמרות' },
  leads: { title: 'ניהול לידים', subtitle: 'חיפוש, סינון, תעדוף ועדכון סטטוס' },
  scoring: { title: 'שיטת הניקוד', subtitle: 'איך המערכת מתעדפת לידים' },
};

export default function App({ now: nowProp, storage = defaultStorage() }: { now?: Date; storage?: Storage }) {
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);
  const store = useLeadStore(now, storage);

  const [view, setView] = useState<View>('overview');
  const [filters, setFilters] = useState<LeadFilters>(EMPTY_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Single source of truth: every KPI, chart and table row derives from `filtered`.
  const scored = useMemo(() => enrichLeads(store.leads, now), [store.leads, now]);
  const filtered = useMemo(() => filterLeads(scored, filters, now), [scored, filters, now]);
  const kpis = useMemo(() => computeKpis(filtered, now), [filtered, now]);
  const allStale = useMemo(() => scored.filter((l) => l.stale).length, [scored]);
  const selected = scored.find((l) => l.id === selectedId) ?? null;

  const navigate = (id: NavId) => {
    setMenuOpen(false);
    if (id === 'stale') {
      setFilters({ ...EMPTY_FILTERS, staleOnly: true });
      setView('leads');
    } else {
      if (id === 'leads' && filters.staleOnly) setFilters({ ...filters, staleOnly: false });
      setView(id);
    }
  };
  const activeNav: NavId = view === 'leads' && filters.staleOnly ? 'stale' : view;

  const reset = () => {
    if (window.confirm('לאפס את כל השינויים (סטטוסים והערות) ולחזור לנתוני הדמה המקוריים?')) {
      store.reset();
      setFilters(EMPTY_FILTERS);
      setSelectedId(null);
    }
  };

  const closeDrawer = useCallback(() => setSelectedId(null), []);
  const { title, subtitle } = TITLES[view];

  return (
    <div className="min-h-screen lg:flex">
      <Sidebar active={activeNav} staleCount={allStale} open={menuOpen} onNavigate={navigate} onClose={() => setMenuOpen(false)} onReset={reset} />

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 py-3 lg:px-8">
            <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="פתיחת תפריט" onClick={() => setMenuOpen(true)}>
              <Menu className="size-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-xl">{title}</h1>
              <p className="hidden truncate text-sm text-slate-500 sm:block">{subtitle}</p>
            </div>
            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-500 md:inline">עודכן: {formatDate(now.toISOString())}</span>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] space-y-5 p-4 lg:p-8">
          {view !== 'scoring' && (
            <>
              <FilterBar filters={filters} onChange={setFilters} shown={filtered.length} total={scored.length} />
              <KpiCards kpis={kpis} />
            </>
          )}

          {view === 'overview' && (
            <>
              <StaleAlert count={kpis.staleCount} onShow={() => navigate('stale')} />
              <div className="grid gap-5 xl:grid-cols-2">
                <SourceChart rows={countBySource(filtered)} active={filters.source} onSelect={(source) => setFilters({ ...filters, source })} />
                <StatusChart rows={countByStatus(filtered)} active={filters.status} onSelect={(status) => setFilters({ ...filters, status })} />
                <TrendChart points={weeklyTrend(filtered, now)} />
                <FunnelChart rows={funnel(filtered)} wonValue={kpis.wonValue} />
              </div>
              <div className="grid gap-5 xl:grid-cols-2">
                <PriorityList leads={filtered} onOpen={setSelectedId} onShowAll={() => setView('leads')} />
                <RepTable rows={repPerformance(filtered, now)} onSelect={(owner) => setFilters({ ...filters, owner })} />
              </div>
            </>
          )}

          {view === 'leads' && (
            <LeadsTable
              leads={filtered}
              onOpen={setSelectedId}
              onStatusChange={store.setStatus}
              onClearFilters={() => setFilters(EMPTY_FILTERS)}
              filterKey={JSON.stringify(filters)}
            />
          )}

          {view === 'scoring' && <ScoringPage />}
        </main>
      </div>

      <LeadDrawer lead={selected} now={now} onClose={closeDrawer} onStatusChange={store.setStatus} onAddNote={store.addNote} />
    </div>
  );
}
