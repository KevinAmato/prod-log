import { useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useStore } from '../store/StoreContext.jsx';
import Column from './Column.jsx';
import { isOverdue } from '../lib/dates.js';

// The live board. Mobile-first: columns are near-full-width and snap-scroll
// horizontally (swipe between Short term / Long term); on desktop they simply
// sit side by side. A ghost column at the end adds new columns.
// Drag & drop is @hello-pangea/dnd (react-beautiful-dnd fork): battle-tested
// touch handling (long-press to lift, scroll otherwise), auto-scroll of both
// the horizontal board and column lists, keyboard dragging for free.
// Board-level filters (category color / overdue) come from prefs — set via the
// funnel button in the header.
export default function Board() {
  const { state, actions } = useStore();
  const [addingCol, setAddingCol] = useState(false);
  const [dragging, setDragging] = useState(false);

  const { filterCategoryId, filterOverdue } = state.prefs;
  const liveCards = state.cards.filter(
    (c) =>
      c.status === 'live' &&
      (!filterCategoryId || c.categoryId === filterCategoryId) &&
      (!filterOverdue || isOverdue(c.dueDate)),
  );

  const onDragEnd = ({ draggableId, source, destination }) => {
    setDragging(false);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index)
      return;

    // Dropping into an auto-sorted column: position is decided by the sort,
    // so just append to the underlying manual order.
    const destCol = state.columns.find((c) => c.id === destination.droppableId);
    if ((destCol?.sort || 'manual') !== 'manual') {
      actions.moveCard(draggableId, destination.droppableId, Infinity);
      return;
    }

    // The visible list may be filtered, so map the visible destination index
    // to a slot among ALL live cards of the destination column (moveCard
    // indexes exclude the moving card).
    const visible = liveCards.filter(
      (c) => c.columnId === destination.droppableId && c.id !== draggableId,
    );
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
    <DragDropContext onDragStart={() => setDragging(true)} onDragEnd={onDragEnd}>
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
    </DragDropContext>
  );
}
