import { useMemo, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, decisionTotal, DECISION_STATUSES } from '../config/gates.js';
import { computeDiligence, needsPostLaunchReview, decisionLines } from '../lib/diligence.js';
import DiligenceBadge from './DiligenceBadge.jsx';
import NewDecisionModal from './NewDecisionModal.jsx';
import BackupControls from './BackupControls.jsx';
import { Button, Card, Pill } from './ui.jsx';

const SORTS = {
  recent: { label: 'Most recent', fn: (a, b) => b.updatedAt.localeCompare(a.updatedAt) },
  leastRigorous: {
    label: 'Least rigorous first',
    fn: (a, b) => computeDiligence(a).ratio - computeDiligence(b).ratio,
  },
  furthest: {
    label: 'Furthest in funnel',
    fn: (a, b) => b.currentGateOrder - a.currentGateOrder,
  },
};

export default function Backlog({ onOpen }) {
  const { state } = useStore();
  const [newOpen, setNewOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [sort, setSort] = useState('recent');

  const decisions = useMemo(() => {
    let list = state.decisions;
    if (statusFilter !== 'all') list = list.filter((d) => d.status === statusFilter);
    return [...list].sort(SORTS[sort].fn);
  }, [state.decisions, statusFilter, sort]);

  const noKey = !state.settings.apiKey;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Backlog</h1>
          <p className="text-sm text-ink/60">
            {state.decisions.length} decision{state.decisions.length === 1 ? '' : 's'} ·{' '}
            {state.profile.productName}
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)}>New decision</Button>
      </div>

      {noKey && (
        <Card className="mt-4 border-accent/30 bg-accent/5 p-4 text-sm text-ink/80">
          No Anthropic API key set — the funnel works with the built-in questions,
          but AI-personalised questions and probing are off. Add a key in{' '}
          <span className="font-medium">Settings</span> to turn them on.
        </Card>
      )}

      <div className="mt-4">
        <BackupControls variant="prominent" />
      </div>

      {state.decisions.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <select
            className="rounded-md border border-ink/20 bg-white px-2 py-1 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All statuses</option>
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-ink/20 bg-white px-2 py-1 text-sm"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mt-4 space-y-3">
        {decisions.length === 0 && (
          <Card className="p-8 text-center text-sm text-ink/50">
            No decisions yet. Log the next real call you're making at work.
          </Card>
        )}

        {decisions.map((d) => {
          const total = decisionTotal(d);
          const gate = decisionGateAt(d, d.currentGateOrder);
          const done = d.currentGateOrder > total;
          return (
            <Card
              key={d.id}
              className="cursor-pointer p-4 transition-colors hover:border-ink/25"
              onClick={() => onOpen(d.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium">{d.title}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/50">
                    <Pill>{d.type}</Pill>
                    {decisionLines(d).map((l) => (
                      <Pill key={l}>{l}</Pill>
                    ))}
                    <Pill>{d.status}</Pill>
                    <span>
                      {done
                        ? 'Funnel complete'
                        : `At gate ${d.currentGateOrder}/${total} — ${gate?.name}`}
                    </span>
                  </div>
                </div>
                {needsPostLaunchReview(d) && <Pill tone="flag">loop open</Pill>}
              </div>
              <div className="mt-3">
                <DiligenceBadge decision={d} />
              </div>
            </Card>
          );
        })}
      </div>

      {newOpen && (
        <NewDecisionModal
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            onOpen(id);
          }}
        />
      )}
    </div>
  );
}
