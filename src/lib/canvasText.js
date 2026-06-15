import { useEffect, useState } from 'react';

export const FONT_SIZES = [10, 12, 14, 16, 18, 24, 32, 48];
export const DEFAULT_FONT = 14;

// Live element box size via ResizeObserver — drives font auto-scaling during a
// NodeResizer drag without writing to the store on every frame.
export function useNodeSize(ref) {
  const [size, setSize] = useState(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    // Border-box (offsetWidth/Height) matches the dimensions NodeResizer sets,
    // so font scaling is exact at rest rather than off by the border width.
    const ro = new ResizeObserver(() => {
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

// Font size that tracks the element's size: the stored fontSize is "correct" at
// the stored width/height; scale by the geometric mean of the current vs.
// reference dimensions so text grows/shrinks proportionally as you resize.
export function scaledFont(style, refW, refH, size) {
  const base = style?.fontSize || DEFAULT_FONT;
  if (!size || !refW || !refH) return base;
  const sw = Math.max(size.w / refW, 0.05);
  const sh = Math.max(size.h / refH, 0.05);
  return Math.max(6, base * Math.sqrt(sw * sh));
}

// Inline CSS for the font-style toggles.
export function textDecorations(style = {}) {
  const deco = [style.underline && 'underline', style.strike && 'line-through']
    .filter(Boolean)
    .join(' ');
  return {
    fontWeight: style.bold ? 700 : undefined,
    fontStyle: style.italic ? 'italic' : undefined,
    textDecoration: deco || undefined,
    fontFamily: style.code ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : undefined,
  };
}

// On resize end: persist the new box AND bake the size change into fontSize, so
// the scaling sticks (after commit the reference dims == current dims).
export function commitResize(actions, id, params, data, refW, refH) {
  const base = data.style?.fontSize || DEFAULT_FONT;
  const scale = Math.sqrt((params.width / refW) * (params.height / refH)) || 1;
  actions.updateElement(id, {
    width: Math.round(params.width),
    height: Math.round(params.height),
    style: { fontSize: +(base * scale).toFixed(1) },
  });
}
