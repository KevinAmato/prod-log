import { useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useStore } from '../../store/StoreContext.jsx';
import NodeHandles from './NodeHandles.jsx';

// A free text label/field on the canvas. Transparent by default; resizable; text
// colour customisable via the style panel.
export default function TextNode({ id, data, selected }) {
  const { actions } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text || '');

  const style = data.style || {};
  const color = style.text || '#1c1a17';

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) actions.updateElement(id, { text: draft });
  };

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={28}
        color="#b5562e"
        onResizeEnd={(_, p) =>
          actions.updateElement(id, { width: Math.round(p.width), height: Math.round(p.height) })
        }
      />
      {data.comment && (
        <span
          title={data.comment}
          className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-white px-1 text-[11px] shadow ring-1 ring-ink/10"
        >
          💬
        </span>
      )}
      <div
        className="h-full w-full rounded px-1 py-0.5"
        style={{ color, background: style.bg || 'transparent' }}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            autoFocus
            className="nodrag h-full w-full resize-none bg-transparent text-sm outline-none"
            style={{ color }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-snug">
            {data.text || 'Double-click to edit'}
          </p>
        )}
      </div>
      <NodeHandles />
    </div>
  );
}
