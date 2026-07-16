import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import CheckCircle from './CheckCircle.jsx';
import QuickAdd from './QuickAdd.jsx';

// One task. Collapsed: checkbox + title (+ subtask progress). Subtasks are
// always visible with their own checkboxes; tapping the body expands to reveal
// the note, the subtask adder and move controls.
export default function TaskCard({ card, index, columnCount, columns, onDropCard }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [shake, setShake] = useState(false);
  const renameRef = useRef(null);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const openSubs = card.subtasks.filter((t) => !t.done).length;
  const hideDone = state.prefs.hideDoneSubtasks;
  const visibleSubs = hideDone ? card.subtasks.filter((t) => !t.done) : card.subtasks;

  const tryDone = () => {
    if (openSubs > 0) {
      setShake(true);
      setTimeout(() => setShake(false), 450);
      snack(`${openSubs} subtask${openSubs === 1 ? '' : 's'} still open`);
      return;
    }
    actions.markDone(card.id);
    snack('Task done', { label: 'Undo', onAction: undo });
  };

  const del = () => {
    setMenu(false);
    actions.deleteCard(card.id);
    snack('Task deleted', { label: 'Undo', onAction: undo });
  };

  const commitRename = (e) => {
    const v = e.target.value.trim();
    if (v) actions.updateCard(card.id, { title: v });
    setRenaming(false);
  };

  return (
    <div
      draggable={!renaming}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/card-id', card.id);
        e.dataTransfer.effectAllowed = 'move';
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const dragId = e.dataTransfer.getData('text/card-id');
        if (dragId && dragId !== card.id) onDropCard(dragId, index);
      }}
      className={`rounded-xl border border-ink/10 bg-surface shadow-sm transition-shadow ${
        shake ? 'animate-[cardshake_0.4s_ease]' : ''
      }`}
    >
      {/* ── Main row ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div className="pt-0.5">
          <CheckCircle checked={false} onToggle={tryDone} title="Mark done" />
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-w-0 flex-1 text-left"
        >
          {renaming ? (
            <input
              ref={renameRef}
              defaultValue={card.title}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename(e);
                if (e.key === 'Escape') setRenaming(false);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full rounded border border-accent/50 bg-surface px-1.5 py-0.5 text-sm outline-none"
            />
          ) : (
            <span className="break-words text-sm font-medium leading-snug">{card.title}</span>
          )}
          <span className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink/45">
            {card.subtasks.length > 0 && (
              <span className={openSubs === 0 ? 'text-emerald-600' : ''}>
                {card.subtasks.length - openSubs}/{card.subtasks.length} subtasks
              </span>
            )}
            {card.note && !expanded && <span>note</span>}
          </span>
        </button>

        {/* + subtask — the spec's "+ sign inside the card" */}
        <button
          type="button"
          title="Add subtask"
          onClick={() => {
            setExpanded(true);
            setAddingSub(true);
          }}
          className="-m-1 shrink-0 rounded-lg p-1.5 text-lg leading-none text-ink/40 hover:bg-ink/5 hover:text-accent"
        >
          +
        </button>

        {/* ⋯ menu: move / rename / delete */}
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
              <div className="absolute right-0 top-7 z-40 w-44 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                <MenuItem
                  onClick={() => {
                    setMenu(false);
                    setRenaming(true);
                  }}
                >
                  Rename
                </MenuItem>
                <MenuItem
                  disabled={index === 0}
                  onClick={() => {
                    setMenu(false);
                    actions.moveCard(card.id, card.columnId, index - 1);
                  }}
                >
                  Move up
                </MenuItem>
                <MenuItem
                  disabled={index >= columnCount - 1}
                  onClick={() => {
                    setMenu(false);
                    actions.moveCard(card.id, card.columnId, index + 1);
                  }}
                >
                  Move down
                </MenuItem>
                {columns
                  .filter((c) => c.id !== card.columnId)
                  .map((c) => (
                    <MenuItem
                      key={c.id}
                      onClick={() => {
                        setMenu(false);
                        actions.moveCard(card.id, c.id, Infinity);
                      }}
                    >
                      Move to “{c.name}”
                    </MenuItem>
                  ))}
                <div className="my-1 h-px bg-ink/10" />
                <MenuItem danger onClick={del}>
                  Delete
                </MenuItem>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Subtasks (always visible) ─────────────────────────────────── */}
      {visibleSubs.length > 0 && (
        <ul className="space-y-0.5 px-3 pb-2 pl-[42px]">
          {visibleSubs.map((t) => (
            <li key={t.id} className="group flex items-start gap-2">
              <div className="pt-0.5">
                <CheckCircle
                  checked={t.done}
                  size={18}
                  onToggle={() => actions.toggleSubtask(card.id, t.id)}
                />
              </div>
              <span
                className={`min-w-0 flex-1 break-words pt-1 text-[13px] leading-snug ${
                  t.done ? 'text-ink/35 line-through' : 'text-ink/75'
                }`}
              >
                {t.text}
              </span>
              <button
                type="button"
                title="Remove subtask"
                onClick={() => actions.removeSubtask(card.id, t.id)}
                className="pt-1 text-ink/25 opacity-100 hover:text-accent sm:opacity-0 sm:group-hover:opacity-100"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* ── Expanded: note + subtask adder ────────────────────────────── */}
      {(expanded || addingSub) && (
        <div className="space-y-2 border-t border-ink/5 px-3 py-2 pl-[42px]">
          <QuickAdd
            compact
            autoOpen={addingSub}
            onClose={() => setAddingSub(false)}
            addLabel="+ Add subtasks"
            placeholder="Subtask"
            onAdd={(texts) => actions.addSubtasks(card.id, texts)}
          />
          <textarea
            defaultValue={card.note}
            placeholder="Add a note…"
            rows={2}
            onBlur={(e) => {
              if (e.target.value !== card.note) actions.updateCard(card.id, { note: e.target.value });
            }}
            className="w-full resize-none rounded-lg border border-ink/10 bg-paper/60 px-2 py-1.5 text-[13px] outline-none placeholder:text-ink/30 focus:border-accent/50"
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({ children, onClick, disabled, danger }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`block w-full px-3 py-2 text-left text-sm disabled:opacity-30 ${
        danger ? 'text-accent hover:bg-accent/10' : 'text-ink/80 hover:bg-ink/5'
      }`}
    >
      {children}
    </button>
  );
}
