// Alignment helper lines for the canvas — when a dragged node's edge or centre
// lines up (within `distance`) with another node's edge or centre, we snap to it
// and report the guide line to draw. Adapted from the React Flow helper-lines
// example for the v12 node shape.

const wh = (n) => ({
  w: n.measured?.width ?? n.width ?? n.style?.width ?? 0,
  h: n.measured?.height ?? n.height ?? n.style?.height ?? 0,
});

export function getHelperLines(change, nodes, distance = 5) {
  const result = {
    horizontal: undefined,
    vertical: undefined,
    snapPosition: { x: undefined, y: undefined },
  };
  const nodeA = nodes.find((n) => n.id === change.id);
  if (!nodeA || !change.position) return result;

  const a = wh(nodeA);
  const A = {
    left: change.position.x,
    right: change.position.x + a.w,
    top: change.position.y,
    bottom: change.position.y + a.h,
    width: a.w,
    height: a.h,
    centerX: change.position.x + a.w / 2,
    centerY: change.position.y + a.h / 2,
  };

  let vDist = distance;
  let hDist = distance;

  for (const nodeB of nodes) {
    if (nodeB.id === nodeA.id) continue;
    const b = wh(nodeB);
    const B = {
      left: nodeB.position.x,
      right: nodeB.position.x + b.w,
      top: nodeB.position.y,
      bottom: nodeB.position.y + b.h,
      centerX: nodeB.position.x + b.w / 2,
      centerY: nodeB.position.y + b.h / 2,
    };

    // ── Vertical guides (align X) ──────────────────────────────────────
    // left ↔ left
    let d = Math.abs(A.left - B.left);
    if (d < vDist) {
      result.snapPosition.x = B.left;
      result.vertical = B.left;
      vDist = d;
    }
    // right ↔ right
    d = Math.abs(A.right - B.right);
    if (d < vDist) {
      result.snapPosition.x = B.right - A.width;
      result.vertical = B.right;
      vDist = d;
    }
    // left ↔ right
    d = Math.abs(A.left - B.right);
    if (d < vDist) {
      result.snapPosition.x = B.right;
      result.vertical = B.right;
      vDist = d;
    }
    // right ↔ left
    d = Math.abs(A.right - B.left);
    if (d < vDist) {
      result.snapPosition.x = B.left - A.width;
      result.vertical = B.left;
      vDist = d;
    }
    // centre ↔ centre
    d = Math.abs(A.centerX - B.centerX);
    if (d < vDist) {
      result.snapPosition.x = B.centerX - A.width / 2;
      result.vertical = B.centerX;
      vDist = d;
    }

    // ── Horizontal guides (align Y) ────────────────────────────────────
    d = Math.abs(A.top - B.top);
    if (d < hDist) {
      result.snapPosition.y = B.top;
      result.horizontal = B.top;
      hDist = d;
    }
    d = Math.abs(A.bottom - B.bottom);
    if (d < hDist) {
      result.snapPosition.y = B.bottom - A.height;
      result.horizontal = B.bottom;
      hDist = d;
    }
    d = Math.abs(A.top - B.bottom);
    if (d < hDist) {
      result.snapPosition.y = B.bottom;
      result.horizontal = B.bottom;
      hDist = d;
    }
    d = Math.abs(A.bottom - B.top);
    if (d < hDist) {
      result.snapPosition.y = B.top - A.height;
      result.horizontal = B.top;
      hDist = d;
    }
    d = Math.abs(A.centerY - B.centerY);
    if (d < hDist) {
      result.snapPosition.y = B.centerY - A.height / 2;
      result.horizontal = B.centerY;
      hDist = d;
    }
  }

  return result;
}
