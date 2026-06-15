import { useRef } from 'react';
import { NodeResizer } from '@xyflow/react';
import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, decisionTotal } from '../config/gates.js';
import { diligenceTags } from '../lib/diligence.js';
import {
  useNodeSize,
  scaledFont,
  textDecorations,
  commitResize,
  H_TEXT,
  V_FLEX,
  H_FLEX,
} from '../lib/canvasText.js';
import NodeHandles from './canvas/NodeHandles.jsx';

const ACCENT = '#b5562e';
export const INITIATIVE_DEFAULT = { width: 224, height: 132 };

const tone = {
  neutral: 'bg-ink/5 text-ink/70',
  flag: 'bg-accent/10 text-accent',
  warn: 'bg-amber-500/15 text-amber-700',
  good: 'bg-emerald-600/10 text-emerald-700',
};

// A canvas card. Content is read live from the central store by id; only layout
// + presentation (position, size, colours, font, comment) come from the map.
// All text uses em units so a single root font-size scales the whole card.
export default function InitiativeNode({ id, data, selected }) {
  const { state, actions } = useStore();
  const ref = useRef(null);
  const size = useNodeSize(ref);
  const d = state.decisions.find((x) => x.id === data.decisionId);
  const style = data.style || {};
  const refW = data.width || INITIATIVE_DEFAULT.width;
  const refH = data.height || INITIATIVE_DEFAULT.height;
  const font = scaledFont(style, refW, refH, size);

  const resizer = (
    <NodeResizer
      isVisible={selected}
      minWidth={150}
      minHeight={84}
      color={ACCENT}
      onResizeEnd={(_, p) => commitResize(actions, id, p, data, refW, refH)}
    />
  );

  if (!d) {
    return (
      <div ref={ref} className="h-full w-full rounded-lg border border-dashed border-ink/20 bg-white px-3 py-2 text-xs text-ink/40">
        {resizer}
        (initiative deleted)
        <NodeHandles />
      </div>
    );
  }

  const total = decisionTotal(d);
  const gate = decisionGateAt(d, d.currentGateOrder);
  const done = d.currentGateOrder > total;
  const tags = diligenceTags(d);
  const hasCustomBg = !!style.bg;
  const align = style.align || 'left';
  const valign = style.valign || 'top';

  return (
    <div
      ref={ref}
      className={`group relative flex h-full w-full flex-col overflow-hidden rounded-lg border shadow-sm ${
        hasCustomBg ? 'border-black/10' : 'border-ink/15 bg-white'
      }`}
      style={{
        background: style.bg,
        color: style.text,
        fontSize: font,
        justifyContent: V_FLEX[valign],
        ...textDecorations(style),
      }}
    >
      {resizer}
      {data.comment && (
        <span
          title={data.comment}
          className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-white px-1 text-[11px] shadow ring-1 ring-ink/10"
        >
          💬
        </span>
      )}
      <div className="p-[0.85em]" style={{ textAlign: H_TEXT[align] }}>
        <p className="uppercase tracking-wide opacity-50" style={{ fontSize: '0.72em' }}>
          {d.type}
        </p>
        <h4 className="line-clamp-2 font-semibold leading-snug" style={{ fontSize: '1.05em' }}>
          {d.title}
        </h4>
        <p className="opacity-60" style={{ fontSize: '0.8em' }}>
          {done ? 'Funnel complete' : `Gate ${d.currentGateOrder}/${total} · ${gate?.name}`}
        </p>
        <div
          className="mt-[0.45em] flex flex-wrap gap-[0.3em]"
          style={{ justifyContent: H_FLEX[align] }}
        >
          {tags.length === 0 ? (
            <span className="opacity-50" style={{ fontSize: '0.72em' }}>
              in progress
            </span>
          ) : (
            tags.map((t) => (
              <span
                key={t.label}
                className={`rounded-full px-[0.5em] py-[0.15em] ${tone[t.tone]}`}
                style={{ fontSize: '0.72em' }}
              >
                {t.label}
              </span>
            ))
          )}
        </div>
      </div>
      <NodeHandles />
    </div>
  );
}
