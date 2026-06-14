import { decisionGates } from '../config/gates.js';

// Product lines for a decision, tolerant of the legacy single-string shape.
export function decisionLines(decision) {
  if (Array.isArray(decision.productLines)) return decision.productLines;
  return decision.productLine ? [decision.productLine] : [];
}

// Derives the diligence picture for one decision from its evidence entries,
// scaled to that decision's own (snapshotted) gate set. Deliberately
// qualitative-first (counts + a validation flag) rather than a single gameable
// number — see PRD open question #1.
export function computeDiligence(decision) {
  const gates = decisionGates(decision);
  const total = gates.length;
  const evidence = decision.evidence || [];
  const provided = evidence.filter((e) => e.status === 'provided').length;
  const skipped = evidence.filter((e) => e.status === 'skipped').length;

  const validationSkipped = evidence.filter(
    (e) =>
      e.status === 'skipped' &&
      gates.find((g) => g.order === e.gateOrder)?.isValidationGate,
  ).length;

  const reached = evidence.length; // gates the decision has actually passed through
  const remaining = total - reached;

  // A soft ratio for sorting only — never surfaced as the headline.
  const ratio = reached === 0 ? 0 : provided / reached;

  return { provided, skipped, validationSkipped, reached, remaining, ratio, total };
}

// "6/9 gates evidenced, 2 skipped — incl. 1 validation gate"
export function diligenceLabel(decision) {
  const d = computeDiligence(decision);
  let label = `${d.provided}/${d.total} gates evidenced`;
  if (d.skipped > 0) {
    label += `, ${d.skipped} skipped`;
    if (d.validationSkipped > 0) {
      label += ` — incl. ${d.validationSkipped} validation gate${
        d.validationSkipped > 1 ? 's' : ''
      }`;
    }
  }
  return label;
}

// Qualitative diligence archetypes (per MVP feedback §4.1) — descriptive tags
// instead of a single gameable number. Keyed off gate *semantics* (validation
// flag, gate key), so they survive the per-decision overlay funnels rather than
// hard-coding gate numbers.
const SIZING_KEYS = ['opportunity-sizing', 'prioritisation', 'revenue-margin'];

export function diligenceTags(decision) {
  const gates = decisionGates(decision);
  const evidence = decision.evidence || [];
  const skipped = evidence.filter((e) => e.status === 'skipped');
  const gateOf = (order) => gates.find((g) => g.order === order);

  const tags = [];
  if (skipped.some((e) => gateOf(e.gateOrder)?.isValidationGate)) {
    tags.push({ label: 'Unvalidated', tone: 'flag' });
  }
  if (skipped.some((e) => SIZING_KEYS.includes(gateOf(e.gateOrder)?.key))) {
    tags.push({ label: 'Sizing missing', tone: 'warn' });
  }
  if (evidence.length === gates.length && skipped.length === 0) {
    tags.push({ label: 'Fully evidenced', tone: 'good' });
  }
  return tags;
}

// Decisions that shipped but never closed the loop (no post-launch entry). This
// is what makes Diligence a *learning* instrument, not just a capture tool.
export function needsPostLaunchReview(decision) {
  if (decision.status !== 'shipped') return false;
  const gates = decisionGates(decision);
  const lastGate = gates[gates.length - 1];
  return !(decision.evidence || []).some((e) => e.gateOrder === lastGate.order);
}
