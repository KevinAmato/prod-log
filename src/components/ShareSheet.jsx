import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import { aiEnabled, describeError } from '../lib/ai.js';
import { runAssistant } from '../lib/assistant.js';

// Quick capture: what you get after sharing text into Pino from any other app
// (Android share sheet → Pino), or from the header's Quick capture entry.
//
// The shared text lands in an EDITABLE textarea rather than being imported
// blind — shared content is usually messier than what you'd type, so the
// review step is the feature. Three ways out, cheapest first:
//   • One per line  — no AI, instant, right when the source is already a list
//   • Single task   — the whole thing as one title
//   • ✦ Extract     — AI picks the action items out of prose (needs a key)
export default function ShareSheet({ initialText = '', onClose }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();
  const [text, setText] = useState(initialText);
  const [columnId, setColumnId] = useState(state.columns[0]?.id);
  const [busy, setBusy] = useState(false);

  const lines = useMemo(
    () =>
      text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean),
    [text],
  );
  const multiline = lines.length > 1;

  const addPerLine = () => {
    actions.addCards(columnId, lines);
    snack(`Added ${lines.length} task${lines.length === 1 ? '' : 's'}`, {
      label: 'Undo',
      onAction: undo,
    });
    onClose();
  };

  const addSingle = () => {
    const title = lines.join(' ').trim();
    if (!title) return;
    actions.addCards(columnId, [title]);
    snack('Task added', { label: 'Undo', onAction: undo });
    onClose();
  };

  const extract = async () => {
    setBusy(true);
    try {
      const colName = state.columns.find((c) => c.id === columnId)?.name;
      const { receipts } = await runAssistant({
        state,
        actions,
        undo,
        history: [
          {
            role: 'user',
            content: `Add these to the "${colName}" column as tasks:\n\n${text}`,
          },
        ],
      });
      const added = receipts.filter((r) => r.text.startsWith('✓')).length;
      snack(added ? `Added ${added} task${added === 1 ? '' : 's'}` : 'Nothing was added');
      onClose();
    } catch (err) {
      snack(describeError(err));
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 cursor-pointer bg-black/40" onClick={onClose} />
      <div
        className="relative flex max-h-[85dvh] w-full max-w-md flex-col rounded-t-2xl border border-ink/10 bg-paper p-4 shadow-2xl sm:rounded-2xl"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <h3 className="shrink-0 text-sm font-semibold">Quick capture</h3>
        <p className="mt-0.5 shrink-0 text-xs text-ink/55">
          Edit it down, then pick how it lands on the board.
        </p>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          autoFocus={!initialText}
          placeholder="Paste or type anything — notes, a list, a link…"
          className="mt-3 min-h-0 flex-1 resize-none rounded-xl border border-ink/15 bg-surface px-3 py-2 text-sm leading-snug outline-none placeholder:text-ink/35 focus:border-accent"
        />

        <label className="mt-3 flex shrink-0 items-center gap-2 text-xs font-medium text-ink/70">
          Add to
          <select
            value={columnId}
            onChange={(e) => setColumnId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-ink/15 bg-surface px-2 py-1.5 text-sm font-normal text-ink outline-none focus:border-accent"
          >
            {state.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 flex shrink-0 flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-medium text-ink/55 hover:bg-ink/5"
          >
            Cancel
          </button>
          {aiEnabled() && (
            <button
              type="button"
              onClick={extract}
              disabled={busy || !lines.length}
              className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/20 disabled:opacity-30"
            >
              {busy ? 'Extracting…' : '✦ Extract tasks'}
            </button>
          )}
          {multiline && (
            <button
              type="button"
              onClick={addPerLine}
              disabled={busy}
              className="rounded-lg bg-ink px-3 py-2 text-sm font-medium text-paper hover:bg-ink/90 disabled:opacity-30"
            >
              Add {lines.length} tasks
            </button>
          )}
          <button
            type="button"
            onClick={addSingle}
            disabled={busy || !lines.length}
            className={`rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-30 ${
              multiline
                ? 'border border-ink/15 text-ink/70 hover:bg-ink/5'
                : 'bg-ink text-paper hover:bg-ink/90'
            }`}
          >
            {multiline ? 'As one task' : 'Add task'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
