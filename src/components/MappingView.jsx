import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  MarkerType,
  ConnectionMode,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useStore } from '../store/StoreContext.jsx';
import { newId } from '../lib/storage.js';
import InitiativeNode from './InitiativeNode.jsx';
import ShapeNode from './canvas/ShapeNode.jsx';
import TextNode from './canvas/TextNode.jsx';
import CommentNode from './canvas/CommentNode.jsx';
import FloatingEdge from './canvas/FloatingEdge.jsx';
import CanvasToolbar from './canvas/CanvasToolbar.jsx';
import SelectionPanel from './canvas/SelectionPanel.jsx';

const nodeTypes = {
  initiative: InitiativeNode,
  shape: ShapeNode,
  text: TextNode,
  comment: CommentNode,
};
const edgeTypes = { floating: FloatingEdge };
const ACCENT = '#b5562e';
const DRAG_MIME = 'application/diligence-initiative';

// Build the React Flow `data` payload for a stored element.
function nodeData(el) {
  if (el.type === 'initiative') {
    return {
      decisionId: el.decisionId,
      style: el.style,
      comment: el.comment,
      width: el.width,
      height: el.height,
    };
  }
  if (el.type === 'shape') {
    return {
      shape: el.shape,
      text: el.text,
      style: el.style,
      comment: el.comment,
      width: el.width,
      height: el.height,
    };
  }
  if (el.type === 'comment') {
    return { text: el.text };
  }
  return { text: el.text, style: el.style, comment: el.comment, width: el.width };
}

function Canvas({ onOpenDecision }) {
  const { state, actions, theme } = useStore();
  const { screenToFlowPosition } = useReactFlow();
  const wrapperRef = useRef(null);
  const pointer = useRef({ x: 0, y: 0 }); // last cursor position over the canvas

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selection, setSelection] = useState({ nodeIds: [], edgeIds: [] });
  const [sidebarOpen, setSidebarOpen] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= 640,
  );

  // ── Store → canvas sync ──────────────────────────────────────────────
  // Reconcile RF nodes from the store: add new, drop removed, refresh data
  // (colours/comment/text). Positions are preserved from RF (drag is the source
  // until drag-stop persists), so live edits never cause a node to jump.
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return state.map.elements.map((el) => {
        const existing = byId.get(el.id);
        const data = nodeData(el);
        if (existing) return { ...existing, type: el.type, data };
        // Size only seeds new nodes; once mounted, NodeResizer owns the box (so
        // a live resize isn't clobbered by reconciliation). Comments auto-size.
        const node = { id: el.id, type: el.type, position: { x: el.x, y: el.y }, data };
        if (el.type === 'initiative' || el.type === 'shape' || el.type === 'text') {
          node.width = el.width || (el.type === 'initiative' ? 224 : el.type === 'shape' ? 168 : 200);
          node.height = el.height || (el.type === 'initiative' ? 132 : el.type === 'shape' ? 96 : 44);
        }
        return node;
      });
    });
  }, [state.map.elements, setNodes]);

  useEffect(() => {
    setEdges((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]));
      return state.map.edges.map((e) => {
        const arrow = e.arrow || 'end';
        const color = e.color || ACCENT;
        const width = e.width || 1.5;
        const dash =
          e.lineStyle === 'dashed'
            ? `${Math.max(6, width * 4)} ${Math.max(4, width * 3)}`
            : e.lineStyle === 'dotted'
            ? `${width} ${width * 3}`
            : undefined;
        const marker = {
          type: MarkerType.ArrowClosed,
          color,
          width: 14 + width * 2.5,
          height: 14 + width * 2.5,
        };
        const base = {
          id: e.id,
          source: e.source,
          target: e.target,
          type: 'floating',
          style: {
            stroke: color,
            strokeWidth: width,
            strokeDasharray: dash,
            strokeLinecap: e.lineStyle === 'dotted' ? 'round' : 'butt',
          },
          markerEnd: arrow === 'end' || arrow === 'both' ? marker : undefined,
          markerStart: arrow === 'start' || arrow === 'both' ? marker : undefined,
          data: { comment: e.comment },
        };
        const existing = byId.get(e.id);
        return existing ? { ...existing, ...base } : base;
      });
    });
  }, [state.map.edges, setEdges]);

  // ── Canvas → store persistence ───────────────────────────────────────
  const onNodeDragStop = useCallback(
    (_, node, dragged) => {
      (dragged && dragged.length ? dragged : [node]).forEach((n) =>
        actions.moveElement(n.id, n.position),
      );
    },
    [actions],
  );

  const onConnect = useCallback(
    (params) => actions.addMapEdge({ source: params.source, target: params.target }),
    [actions],
  );

  // Comment pins manage themselves — keep them out of the style toolbar.
  const onSelectionChange = useCallback(({ nodes: sn, edges: se }) => {
    setSelection({
      nodeIds: sn.filter((n) => n.type !== 'comment').map((n) => n.id),
      edgeIds: se.map((e) => e.id),
    });
  }, []);

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
      actions.placeInitiative(id, position);
    },
    [screenToFlowPosition, actions],
  );

  // Keyboard: Delete removes the selection; "C" drops a comment pin at the
  // cursor. Both are ignored while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selection.nodeIds.length) actions.removeElements(selection.nodeIds);
        if (selection.edgeIds.length) actions.removeMapEdges(selection.edgeIds);
      } else if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const pos = screenToFlowPosition(pointer.current);
        actions.addElement({ id: newId(), type: 'comment', x: pos.x, y: pos.y, text: '' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selection, actions, screenToFlowPosition]);

  const placedInitiativeIds = new Set(
    state.map.elements.filter((el) => el.type === 'initiative').map((el) => el.decisionId),
  );
  const unplaced = state.decisions.filter((d) => !placedInitiativeIds.has(d.id));

  return (
    <div
      className="relative h-full w-full"
      ref={wrapperRef}
      onPointerMove={(e) => {
        pointer.current = { x: e.clientX, y: e.clientY };
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onSelectionChange={onSelectionChange}
        onNodeDoubleClick={(_, n) => n.type === 'initiative' && onOpenDecision?.(n.id)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        deleteKeyCode={null}
        panOnDrag={[1, 2]}
        selectionOnDrag
        zoomOnDoubleClick={false}
        colorMode={theme}
        fitView
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={22}
          size={1}
          color={theme === 'dark' ? '#3a3631' : '#cbc6ba'}
        />
        <Controls showInteractive={false} />
        <MiniMap className="hidden md:block" pannable zoomable />
      </ReactFlow>

      <CanvasToolbar wrapperRef={wrapperRef} />
      <SelectionPanel nodeIds={selection.nodeIds} edgeIds={selection.edgeIds} />

      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="max-w-xs text-center text-sm text-ink/40">
            Drag initiatives from the panel onto the canvas, or add shapes/text from the
            toolbar. Drag from any edge of an element to connect it.
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
                  className="mb-2 cursor-grab rounded-md border border-ink/10 bg-surface p-2 shadow-sm active:cursor-grabbing"
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

export default function MappingView({ onOpenDecision }) {
  return (
    <ReactFlowProvider>
      <Canvas onOpenDecision={onOpenDecision} />
    </ReactFlowProvider>
  );
}
