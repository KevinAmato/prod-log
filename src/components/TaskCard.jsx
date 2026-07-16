import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import CheckCircle from './CheckCircle.jsx';
import QuickAdd from './QuickAdd.jsx';
import CategoryPicker from './CategoryPicker.jsx';
import ReminderSheet from './ReminderSheet.jsx';
import useTouchDrag from '../lib/useTouchDrag.js';

// One task. Collapsed: checkbox + title (+ progress/due/reminder chips) with a
// category color stripe. Subtasks are always visible with their own checkboxes;
// tapping the body expands to reveal the note, subtask adder and menu extras.
// Drag: HTML5 dnd on desktop, long-press (via useTouchDrag) on touch.
export default function TaskCard({ card, index, columnCount, columns, onDropCard }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();
  const rootRef = useRef(null);
  const [expanded, setExpanded] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [menu, setMenu] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [shake, setShake] = useState(false);
  const renameRef = useRef(null);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  useTouchDrag(rootRef, {
    cardId: card.id,
    title: card.title,
    index,
    colId: card.columnId,
    onDrop: (colId, slot) => actions.moveCard(card.id, colId, slot),
  });

  const openSubs = card.subtasks.filter((t) => !t.done).length;
  const hideDone = state.prefs.hideDoneSubtasks;
  const visibleSubs = hideDone ? card.subtasks.filter((t) => !t.done) : card.subtasks;
  const category = state.categories.find((c) => c.id === card.categoryId);
  const pendingReminders = (card.reminders || []).filter((r) => !r.fired).length;

  // Due-date tone: overdue red, today amber, future neutral.
  const dueInfo = (() => {
    if (!card.dueDate) return null;
    const today = new Date();
    const stamp = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const label = new Date(`${card.dueDate}T12:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
    if (card.dueDate < stamp) return { label, cls: 'bg-red-500/15 text-red-600' };
    if (card.dueDate === stamp) return { label: 'Today', cls: 'bg-amber-500/20 text-amber-700' };
    return { label, cls: 'bg-ink/5 text-ink/50' };
  })();

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
      ref={rootRef}
      data-card-id={card.id}
      data-index={index}
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
      style={{
        borderLeft: `4px solid ${category ? category.color : 'transparent'}`,
      }}
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
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink/45">
            {card.subtasks.length > 0 && (
              <span className={openSubs === 0 ? 'text-emerald-600' : ''}>
                {card.subtasks.length - openSubs}/{card.subtasks.length} subtasks
              </span>
            )}
            {dueInfo && (
              <span className={`rounded-full px-1.5 py-px font-medium ${dueInfo.cls}`}>
                {dueInfo.label}
              </span>
            )}
            {pendingReminders > 0 && <span>🔔 {pendingReminders}</span>}
            {card.note && !expanded && <span>note</span>}
          </span>
        </button>

        {/* Color code */}
        <div className="relative shrink-0 pt-0.5">
          <button
            type="button"
            title={category ? `Color: ${category.name}` : 'Color code'}
            onClick={() => setCatOpen((v) => !v)}
            className="-m-1 rounded-lg p-1.5"
          >
            <span
              className={`block h-3.5 w-3.5 rounded-full ${
                category ? '' : 'border-2 border-dashed border-ink/30'
              }`}
              style={{ background: category?.color }}
            />
          </button>
          {catOpen && <CategoryPicker card={card} onClose={() => setCatOpen(false)} />}
        </div>

        {/* + subtask */}
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

        {/* ⋯ menu */}
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
              <div className="absolute right-0 top-7 z-40 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
                {/* Due date — native picker inline */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="text-sm text-ink/80">Due</span>
                  <input
                    type="date"
                    value={card.dueDate || ''}
                    onChange={(e) =>
                      actions.updateCard(card.id, { dueDate: e.target.value || null })
                    }
                    className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
                  />
                  {card.dueDate && (
                    <button
                      type="button"
                      title="Clear due date"
                      onClick={() => actions.updateCard(card.id, { dueDate: null })}
                      className="text-ink/40 hover:text-accent"
                    >
                      ×
                    </button>
                  )}
                </div>
                <MenuItem
                  onClick={() => {
                    setMenu(false);
                    setRemindersOpen(true);
                  }}
                >
                  Reminders{pendingReminders > 0 ? ` (${pendingReminders})` : '…'}
                </MenuItem>
                <div className="my-1 h-px bg-ink/10" />
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

      {remindersOpen && <ReminderSheet card={card} onClose={() => setRemindersOpen(false)} />}
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
