import { Handle, Position } from '@xyflow/react';
import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, decisionTotal } from '../config/gates.js';
import { diligenceTags } from '../lib/diligence.js';

const tone = {
  neutral: 'bg-ink/5 text-ink/70',
  flag: 'bg-accent/10 text-accent',
  warn: 'bg-amber-500/15 text-amber-700',
  good: 'bg-emerald-600/10 text-emerald-700',
};

const handleClass =
  '!h-3 !w-3 !border-2 !border-white opacity-0 transition-opacity group-hover:opacity-100';

// A canvas card. It stores NO content of its own — it looks the initiative up in
// the central store by id, so any edit elsewhere in the app reflects here live.
export default function InitiativeNode({ data }) {
  const { state } = useStore();
  const d = state.decisions.find((x) => x.id === data.decisionId);

  if (!d) {
    return (
      <div className="w-56 rounded-lg border border-dashed border-ink/20 bg-white px-3 py-2 text-xs text-ink/40">
        (initiative deleted)
      </div>
    );
  }

  const total = decisionTotal(d);
  const gate = decisionGateAt(d, d.currentGateOrder);
  const done = d.currentGateOrder > total;
  const tags = diligenceTags(d);

  return (
    <div className="group relative w-56 rounded-lg border border-ink/15 bg-white shadow-sm">
      <Handle type="target" position={Position.Left} className={`${handleClass} !bg-ink/40`} />

      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wide text-ink/40">{d.type}</p>
        <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{d.title}</h4>
        <p className="mt-1 text-[11px] text-ink/55">
          {done ? 'Funnel complete' : `Gate ${d.currentGateOrder}/${total} · ${gate?.name}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.length === 0 ? (
            <span className="text-[10px] text-ink/40">in progress</span>
          ) : (
            tags.map((t) => (
              <span key={t.label} className={`rounded-full px-1.5 py-0.5 text-[10px] ${tone[t.tone]}`}>
                {t.label}
              </span>
            ))
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} className={`${handleClass} !bg-accent`} />
    </div>
  );
}
