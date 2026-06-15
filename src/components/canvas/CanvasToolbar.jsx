import { useReactFlow } from '@xyflow/react';
import { useStore } from '../../store/StoreContext.jsx';
import { newId } from '../../lib/storage.js';

// Places new shapes/text near the centre of the current viewport (with a little
// jitter so repeated clicks don't stack exactly).
export default function CanvasToolbar({ wrapperRef }) {
  const { actions } = useStore();
  const { screenToFlowPosition } = useReactFlow();

  const place = (factory) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    const cx = (rect ? rect.left + rect.width / 2 : window.innerWidth / 2) + (Math.random() - 0.5) * 80;
    const cy = (rect ? rect.top + rect.height / 2 : window.innerHeight / 2) + (Math.random() - 0.5) * 80;
    const pos = screenToFlowPosition({ x: cx, y: cy });
    actions.addElement(factory(pos));
  };

  // Ellipse starts square so it's a true circle; resize to make an oval.
  const SIZES = {
    rectangle: { width: 168, height: 96 },
    ellipse: { width: 120, height: 120 },
    diamond: { width: 140, height: 100 },
  };

  const addShape = (shape) =>
    place((pos) => ({
      id: newId(),
      type: 'shape',
      shape,
      x: pos.x,
      y: pos.y,
      ...SIZES[shape],
      text: '',
      style: {}, // themed default colours; user can override
      comment: '',
    }));

  const addText = () =>
    place((pos) => ({
      id: newId(),
      type: 'text',
      x: pos.x,
      y: pos.y,
      width: 200,
      text: 'Text',
      style: {},
      comment: '',
    }));

  const btn = 'rounded px-2 py-1.5 text-sm text-ink/70 hover:bg-ink/5';

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border border-ink/15 bg-paper/95 p-1 shadow-sm backdrop-blur">
      <button className={btn} title="Rectangle" onClick={() => addShape('rectangle')}>
        <span className="inline-block h-3.5 w-4 rounded-[3px] border-2 border-current align-middle" />
      </button>
      <button className={btn} title="Ellipse" onClick={() => addShape('ellipse')}>
        <span className="inline-block h-3.5 w-4 rounded-full border-2 border-current align-middle" />
      </button>
      <button className={btn} title="Diamond" onClick={() => addShape('diamond')}>
        <span className="inline-block h-3 w-3 rotate-45 border-2 border-current align-middle" />
      </button>
      <span className="mx-0.5 h-5 w-px bg-ink/10" />
      <button className={`${btn} font-semibold`} title="Text" onClick={addText}>
        T
      </button>
    </div>
  );
}
