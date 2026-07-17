import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';

// Color-code popover: tap a color to assign it to the card, ✎ to rename what
// each color means (names live in state.categories — one palette, board-wide).
export default function CategoryPicker({ card, onClose }) {
  const { state, actions } = useStore();
  const [editing, setEditing] = useState(false);

  const pick = (id) => {
    actions.updateCard(card.id, { categoryId: card.categoryId === id ? null : id });
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer" onClick={onClose} />
      <div className="absolute right-0 top-7 z-40 w-52 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
        {state.categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-2 px-3 py-1">
            <button
              type="button"
              title={cat.name}
              onClick={() => !editing && pick(cat.id)}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left"
            >
              <span
                className="h-4 w-4 shrink-0 rounded-full"
                style={{
                  background: cat.color,
                  outline: card.categoryId === cat.id ? `2px solid ${cat.color}` : 'none',
                  outlineOffset: 2,
                }}
              />
              {editing ? (
                <input
                  defaultValue={cat.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => actions.renameCategory(cat.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  className="min-w-0 flex-1 rounded border border-ink/20 bg-paper px-1.5 py-0.5 text-sm outline-none focus:border-accent"
                />
              ) : (
                <span
                  className={`truncate text-sm ${
                    card.categoryId === cat.id ? 'font-semibold' : 'text-ink/80'
                  }`}
                >
                  {cat.name}
                </span>
              )}
            </button>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-ink/10 px-3 py-1.5">
          <button
            type="button"
            onClick={() => pick(null)}
            className="text-sm text-ink/60 hover:text-ink"
          >
            None
          </button>
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={`rounded px-1.5 py-0.5 text-sm ${
              editing ? 'bg-accent/10 text-accent' : 'text-ink/60 hover:text-ink'
            }`}
          >
            {editing ? 'Done' : '✎ Edit names'}
          </button>
        </div>
      </div>
    </>
  );
}
