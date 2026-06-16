import { useEffect, useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useStore } from '../../store/StoreContext.jsx';

const ACCENT = '#b5562e';
export const FRAME_DEFAULT = { width: 520, height: 360 };

// A labelled container (Now / Next / Later, swimlanes, etc). Frames sit BEHIND
// every other node and don't capture pointer events on their body, so the cards
// dropped inside them stay fully interactive. Only the title bar (the drag
// handle) and the resize controls are clickable. Membership is geometric — a
// node "belongs" to the frame whose bounds contain it — so there's no nesting in
// the data model. Presentation mode steps through frames by their order.
export default function FrameNode({ id, data, selected }) {
  const { actions } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.title || '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (data.title || '')) actions.updateElement(id, { title: draft.trim() });
  };

  const tint = data.style?.bg || ACCENT;

  return (
    // pointer-events-none: lets clicks fall through to the cards on top (and to
    // the pane for rubber-band selection on empty frame area).
    <div className="pointer-events-none h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={140}
        color={ACCENT}
        handleClassName="!pointer-events-auto"
        lineClassName="!pointer-events-auto"
      />
      <div
        className="flex h-full w-full flex-col overflow-hidden rounded-xl border-2 border-dashed"
        style={{ borderColor: tint, background: `${tint}0d` /* ~5% tint */ }}
      >
        {/* Title bar — the only draggable surface (see dragHandle in MappingView) */}
        <div
          className="frame-drag pointer-events-auto flex shrink-0 cursor-grab items-center gap-1.5 rounded-t-[10px] px-2.5 py-1.5 active:cursor-grabbing"
          style={{ background: `${tint}1f` }}
          onDoubleClick={() => {
            setDraft(data.title || '');
            setEditing(true);
          }}
        >
          {editing ? (
            <input
              ref={inputRef}
              autoFocus
              className="nodrag w-full bg-transparent text-sm font-semibold outline-none"
              style={{ color: tint }}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') setEditing(false);
              }}
            />
          ) : (
            <span
              className="select-none truncate text-sm font-semibold uppercase tracking-wide"
              style={{ color: tint }}
              title="Double-click to rename"
            >
              {data.title || 'Frame'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
