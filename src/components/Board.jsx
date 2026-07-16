import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import Column from './Column.jsx';

// The live board. Mobile-first: columns are near-full-width and snap-scroll
// horizontally (swipe between Short term / Long term); on desktop they simply
// sit side by side. A ghost column at the end adds new columns.
export default function Board() {
  const { state, actions } = useStore();
  const [addingCol, setAddingCol] = useState(false);

  const liveCards = state.cards.filter((c) => c.status === 'live');

  return (
    <div
      data-board
      className="flex h-full gap-3 overflow-x-auto overflow-y-hidden scroll-px-3 snap-x snap-mandatory px-3 pt-3 sm:snap-none"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      {state.columns.map((col) => (
        <Column
          key={col.id}
          column={col}
          columns={state.columns}
          canDelete={state.columns.length > 1}
          cards={liveCards.filter((c) => c.columnId === col.id)}
        />
      ))}

      {/* ── Add column ────────────────────────────────────────────────── */}
      <div className="w-[60vw] max-w-[240px] shrink-0 snap-center sm:w-56">
        {addingCol ? (
          <input
            autoFocus
            placeholder="Column name"
            className="w-full rounded-xl border border-accent/50 bg-surface px-3 py-2.5 text-sm font-semibold outline-none ring-1 ring-accent/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.target.value.trim()) {
                actions.addColumn(e.target.value);
                setAddingCol(false);
              }
              if (e.key === 'Escape') setAddingCol(false);
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) actions.addColumn(e.target.value);
              setAddingCol(false);
            }}
          />
        ) : (
          <button
            type="button"
            onClick={() => setAddingCol(true)}
            className="w-full rounded-2xl border-2 border-dashed border-ink/15 px-3 py-3 text-sm font-medium text-ink/40 transition-colors hover:border-ink/30 hover:text-ink/70"
          >
            + Add column
          </button>
        )}
      </div>
    </div>
  );
}
