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

// Contextual editor for the current selection: colours + comment + delete.
// Shown whenever one or more canvas elements (or an edge) are selected.
export default function SelectionPanel({ nodeIds, edgeIds }) {
  const { state, actions } = useStore();
  if (nodeIds.length === 0 && edgeIds.length === 0) return null;

  const singleNode =
    nodeIds.length === 1 && edgeIds.length === 0
      ? state.map.elements.find((e) => e.id === nodeIds[0])
      : null;
  const singleEdge =
    edgeIds.length === 1 && nodeIds.length === 0
      ? state.map.edges.find((e) => e.id === edgeIds[0])
      : null;

  const firstEl = state.map.elements.find((e) => nodeIds.includes(e.id));
  const st = firstEl?.style || {};
  const fontVal = Math.round(st.fontSize || DEFAULT_FONT);

  const setBg = (bg) => nodeIds.forEach((id) => actions.updateElement(id, { style: { bg } }));
  const setText = (text) => nodeIds.forEach((id) => actions.updateElement(id, { style: { text } }));
  const setFont = (px) =>
    nodeIds.forEach((id) => actions.updateElement(id, { style: { fontSize: Math.max(6, Math.min(200, px)) } }));
  const toggle = (key) => {
    const next = !st[key];
    nodeIds.forEach((id) => actions.updateElement(id, { style: { [key]: next } }));
  };
  const del = () => {
    if (nodeIds.length) actions.removeElements(nodeIds);
    if (edgeIds.length) actions.removeMapEdges(edgeIds);
  };

  const Swatch = ({ value, onClick }) => (
    <button
      onClick={onClick}
      title={value}
      className="h-5 w-5 rounded-full border border-black/15"
      style={{ background: value }}
    />
  );

  return (
    <div className="absolute right-3 top-3 z-10 w-56 rounded-lg border border-ink/15 bg-paper/95 p-3 text-sm shadow-lg backdrop-blur">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">
          {edgeIds.length && !nodeIds.length
            ? 'Connector'
            : nodeIds.length > 1
            ? `${nodeIds.length} selected`
            : 'Element'}
        </p>
        <button onClick={del} className="text-xs font-medium text-accent hover:underline">
          Delete
        </button>
      </div>

      {nodeIds.length > 0 && (
        <>
          <p className="mt-3 text-xs text-ink/55">Background</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {BG_COLORS.map((c) => (
              <Swatch key={c.value} value={c.value} onClick={() => setBg(c.value)} />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink/55">Text</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {TEXT_COLORS.map((c) => (
              <Swatch key={c.value} value={c.value} onClick={() => setText(c.value)} />
            ))}
          </div>

          <p className="mt-3 text-xs text-ink/55">Font</p>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center rounded-md border border-ink/15">
              <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={() => setFont(fontVal - 2)}>
                −
              </button>
              <span className="w-8 text-center text-sm tabular-nums">{fontVal}</span>
              <button className="px-2 py-1 text-ink/60 hover:bg-ink/5" onClick={() => setFont(fontVal + 2)}>
                +
              </button>
            </div>
          </div>
          <div className="mt-1.5 flex gap-1">
            {STYLE_TOGGLES.map(([key, glyph, cls, title]) => (
              <button
                key={key}
                title={title}
                onClick={() => toggle(key)}
                className={`flex-1 rounded border px-1 py-1 text-sm ${cls} ${
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
        <>
          <p className="mt-3 text-xs text-ink/55">Arrow</p>
          <div className="mt-1 flex gap-1">
            {[
              ['none', '—', 'No arrow'],
              ['end', '→', 'Arrow at end'],
              ['start', '←', 'Invert (arrow at start)'],
              ['both', '↔', 'Double arrow'],
            ].map(([val, glyph, title]) => {
              const active = (singleEdge.arrow || 'end') === val;
              return (
                <button
                  key={val}
                  title={title}
                  onClick={() => actions.updateEdge(singleEdge.id, { arrow: val })}
                  className={`flex-1 rounded border px-2 py-1 text-sm ${
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
        </>
      )}

      {(singleNode || singleEdge) && (
        <>
          <p className="mt-3 text-xs text-ink/55">Comment</p>
          <textarea
            className="mt-1 min-h-[56px] w-full resize-y rounded-md border border-ink/20 bg-white px-2 py-1.5 text-sm outline-none focus:border-accent"
            placeholder="Add a note…"
            value={(singleNode ? singleNode.comment : singleEdge.comment) || ''}
            onChange={(e) =>
              singleNode
                ? actions.updateElement(singleNode.id, { comment: e.target.value })
                : actions.updateEdge(singleEdge.id, { comment: e.target.value })
            }
          />
        </>
      )}
    </div>
  );
}
