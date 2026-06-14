import { getBezierPath, useInternalNode, EdgeLabelRenderer } from '@xyflow/react';
import { getEdgeParams } from '../../lib/floatingEdge.js';

const ACCENT = '#b5562e';

// Edge whose endpoints float to each node's border. Renders a comment chip at
// the midpoint when the edge has a comment.
export default function FloatingEdge({ id, source, target, markerEnd, style, data }) {
  const sourceNode = useInternalNode(source);
  const targetNode = useInternalNode(target);
  if (!sourceNode || !targetNode) return null;

  const { sx, sy, tx, ty } = getEdgeParams(sourceNode, targetNode);
  const [path, labelX, labelY] = getBezierPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
  });

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        markerEnd={markerEnd}
        style={{ stroke: ACCENT, strokeWidth: 1.5, ...style }}
      />
      {data?.comment && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-white px-1.5 py-0.5 text-[10px] text-ink/70 shadow-sm ring-1 ring-ink/10"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            💬 {data.comment.length > 28 ? `${data.comment.slice(0, 28)}…` : data.comment}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
