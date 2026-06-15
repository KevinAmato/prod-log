import { useRef, useState } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useStore } from '../../store/StoreContext.jsx';
import {
  useNodeSize,
  scaledFont,
  textDecorations,
  commitResize,
  H_TEXT,
  V_FLEX,
} from '../../lib/canvasText.js';
import NodeHandles from './NodeHandles.jsx';

const DIAMOND = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
const ACCENT = '#b5562e';
const DEFAULTS = { rectangle: [168, 96], ellipse: [120, 120], diamond: [140, 100] };

export default function ShapeNode({ id, data, selected }) {
  const { actions } = useStore();
  const ref = useRef(null);
  const size = useNodeSize(ref);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text || '');

  const shape = data.shape || 'rectangle';
  const style = data.style || {};
  const bg = style.bg || 'rgb(var(--surface))';
  const color = style.text || 'rgb(var(--ink))';
  const [dw, dh] = DEFAULTS[shape] || DEFAULTS.rectangle;
  const refW = data.width || dw;
  const refH = data.height || dh;
  const font = scaledFont(style, refW, refH, size);

  const align = style.align || 'center';
  const valign = style.valign || 'middle';
  const shapeStyle = {
    background: bg,
    color,
    borderRadius: shape === 'ellipse' ? '50%' : shape === 'diamond' ? 0 : 10,
    alignItems: V_FLEX[valign],
    ...(shape === 'diamond' ? { clipPath: DIAMOND } : {}),
  };
  const textStyle = {
    color,
    fontSize: font,
    width: '100%',
    textAlign: H_TEXT[align],
    ...textDecorations(style),
  };

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) actions.updateElement(id, { text: draft });
  };

  return (
    <div ref={ref} className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={56}
        minHeight={40}
        color={ACCENT}
        onResizeEnd={(_, p) => commitResize(actions, id, p, data, refW, refH)}
      />
      {data.comment && (
        <span
          title={data.comment}
          className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-surface px-1 text-[11px] shadow ring-1 ring-ink/10"
        >
          💬
        </span>
      )}
      <div
        className="flex h-full w-full border border-black/10 p-2 shadow-sm"
        style={shapeStyle}
        onDoubleClick={() => setEditing(true)}
      >
        {editing ? (
          <textarea
            autoFocus
            className="nodrag h-full w-full resize-none bg-transparent outline-none"
            style={textStyle}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
          />
        ) : (
          <span className="leading-snug" style={textStyle}>
            {data.text || 'Double-click to edit'}
          </span>
        )}
      </div>
      <NodeHandles />
    </div>
  );
}
