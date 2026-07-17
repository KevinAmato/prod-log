import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { CATEGORY_PALETTE, MAX_CATEGORIES } from '../lib/storage.js';

// Color-code popover. Normal mode: tap a category to assign/clear it on the
// card. Edit mode (✎): rename inline, tap the dot to recolor (cycles the
// palette), × to delete, and "+ New category" to add one — the board-wide set
// is user-managed now, capped at MAX_CATEGORIES.
export default function CategoryPicker({ card, onClose }) {
  const { state, actions } = useStore();
  const [editing, setEditing] = useState(false);

  const pick = (id) => {
    actions.updateCard(card.id, { categoryId: card.categoryId === id ? null : id });
    onClose();
  };

  // Recolor without a nested swatch popover: tap the dot to advance to the
  // next palette color. Compact, and every color is reachable in a few taps.
  const cycleColor = (cat) => {
    const i = CATEGORY_PALETTE.indexOf(cat.color);
    actions.setCategoryColor(cat.id, CATEGORY_PALETTE[(i + 1) % CATEGORY_PALETTE.length]);
  };

  const atMax = state.categories.length >= MAX_CATEGORIES;

  return (
    <>
      <div className="fixed inset-0 z-30 cursor-pointer" onClick={onClose} />
      <div className="absolute right-0 top-7 z-40 w-60 overflow-hidden rounded-xl border border-ink/10 bg-surface py-1 shadow-xl">
        <div className="max-h-72 overflow-y-auto">
          {state.categories.map((cat) =>
            editing ? (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-1">
                <button
                  type="button"
                  title="Tap to change color"
                  onClick={() => cycleColor(cat)}
                  className="h-4 w-4 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ background: cat.color }}
                />
                <input
                  defaultValue={cat.name}
                  onBlur={(e) => actions.renameCategory(cat.id, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                  className="min-w-0 flex-1 rounded border border-ink/20 bg-paper px-1.5 py-0.5 text-sm outline-none focus:border-accent"
                />
                <button
                  type="button"
                  title={`Delete “${cat.name}”`}
                  onClick={() => actions.removeCategory(cat.id)}
                  className="shrink-0 rounded p-1 leading-none text-ink/40 hover:bg-accent/10 hover:text-accent"
                >
                  ×
                </button>
              </div>
            ) : (
              <div key={cat.id} className="flex items-center gap-2 px-3 py-1">
                <button
                  type="button"
                  title={cat.name}
                  onClick={() => pick(cat.id)}
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
                  <span
                    className={`truncate text-sm ${
                      card.categoryId === cat.id ? 'font-semibold' : 'text-ink/80'
                    }`}
                  >
                    {cat.name}
                  </span>
                </button>
              </div>
            ),
          )}

          {editing &&
            (atMax ? (
              <p className="px-3 py-1.5 text-[11px] text-ink/40">
                Maximum of {MAX_CATEGORIES} categories reached.
              </p>
            ) : (
              <button
                type="button"
                onClick={() => actions.addCategory('New category')}
                className="block w-full px-3 py-1.5 text-left text-sm font-medium text-accent hover:bg-accent/10"
              >
                + New category
              </button>
            ))}
        </div>

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
            {editing ? 'Done' : '✎ Edit'}
          </button>
        </div>
      </div>
    </>
  );
}
