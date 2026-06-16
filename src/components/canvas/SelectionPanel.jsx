import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../../store/StoreContext.jsx';
import { BG_COLORS, TEXT_COLORS, LINE_COLORS, FONT_FAMILIES } from '../../lib/canvasPalette.js';
import { DEFAULT_FONT } from '../../lib/canvasText.js';

const STYLE_TOGGLES = [
  ['bold', 'B', 'font-bold', 'Bold'],
  ['italic', 'I', 'italic', 'Italic'],
  ['underline', 'U', 'underline', 'Underline'],
  ['strike', 'S', 'line-through', 'Strikethrough'],
  ['code', '</>', 'font-mono', 'Code'],
];

const ARROWS = [
  ['none', '—', 'No arrow'],
  ['end', '→', 'Arrow at end'],
  ['start', '←', 'Invert (arrow at start)'],
  ['both', '↔', 'Double arrow'],
];

const Divider = () => <span className="h-6 w-px shrink-0 bg-ink/15" />;

// Renders the swatch popover in a portal so the toolbar's overflow clipping
// can't hide it; positioned just above the clicked circle.
function ColorCircle({ current, colors, onPick, title }) {
  const btnRef = useRef(null);
  const [pos, setPos] = useState(null);
  const open = () => {
    const r = btnRef.current.getBoundingClientRect();
    setPos({ x: r.left + r.width / 2, y: r.top - 8 });
  };
  return (
    <div className="shrink-0">
      <button
        ref={btnRef}
        title={title}
        onClick={() => (pos ? setPos(null) : open())}
        className="block h-6 w-6 rounded-full border border-black/20"
        style={{ background: current }}
      />
      {pos &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[60]" onClick={() => setPos(null)} />
            <div
              className="fixed z-[61] grid w-[188px] -translate-x-1/2 -translate-y-full grid-cols-8 gap-1.5 rounded-lg border border-ink/15 bg-paper p-2 shadow-xl"
              style={{ left: pos.x, top: pos.y }}
            >
              {colors.map((c) => (
                <button
                  key={c.value}
                  title={c.name}
                  onClick={() => {
                    onPick(c.value);
                    setPos(null);
                  }}
                  className="h-6 w-6 rounded-full border border-black/15"
                  style={{ background: c.value }}
                />
              ))}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

function HAlign({ dir }) {
  const widths = { left: [10, 6, 8], center: [8, 6, 10], right: [6, 10, 8] }[dir];
  return (
    <svg width="15" height="15" viewBox="0 0 15 15">
      {[3, 7, 11].map((y, i) => {
        const w = widths[i];
        const x = dir === 'left' ? 2 : dir === 'right' ? 13 - w : (15 - w) / 2;
        return <rect key={i} x={x} y={y - 0.8} width={w} height="1.6" rx="0.8" fill="currentColor" />;
      })}
    </svg>
  );
}

function VAlign({ dir }) {
  const ys = { top: [2.5, 5.5, 8.5], middle: [4, 7, 10], bottom: [5.5, 8.5, 11.5] }[dir];
  return (
    <svg width="15" height="15" viewBox="0 0 15 15">
      {ys.map((y, i) => (
        <rect key={i} x="3" y={y} width="9" height="1.6" rx="0.8" fill="currentColor" />
      ))}
    </svg>
  );
}

function LineIcon({ variant }) {
  const dash = variant === 'dashed' ? '4 3' : variant === 'dotted' ? '1.5 3' : undefined;
  return (
    <svg width="22" height="12" viewBox="0 0 22 12">
      <line
        x1="2"
        y1="6"
        x2="20"
        y2="6"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap={variant === 'dotted' ? 'round' : 'butt'}
      />
    </svg>
  );
}

// Two overlapping squares; the filled one shows which layer the action targets
// (front = top square solid, back = bottom square solid).
function ZIcon({ front }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15">
      <rect x="2" y="2" width="8" height="8" rx="1.5" fill={front ? 'none' : 'currentColor'} stroke="currentColor" strokeWidth="1.3" />
      <rect x="5" y="5" width="8" height="8" rx="1.5" fill={front ? 'currentColor' : 'rgb(var(--paper))'} stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

const Stepper = ({ value, onDec, onInc }) => (
  <div className="flex shrink-0 items-center rounded-md border border-ink/15">
    <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={onDec}>
      −
    </button>
    <span className="w-7 text-center text-sm tabular-nums">{value}</span>
    <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={onInc}>
      +
    </button>
  </div>
);

const seg = (active) =>
  `px-1.5 py-1 text-sm leading-none ${active ? 'bg-accent/10 text-accent' : 'text-ink/60 hover:bg-ink/5'}`;

export default function SelectionPanel({ nodeIds, edgeIds }) {
  const { state, actions } = useStore();
  if (nodeIds.length === 0 && edgeIds.length === 0) return null;

  const firstEl = state.map.elements.find((e) => nodeIds.includes(e.id));
  const st = firstEl?.style || {};
  const fontVal = Math.round(st.fontSize || DEFAULT_FONT);
  const singleEdge =
    edgeIds.length === 1 && nodeIds.length === 0
      ? state.map.edges.find((e) => e.id === edgeIds[0])
      : null;

  const setStyle = (patch) => nodeIds.forEach((id) => actions.updateElement(id, { style: patch }));
  const setFont = (px) => setStyle({ fontSize: Math.max(6, Math.min(200, px)) });
  const toggle = (key) => setStyle({ [key]: !st[key] });
  const del = () => {
    if (nodeIds.length) actions.removeElements(nodeIds);
    if (edgeIds.length) actions.removeMapEdges(edgeIds);
  };

  const setEdge = (patch) => singleEdge && actions.updateEdge(singleEdge.id, patch);
  const edgeWidth = singleEdge ? singleEdge.width || 1.5 : 1.5;

  return (
    <div className="absolute bottom-4 left-1/2 z-10 flex max-w-[calc(100vw-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-xl border border-ink/15 bg-paper/95 px-3 py-2 shadow-lg backdrop-blur">
      {nodeIds.length > 0 && (
        <>
          <ColorCircle
            title="Background"
            current={st.bg || '#ffffff'}
            colors={BG_COLORS}
            onPick={(bg) => setStyle({ bg })}
          />
          <ColorCircle
            title="Text colour"
            current={st.text || '#1c1a17'}
            colors={TEXT_COLORS}
            onPick={(text) => setStyle({ text })}
          />
          <select
            title="Font"
            value={st.fontFamily || ''}
            onChange={(e) => setStyle({ fontFamily: e.target.value })}
            className="shrink-0 rounded-md border border-ink/15 bg-surface px-1.5 py-1 text-sm"
          >
            {FONT_FAMILIES.map((f) => (
              <option key={f.name} value={f.value} style={{ fontFamily: f.value || undefined }}>
                {f.name}
              </option>
            ))}
          </select>
          <Divider />
          <Stepper value={fontVal} onDec={() => setFont(fontVal - 2)} onInc={() => setFont(fontVal + 2)} />
          <div className="flex shrink-0 gap-1">
            {STYLE_TOGGLES.map(([key, glyph, cls, title]) => (
              <button
                key={key}
                title={title}
                onClick={() => toggle(key)}
                className={`rounded border ${cls} ${
                  st[key] ? 'border-accent ' + seg(true) : 'border-ink/15 ' + seg(false)
                }`}
              >
                {glyph}
              </button>
            ))}
          </div>
          <Divider />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-ink/15">
            {['left', 'center', 'right'].map((dir) => (
              <button key={dir} title={`Align ${dir}`} onClick={() => setStyle({ align: dir })} className={seg(st.align === dir)}>
                <HAlign dir={dir} />
              </button>
            ))}
          </div>
          <div className="flex shrink-0 overflow-hidden rounded-md border border-ink/15">
            {['top', 'middle', 'bottom'].map((dir) => (
              <button key={dir} title={`Align ${dir}`} onClick={() => setStyle({ valign: dir })} className={seg(st.valign === dir)}>
                <VAlign dir={dir} />
              </button>
            ))}
          </div>
          <Divider />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-ink/15">
            <button title="Bring to front  ]" onClick={() => actions.bringToFront(nodeIds)} className={seg(false)}>
              <ZIcon front />
            </button>
            <button title="Send to back  [" onClick={() => actions.sendToBack(nodeIds)} className={seg(false)}>
              <ZIcon />
            </button>
          </div>
        </>
      )}

      {singleEdge && (
        <>
          <div className="flex shrink-0 gap-1">
            {ARROWS.map(([val, glyph, title]) => (
              <button
                key={val}
                title={title}
                onClick={() => setEdge({ arrow: val })}
                className={`rounded border ${
                  (singleEdge.arrow || 'end') === val ? 'border-accent ' + seg(true) : 'border-ink/15 ' + seg(false)
                }`}
              >
                {glyph}
              </button>
            ))}
          </div>
          <Divider />
          <div className="flex shrink-0 overflow-hidden rounded-md border border-ink/15">
            {['solid', 'dashed', 'dotted'].map((v) => (
              <button key={v} title={v} onClick={() => setEdge({ lineStyle: v })} className={seg((singleEdge.lineStyle || 'solid') === v)}>
                <LineIcon variant={v} />
              </button>
            ))}
          </div>
          <Stepper
            value={edgeWidth}
            onDec={() => setEdge({ width: Math.max(1, edgeWidth - 1) })}
            onInc={() => setEdge({ width: Math.min(12, edgeWidth + 1) })}
          />
          <ColorCircle
            title="Line colour"
            current={singleEdge.color || '#b5562e'}
            colors={LINE_COLORS}
            onPick={(color) => setEdge({ color })}
          />
        </>
      )}

      <Divider />
      <button onClick={del} className="shrink-0 px-1 text-sm font-medium text-accent hover:underline">
        Delete
      </button>
    </div>
  );
}
