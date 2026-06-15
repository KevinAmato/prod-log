import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { DECISION_TYPES } from '../config/gates.js';
import { Button, Field, inputClass } from './ui.jsx';

export default function NewDecisionModal({ onClose, onCreated }) {
  const { state, actions } = useStore();
  const lines = state.profile.productLines || [];
  const [title, setTitle] = useState('');
  const [type, setType] = useState(DECISION_TYPES[0]);
  // Multi-select: a Set of chosen line names. "All" toggles every line.
  const [selected, setSelected] = useState(() => new Set());

  const allChecked = lines.length > 0 && selected.size === lines.length;

  const toggleAll = () => {
    setSelected(allChecked ? new Set() : new Set(lines));
  };
  const toggleLine = (line) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(line) ? next.delete(line) : next.add(line);
      return next;
    });
  };

  const submit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    // Preserve the profile's order rather than Set insertion order.
    const productLines = lines.filter((l) => selected.has(l));
    const id = actions.createDecision({ title, type, productLines });
    onCreated(id);
  };

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <form
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 className="text-lg font-semibold">New decision</h2>
        <p className="mt-1 text-sm text-ink/60">
          It enters the funnel at Gate 1 — Problem framing.
        </p>

        <div className="mt-5 space-y-4">
          <Field label="Title">
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Add bulk CSV export to the admin dashboard"
              autoFocus
            />
          </Field>
          <Field label="Type">
            <select
              className={inputClass}
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {DECISION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>

          {lines.length > 0 && (
            <Field label="Affected product lines" hint="Select one or more.">
              <div className="rounded-md border border-ink/20 bg-surface">
                <label className="flex cursor-pointer items-center gap-2 border-b border-ink/10 px-3 py-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={toggleAll}
                    className="accent-accent"
                  />
                  All product lines
                </label>
                <div className="max-h-44 overflow-y-auto">
                  {lines.map((l) => (
                    <label
                      key={l}
                      className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-ink/[0.03]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(l)}
                        onChange={() => toggleLine(l)}
                        className="accent-accent"
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </Field>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </div>
  );
}
