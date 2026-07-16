import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import BackupControls from './BackupControls.jsx';

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

        {/* Hide-done-subtasks filter (board-level, spec §filter) */}
        <button
          type="button"
          onClick={() => actions.setPref('hideDoneSubtasks', !state.prefs.hideDoneSubtasks)}
          className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            state.prefs.hideDoneSubtasks
              ? 'border-accent/40 bg-accent/10 text-accent'
              : 'border-ink/15 text-ink/50 hover:bg-ink/5'
          }`}
          title="Hide completed subtasks on the board"
        >
          {state.prefs.hideDoneSubtasks ? '✓ ' : ''}Hide done
        </button>

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
              <div className="absolute right-0 top-8 z-40 flex w-48 flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
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
    </header>
  );
}
