import { decisionGateAt, decisionTotal } from '../config/gates.js';
import { decisionLines, diligenceLabel } from './diligence.js';

// Flatten a decision — overview + every gate's recorded values — to plain text,
// one value per line, for pasting into Jira / Airtable / docs.
export function decisionToText(d) {
  const out = [];

  // ── Overview ──────────────────────────────────────────────────────
  out.push(d.title || '(untitled)');
  out.push(`Type: ${d.type}`);
  const pl = decisionLines(d);
  if (pl.length) out.push(`Product lines: ${pl.join(', ')}`);
  out.push(`Status: ${d.status}`);
  out.push(`Diligence: ${diligenceLabel(d)}`);
  const total = decisionTotal(d);
  out.push(
    `Current gate: ${
      d.currentGateOrder > total
        ? 'funnel complete'
        : `${d.currentGateOrder}/${total} — ${decisionGateAt(d, d.currentGateOrder)?.name || ''}`
    }`,
  );

  // ── Gate-by-gate ──────────────────────────────────────────────────
  (d.evidence || []).forEach((e) => {
    const gate = decisionGateAt(d, e.gateOrder);
    const name = e.gateName || gate?.name || `Gate ${e.gateOrder}`;
    out.push('');
    out.push(`Gate ${e.gateOrder} — ${name}${gate?.isValidationGate ? ' (validation)' : ''}: ${e.status}`);
    if (e.questionAsked) out.push(`Q: ${e.questionAsked}`);

    if (e.status === 'skipped') {
      out.push(`Skip reason: ${e.skipReason || '(none)'}`);
    } else {
      const sections =
        e.sections && e.sections.length
          ? e.sections
          : e.response
          ? [{ label: 'Evidence', value: e.response }]
          : [];
      sections.forEach((s) => out.push(`${s.label}: ${s.value}`));
      if (e.source) out.push(`Source: ${e.source}`); // legacy single-field entries
    }
  });

  return out.join('\n').trim() + '\n';
}
