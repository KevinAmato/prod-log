import { useEffect, useRef } from 'react';
import { useStore } from '@xyflow/react';

const selector = (s) => ({ width: s.width, height: s.height, transform: s.transform });

// Draws the alignment guide line(s) on a canvas overlaid on the flow, mapped
// through the current viewport transform. `horizontal`/`vertical` are positions
// in flow coordinates (or undefined when there's no active guide).
export default function HelperLines({ horizontal, vertical }) {
  const { width, height, transform } = useStore(selector);
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const dpi = window.devicePixelRatio || 1;
    canvas.width = width * dpi;
    canvas.height = height * dpi;
    ctx.scale(dpi, dpi);
    ctx.clearRect(0, 0, width, height);
    ctx.strokeStyle = '#b5562e';
    ctx.lineWidth = 1;

    const [tx, ty, zoom] = transform;
    if (typeof vertical === 'number') {
      const x = vertical * zoom + tx;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    if (typeof horizontal === 'number') {
      const y = horizontal * zoom + ty;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }, [width, height, transform, horizontal, vertical]);

  return (
    <canvas
      ref={ref}
      className="pointer-events-none absolute left-0 top-0 z-[4]"
      style={{ width, height }}
    />
  );
}
