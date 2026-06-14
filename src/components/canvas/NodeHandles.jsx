import { Handle, Position } from '@xyflow/react';

// Full-side connection handles on all four edges. With ConnectionMode.Loose a
// `source` handle can also receive connections, so each side is both a start and
// a drop target — you can connect from/to any side of any element. Styled (in
// index.css) as thin bars spanning each side, revealed on hover, so a drag can
// begin anywhere along an edge rather than at a single dot.
const SIDES = [
  ['top', Position.Top],
  ['right', Position.Right],
  ['bottom', Position.Bottom],
  ['left', Position.Left],
];

export default function NodeHandles() {
  return SIDES.map(([id, position]) => (
    <Handle key={id} id={id} type="source" position={position} className="diligence-handle" />
  ));
}
