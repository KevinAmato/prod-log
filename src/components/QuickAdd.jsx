import { useEffect, useRef, useState } from 'react';

// The capture surface for tasks AND subtasks. Design goals, in order:
//   1. Nothing between the intent and the text field — one tap, autofocused.
//   2. Rapid entry: Enter commits and keeps the field open for the next item.
//   3. Lists for free: pasting multiline text creates one item per line.
// `onAdd` always receives an ARRAY of titles so bulk paste is a single commit
// (and a single undo).
export default function QuickAdd({
  onAdd,
  placeholder = 'Task title',
  addLabel = '+ Add task',
  autoOpen = false,
  openSignal = 0, // bump to open from outside (tap on empty column space)
  onClose,
  onOpenChange, // lets the parent know if a tap means "open" or "cancel"
  compact = false,
}) {
  const [open, setOpen] = useState(autoOpen);
  const [val, setVal] = useState('');
  const ref = useRef(null);
  const openChangeRef = useRef(onOpenChange);
  openChangeRef.current = onOpenChange;

  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);

  useEffect(() => {
    openChangeRef.current?.(open);
  }, [open]);

  useEffect(() => {
    if (openSignal) setOpen(true);
  }, [openSignal]);

  const commit = (text) => {
    const items = String(text)
      .split(/\r?\n/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (items.length) onAdd(items);
  };

  const close = () => {
    setOpen(false);
    setVal('');
    onClose?.();
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full items-center rounded-lg text-left font-medium text-ink/50 transition-colors hover:bg-ink/5 hover:text-ink/80 ${
          compact ? 'px-2 py-1.5 text-xs' : 'min-h-[42px] px-3 py-2 text-sm'
        }`}
      >
        {addLabel}
      </button>
    );
  }

  return (
    <div>
      <input
        ref={ref}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder={placeholder}
        enterKeyHint="done"
        className={`w-full rounded-lg border border-accent/50 bg-surface outline-none ring-1 ring-accent/30 placeholder:text-ink/35 ${
          compact ? 'px-2 py-1.5 text-sm' : 'px-3 py-2.5 text-base'
        }`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (val.trim()) {
              commit(val);
              setVal('');
            } else {
              close();
            }
          } else if (e.key === 'Escape') {
            close();
          }
        }}
        onPaste={(e) => {
          const text = e.clipboardData?.getData('text') || '';
          if (text.includes('\n')) {
            e.preventDefault();
            commit(val ? `${val}\n${text}` : text);
            setVal('');
          }
        }}
        onBlur={() => {
          // Commit whatever's typed, then fold away — no data lost on a stray tap.
          if (val.trim()) commit(val);
          close();
        }}
      />
      <p className={`mt-1 px-1 text-ink/40 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        Enter adds · paste a list for one per line
      </p>
    </div>
  );
}
