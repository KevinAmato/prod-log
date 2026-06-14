import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  useReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store/StoreContext.jsx';
import InitiativeNode from './InitiativeNode.jsx';

const nodeTypes = { initiative: InitiativeNode };
const DRAG_MIME = 'application/diligence-initiative';

// Directional, on-brand connectors so edges read as dependencies / roadmap paths.
const ACCENT = '#b5562e';
const defaultEdgeOptions = {
  markerEnd: { type: MarkerType.ArrowClosed, color: ACCENT, width: 18, height: 18 },
  style: { stroke: ACCENT, strokeWidth: 1.5 },
};

function Canvas({ onOpenDecision }) {
  const { state, actions } = useStore();
  const { screenToFlowPosition } = useReactFlow();
  // Open by default on desktop; collapsed on phones so the canvas is visible.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640,
  );

  // Seed React Flow from the persisted map LAYOUT (positions + edges). Card
  // content is read live by InitiativeNode, so only layout lives here. Seeded
  // once on mount; persistence flows back to the store on drag/connect/delete.
  const initialNodes = useMemo(
    () =>
      Object.entries(state.map.nodes)
        .filter(([id]) => state.decisions.some((d) => d.id === id))
        .map(([id, pos]) => ({ id, type: 'initiative', position: pos, data: { decisionId: id } })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialEdges = useMemo(
    () => state.map.edges.map((e) => ({ ...e })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeDragStop = useCallback(
    (_, node) => actions.moveMapNode(node.id, node.position),
    [actions],
  );

  const onConnect = useCallback(
    (params) => {
      const id = `e-${params.source}-${params.target}`;
      setEdges((eds) => addEdge({ ...params, id }, eds));
      actions.addMapEdge({ source: params.source, target: params.target });
    },
    [actions, setEdges],
  );

  const onNodesDelete = useCallback(
    (deleted) => actions.removeMapNodes(deleted.map((n) => n.id)),
    [actions],
  );
  const onEdgesDelete = useCallback(
    (deleted) => actions.removeMapEdges(deleted.map((e) => e.id)),
    [actions],
  );

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const id = e.dataTransfer.getData(DRAG_MIME);
      if (!id) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      actions.placeOnMap(id, position);
      setNodes((nds) =>
        nds.some((n) => n.id === id)
          ? nds
          : nds.concat({ id, type: 'initiative', position, data: { decisionId: id } }),
      );
    },
    [screenToFlowPosition, actions, setNodes],
  );

  // Drop orphaned canvas nodes whose decision was deleted elsewhere.
  useEffect(() => {
    const valid = new Set(state.decisions.map((d) => d.id));
    setNodes((nds) => {
      const filtered = nds.filter((n) => valid.has(n.id));
      return filtered.length === nds.length ? nds : filtered;
    });
  }, [state.decisions, setNodes]);

  const placedIds = new Set(nodes.map((n) => n.id));
  const unplaced = state.decisions.filter((d) => !placedIds.has(d.id));

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDoubleClick={(_, n) => onOpenDecision?.(n.id)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="#cbc6ba" />
        <Controls showInteractive={false} />
        <MiniMap className="hidden md:block" pannable zoomable />
      </ReactFlow>

      {/* Empty-canvas hint */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center text-sm text-ink/40">
            Drag initiatives from the panel onto the canvas. Drag from a card's right edge to
            connect it to another.
          </p>
        </div>
      )}

      {/* Unplaced-initiatives drawer */}
      <button
        onClick={() => setSidebarOpen((o) => !o)}
        className="absolute left-3 top-3 z-10 rounded-md border border-ink/15 bg-paper/95 px-3 py-1.5 text-sm font-medium shadow-sm backdrop-blur"
      >
        {sidebarOpen ? 'Hide' : 'Initiatives'} ({unplaced.length})
      </button>

      {sidebarOpen && (
        <aside className="absolute bottom-3 left-3 top-14 z-10 flex w-64 max-w-[80vw] flex-col rounded-lg border border-ink/10 bg-paper/95 shadow-lg backdrop-blur">
          <p className="border-b border-ink/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink/50">
            Unplaced initiatives
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {state.decisions.length === 0 ? (
              <p className="p-2 text-xs text-ink/45">
                No decisions yet. Create them in the Backlog first.
              </p>
            ) : unplaced.length === 0 ? (
              <p className="p-2 text-xs text-ink/45">All initiatives are on the map.</p>
            ) : (
              unplaced.map((d) => (
                <div
                  key={d.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(DRAG_MIME, d.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="mb-2 cursor-grab rounded-md border border-ink/10 bg-white p-2 shadow-sm active:cursor-grabbing"
                >
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{d.title}</p>
                  <p className="mt-0.5 text-[11px] text-ink/50">{d.type}</p>
                </div>
              ))
            )}
          </div>
        </aside>
      )}
    </div>
  );
}

// React Flow hooks need the provider; keep it thin so <Canvas/> remounts (and
// re-seeds from the store) whenever the Mapping tab is opened.
export default function MappingView({ onOpenDecision }) {
  return (
    <ReactFlowProvider>
      <Canvas onOpenDecision={onOpenDecision} />
    </ReactFlowProvider>
  );
}
