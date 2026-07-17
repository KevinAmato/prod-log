import { useEffect, useRef, useState } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import TaskCard from './TaskCard.jsx';
import QuickAdd from './QuickAdd.jsx';
import { boardToText, copyText } from '../lib/exportText.js';

const SORT_ACTIONS = [
  ['due', 'Sort by due date'],
  ['az', 'Sort A → Z'],
  ['za', 'Sort Z → A'],
];

// One board column. Header has three control sections:
//   ⇅  sort   — one-shot rearrange (dragging always keeps working)
//   ⧩  filter — per-column view filter: category color and/or overdue
//   ⋯  rest   — rename / remove
// Cards can be dropped anywhere in the column body.
export default function Column({ column, cards, columns, canDelete, numbers, searching = false }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();
  const [menu, setMenu] = useState(false); // 'sort' | 'filter' | 'more' | false
  const [renaming, setRenaming] = useState(false);
  const [addSignal, setAddSignal] = useState(0); // tap-on-empty-space → quick add
  const renameRef = useRef(null);
  // A tap on the column's empty space means "open the adder" — UNLESS the
  // adder is already open, where it means "cancel". Both have to be decided
  // at pointerdown: by the time `click` fires, the input's blur has already
  // closed it, so `click` alone can't tell the two apart (and would just
  // reopen it, making cancel impossible).
  const adderOpen = useRef(false);
  const suppressReopen = useRef(false);

  const filter = column.filter || {};
  const filterActive = !!filter.categoryId || !!filter.overdue;
  const filterCat = state.categories.find((c) => c.id === filter.categoryId);

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

  const iconBtn = (active) =>
    `-m-0.5 rounded-lg p-1.5 leading-none transition-colors ${
      active ? 'bg-accent/10 text-accent' : 'text-ink/40 hover:bg-ink/10 hover:text-ink'
    }`;

  const pop =
    'absolute right-0 top-7 z-40 w-52 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl';

  return (
    <section className="flex h-full min-h-0 w-[86vw] max-w-[330px] shrink-0 snap-center flex-col rounded-2xl bg-ink/[0.045] sm:w-80">
      {/* ── Column header ─────────────────────────────────────────────── */}
      <header className="flex items-center gap-1.5 px-3 pb-1 pt-3">
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

        {/* Sort (one-shot) */}
        <div className="relative shrink-0">
          <button
            type="button"
            title="Sort column"
            onClick={() => setMenu(menu === 'sort' ? false : 'sort')}
            className={iconBtn(menu === 'sort')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M4.5 2.5v10M4.5 12.5 2 10M4.5 12.5 7 10" />
              <path d="M10.5 12.5v-10M10.5 2.5 8 5M10.5 2.5 13 5" />
            </svg>
          </button>
          {menu === 'sort' && (
            <>
              <div className="fixed inset-0 z-30 cursor-pointer" onClick={() => setMenu(false)} />
              <div className={pop}>
                {SORT_ACTIONS.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      actions.sortColumn(column.id, key);
                      setMenu(false);
                      snack('Sorted — drag anytime to rearrange', { label: 'Undo', onAction: undo });
                    }}
                    className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Filter (funnel) */}
        <div className="relative shrink-0">
          <button
            type="button"
            title="Filter column"
            onClick={() => setMenu(menu === 'filter' ? false : 'filter')}
            className={iconBtn(filterActive || menu === 'filter')}
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1.5 2.5h12l-4.5 5.5v4l-3 1.5v-5.5L1.5 2.5Z" fill={filterActive ? 'currentColor' : 'none'} fillOpacity={filterActive ? 0.25 : 0} />
            </svg>
          </button>
          {menu === 'filter' && (
            <>
              <div className="fixed inset-0 z-30 cursor-pointer" onClick={() => setMenu(false)} />
              <div className={`${pop} p-3`}>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">
                  Category
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {state.categories.map((cat) => {
                    const on = filter.categoryId === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() =>
                          actions.setColumnFilter(column.id, {
                            categoryId: on ? null : cat.id,
                            overdue: !!filter.overdue,
                          })
                        }
                        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                          on ? 'text-ink/85' : 'border-ink/10 text-ink/60 hover:bg-ink/5'
                        }`}
                        style={on ? { borderColor: cat.color, background: `${cat.color}1a` } : {}}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: cat.color }}
                        />
                        {cat.name}
                      </button>
                    );
                  })}
                </div>
                <label className="mt-3 flex items-center gap-2 text-sm text-ink/80">
                  <input
                    type="checkbox"
                    checked={!!filter.overdue}
                    onChange={(e) =>
                      actions.setColumnFilter(column.id, {
                        categoryId: filter.categoryId || null,
                        overdue: e.target.checked,
                      })
                    }
                    className="h-4 w-4 accent-[#7c3aed]"
                  />
                  Overdue only
                </label>
                {filterActive && (
                  <button
                    type="button"
                    onClick={() => {
                      actions.setColumnFilter(column.id, { categoryId: null, overdue: false });
                      setMenu(false);
                    }}
                    className="mt-3 w-full rounded-lg border border-ink/15 py-1.5 text-xs font-medium text-ink/60 hover:bg-ink/5"
                  >
                    Clear filter
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* Rest (⋯) */}
        <div className="relative shrink-0">
          <button
            type="button"
            title="Column menu"
            onClick={() => setMenu(menu === 'more' ? false : 'more')}
            className={iconBtn(menu === 'more')}
          >
            ⋯
          </button>
          {menu === 'more' && (
            <>
              <div className="fixed inset-0 z-30 cursor-pointer" onClick={() => setMenu(false)} />
              <div className={pop}>
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
                  onClick={async () => {
                    const ok = await copyText(
                      boardToText(state, { columnIds: [column.id] }),
                    );
                    setMenu(false);
                    if (ok) snack('Column copied as text');
                  }}
                  disabled={cards.length === 0}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5 disabled:opacity-30"
                >
                  Copy as text
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

      {/* Active-filter strip */}
      {filterActive && (
        <button
          type="button"
          onClick={() => actions.setColumnFilter(column.id, { categoryId: null, overdue: false })}
          className="mx-3 mb-1 flex items-center gap-1.5 self-start rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent"
          title="Clear filter"
        >
          {filterCat && (
            <span className="h-2 w-2 rounded-full" style={{ background: filterCat.color }} />
          )}
          {filterCat?.name}
          {filter.overdue ? `${filterCat ? ' · ' : ''}overdue` : ''} ×
        </button>
      )}

      {/* ── Cards (droppable; tapping empty space below the cards opens the
             quick-add, so capture never needs the exact button) ─────────── */}
      <Droppable droppableId={column.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            onPointerDown={(e) => {
              if (e.target === e.currentTarget) suppressReopen.current = adderOpen.current;
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget && !suppressReopen.current) {
                setAddSignal((s) => s + 1);
              }
              suppressReopen.current = false;
            }}
            className={`min-h-[40px] flex-1 cursor-pointer overflow-y-auto px-2 py-2 transition-colors ${
              snapshot.isDraggingOver ? 'rounded-xl bg-accent/[0.06]' : ''
            }`}
          >
            {cards.map((card, i) => (
              <Draggable key={card.id} draggableId={card.id} index={i}>
                {(prov, snap) => (
                  <TaskCard
                    provided={prov}
                    isDragging={snap.isDragging}
                    card={card}
                    number={numbers.get(card.id)}
                    index={i}
                    columnCount={cards.length}
                    columns={columns}
                  />
                )}
              </Draggable>
            ))}
            {provided.placeholder}
            {cards.length === 0 && (
              <p className="pointer-events-none px-2 py-3 text-center text-xs text-ink/30">
                {searching
                  ? 'No matches'
                  : filterActive
                    ? 'No tasks match the filter'
                    : 'No tasks yet — tap to add'}
              </p>
            )}
          </div>
        )}
      </Droppable>

      {/* ── Quick add (pinned) ────────────────────────────────────────── */}
      <div className="px-2 pb-2">
        <QuickAdd
          openSignal={addSignal}
          onOpenChange={(o) => {
            adderOpen.current = o;
          }}
          onAdd={(titles) => actions.addCards(column.id, titles)}
        />
      </div>
    </section>
  );
}
