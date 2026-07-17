import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import CheckCircle from './CheckCircle.jsx';
import ReminderSheet from './ReminderSheet.jsx';
import { dueInfo } from '../lib/dates.js';
import { aiEnabled, shortenText, describeError } from '../lib/ai.js';

// One subtask line: n.m number, checkbox, text (+ due/reminder chips) and a
// ⋯ menu with the same due date + reminders + AI Shorten powers as the parent
// card, plus Remove. The n.m number is what the AI assistant references.
export default function SubtaskRow({ card, sub, number }) {
  const { actions } = useStore();
  const snack = useSnack();
  const [menu, setMenu] = useState(false);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [shortening, setShortening] = useState(false);

  const due = dueInfo(sub.dueDate);
  const pending = (sub.reminders || []).filter((r) => !r.fired).length;
  const canRestore = (sub.textHistory || []).length > 0;

  const doShorten = async () => {
    setMenu(false);
    setShortening(true);
    try {
      const short = await shortenText(sub.text);
      if (short === sub.text) {
        snack('Already about as short as it gets');
      } else {
        actions.setSubtaskTextWithHistory(card.id, sub.id, short);
        snack('Shortened', {
          label: 'Undo',
          onAction: () => actions.restoreSubtaskText(card.id, sub.id),
        });
      }
    } catch (err) {
      snack(describeError(err));
    } finally {
      setShortening(false);
    }
  };

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
        {number && (
          <span className="mr-1 font-mono text-[10px] text-ink/30">{number}</span>
        )}
        <span
          className={`break-words text-[13px] leading-snug ${
            sub.done ? 'text-ink/35 line-through' : 'text-ink/75'
          } ${shortening ? 'animate-pulse opacity-50' : ''}`}
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
              {aiEnabled() && (
                <button
                  type="button"
                  onClick={doShorten}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  <span className="text-accent">✦</span> Shorten
                </button>
              )}
              {canRestore && (
                <button
                  type="button"
                  onClick={() => {
                    setMenu(false);
                    actions.restoreSubtaskText(card.id, sub.id);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5"
                >
                  ↺ Restore previous text
                </button>
              )}
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
