import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import CheckCircle from './CheckCircle.jsx';
import { Pill } from './ui.jsx';

// The Done and Deleted boards. Done: unchecking a card restores it to the live
// board. Deleted: restore, or delete forever (behind a confirm).
export default function ArchiveList({ mode }) {
  const { state, actions, undo } = useStore();
  const snack = useSnack();

  const stamp = mode === 'done' ? 'doneAt' : 'deletedAt';
  const cards = state.cards
    .filter((c) => c.status === mode)
    .sort((a, b) => (b[stamp] || '').localeCompare(a[stamp] || ''));

  const colName = (id) => state.columns.find((c) => c.id === id)?.name;

  const restore = (card) => {
    actions.restoreCard(card.id);
    snack('Restored to board', { label: 'Undo', onAction: undo });
  };

  const destroy = (card) => {
    if (window.confirm(`Delete “${card.title}” forever? This can't be recovered later.`)) {
      actions.destroyCard(card.id);
      snack('Deleted forever', { label: 'Undo', onAction: undo });
    }
  };

  if (cards.length === 0) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-ink/40">
        {mode === 'done'
          ? 'Nothing done yet — completed tasks land here.'
          : 'Nothing deleted. Deleted tasks land here and can be restored.'}
      </div>
    );
  }

  return (
    <div className="mx-auto h-full max-w-xl space-y-2 overflow-y-auto px-3 py-3">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex items-start gap-2 rounded-xl border border-ink/10 bg-surface px-3 py-2.5 shadow-sm"
        >
          {mode === 'done' ? (
            <div className="pt-0.5">
              <CheckCircle checked onToggle={() => restore(card)} title="Un-complete (restore)" />
            </div>
          ) : null}

          <div className="min-w-0 flex-1">
            <p
              className={`break-words text-sm font-medium leading-snug ${
                mode === 'done' ? 'text-ink/60 line-through' : ''
              }`}
            >
              {card.title}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink/45">
              {colName(card.columnId) && <Pill>{colName(card.columnId)}</Pill>}
              {card.subtasks.length > 0 && (
                <span>
                  {card.subtasks.filter((t) => t.done).length}/{card.subtasks.length} subtasks
                </span>
              )}
              {card[stamp] && <span>{new Date(card[stamp]).toLocaleDateString()}</span>}
            </div>
          </div>

          {mode === 'deleted' && (
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => restore(card)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/5"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => destroy(card)}
                className="rounded-lg px-2 py-1.5 text-xs font-medium text-accent hover:bg-accent/10"
              >
                Delete forever
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
