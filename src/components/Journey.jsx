import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { decisionGateAt, gateSections } from '../config/gates.js';
import { Button, Card, Pill, inputClass } from './ui.jsx';

const fmt = (iso) => {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
};

// Normalises an entry's content into { key: value } for the editor, tolerant of
// the legacy response/source shape saved before gates had sections.
function entryValues(entry, sections) {
  const out = {};
  for (const s of sections) {
    const fromSections = (entry.sections || []).find((x) => x.key === s.key);
    if (fromSections) out[s.key] = fromSections.value;
    else if (s.key === 'response' && entry.response) out[s.key] = entry.response;
    else if (s.key === 'source' && entry.source) out[s.key] = entry.source;
    else out[s.key] = '';
  }
  return out;
}

// Render the saved content of one entry (read mode).
function EntryBody({ entry }) {
  if (entry.status === 'skipped') {
    return (
      <p className="mt-1 text-sm text-ink/90">
        Skip reason: {entry.skipReason || '(none)'}
      </p>
    );
  }
  const sections =
    entry.sections && entry.sections.length
      ? entry.sections
      : // legacy fallback
        [
          entry.response && { label: 'Evidence', value: entry.response },
          entry.source && { label: 'Source', value: entry.source },
        ].filter(Boolean);

  return (
    <div className="mt-1 space-y-2">
      {sections.map((s, i) => (
        <div key={i}>
          {s.label && (
            <p className="text-xs font-medium text-ink/55">{s.label}</p>
          )}
          <p className="whitespace-pre-wrap text-sm text-ink/90">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function EditForm({ decisionId, entry, gate, onDone }) {
  const { actions } = useStore();
  const sections = gateSections(gate);
  const [status, setStatus] = useState(entry.status);
  const [values, setValues] = useState(() => entryValues(entry, sections));
  const [skipReason, setSkipReason] = useState(entry.skipReason || '');

  const setVal = (k, v) => setValues((p) => ({ ...p, [k]: v }));
  const canSave =
    status === 'skipped'
      ? !!skipReason.trim()
      : sections.every((s) => !s.required || (values[s.key] || '').trim());

  const save = () => {
    if (!canSave) return;
    if (status === 'provided') {
      const built = sections
        .map((s) => ({ key: s.key, label: s.label, value: (values[s.key] || '').trim() }))
        .filter((s) => s.value);
      actions.editEvidence(decisionId, entry.gateOrder, { status: 'provided', sections: built });
    } else {
      actions.editEvidence(decisionId, entry.gateOrder, {
        status: 'skipped',
        skipReason: skipReason.trim(),
      });
    }
    onDone();
  };

  return (
    <div className="mt-3 rounded-lg border border-ink/15 bg-white p-3">
      <div className="mb-3 flex gap-2 text-xs">
        <button
          onClick={() => setStatus('provided')}
          className={`rounded px-2 py-1 ${
            status === 'provided' ? 'bg-ink text-paper' : 'bg-ink/5 text-ink/60'
          }`}
        >
          Provided
        </button>
        <button
          onClick={() => setStatus('skipped')}
          className={`rounded px-2 py-1 ${
            status === 'skipped' ? 'bg-accent text-white' : 'bg-ink/5 text-ink/60'
          }`}
        >
          Skipped
        </button>
      </div>

      {status === 'provided' ? (
        <div className="space-y-3">
          {sections.map((s) => (
            <div key={s.key}>
              <label className="mb-1 block text-xs font-medium text-ink/70">
                {s.label}
                {!s.required && <span className="text-ink/40"> (optional)</span>}
              </label>
              {s.type === 'input' ? (
                <input
                  className={inputClass}
                  value={values[s.key] || ''}
                  placeholder={s.placeholder}
                  onChange={(e) => setVal(s.key, e.target.value)}
                />
              ) : (
                <textarea
                  className={`${inputClass} min-h-[90px] resize-y`}
                  value={values[s.key] || ''}
                  placeholder={s.placeholder}
                  onChange={(e) => setVal(s.key, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <input
          className={inputClass}
          value={skipReason}
          placeholder="One-line reason for skipping…"
          onChange={(e) => setSkipReason(e.target.value)}
        />
      )}

      <div className="mt-3 flex gap-2">
        <Button onClick={save} disabled={!canSave}>
          Save
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function JourneyCard({ decision, entry }) {
  const [editing, setEditing] = useState(false);
  const gate = decisionGateAt(decision, entry.gateOrder);
  const skipped = entry.status === 'skipped';

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">
          Gate {entry.gateOrder} · {entry.gateName || gate?.name}
        </span>
        <div className="flex items-center gap-2">
          {gate?.isValidationGate && <Pill>validation</Pill>}
          {skipped ? <Pill tone="flag">skipped</Pill> : <Pill tone="good">evidenced</Pill>}
        </div>
      </div>

      {entry.questionAsked && (
        <p className="mt-2 text-xs italic text-ink/50">{entry.questionAsked}</p>
      )}

      {editing ? (
        <EditForm
          decisionId={decision.id}
          entry={entry}
          gate={gate}
          onDone={() => setEditing(false)}
        />
      ) : (
        <>
          <EntryBody entry={entry} />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[11px] text-ink/40">
              {fmt(entry.timestamp)}
              {entry.editedAt && ' · edited'}
            </p>
            <Button variant="ghost" className="px-3 text-xs" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}

// The ordered history of a decision across gates — derived purely from its
// evidence entries (it's a view, not stored state).
export default function Journey({ decision }) {
  const evidence = decision.evidence || [];
  if (evidence.length === 0) return null;

  return (
    <section className="mt-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/50">
        Journey so far
      </h3>
      <ol className="mt-3 space-y-3">
        {evidence.map((e, i) => (
          <JourneyCard key={i} decision={decision} entry={e} />
        ))}
      </ol>
    </section>
  );
}
