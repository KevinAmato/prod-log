import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import CheckCircle from './CheckCircle.jsx';
import ReminderSheet from './ReminderSheet.jsx';
import { dueInfo } from '../lib/dates.js';

// One subtask line: checkbox, text (+ due/reminder chips) and a ⋯ menu with
// the same due date + reminders powers as the parent card, plus Remove.
export default function SubtaskRow({ card, sub }) {
  const { actions } = useStore();
  const [menu, setMenu] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);

  const due = dueInfo(sub.dueDate);
  const pending = (sub.reminders || []).filter((r) => !r.fired).length;

  return (
    <li className="flex items-start gap-2">
      <div className="pt-0.5">
        <CheckCircle
          checked={sub.done}
          size={18}
          onToggle={() => actions.toggleSubtask(card.id, sub.id)}
        />
      </div>

      <span className="min-w-0 flex-1 pt-1">
        <span
          className={`break-words text-[13px] leading-snug ${
            sub.done ? 'text-ink/35 line-through' : 'text-ink/75'
          }`}
        >
          {sub.text}
        </span>
        {(due || pending > 0) && (
          <span className="ml-1.5 inline-flex items-center gap-1.5 align-middle text-[10px] text-ink/45">
            {due && (
              <span className={`rounded-full px-1.5 py-px font-medium ${due.cls}`}>
                {due.label}
              </span>
            )}
            {pending > 0 && <span>🔔 {pending}</span>}
          </span>
        )}
      </span>

      <div className="relative shrink-0">
        <button
          type="button"
          title="Subtask menu"
          onClick={() => setMenu((v) => !v)}
          className="rounded-lg px-1.5 pt-0.5 leading-none text-ink/30 hover:bg-ink/5 hover:text-ink"
        >
          ⋯
        </button>
        {menu && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
            <div className="absolute right-0 top-6 z-40 w-56 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
              <div className="flex items-center gap-2 px-3 py-2">
                <span className="text-sm text-ink/80">Due</span>
                <input
                  type="date"
                  value={sub.dueDate || ''}
                  onChange={(e) =>
                    actions.updateSubtask(card.id, sub.id, { dueDate: e.target.value || null })
                  }
                  className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-paper px-2 py-1 text-sm outline-none focus:border-accent"
                />
                {sub.dueDate && (
                  <button
                    type="button"
                    title="Clear due date"
                    onClick={() => actions.updateSubtask(card.id, sub.id, { dueDate: null })}
                    className="text-ink/40 hover:text-accent"
                  >
                    ×
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  setRemindersOpen(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
              >
                Reminders{pending > 0 ? ` (${pending})` : '…'}
              </button>
              <div className="my-1 h-px bg-ink/10" />
              <button
                type="button"
                onClick={() => {
                  setMenu(false);
                  actions.removeSubtask(card.id, sub.id);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-accent hover:bg-accent/10"
              >
                Remove
              </button>
            </div>
          </>
        )}
      </div>

      {remindersOpen && (
        <ReminderSheet
          title={`${sub.text} — ${card.title}`}
          reminders={sub.reminders || []}
          onSave={(reminders) => actions.updateSubtask(card.id, sub.id, { reminders })}
          onClose={() => setRemindersOpen(false)}
        />
      )}
    </li>
  );
}
