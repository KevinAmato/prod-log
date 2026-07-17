import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import BackupControls from './BackupControls.jsx';
import SyncSheet from './SyncSheet.jsx';
import { syncEnabled } from '../lib/sync.js';

const VIEWS = [
  ['live', 'Live'],
  ['done', 'Done'],
  ['deleted', 'Deleted'],
];

// Compact two-row header: brand + utilities on top, the Live/Done/Deleted
// switcher below (full-width segmented control — the primary navigation).
export default function Header({ view, setView }) {
  const { state, actions, theme, toggleTheme } = useStore();
  const [menu, setMenu] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);

  const { filterCategoryId, filterOverdue } = state.prefs;
  const filterActive = !!filterCategoryId || filterOverdue;
  const activeCat = state.categories.find((c) => c.id === filterCategoryId);

  const counts = {
    live: state.cards.filter((c) => c.status === 'live').length,
    done: state.cards.filter((c) => c.status === 'done').length,
    deleted: state.cards.filter((c) => c.status === 'deleted').length,
  };

  return (
    <header className="shrink-0 border-b border-ink/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 pt-2.5">
        <h1 className="flex-1 text-base font-bold tracking-tight">
          ProdLog<span className="text-accent">.</span>
        </h1>

        {/* Board filter: by category color and/or overdue */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setFilterOpen((v) => !v)}
            title="Filter the board"
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              filterActive
                ? 'border-accent/40 bg-accent/10 text-accent'
                : 'border-ink/15 text-ink/50 hover:bg-ink/5'
            }`}
          >
            {activeCat && (
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: activeCat.color }} />
            )}
            Filter{filterOverdue ? ' · overdue' : ''}
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-8 z-40 w-56 rounded-xl border border-ink/10 bg-surface p-3 shadow-xl">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                  Color
                </p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {state.categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      title={cat.name}
                      onClick={() =>
                        actions.setPref(
                          'filterCategoryId',
                          filterCategoryId === cat.id ? null : cat.id,
                        )
                      }
                      className="h-6 w-6 rounded-full"
                      style={{
                        background: cat.color,
                        outline:
                          filterCategoryId === cat.id ? `2px solid ${cat.color}` : 'none',
                        outlineOffset: 2,
                        opacity: filterCategoryId && filterCategoryId !== cat.id ? 0.35 : 1,
                      }}
                    />
                  ))}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
                  <input
                    type="checkbox"
                    checked={filterOverdue}
                    onChange={(e) => actions.setPref('filterOverdue', e.target.checked)}
                    className="h-4 w-4 accent-[#7c3aed]"
                  />
                  Overdue only
                </label>
                <label className="mt-2 flex items-center gap-2 text-sm text-ink/80">
                  <input
                    type="checkbox"
                    checked={state.prefs.hideDoneSubtasks}
                    onChange={(e) => actions.setPref('hideDoneSubtasks', e.target.checked)}
                    className="h-4 w-4 accent-[#7c3aed]"
                  />
                  Hide done subtasks
                </label>
                {filterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      actions.setPref('filterCategoryId', null);
                      actions.setPref('filterOverdue', false);
                    }}
                    className="mt-3 w-full rounded-lg border border-ink/15 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          title="Toggle dark mode"
          className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        <div className="relative">
          <button
            type="button"
            title="Menu"
            onClick={() => setMenu((v) => !v)}
            className="rounded-lg p-1.5 leading-none text-ink/60 hover:bg-ink/5"
          >
            ⋯
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-8 z-40 flex w-52 flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setSyncOpen(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  Sync devices{syncEnabled() ? ' ✓' : '…'}
                </button>
                <div className="my-1 h-px bg-ink/10" />
                <BackupControls />
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── View switcher ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-3 pb-2.5 pt-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.06] p-1">
          {VIEWS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={`rounded-lg py-1.5 text-sm font-medium transition-colors ${
                view === key ? 'bg-surface shadow-sm' : 'text-ink/50 hover:text-ink/80'
              }`}
            >
              {label}
              {counts[key] > 0 && (
                <span className={`ml-1.5 text-xs ${view === key ? 'text-accent' : 'text-ink/35'}`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {syncOpen && <SyncSheet onClose={() => setSyncOpen(false)} />}
    </header>
  );
}
