import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, decisionTotal, DECISION_STATUSES } from '../config/gates.js';
import { decisionLines } from '../lib/diligence.js';
import GatePanel from './GatePanel.jsx';
import Journey from './Journey.jsx';
import DiligenceBadge from './DiligenceBadge.jsx';
import { Button, Card, Pill, inputClass } from './ui.jsx';

// The post-launch review (always the last gate) is held back from the
// build-time funnel: the earlier gates run in sequence, then a minimalist
// "funnel complete" state invites the PM to close the loop *once they actually
// have post-launch feedback*.
export default function DecisionView({ decision, onBack }) {
  const { actions } = useStore();
  const [openPostLaunch, setOpenPostLaunch] = useState(false);

  const total = decisionTotal(decision);
  const order = decision.currentGateOrder;
  const buildComplete = order === total; // build gates done, post-launch pending
  const fullyComplete = order > total; // post-launch also done
  const gate = decisionGateAt(decision, order);
  const postLaunchGate = decisionGateAt(decision, total);

  const remove = () => {
    if (window.confirm(`Delete "${decision.title}" and its full evidence trail?`)) {
      actions.deleteDecision(decision.id);
      onBack();
    }
  };

  return (
    <div>
      <button onClick={onBack} className="text-sm text-ink/50 hover:text-ink">
        ← Back to backlog
      </button>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">{decision.title}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink/50">
            <Pill>{decision.type}</Pill>
            {decisionLines(decision).map((l) => (
              <Pill key={l}>{l}</Pill>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-ink/50">Status</label>
          <select
            className="rounded-md border border-ink/20 bg-white px-2 py-1 text-sm"
            value={decision.status}
            onChange={(e) => actions.updateDecision(decision.id, { status: e.target.value })}
          >
            {DECISION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Button variant="danger" onClick={remove}>
            Delete
          </Button>
        </div>
      </div>

      <div className="mt-3">
        <DiligenceBadge decision={decision} />
      </div>

      {/* Build-time funnel: every gate before the post-launch review */}
      {order < total && (
        // key forces a fresh panel per gate so the question regenerates and the
        // local submit/skip/probe state resets cleanly.
        <GatePanel key={`${decision.id}-${gate.order}`} decision={decision} gate={gate} />
      )}

      {/* Funnel complete, post-launch review still open */}
      {buildComplete && !openPostLaunch && (
        <Card className="mt-6 p-6">
          <p className="text-sm font-semibold">Funnel complete.</p>
          <p className="mt-1 text-sm text-ink/60">
            All build-time gates are logged. Close this one out once you have
            real post-launch feedback — that's what turns this from a capture
            tool into a learning one.
          </p>

          {/* Greyed-out preview of the post-launch gate */}
          <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-ink/[0.02] p-4 opacity-60">
            <p className="text-xs font-medium uppercase tracking-wide text-ink/40">
              Gate {postLaunchGate.order} · {postLaunchGate.name} (not yet open)
            </p>
            <p className="mt-1 text-sm text-ink/70">{postLaunchGate.coreQuestion}</p>
            <textarea
              className={`${inputClass} mt-3 min-h-[80px] resize-none`}
              placeholder="Available once you open the post-launch review…"
              disabled
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={() => setOpenPostLaunch(true)}>
              I have post-launch feedback — open this gate
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back to backlog
            </Button>
          </div>
        </Card>
      )}

      {/* Post-launch review opened — the real, active gate */}
      {buildComplete && openPostLaunch && (
        <GatePanel
          key={`${decision.id}-${postLaunchGate.order}`}
          decision={decision}
          gate={postLaunchGate}
        />
      )}

      {/* Loop fully closed */}
      {fullyComplete && (
        <Card className="mt-6 p-6 text-center">
          <p className="text-sm font-medium">Loop closed.</p>
          <p className="mt-1 text-sm text-ink/60">
            Every gate — including the post-launch review — is logged. The full
            evidence trail is below.
          </p>
        </Card>
      )}

      <Journey decision={decision} />
    </div>
  );
}
