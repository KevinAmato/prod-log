// Geometry for "floating" edges — the connection points are computed on each
// node's border facing the other node, so an edge attaches at the natural point
// regardless of which side handle started it. Adapted from the React Flow v12
// floating-edges example, hardened against a not-yet-measured node (falls back
// to its declared width/height so the edge renders immediately).

const dims = (node) => ({
  w: node.measured?.width ?? node.width ?? 0,
  h: node.measured?.height ?? node.height ?? 0,
});

export function nodeReady(node) {
  if (!node) return false;
  const { w, h } = dims(node);
  return w > 0 && h > 0 && !!node.internals?.positionAbsolute;
}

function getNodeIntersection(intersectionNode, targetNode) {
  const { w: iw, h: ih } = dims(intersectionNode);
  const intersectionNodePosition = intersectionNode.internals.positionAbsolute;
  const targetPosition = targetNode.internals.positionAbsolute;
  const { w: tw, h: th } = dims(targetNode);

  const w = iw / 2;
  const h = ih / 2;

  const x2 = intersectionNodePosition.x + w;
  const y2 = intersectionNodePosition.y + h;
  const x1 = targetPosition.x + tw / 2;
  const y1 = targetPosition.y + th / 2;

  const xx1 = (x1 - x2) / (2 * w) - (y1 - y2) / (2 * h);
  const yy1 = (x1 - x2) / (2 * w) + (y1 - y2) / (2 * h);
  const a = 1 / (Math.abs(xx1) + Math.abs(yy1) || 1);
  const xx3 = a * xx1;
  const yy3 = a * yy1;
  const x = w * (xx3 + yy3) + x2;
  const y = h * (-xx3 + yy3) + y2;

  return { x, y };
}

export function getEdgeParams(source, target) {
  const s = getNodeIntersection(source, target);
  const t = getNodeIntersection(target, source);
  return { sx: s.x, sy: s.y, tx: t.x, ty: t.y };
}
