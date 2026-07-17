import { useMemo, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useStore } from '../store/StoreContext.jsx';
import Column from './Column.jsx';
import { isOverdue } from '../lib/dates.js';
import { numberCards } from '../lib/assistant.js';
import { queryTerms, cardMatches } from '../lib/search.js';

// The live board. Mobile-first: columns are near-full-width and snap-scroll
// horizontally; desktop side by side. Drag & drop is @hello-pangea/dnd.
// Filters are PER COLUMN (funnel in each column header); task numbers are the
// global top-to-bottom order over unfiltered live cards, so they stay stable
// while filtering and are what the AI assistant references.
export default function Board({ query = '' }) {
  const { state, actions } = useStore();
  const [addingCol, setAddingCol] = useState(false);
  const [dragging, setDragging] = useState(false);

  const numbers = useMemo(() => numberCards(state), [state]);
  const terms = useMemo(() => queryTerms(query), [query]);

  // Search composes WITH the column's own filter — a card has to satisfy both.
  const visibleIn = (col) => {
    const f = col.filter || {};
    return state.cards.filter(
      (c) =>
        c.status === 'live' &&
        c.columnId === col.id &&
        (!f.categoryId || c.categoryId === f.categoryId) &&
        (!f.overdue || isOverdue(c.dueDate)) &&
        cardMatches(c, terms),
    );
  };

  const onDragEnd = ({ draggableId, source, destination }) => {
    setDragging(false);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    // The visible list may be filtered, so map the visible destination index
    // to a slot among ALL live cards of the destination column (moveCard
    // indexes exclude the moving card).
    const destCol = state.columns.find((c) => c.id === destination.droppableId);
    if (!destCol) return;
    const visible = visibleIn(destCol).filter((c) => c.id !== draggableId);
    const anchor = visible[destination.index];
    let slot = Infinity;
    if (anchor) {
      const underlying = state.cards.filter(
        (c) =>
          c.status === 'live' &&
          c.columnId === destination.droppableId &&
          c.id !== draggableId,
      );
      slot = underlying.indexOf(anchor);
    }
    actions.moveCard(draggableId, destination.droppableId, slot);
  };

  return (
    <DragDropContext
      onDragStart={() => setDragging(true)}
      onDragEnd={onDragEnd}
      // Softer cross-column drags on mobile: the board starts auto-scrolling
      // much earlier (30% from the edge vs 25% default) and ramps to a faster
      // max sooner, so nudging a card toward the next column scrolls the view.
      autoScrollerOptions={{
        startFromPercentage: 0.3,
        maxScrollAtPercentage: 0.15,
        maxPixelScroll: 34,
      }}
    >
      <div
        className={`flex h-full gap-3 overflow-x-auto overflow-y-hidden scroll-px-3 px-3 pt-3 sm:snap-none ${
          dragging ? '' : 'snap-x snap-mandatory' // snap fights dnd auto-scroll
        }`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
      >
        {state.columns.map((col) => (
          <Column
            key={col.id}
            column={col}
            columns={state.columns}
            canDelete={state.columns.length > 1}
            cards={visibleIn(col)}
            numbers={numbers}
            searching={terms.length > 0}
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
    </DragDropContext>
  );
}
