import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import TaskCard from './TaskCard.jsx';
import QuickAdd from './QuickAdd.jsx';

// One board column: rename inline, delete via menu (live cards move to the
// first remaining column), quick-add pinned at the bottom. Cards can be
// dropped anywhere in the column body (drops on a card insert at its slot).
export default function Column({ column, cards, columns, canDelete }) {
  const { actions } = useStore();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const renameRef = useRef(null);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const commitRename = (e) => {
    actions.renameColumn(column.id, e.target.value);
    setRenaming(false);
  };

  const removeColumn = () => {
    setMenu(false);
    const live = cards.length;
    const target = columns.find((c) => c.id !== column.id);
    if (
      live === 0 ||
      window.confirm(
        `“${column.name}” has ${live} task${live === 1 ? '' : 's'} — they'll move to “${target.name}”. Remove column?`,
      )
    ) {
      actions.removeColumn(column.id);
    }
  };

  return (
    <section
      className="flex max-h-full w-[86vw] max-w-[330px] shrink-0 snap-center flex-col rounded-2xl bg-ink/[0.045] sm:w-80"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const dragId = e.dataTransfer.getData('text/card-id');
        if (dragId) actions.moveCard(dragId, column.id, Infinity);
      }}
    >
      {/* ── Column header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 pb-1 pt-3">
        {renaming ? (
          <input
            ref={renameRef}
            defaultValue={column.name}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename(e);
              if (e.key === 'Escape') setRenaming(false);
            }}
            className="min-w-0 flex-1 rounded border border-accent/50 bg-surface px-2 py-1 text-sm font-semibold outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setRenaming(true)}
            title="Rename column"
            className="min-w-0 flex-1 truncate text-left text-sm font-semibold"
          >
            {column.name}
            <span className="ml-2 font-normal text-ink/40">{cards.length}</span>
          </button>
        )}

        <div className="relative shrink-0">
          <button
            type="button"
            title="Column menu"
            onClick={() => setMenu((v) => !v)}
            className="-m-1 rounded-lg p-1.5 leading-none text-ink/40 hover:bg-ink/10 hover:text-ink"
          >
            ⋯
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-7 z-40 w-44 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    setRenaming(true);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  Rename
                </button>
                <button
                  type="button"
                  disabled={!canDelete}
                  onClick={removeColumn}
                  className="block w-full px-3 py-2 text-left text-sm text-accent hover:bg-accent/10 disabled:opacity-30"
                >
                  Remove column
                </button>
              </div>
            </>
          )}
        </div>
      </header>

      {/* ── Cards ─────────────────────────────────────────────────────── */}
      <div className="min-h-[40px] flex-1 space-y-2 overflow-y-auto px-2 py-2">
        {cards.map((card, i) => (
          <TaskCard
            key={card.id}
            card={card}
            index={i}
            columnCount={cards.length}
            columns={columns}
            onDropCard={(dragId, slot) => actions.moveCard(dragId, column.id, slot)}
          />
        ))}
        {cards.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-ink/30">No tasks yet</p>
        )}
      </div>

      {/* ── Quick add (pinned) ────────────────────────────────────────── */}
      <div className="px-2 pb-2">
        <QuickAdd onAdd={(titles) => actions.addCards(column.id, titles)} />
      </div>
    </section>
  );
}
