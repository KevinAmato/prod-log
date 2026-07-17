import { useEffect, useRef, useState } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { useStore } from '../store/StoreContext.jsx';
import BackupControls from './BackupControls.jsx';
import SyncSheet from './SyncSheet.jsx';
import AiSettingsSheet from './AiSettingsSheet.jsx';
import CleanupSheet from './CleanupSheet.jsx';
import { syncEnabled } from '../lib/sync.js';
import { aiEnabled } from '../lib/ai.js';
import { queryTerms, cardMatches } from '../lib/search.js';

const VIEWS = [
  ['live', 'Live'],
  ['done', 'Done'],
  ['deleted', 'Deleted'],
];

function SearchIcon({ className = '' }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 15 15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10 10l3.5 3.5" />
    </svg>
  );
}

// Compact two-row header: brand + utilities on top, the Live/Done/Deleted
// switcher below. Filtering lives in each column's funnel now — the header ⋯
// menu keeps the board-wide bits: AI assistant, sync, hide-done, backup.
// The search icon expands over the brand into an input; its query composes
// with the column filters (both must match) and applies to whichever board
// you're on, so the archive is searchable too.
export default function Header({
  view,
  setView,
  query,
  setQuery,
  onAiChanged,
  onStartCleanup,
  onQuickCapture,
}) {
  const { state, actions, theme, toggleTheme } = useStore();
  const [menu, setMenu] = useState(false);
  const [syncOpen, setSyncOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const counts = {
    live: state.cards.filter((c) => c.status === 'live').length,
    done: state.cards.filter((c) => c.status === 'done').length,
    deleted: state.cards.filter((c) => c.status === 'deleted').length,
  };

  // Count within the CURRENT board only — matches what you're looking at.
  const terms = queryTerms(query);
  const matchCount = terms.length
    ? state.cards.filter((c) => c.status === view && cardMatches(c, terms)).length
    : 0;

  const closeSearch = () => {
    setQuery('');
    setSearchOpen(false);
  };

  const item = 'block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5';

  return (
    // relative z-40 keeps the menu + its click-away scrim painting ABOVE the
    // board. No backdrop-blur: besides being useless here (nothing scrolls
    // behind the header), backdrop-filter turns the header into the containing
    // block for fixed descendants — the full-screen scrim would collapse to
    // the header strip and outside-clicks could never close the menu.
    <header className="relative z-40 shrink-0 border-b border-ink/10 bg-paper">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 pt-2.5">
        {searchOpen ? (
          <div className="flex flex-1 items-center gap-1.5 rounded-full border border-accent/40 bg-surface px-2.5 py-1 ring-1 ring-accent/20">
            <SearchIcon className="shrink-0 text-accent" />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
              placeholder="Search tasks…"
              className="min-w-0 flex-1 bg-transparent py-0.5 text-base outline-none placeholder:text-ink/35 sm:text-sm"
            />
            {!!terms.length && (
              <span className="shrink-0 text-[11px] tabular-nums text-ink/45">
                {matchCount}
              </span>
            )}
            <button
              type="button"
              onClick={closeSearch}
              title="Close search"
              className="shrink-0 rounded-md p-0.5 leading-none text-ink/45 hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <h1 className="flex-1 text-base font-bold tracking-tight">
              Pino<span className="text-accent">.</span>
            </h1>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              title="Search tasks"
              className="rounded-lg p-1.5 text-ink/60 hover:bg-ink/5"
            >
              <SearchIcon />
            </button>
          </>
        )}

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
                    onQuickCapture();
                  }}
                  className={item}
                >
                  ⚡ Quick capture…
                </button>
                <div className="my-1 h-px bg-ink/10" />
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
                  🧹 Cleanup schedule{state.cleanups?.length ? ' ✓' : '…'}
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

      {/* ── View switcher — Done/Deleted also double as drag targets: drop a
             card here to complete (Done, force-completes subtasks too — a
             drag is a deliberate enough gesture that a shake-and-reject would
             feel broken) or delete (Deleted, soft — same as the ⋯ menu). Live
             isn't a target; nothing asked for drag-to-restore and it already
             has one (uncheck / Restore). ────────────────────────────────── */}
      <div className="mx-auto max-w-5xl px-3 pb-2.5 pt-2">
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/[0.06] p-1">
          {VIEWS.map(([key, label]) => {
            const tab = (dropProps, isOver) => (
              <button
                ref={dropProps?.innerRef}
                {...dropProps?.droppableProps}
                type="button"
                onClick={() => setView(key)}
                title={
                  key === 'done'
                    ? 'Drop a task here to complete it'
                    : key === 'deleted'
                      ? 'Drop a task here to delete it'
                      : undefined
                }
                className={`rounded-lg py-1.5 text-sm font-medium transition-all ${
                  isOver
                    ? 'scale-105 bg-accent text-white shadow-md'
                    : view === key
                      ? 'bg-surface shadow-sm'
                      : 'text-ink/50 hover:text-ink/80'
                }`}
              >
                {label}
                {counts[key] > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${isOver ? 'text-white' : view === key ? 'text-accent' : 'text-ink/35'}`}
                  >
                    {counts[key]}
                  </span>
                )}
              </button>
            );
            if (key === 'live') return <div key={key}>{tab()}</div>;
            return (
              <Droppable key={key} droppableId={`tab-${key}`}>
                {(dropProps, snapshot) => tab(dropProps, snapshot.isDraggingOver)}
              </Droppable>
            );
          })}
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
