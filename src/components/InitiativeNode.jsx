import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, decisionTotal } from '../config/gates.js';
import { diligenceTags } from '../lib/diligence.js';
import NodeHandles from './canvas/NodeHandles.jsx';

const tone = {
  neutral: 'bg-ink/5 text-ink/70',
  flag: 'bg-accent/10 text-accent',
  warn: 'bg-amber-500/15 text-amber-700',
  good: 'bg-emerald-600/10 text-emerald-700',
};

// A canvas card. It stores NO content of its own — it looks the initiative up in
// the central store by id, so any edit elsewhere in the app reflects here live.
// Only layout + presentation (position, colors, comment) come from the map.
export default function InitiativeNode({ data }) {
  const { state } = useStore();
  const d = state.decisions.find((x) => x.id === data.decisionId);
  const style = data.style || {};

  if (!d) {
    return (
      <div className="w-56 rounded-lg border border-dashed border-ink/20 bg-white px-3 py-2 text-xs text-ink/40">
        (initiative deleted)
        <NodeHandles />
      </div>
    );
  }

  const total = decisionTotal(d);
  const gate = decisionGateAt(d, d.currentGateOrder);
  const done = d.currentGateOrder > total;
  const tags = diligenceTags(d);
  const hasCustomBg = !!style.bg;

  return (
    <div
      className={`group relative w-56 rounded-lg border shadow-sm ${
        hasCustomBg ? 'border-black/10' : 'border-ink/15 bg-white'
      }`}
      style={{ background: style.bg, color: style.text }}
    >
      {data.comment && (
        <span
          title={data.comment}
          className="absolute -right-1.5 -top-1.5 z-10 rounded-full bg-white px-1 text-[11px] shadow ring-1 ring-ink/10"
        >
          💬
        </span>
      )}
      <div className="p-3">
        <p className="text-[10px] uppercase tracking-wide opacity-50">{d.type}</p>
        <h4 className="mt-0.5 line-clamp-2 text-sm font-semibold leading-snug">{d.title}</h4>
        <p className="mt-1 text-[11px] opacity-60">
          {done ? 'Funnel complete' : `Gate ${d.currentGateOrder}/${total} · ${gate?.name}`}
        </p>
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.length === 0 ? (
            <span className="text-[10px] opacity-50">in progress</span>
          ) : (
            tags.map((t) => (
              <span key={t.label} className={`rounded-full px-1.5 py-0.5 text-[10px] ${tone[t.tone]}`}>
                {t.label}
              </span>
            ))
          )}
        </div>
      </div>
      <NodeHandles />
    </div>
  );
}
