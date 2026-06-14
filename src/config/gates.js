// The decision funnel. A BASE spine (kept comparable across all decisions) is
// composed with two overlays:
//   • PM archetype  — tilts the validation/sizing/success gates (e.g. a B2C /
//     marketplace or growth PM measures against analytics & experiments; a B2B
//     SaaS PM leans on qualitative user evidence).
//   • Decision type — adds/replaces gates (pricing change, kill-or-deprecate,
//     partnership each need different diligence).
//
// `buildFunnel({ archetype, decisionType })` returns the composed, re-ordered
// gate list. The result is SNAPSHOTTED onto each decision at creation time, so a
// decision's funnel is frozen for its life — audit-trail integrity over config
// churn. `gateSections` drives multi-field gates (e.g. the merged problem gate).

const clone = (x) => structuredClone(x);

// ── BASE spine ──────────────────────────────────────────────────────────────
const BASE = [
  {
    key: 'problem-evidence',
    name: 'Problem & evidence',
    purpose: 'Is there a real, evidenced problem — and who has it?',
    coreQuestion:
      "What's the problem, who specifically has it, and what evidence shows it's real?",
    evidenceBar:
      'A clear problem statement, the affected user/segment, and evidence (quotes, tickets, data) — not just an internal opinion.',
    isValidationGate: true,
    sections: [
      {
        key: 'painPoint',
        label: 'Pain point description',
        type: 'textarea',
        required: true,
        placeholder: "What's the problem, and who specifically has it?",
      },
      {
        key: 'source',
        label: 'Source',
        type: 'input',
        required: false,
        placeholder:
          'Who is this from? e.g. direct user feedback, CSMs, support tickets…',
      },
      {
        key: 'evidence',
        label: 'Evidence',
        type: 'textarea',
        required: true,
        placeholder:
          'User quotes, support tickets, or data showing the pain — not an internal opinion.',
      },
    ],
  },
  {
    key: 'strategic-fit',
    name: 'Strategic fit',
    purpose: 'Does solving it align with product / company strategy?',
    coreQuestion: 'Which strategic goal or OKR does solving this serve?',
    evidenceBar: 'A link or reference to the specific strategic goal it advances.',
    isValidationGate: false,
  },
  {
    key: 'opportunity-sizing',
    name: 'Opportunity sizing',
    purpose: 'Is it worth solving?',
    coreQuestion:
      'How big is this — roughly how many users / which segments, and what is the impact?',
    evidenceBar: 'A rough reach/impact estimate, affected segments, $ where possible.',
    isValidationGate: false,
  },
  {
    key: 'solution-validation',
    name: 'Solution validation',
    purpose: 'Is the proposed solution desirable to users?',
    coreQuestion:
      'What feedback have real users given on this concept or prototype — before build?',
    evidenceBar: 'Feedback on the concept/prototype from real users, gathered before build.',
    isValidationGate: true,
  },
  {
    key: 'feasibility-risk',
    name: 'Feasibility & risk',
    purpose: 'Can we build it, and what are the risks?',
    coreQuestion:
      'What did engineering say about feasibility, and what legal / infosec / compliance risks are flagged?',
    evidenceBar: 'Eng input plus any legal/infosec/compliance flags where relevant.',
    isValidationGate: false,
  },
  {
    key: 'prioritisation',
    name: 'Prioritisation decision',
    purpose: 'Why now, vs. other things?',
    coreQuestion: 'Why now — and what are you explicitly trading off to do this?',
    evidenceBar: 'The explicit trade-off made, and against what.',
    isValidationGate: false,
  },
  {
    key: 'success-definition',
    name: 'Success definition',
    purpose: 'How will we know if it worked?',
    coreQuestion: 'What metric(s) will tell you this worked — defined before build?',
    evidenceBar: 'Concrete success metric(s), defined before build starts.',
    isValidationGate: false,
  },
  {
    key: 'post-launch',
    name: 'Post-launch review',
    purpose: 'Did it work? What did we learn?',
    coreQuestion: 'What actually happened vs. what you predicted — and what did you learn?',
    evidenceBar: 'Actual outcome vs. predicted, plus a short retro note.',
    isValidationGate: false,
  },
];

