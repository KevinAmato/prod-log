import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import BackupControls from './BackupControls.jsx';
import SyncSheet from './SyncSheet.jsx';
import AiSettingsSheet from './AiSettingsSheet.jsx';
import CleanupSheet from './CleanupSheet.jsx';
import { syncEnabled } from '../lib/sync.js';
import { aiEnabled } from '../lib/ai.js';

const VIEWS = [
  ['live', 'Live'],
  ['done', 'Done'],
  ['deleted', 'Deleted'],
];

// Compact two-row header: brand + utilities on top, the Live/Done/Deleted
// switcher below. Filtering lives in each column's funnel now — the header ⋯
// menu keeps the board-wide bits: AI assistant, sync, hide-done, backup.
export default function Header({ view, setView, onAiChanged, onStartCleanup }) {
  const { state, actions, theme, toggleTheme } = useStore();
  const [menu, setMenu] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);

  const counts = {
    live: state.cards.filter((c) => c.status === 'live').length,
    done: state.cards.filter((c) => c.status === 'done').length,
    deleted: state.cards.filter((c) => c.status === 'deleted').length,
  };

  const item = 'block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5';

  return (
    <header className="shrink-0 border-b border-ink/10 bg-paper/95 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 pt-2.5">
        <h1 className="flex-1 text-base font-bold tracking-tight">
          ProdLog<span className="text-accent">.</span>
        </h1>

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
              <div className="absolute right-0 top-8 z-40 flex w-56 flex-col overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setAiOpen(true);
                  }}
                  className={item}
                >
                  ✦ AI assistant{aiEnabled() ? ' ✓' : '…'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setCleanupOpen(true);
                  }}
                  className={item}
                >
                  🧹 Cleanup schedule{state.cleanup?.everyDays ? ' ✓' : '…'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setSyncOpen(true);
                  }}
                  className={item}
                >
                  Sync devices{syncEnabled() ? ' ✓' : '…'}
                </button>
                <label className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-ink/80 hover:bg-ink/5">
                  <input
                    type="checkbox"
                    checked={state.prefs.hideDoneSubtasks}
                    onChange={(e) => actions.setPref('hideDoneSubtasks', e.target.checked)}
                    className="h-4 w-4 accent-[#7c3aed]"
                  />
                  Hide done subtasks
                </label>
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
      {aiOpen && <AiSettingsSheet onClose={() => setAiOpen(false)} onSaved={onAiChanged} />}
      {cleanupOpen && (
        <CleanupSheet onClose={() => setCleanupOpen(false)} onStart={onStartCleanup} />
      )}
    </header>
  );
}
