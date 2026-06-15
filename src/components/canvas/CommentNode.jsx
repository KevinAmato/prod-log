import { useState } from 'react';
import { useStore } from '../../store/StoreContext.jsx';

// A free-floating comment pin. New/empty comments mount expanded (editing);
// saving collapses to a "C" circle. Blur-while-empty or the close button deletes
// it. Drag the collapsed circle to reposition.
export default function CommentNode({ id, data }) {
  const { actions } = useStore();
  const [expanded, setExpanded] = useState(() => !data.text);
  const [draft, setDraft] = useState(data.text || '');

  const onBlur = () => {
    const v = draft.trim();
    if (!v) {
      actions.removeElements([id]); // clicking out of an empty comment deletes it
      return;
    }
    actions.updateElement(id, { text: v });
    setExpanded(false);
  };

  const del = (e) => {
    e.preventDefault(); // fire before textarea blur so "close == delete" always wins
    actions.removeElements([id]);
  };

  if (!expanded) {
    return (
      <button
        onClick={() => {
          setDraft(data.text || '');
          setExpanded(true);
        }}
        title={data.text}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-white shadow ring-2 ring-white"
      >
        C
      </button>
    );
  }

  return (
    <div className="nodrag w-56 rounded-lg border border-ink/15 bg-white p-2 shadow-xl">
      <div className="mb-1 flex items-center justify-between">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
          C
        </span>
        <button
          onMouseDown={del}
          title="Close (delete) comment"
          className="px-1 text-base leading-none text-ink/40 hover:text-accent"
        >
          ×
        </button>
      </div>
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={onBlur}
        placeholder="Add a comment…"
        className="nodrag h-20 w-full resize-none rounded border border-ink/15 p-1.5 text-sm outline-none focus:border-accent"
      />
    </div>
  );
}