// ── PM archetypes ────────────────────────────────────────────────────────────
export const ARCHETYPES = [
  { id: 'b2b-saas', label: 'B2B SaaS (qualitative evidence)' },
  { id: 'b2c-marketplace', label: 'B2C / Marketplace (analytics & experiments)' },
  { id: 'growth', label: 'Growth (experiment-driven)' },
  { id: 'platform', label: 'Platform / API' },
  { id: 'other', label: 'Other' },
];

// Analytics tilt — applied to B2C/marketplace and growth archetypes. Reframes
// the validation/sizing/success gates toward behavioural data and experiments.
const ANALYTICS_TILT = {
  'problem-evidence': {
    evidenceBar:
      'A clear problem, the affected segment, and behavioural evidence (funnel drop-off, cohort/retention data, session analytics) — not just opinion.',
    sections: [
      {
        key: 'painPoint',
        label: 'Pain point description',
        type: 'textarea',
        required: true,
        placeholder: "What's the problem, and which user segment / funnel step?",
      },
      {
        key: 'source',
        label: 'Source',
        type: 'input',
        required: false,
        placeholder: 'Who/what is this from? e.g. funnel analytics, session data, NPS verbatims…',
      },
      {
        key: 'evidence',
        label: 'Evidence',
        type: 'textarea',
        required: true,
        placeholder:
          'Quantified behavioural signal — conversion/retention/GMV data, not a stated preference.',
      },
    ],
  },
  'opportunity-sizing': {
    coreQuestion:
      'What do funnel / cohort analytics say about reach and impact — affected users, conversion lift, GMV / retention upside?',
    evidenceBar: 'A data-backed reach/impact estimate from analytics, not a directional guess.',
  },
  'solution-validation': {
    name: 'Solution validation (experiment)',
    coreQuestion:
      'How will you test desirability with real behaviour — what is the experiment / A-B variant, the primary metric, and the guardrails?',
    evidenceBar:
      'A defined experiment (variant, primary metric, guardrail metrics) or a behavioural signal — not just stated preference.',
  },
  'success-definition': {
    coreQuestion:
      'What is the primary metric, its baseline and target, and the guardrail metrics you will not regress?',
    evidenceBar: 'Primary metric + baseline + target + guardrails, defined before build.',
  },
};

const ARCHETYPE_PATCHES = {
  'b2c-marketplace': ANALYTICS_TILT,
  growth: ANALYTICS_TILT,
};

// ── Decision-type overlays ───────────────────────────────────────────────────
const DECISION_OVERLAYS = {
  'pricing change': {
    patch: {
      'solution-validation': {
        key: 'price-testing',
        name: 'Price testing',
        purpose: 'Will the market accept the new price?',
        coreQuestion:
          'What evidence on willingness-to-pay / price sensitivity have you gathered (van Westendorp, A/B price test, interviews)?',
        evidenceBar:
          'WTP / elasticity evidence from real prospects or a price experiment — not a guess.',
        isValidationGate: true,
      },
    },
    insertAfter: {
      'opportunity-sizing': [
        {
          key: 'revenue-margin',
          name: 'Revenue & margin impact',
          purpose: 'What does this do to revenue and margin?',
          coreQuestion:
            'Model the revenue and margin impact across affected segments — best and worst case?',
          evidenceBar: 'A quantified revenue/margin model, not a directional guess.',
          isValidationGate: false,
        },
      ],
      'feasibility-risk': [
        {
          key: 'migration-grandfathering',
          name: 'Migration & grandfathering',
          purpose: 'How are existing customers handled?',
          coreQuestion:
            'How will existing customers be moved or grandfathered, and what is the churn risk?',
          evidenceBar: 'A concrete migration/grandfathering plan with a churn-risk view.',
          isValidationGate: false,
        },
        {
          key: 'pricing-comms',
          name: 'Pricing comms plan',
          purpose: 'How is the change communicated?',
          coreQuestion:
            'What is the communication plan and timeline to customers and the GTM team?',
          evidenceBar: 'A comms plan: who is told, how, and when.',
          isValidationGate: false,
        },
      ],
    },
  },

  'kill-or-deprecate': {
    patch: {
      'problem-evidence': {
        purpose: 'Why kill or deprecate this — with evidence?',
        coreQuestion:
          'Why kill or deprecate this — and what evidence (low usage, high cost, strategic misfit) supports it?',
        evidenceBar: 'Usage/cost data or a strategic rationale — evidence, not just a hunch.',
      },
      'success-definition': {
        coreQuestion:
          'What does a clean sunset look like — what metrics confirm it worked (migrated %, support load, cost saved)?',
        evidenceBar: 'Concrete sunset metrics defined before deprecation.',
      },
    },
    remove: ['solution-validation'],
    insertAfter: {
      'feasibility-risk': [
        {
          key: 'sunset-migration',
          name: 'Migration & customer comms',
          purpose: 'How do affected users transition?',
          coreQuestion:
            'What is the migration path and customer-communication plan for the sunset?',
          evidenceBar: 'A migration + comms plan with a timeline.',
          isValidationGate: false,
        },
      ],
    },
  },

  partnership: {
    insertAfter: {
      'feasibility-risk': [
        {
          key: 'partner-diligence',
          name: 'Partner due diligence',
          purpose: 'Is the partner sound and aligned?',
          coreQuestion:
            'What due diligence have you done on the partner (viability, security, reputation, incentive alignment)?',
          evidenceBar: 'Concrete diligence findings, not vibes.',
          isValidationGate: false,
        },
        {
          key: 'dependency-exit',
          name: 'Dependency & exit terms',
          purpose: 'What is the lock-in and the exit?',
          coreQuestion:
            'What dependency does this create, and what are the exit terms if it fails?',
          evidenceBar: 'A clear dependency assessment and exit/termination terms.',
          isValidationGate: false,
        },
      ],
    },
  },
};

