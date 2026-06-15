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

const ACCENT = '#b5562e';
const DEFAULTS = [200, 44];

// A free text label/field on the canvas. Transparent by default; resizable; text
// colour/size/styling customisable via the style panel.
export default function TextNode({ id, data, selected }) {
  const { actions } = useStore();
  const ref = useRef(null);
  const size = useNodeSize(ref);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data.text || '');

  const style = data.style || {};
  const color = style.text || 'rgb(var(--ink))';
  const refW = data.width || DEFAULTS[0];
  const refH = data.height || DEFAULTS[1];
  const font = scaledFont(style, refW, refH, size);
  const align = style.align || 'left';
  const valign = style.valign || 'top';
  const textStyle = { color, fontSize: font, textAlign: H_TEXT[align], ...textDecorations(style) };

  const commit = () => {
    setEditing(false);
    if (draft !== data.text) actions.updateElement(id, { text: draft });
  };

  return (
    <div ref={ref} className="group relative h-full w-full">
      <NodeResizer
        isVisible={selected}
        minWidth={80}
        minHeight={28}
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
        className="flex h-full w-full flex-col rounded px-1 py-0.5"
        style={{ background: style.bg || 'transparent', justifyContent: V_FLEX[valign] }}
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
          <p className="whitespace-pre-wrap leading-snug" style={textStyle}>
            {data.text || 'Double-click to edit'}
          </p>
        )}
      </div>
      <NodeHandles />
    </div>
  );
}
