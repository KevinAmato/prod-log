import { useState } from 'react';
import { useStore } from '../../store/StoreContext.jsx';
import NodeHandles from './NodeHandles.jsx';

const DIAMOND = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';

export default function ShapeNode({ id, data }) {
  const { actions } = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text || '');

  const shape = data.shape || 'rectangle';
  const style = data.style || {};
  const bg = style.bg || '#ffffff';
  const color = style.text || '#1c1a17';
  const w = data.width || 168;
  const h = data.height || 96;

  const shapeStyle = {
    width: w,
    height: h,
    background: bg,
    color,
    ...(shape === 'ellipse' ? { borderRadius: '9999px' } : {}),
    ...(shape === 'diamond' ? { clipPath: DIAMOND } : { borderRadius: 10 }),
  };

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) actions.updateElement(id, { text: draft });
  };

  return (
    <div className="group relative" style={{ width: w, height: h }}>
      {data.comment && (
        <span
          title={data.comment}
          className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-white px-1 text-[11px] shadow ring-1 ring-ink/10"
        >
          💬
        </span>
      )}
      <div
        className="flex h-full w-full items-center justify-center border border-black/10 p-2 text-center shadow-sm"
        style={shapeStyle}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            autoFocus
            className="nodrag h-full w-full resize-none bg-transparent text-center text-sm outline-none"
            style={{ color }}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
          />
        ) : (
          <span className="text-sm leading-snug">{data.text || 'Double-click to edit'}</span>
        )}
      </div>
      <NodeHandles />
    </div>
  );
}
