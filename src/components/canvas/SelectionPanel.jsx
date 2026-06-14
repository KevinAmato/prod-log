import { useStore } from '../../store/StoreContext.jsx';
import { BG_COLORS, TEXT_COLORS } from '../../lib/canvasPalette.js';

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

  const setBg = (bg) => nodeIds.forEach((id) => actions.updateElement(id, { style: { bg } }));
  const setText = (text) => nodeIds.forEach((id) => actions.updateElement(id, { style: { text } }));
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
