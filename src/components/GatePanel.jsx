import { useEffect, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { gateSections, decisionTotal } from '../config/gates.js';
import {
  generateGateQuestion,
  probeEvidence,
  getIdeationAngles,
  describeError,
  hasKey,
} from '../lib/ai.js';
import { Button, Card, Skeleton, inputClass } from './ui.jsx';

// One gate's interaction. The AI asks and probes; ADVANCEMENT AND SKIPPING ARE
// UI ACTIONS, never AI decisions — that's what keeps the audit trail clean and
// the AI inside its facilitation role.
export default function GatePanel({ decision, gate }) {
  const { state, actions } = useStore();
  const settings = state.settings;
  const keyed = hasKey(settings);
  const sections = gateSections(gate);
  const total = decisionTotal(decision);

  const ctx = {
    profile: state.profile,
    decision,
    gate,
    priorEvidence: decision.evidence || [],
  };

  const [question, setQuestion] = useState(gate.coreQuestion);
  const [loadingQuestion, setLoadingQuestion] = useState(false);
  const [values, setValues] = useState({}); // section.key -> text
  const [probe, setProbe] = useState('');
  const [probed, setProbed] = useState(false);
  const [probing, setProbing] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const [angles, setAngles] = useState([]);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const [error, setError] = useState('');

  const setVal = (key, v) => setValues((prev) => ({ ...prev, [key]: v }));
  const canSubmit = sections.every((s) => !s.required || (values[s.key] || '').trim());

  // Generate a personalised question on mount. Falls back to the static
  // coreQuestion if there's no key or the call fails — the funnel still works.
  useEffect(() => {
    let cancelled = false;
    if (!keyed) {
      setQuestion(gate.coreQuestion);
      return;
    }
    setLoadingQuestion(true);
    generateGateQuestion(settings, ctx)
      .then((q) => {
        if (!cancelled) setQuestion(q);
      })
      .catch((e) => {
        if (!cancelled) {
          setQuestion(gate.coreQuestion);
          setError(describeError(e));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingQuestion(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision.id, gate.order]);

  const buildSections = () =>
    sections
      .map((s) => ({ key: s.key, label: s.label, value: (values[s.key] || '').trim() }))
      .filter((s) => s.value);

  const combinedText = () =>
    buildSections()
      .map((s) => `${s.label}: ${s.value}`)
      .join('\n');

  const commitProvide = () => {
    actions.recordEvidence(decision.id, {
      questionAsked: question,
      sections: buildSections(),
      status: 'provided',
    });
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setError('');
    // One probing follow-up, if the evidence looks thin. Never blocks: if a
    // probe is shown, the button becomes "Submit anyway".
    if (keyed && !probed) {
      setProbing(true);
      try {
        const res = await probeEvidence(settings, ctx, combinedText());
        setProbed(true);
        if (!res.meetsBar && res.followUp) {
          setProbe(res.followUp);
          setProbing(false);
          return;
        }
      } catch (e) {
        setError(describeError(e));
        setProbing(false);
        return;
      }
      setProbing(false);
    }
    commitProvide();
  };

  const confirmSkip = () => {
    if (!skipReason.trim()) return;
    actions.recordEvidence(decision.id, {
      questionAsked: question,
      status: 'skipped',
      skipReason: skipReason.trim(),
    });
  };

  const onIdeate = async () => {
    setError('');
    setLoadingAngles(true);
    try {
      const a = await getIdeationAngles(settings, ctx);
      setAngles(a);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setLoadingAngles(false);
    }
  };

  return (
    <Card className="mt-6 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">
            Gate {gate.order} of {total}
            {gate.isValidationGate && ' · validation gate'}
          </p>
          <h2 className="mt-0.5 text-lg font-semibold">{gate.name}</h2>
          <p className="text-sm text-ink/60">{gate.purpose}</p>
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-ink/[0.03] p-4">
        <p className="text-xs uppercase tracking-wide text-ink/40">
          {loadingQuestion ? 'Loading question…' : 'The question'}
        </p>
        {loadingQuestion ? (
          <div className="mt-2 space-y-2">
            <Skeleton className="h-4 w-[85%]" />
            <Skeleton className="h-4 w-[60%]" />
          </div>
        ) : (
          <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed">
            {question}
          </p>
        )}
        <p className="mt-3 text-xs text-ink/45">
          <span className="font-medium">Evidence bar:</span> {gate.evidenceBar}
        </p>
      </div>

      {!skipping && (
        <>
          <div className="mt-4 space-y-4">
            {sections.map((s) => (
              <div key={s.key}>
                <label className="mb-1 block text-xs font-medium text-ink/70">
                  {s.label}
                  {!s.required && <span className="text-ink/40"> (optional)</span>}
                </label>
                {s.type === 'input' ? (
                  <input
                    className={inputClass}
                    placeholder={s.placeholder}
                    value={values[s.key] || ''}
                    onChange={(e) => setVal(s.key, e.target.value)}
                  />
                ) : (
                  <textarea
                    className={`${inputClass} min-h-[110px] resize-y`}
                    placeholder={s.placeholder}
                    value={values[s.key] || ''}
                    onChange={(e) => setVal(s.key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </div>

          {probe && (
            <div className="mt-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                One probing follow-up
              </p>
              <p className="mt-1 text-sm text-ink/85">{probe}</p>
              <p className="mt-1 text-xs text-ink/45">
                Sharpen your answer above, or submit it anyway — your call.
              </p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onSubmit} disabled={!canSubmit || probing}>
              {probing ? 'Checking…' : probe ? 'Submit anyway' : 'Submit'}
            </Button>
            <Button variant="outline" onClick={() => setSkipping(true)}>
              Skip this gate
            </Button>
            {keyed && (
              <Button variant="ghost" onClick={onIdeate} disabled={loadingAngles}>
                {loadingAngles ? 'Thinking…' : "I'm stuck — give me angles"}
              </Button>
            )}
          </div>
        </>
      )}

      {skipping && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-sm font-medium">
            Skipping is allowed — but it's logged and surfaced in the backlog.
          </p>
          <input
            className={`${inputClass} mt-3`}
            placeholder="One-line reason for skipping…"
            value={skipReason}
            onChange={(e) => setSkipReason(e.target.value)}
            autoFocus
          />
          <div className="mt-3 flex gap-2">
            <Button variant="accent" onClick={confirmSkip} disabled={!skipReason.trim()}>
              Log skip & advance
            </Button>
            <Button variant="ghost" onClick={() => setSkipping(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {angles.length > 0 && (
        <div className="mt-4 rounded-lg border border-ink/10 bg-surface p-4">
          <p className="text-xs uppercase tracking-wide text-ink/40">
            Angles to react to — not answers
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink/85">
            {angles.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-accent">{error}</p>}
    </Card>
  );
}
