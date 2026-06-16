import { useCallback, useEffect, useState } from 'react';
import { useReactFlow } from '@xyflow/react';

// Full-screen, step-through view of the canvas: each frame becomes a slide and
// the viewport flies to fit it. Reads the canvas live (it's the single source of
// truth), so what you present is exactly what you built. Esc / ✕ exits; ← →,
// Space, or the on-screen arrows move between frames.
export default function PresentationMode({ frames, onExit }) {
  const { fitBounds } = useReactFlow();
  const [i, setI] = useState(0);
  const count = frames.length;

  const go = useCallback(
    (idx) => {
      const clamped = Math.max(0, Math.min(count - 1, idx));
      setI(clamped);
      const f = frames[clamped];
      if (f) fitBounds({ x: f.x, y: f.y, width: f.width, height: f.height }, { padding: 0.12, duration: 500 });
    },
    [frames, count, fitBounds],
  );

  // Fly to the first frame on enter / whenever the frame set changes.
  useEffect(() => {
    go(i >= count ? count - 1 : i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  useEffect(() => {
    go(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onExit();
      else if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        go(i + 1);
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        go(i - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [i, go, onExit]);

  const current = frames[i];

  return (
    <>
      {/* Top bar: title + slide counter + exit */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between p-4">
        <span className="pointer-events-auto rounded-full bg-ink/80 px-4 py-1.5 text-sm font-semibold uppercase tracking-wide text-paper shadow-lg backdrop-blur">
          {current?.title || 'Frame'}
        </span>
        <div className="pointer-events-auto flex items-center gap-2">
          <span className="rounded-full bg-ink/80 px-3 py-1.5 text-sm font-medium text-paper shadow-lg">
            {i + 1} / {count}
          </span>
          <button
            onClick={onExit}
            className="rounded-full bg-ink/80 px-3 py-1.5 text-sm font-medium text-paper shadow-lg hover:bg-ink"
            title="Exit presentation (Esc)"
          >
            ✕ Exit
          </button>
        </div>
      </div>

      {/* Prev / Next */}
      <button
        onClick={() => go(i - 1)}
        disabled={i === 0}
        className="absolute left-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-ink/80 p-3 text-paper shadow-lg hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30"
        title="Previous (←)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <button
        onClick={() => go(i + 1)}
        disabled={i === count - 1}
        className="absolute right-4 top-1/2 z-30 -translate-y-1/2 rounded-full bg-ink/80 p-3 text-paper shadow-lg hover:bg-ink disabled:cursor-not-allowed disabled:opacity-30"
        title="Next (→)"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </>
  );
}
