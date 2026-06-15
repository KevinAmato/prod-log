import { useState } from 'react';
import { useStore } from '../../store/StoreContext.jsx';
import { BG_COLORS, TEXT_COLORS } from '../../lib/canvasPalette.js';
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

// A single circle showing the current colour; click reveals a swatch row above
// it, click anywhere outside closes it.
function ColorCircle({ current, colors, onPick, title }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="block h-6 w-6 rounded-full border border-black/20"
        style={{ background: current }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute bottom-9 left-1/2 z-30 flex -translate-x-1/2 gap-1.5 rounded-lg border border-ink/15 bg-paper p-2 shadow-xl">
            {colors.map((c) => (
              <button
                key={c.value}
                title={c.name}
                onClick={() => {
                  onPick(c.value);
                  setOpen(false);
                }}
                className="h-6 w-6 rounded-full border border-black/15"
                style={{ background: c.value }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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

  const tBtn =
    'rounded border px-1.5 py-1 text-sm leading-none transition-colors';

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
          <Divider />
          <div className="flex shrink-0 items-center rounded-md border border-ink/15">
            <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={() => setFont(fontVal - 2)}>
              −
            </button>
            <span className="w-7 text-center text-sm tabular-nums">{fontVal}</span>
            <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={() => setFont(fontVal + 2)}>
              +
            </button>
          </div>
          <div className="flex shrink-0 gap-1">
            {STYLE_TOGGLES.map(([key, glyph, cls, title]) => (
              <button
                key={key}
                title={title}
                onClick={() => toggle(key)}
                className={`${tBtn} ${cls} ${
                  st[key]
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/15 text-ink/60 hover:bg-ink/5'
                }`}
              >
                {glyph}
              </button>
            ))}
          </div>
        </>
      )}

      {singleEdge && (
        <div className="flex shrink-0 gap-1">
          {ARROWS.map(([val, glyph, title]) => {
            const active = (singleEdge.arrow || 'end') === val;
            return (
              <button
                key={val}
                title={title}
                onClick={() => actions.updateEdge(singleEdge.id, { arrow: val })}
                className={`${tBtn} ${
                  active
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-ink/15 text-ink/60 hover:bg-ink/5'
                }`}
              >
                {glyph}
              </button>
            );
          })}
        </div>
      )}

      <Divider />
      <button onClick={del} className="shrink-0 px-1 text-sm font-medium text-accent hover:underline">
        Delete
      </button>
    </div>
  );
}