// ── Composition ──────────────────────────────────────────────────────────────
export function buildFunnel({ archetype, decisionType } = {}) {
  let gates = BASE.map(clone);

  const ap = ARCHETYPE_PATCHES[archetype];
  if (ap) gates = gates.map((g) => (ap[g.key] ? { ...g, ...clone(ap[g.key]) } : g));

  const ov = DECISION_OVERLAYS[decisionType];
  if (ov) {
    if (ov.patch) {
      gates = gates.map((g) => (ov.patch[g.key] ? { ...g, ...clone(ov.patch[g.key]) } : g));
    }
    if (ov.remove) {
      gates = gates.filter((g) => !ov.remove.includes(g.key));
    }
    if (ov.insertAfter) {
      const out = [];
      for (const g of gates) {
        out.push(g);
        if (ov.insertAfter[g.key]) out.push(...ov.insertAfter[g.key].map(clone));
      }
      gates = out;
    }
  }

  // Post-launch always closes the loop, regardless of inserts.
  const post = gates.find((g) => g.key === 'post-launch');
  gates = gates.filter((g) => g.key !== 'post-launch');
  if (post) gates.push(post);

  return gates.map((g, i) => ({ ...g, order: i + 1 }));
}

// Default funnel — used as the fallback for legacy decisions saved before gate
// snapshots existed.
export const GATES = buildFunnel({ archetype: 'b2b-saas', decisionType: 'new feature' });
export const TOTAL_GATES = GATES.length;
export const gateByOrder = (order) => GATES.find((g) => g.order === order) || null;

// ── Per-decision gate access (reads the decision's frozen snapshot) ──────────
export function decisionGates(decision) {
  return decision?.gates?.length ? decision.gates : GATES;
}
export function decisionGateAt(decision, order) {
  return decisionGates(decision).find((g) => g.order === order) || null;
}
export function decisionTotal(decision) {
  return decisionGates(decision).length;
}

// A gate's input sections. Gates without an explicit `sections` array collect a
// single free-text evidence response.
const DEFAULT_SECTION = {
  key: 'response',
  label: 'Evidence',
  type: 'textarea',
  required: true,
  placeholder: 'Your evidence — free text, a link, or a note…',
};
export function gateSections(gate) {
  return gate?.sections?.length ? gate.sections : [DEFAULT_SECTION];
}

export const DECISION_TYPES = [
  'new feature',
  'enhancement',
  'kill-or-deprecate',
  'pricing change',
  'partnership',
  'other',
];

export const DECISION_STATUSES = ['active', 'shipped', 'killed', 'parked'];
