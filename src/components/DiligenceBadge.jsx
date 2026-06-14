import {
  computeDiligence,
  diligenceLabel,
  diligenceTags,
  needsPostLaunchReview,
} from '../lib/diligence.js';
import { Pill } from './ui.jsx';

// At-a-glance diligence picture. Skipped validation gates are flagged loudest —
// that's the whole "skipping is allowed but never hidden" mechanism. Qualitative
// archetype tags (Unvalidated / Sizing missing / Fully evidenced) replace any
// single gameable score.
export default function DiligenceBadge({ decision }) {
  const d = computeDiligence(decision);
  const label = diligenceLabel(decision);
  const tags = diligenceTags(decision);
  const loopOpen = needsPostLaunchReview(decision);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* segmented progress across this decision's gates */}
      <div className="flex gap-0.5" title={`${d.reached}/${d.total} gates reached`}>
        {Array.from({ length: d.total }).map((_, i) => {
          const entry = (decision.evidence || [])[i];
          let cls = 'bg-ink/10'; // not reached
          if (entry?.status === 'provided') cls = 'bg-emerald-600';
          else if (entry?.status === 'skipped') cls = 'bg-accent';
          return <span key={i} className={`h-2 w-3 rounded-sm ${cls}`} />;
        })}
      </div>
      <span className="text-xs text-ink/60">{label}</span>
      {tags.map((t) => (
        <Pill key={t.label} tone={t.tone}>
          {t.label}
        </Pill>
      ))}
      {loopOpen && <Pill tone="flag">needs post-launch review</Pill>}
    </div>
  );
}
