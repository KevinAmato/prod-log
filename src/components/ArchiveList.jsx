import { useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import CheckCircle from './CheckCircle.jsx';
import { Pill } from './ui.jsx';
import { queryTerms, cardMatches } from '../lib/search.js';

// The Done and Deleted boards. Rows render in array order — a card landing
// here is hoisted to the front by the store, so it's newest-first by default
// and can be drag-reordered exactly like the live board — or dragged onto
// the OTHER archive tab in the header (Done -> Deleted) to move it there.
//   Done:    uncheck to restore · ⋯ → move to Deleted / delete forever
//   Deleted: restore · delete forever (confirmed)
//
// Drag & drop (@hello-pangea/dnd) lives ONE level up, in App.jsx — a single
// DragDropContext spans Header + Board + ArchiveList; see its onDragEnd for
// both this board's own reordering and the tab-drop routing.
export default function ArchiveList({ mode, query = '' }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();

  const terms = queryTerms(query);
  const searching = terms.length > 0;
  const cards = state.cards.filter((c) => c.status === mode && cardMatches(c, terms));

  const restore = (card) => {
    actions.restoreCard(card.id);
    snack('Restored to board', { label: 'Undo', onAction: undo });
  };

  const toDeleted = (card) => {
    actions.deleteCard(card.id);
    snack('Moved to Deleted', { label: 'Undo', onAction: undo });
  };

  const destroy = (card) => {
    if (window.confirm(`Delete “${card.title}” forever? This can't be recovered later.`)) {
      actions.destroyCard(card.id);
      snack('Deleted forever', { label: 'Undo', onAction: undo });
    }
  };

  const destroyAll = () => {
    if (
      window.confirm(
        `Permanently delete all ${cards.length} task${cards.length === 1 ? '' : 's'} in the Deleted board? This can't be recovered later.`,
      )
    ) {
      actions.destroyAll('deleted');
      snack(`Deleted ${cards.length} forever`, { label: 'Undo', onAction: undo });
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink/40">
        {searching
          ? 'No matches on this board.'
          : mode === 'done'
            ? 'Nothing done yet — completed tasks land here.'
            : 'Nothing deleted. Deleted tasks land here and can be restored.'}
      </div>
    );
  }

  return (
    <Droppable droppableId={`archive-${mode}`}>
      {(provided) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className="mx-auto h-full max-w-xl overflow-y-auto px-3 py-3"
        >
          {/* Hidden while searching: it empties the WHOLE board, which
              wouldn't match the filtered list you're looking at. */}
          {mode === 'deleted' && !searching && (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={destroyAll}
                className="rounded-lg border border-accent/30 px-2.5 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                Delete all forever
              </button>
            </div>
          )}
          {cards.map((card, i) => (
            <Draggable key={card.id} draggableId={card.id} index={i}>
              {(prov, snap) => (
                <ArchiveRow
                  provided={prov}
                  isDragging={snap.isDragging}
                  card={card}
                  mode={mode}
                  onRestore={() => restore(card)}
                  onToDeleted={() => toDeleted(card)}
                  onDestroy={() => destroy(card)}
                />
              )}
            </Draggable>
          ))}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

function ArchiveRow({ provided, isDragging, card, mode, onRestore, onToDeleted, onDestroy }) {
  const { state } = useStore();
  const [menu, setMenu] = useState(false);

  const stamp = mode === 'done' ? 'doneAt' : 'deletedAt';
  const colName = state.columns.find((c) => c.id === card.columnId)?.name;
  const category = state.categories.find((c) => c.id === card.categoryId);

  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      data-card-id={card.id}
      className={`mb-2 flex select-none items-start gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm ${
        isDragging ? 'shadow-xl ring-2 ring-accent/40' : ''
      }`}
      style={{
        ...provided.draggableProps.style,
        borderLeft: `4px solid ${category ? category.color : 'transparent'}`,
      }}
    >
      {mode === 'done' && (
        <div className="pt-0.5">
          <CheckCircle checked onToggle={onRestore} title="Un-complete (restore)" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`break-words text-sm font-medium leading-snug ${
            mode === 'done' ? 'text-ink/60 line-through' : ''
          }`}
        >
          {card.title}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink/45">
          {colName && <Pill>{colName}</Pill>}
          {card.subtasks.length > 0 && (
            <span>
              {card.subtasks.filter((t) => t.done).length}/{card.subtasks.length} subtasks
            </span>
          )}
          {card[stamp] && <span>{new Date(card[stamp]).toLocaleDateString()}</span>}
        </div>
      </div>

      {mode === 'deleted' ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onRestore}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
          >
            Restore
          </button>
          <button
            type="button"
            onClick={onDestroy}
            className="rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
          >
            Delete forever
          </button>
        </div>
      ) : (
        <div className="relative shrink-0">
          <button
            type="button"
            title="Task menu"
            onClick={() => setMenu((v) => !v)}
            className="-m-1 rounded-lg p-1.5 leading-none text-ink/40 hover:bg-ink/5 hover:text-ink"
          >
            ⋯
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-7 z-40 w-48 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onRestore();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  Restore to board
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onToDeleted();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  Move to Deleted
                </button>
                <div className="my-1 h-px bg-ink/10" />
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    onDestroy();
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-accent hover:bg-accent/10"
                >
                  Delete forever
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
