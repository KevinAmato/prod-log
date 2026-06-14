# Diligence (ProdLog) — Project Paper

**An audit trail for product judgment.**

| | |
|---|---|
| **Status** | Working v1 (single-user / self). Live. |
| **Repo** | https://github.com/KevinAmato/prod-log (public) |
| **Live app** | https://kevinamato.github.io/prod-log/ |
| **Author** | Kevin Amato |
| **Stack** | React + Vite + Tailwind, static SPA, BYOK Anthropic, `localStorage` |
| **Running cost** | $0 — no backend, no database, no server-side inference |

This paper is the single onboarding document. **Part I** is the product (read this if
you're a PM or stakeholder). **Part II** is the architecture and code (read this if
you're a developer). **Part III** is operations (deploy, dev, limitations).

---

# Part I — The Product

## 1. Problem

Product managers make dozens of consequential calls — what to build, what to kill, what
to deprioritise — but the **reasoning and evidence** behind those calls is rarely
captured. It lives in scattered Slack threads, Notion docs, and people's heads. Three
consequences:

1. **No audit trail.** When a decision is questioned months later ("why did we build
   this?"), the evidence chain is gone.
2. **Skipped diligence is invisible.** A PM can ship with zero user validation and nobody
   notices until it fails. Nothing makes the *gaps* in rigour visible.
3. **No feedback loop on decision quality.** PMs and their leaders have no structured way
   to see whether decisions are made with appropriate diligence, or to improve over time.

Existing tools capture *what* was decided (Jira) or *what* will be built (Productboard,
Notion). None capture the **evidence-backed journey of a decision through a diligence
funnel**, and none make skipped validation an explicit, tracked event.

## 2. Vision & positioning

A product-decision funnel that works like a due-diligence checklist *and* a tracker. Every
decision passes through a sequence of lifecycle **gates**. At each gate the tool asks for
evidence; the PM either **provides** it (stored, timestamped) or explicitly **skips** it
(also stored, timestamped, with a reason). The result is a living backlog of decisions,
each with a complete, visible evidence trail.

**One-line positioning:** *an audit trail for product judgment.*

The differentiator is the **anti-generative** stance: the AI is a forcing function for
human rigour, not a ghostwriter. It never writes the PRD, invents user feedback, or makes
the call.

## 3. Design principles (these are enforced in code, not just aspirations)

1. **The AI facilitates, it never decides.** It asks the gate's question, evaluates the
   evidence against a bar, and asks *at most one* probing follow-up. Advancing and
   skipping are **UI actions** the human takes — never AI actions.
2. **Feedback before solutioning.** The funnel biases toward forcing real user/stakeholder
   validation *before* a decision advances to build. This is the core philosophical stance
   and the main differentiator vs. generative "AI writes your PRD" tools.
3. **Skipping is allowed but never hidden.** A PM can skip any gate to keep momentum — but
   every skip is logged with a reason and surfaced loudly in the backlog. Visibility, not
   mechanical enforcement, is the lever.
4. **Structured-but-adaptive.** The gate set is predefined and consistent so the audit
   trail is comparable. The AI personalises *phrasing*; it never invents the gates.
5. **Minimalist UI.** The product is the funnel logic and the evidence ledger, not a heavy
   interface.

## 4. Target user & scope (v1)

A single user: the author — a B2B SaaS PM owning a multi-segment platform. Tuned to real
decisions being made at work. Generalisation to other PM archetypes and a manager/Head-of-
Product cross-team view are **out of scope for v1** (though the archetype system, §6, lays
the groundwork).

## 5. Core concepts / data model (conceptual)

- **Decision** — the thing being evaluated (title, type, product lines, status, current
  gate, and its *snapshotted* gate set).
- **Gate** — a lifecycle stage with a *purpose*, a *core question*, and an *evidence bar*.
- **Evidence entry** — one record per gate per decision: the question asked, the structured
  response (one or more labelled **sections**) or a skip reason, status, timestamp.
- **Journey** — the ordered history of a decision across its gates. Derived from its
  evidence entries; not stored separately.
- **Backlog** — all decisions, filterable/sortable, each with an at-a-glance diligence
  picture.

## 6. The adaptive funnel

Unlike the original fixed 9-gate plan, the funnel is **composed per decision** from a base
spine plus two overlays, then **snapshotted onto the decision at creation** (frozen for its
life — audit integrity over config churn). See `src/config/gates.js`.

### 6.1 Base spine (B2B SaaS, new feature → 8 gates)

| # | Gate | Validation? | Evidence bar (short) |
|---|------|:--:|---|
| 1 | **Problem & evidence** | ✅ | Problem + affected segment + evidence (quotes/tickets/data). *3 sections: Pain point / Source / Evidence.* |
| 2 | Strategic fit | | The strategic goal/OKR it serves |
| 3 | Opportunity sizing | | Reach/impact estimate, segments, $ |
| 4 | **Solution validation** | ✅ | Real-user feedback on the concept *before build* |
| 5 | Feasibility & risk | | Eng input + legal/infosec/compliance flags |
| 6 | Prioritisation decision | | The explicit trade-off, and against what |
| 7 | Success definition | | Success metric(s) defined before build |
| 8 | Post-launch review | | Actual vs. predicted + retro note |

> **Merge note:** the original plan's Gate 1 (Problem framing) and Gate 2 (Problem
> validation) were merged into the single **Problem & evidence** validation gate with three
> sections (Pain point / Source / Evidence).

### 6.2 PM archetype overlay

Set in onboarding/Settings. `b2c-marketplace` and `growth` apply an **analytics tilt** —
the problem, sizing, solution-validation and success gates reframe toward funnel/cohort
data, A/B experiments, baselines and guardrail metrics. `b2b-saas` (default), `platform`,
and `other` keep the qualitative spine.

### 6.3 Decision-type overlay

| Type | What changes |
|---|---|
| `pricing change` | Solution validation → **Price testing** (WTP/elasticity); inserts **Revenue & margin impact**, **Migration & grandfathering**, **Pricing comms plan** (→ ~11 gates) |
| `kill-or-deprecate` | Reframes the problem gate toward usage/cost evidence; **removes** solution validation; inserts **Migration & customer comms**; reframes success → clean-sunset metrics |
| `partnership` | Inserts **Partner due diligence** and **Dependency & exit terms** |
| `new feature` / `enhancement` / `other` | Base spine |

Post-launch review is always re-appended last, regardless of inserts.

## 7. Key user flows

- **Onboarding** — capture PM type, **archetype**, product name, product lines.
- **Create a decision** — title, type, multi-select product lines (with an "All" option).
  Enters the funnel at gate 1 with its composed gate set snapshotted.
- **Progress a gate** — the AI asks a personalised question; the PM fills the section(s)
  and **Submits**, or **Skips** with a one-line reason. If a key is set and the evidence
  looks thin, the AI shows **one** probing follow-up (non-blocking — the button becomes
  "Submit anyway"). On request ("I'm stuck — give me angles") the AI offers prompts to react
  to, never answers.
- **Post-launch separation** — after the build-time gates, a minimalist "Funnel complete"
  state holds the post-launch gate greyed-out until the PM clicks "I have post-launch
  feedback — open this gate."
- **Edit any saved gate** — each journey card has an Edit affordance: change the
  content, fix a skip reason, or convert a skip into provided evidence later.
- **View the backlog** — every decision with its diligence picture and qualitative tags.

## 8. AI behaviour spec

- **Context the AI always has:** the PM profile, the current decision, the current gate's
  purpose + core question + evidence bar, and all prior evidence for that decision.
- **Per gate:** ask the (personalised) core question; evaluate the response against the
  bar; ask at most one probing follow-up if it falls short; then stop.
- **Hard constraints (in the system prompt):** never advance/skip on the user's behalf;
  never generate evidence or invent user feedback; never claim validation happened; only
  offer ideas on explicit request, clearly labelled as prompts to react to.
- **Tone:** a sharp, supportive PM mentor running a stage-gate review — direct, not
  sycophantic.

## 9. Diligence indicator (qualitative, not a score)

Deliberately **not** a single number (a number gets gamed — PMs would stuff fluff to raise
it). Instead: a count (`6/8 gates evidenced, 2 skipped`), a segmented progress bar, and
descriptive **archetype tags**:

| Tag | Trigger |
|---|---|
| **Unvalidated** (red) | A validation gate was skipped |
| **Sizing missing** (amber) | Opportunity-sizing / prioritisation / revenue-margin skipped |
| **Fully evidenced** (green) | All gates reached and none skipped |
| **needs post-launch review** | Shipped but the post-launch gate is unfilled |

## 10. Success metrics (for the tool itself)

Single-user v1, so success = behaviour change in the author: decisions actually get logged;
validation gates get skipped *less* over time; at least one real decision is changed because
the funnel surfaced a gap; post-launch reviews actually get filled in.

## 11. Out of scope (v1)

Multi-user/team accounts and the manager view; integrations (Jira/Notion/Slack) — manual
entry only; a mobile-native app (responsive web suffices); any server-side storage of user
data; generative PRD/artifact creation (deliberately excluded).

---

# Part II — Architecture & Technical

## 12. Stack & the $0 / BYOK model

| Layer | Choice | Why |
|---|---|---|
| Framework | React 18 + Vite 6 | Fast, trivial static build |
| Styling | Tailwind 3 | Speed; minimalist UI |
| State | React state + a single `localStorage` JSON blob | No DB; free, local persistence |
| AI | Anthropic Messages API via `@anthropic-ai/sdk`, **called directly from the browser** with the user's key (`dangerouslyAllowBrowser: true`) | BYOK = $0 inference cost to the operator |
| Hosting | GitHub Pages (live) / Cloudflare Pages (alt) | Free static hosting |

**Why no backend:** the moment a server holds the API key, the *operator* pays for every
call. BYOK keeps it genuinely free and is the standard pattern for indie AI tools. The
key sits only in the user's browser and is sent only to Anthropic. Acceptable for a
personal/technical-user tool; revisit for any wider release.

## 13. Data model (actual, as persisted)

One JSON object under `localStorage["diligence_state_v1"]`:

```jsonc
{
  "profile": {
    "pmType": "B2B SaaS PM",
    "archetype": "b2b-saas",        // drives gate overlays
    "productName": "Holtara",
    "productLines": ["Corporate", "GP", "LP"],
    "setupComplete": true
  },
  "settings": {
    "apiKey": "sk-ant-...",          // local only; never leaves the browser except to Anthropic
    "model": "claude-opus-4-8"       // switchable to sonnet/haiku
  },
  "decisions": [
    {
      "id": "…",
      "title": "Introduce usage-based tier",
      "type": "pricing change",
      "productLines": ["GP", "LP"],
      "status": "active",            // active | shipped | killed | parked
      "currentGateOrder": 3,
      "createdAt": "…", "updatedAt": "…",
      "gates": [ /* SNAPSHOT of the composed funnel for this decision */
        { "order": 1, "key": "problem-evidence", "name": "…", "purpose": "…",
          "coreQuestion": "…", "evidenceBar": "…", "isValidationGate": true,
          "sections": [ { "key": "painPoint", "label": "Pain point description", "type": "textarea", "required": true, "placeholder": "…" }, … ] },
        …
      ],
      "evidence": [
        {
          "gateOrder": 1,
          "gateName": "Problem & evidence",
          "questionAsked": "…",                 // the (personalised) question shown
          "status": "provided",                  // provided | skipped
          "sections": [ { "key": "painPoint", "label": "…", "value": "…" }, … ],
          "skipReason": null,
          "timestamp": "…",
          "editedAt": "…"                        // present only if edited
        }
      ]
    }
  ]
}
```

Notes:
- **Gates are snapshotted per decision** (`decision.gates`). Legacy decisions without a
  snapshot fall back to the default funnel via `decisionGates()`.
- **Evidence is structured `sections`**, not a single string. This is how the original
  plan's "single response per gate" limitation (and the reviewer's multi-turn concern) is
  resolved: the ledger stores the *final synthesized evidence*; the probe follow-up is an
  ephemeral, non-blocking nudge that is not persisted as a transcript.

## 14. File map

```
src/
  main.jsx                  App entry; wraps <App/> in <StoreProvider/>
  App.jsx                   Routing (view state), storage-full banner
  index.css                 Tailwind entry + base styles

  config/
    gates.js                BASE spine + archetype/decision-type overlays + buildFunnel();
                            decisionGates/decisionGateAt/decisionTotal; gateSections;
                            ARCHETYPES, DECISION_TYPES, DECISION_STATUSES

  lib/
    storage.js              load/save the blob, export/import, emptyState, newId
    anthropic.js            BYOK browser client; per-gate system prompt; 3 calls
                            (generateGateQuestion, probeEvidence, getIdeationAngles);
                            robust JSON extraction; describeError
    diligence.js            computeDiligence, diligenceLabel, diligenceTags,
                            needsPostLaunchReview, decisionLines

  store/
    StoreContext.jsx        React context: state + actions (createDecision, recordEvidence,
                            editEvidence, updateDecision, deleteDecision, saveProfile,
                            saveSettings, importState); persistence + storageFull flag

  components/
    Setup.jsx               First-run profile capture (incl. archetype)
    Header.jsx              Title + compact backup controls + Settings
    SettingsModal.jsx       API key, model, and profile edit
    Backlog.jsx             Decision list, filters/sort, prominent backup card, New decision
    NewDecisionModal.jsx    Title/type + multi-select product lines ("All" option)
    DecisionView.jsx        One decision: gate panel + completion state + journey
    GatePanel.jsx           The gate interaction (sections, submit/skip, probe, ideation)
    Journey.jsx             Timeline of saved gates; inline Edit form per card
    DiligenceBadge.jsx      Segmented bar + label + qualitative tags
    BackupControls.jsx      Export/import (compact for header, prominent for backlog)
    ui.jsx                  Button, Field, Card, Pill, Skeleton, inputClass
```

## 15. AI integration

`src/lib/anthropic.js`:

- **Client:** `new Anthropic({ apiKey, dangerouslyAllowBrowser: true })`. The SDK adds the
  `anthropic-dangerous-direct-browser-access` header. **No `temperature`** (removed on Opus
  4.8/4.7 — would 400). Default model `claude-opus-4-8`, switchable in Settings.
- **System prompt** (`buildSystemPrompt`) assembles: the design principles as hard
  constraints, the PM profile, the current decision (incl. product lines), all prior
  evidence (rendered from `sections`, tolerant of legacy shape), and the current gate's
  purpose/question/bar.
- **Three calls:**
  1. `generateGateQuestion` → personalised question text (falls back to the static
     `coreQuestion` with no key or on error).
  2. `probeEvidence` → `{ meetsBar, followUp }` via prompted JSON + robust extraction; at
     most one follow-up; never blocks.
  3. `getIdeationAngles` → `{ angles: string[] }`, only on explicit request.
- **Errors:** `describeError` maps 401/429/5xx/CORS to friendly messages. Graceful
  degradation: with no key the whole funnel still works on static questions.

## 16. State & persistence

- `StoreProvider` holds the blob in React state and persists it on every change (one key,
  atomic write). Actions are pure transformations; advancement/skip live in
  `recordEvidence` (UI-driven, never AI-driven).
- **Backup:** `BackupControls` exports the blob to a JSON file and imports/replaces it —
  prominent on the backlog and compact in the header. This is the cross-device mechanism
  (export → OneDrive → import) and the insurance against a cleared browser.
- **Quota safeguard:** `localStorage` is ~5 MB/origin. `saveState` returns `false` on
  failure; the provider raises a `storageFull` banner prompting export + prune. In-memory
  data stays intact for the session.

## 17. Diligence computation

`src/lib/diligence.js` derives everything from a decision's evidence entries scaled to its
own snapshotted gate set: `computeDiligence` (counts + ratio + validation-skip count),
`diligenceLabel` (the text), `diligenceTags` (the qualitative archetypes, keyed off gate
*semantics* — `isValidationGate`, gate `key` — so they survive the per-decision funnels),
and `needsPostLaunchReview`.

---

# Part III — Operations

## 18. Local development

```bash
cd ProdLog
npm install      # first time
npm run dev      # localStorage works here (NOT in a Claude artifact sandbox)
npm run build    # static output in dist/
```

## 19. Deployment

- **GitHub Pages (live):** `.github/workflows/deploy-pages.yml` builds on push to `main`
  with `BASE_PATH=/<repo>/` and publishes. Pages source = "GitHub Actions". Requires a
  **public** repo on a Free plan. Live at https://kevinamato.github.io/prod-log/.
- **Cloudflare Pages (alt, supports private repos free):** connect the repo, build
  `npm run build`, output `dist`, base `/`. Or `npx wrangler pages deploy dist`.
- **Base path:** `vite.config.js` reads `BASE_PATH` (default `/` for Cloudflare/custom
  domains; `/repo/` for GitHub Pages project sites).

Each user pastes their own Anthropic key on the live site (Settings) — true $0 for the
operator.

## 20. Security & privacy

- The API key lives only in the user's `localStorage` and is sent only to Anthropic.
- No backend, no telemetry, no server-side storage of any decision data.
- The repo contains no secrets (BYOK), which is why it can be public.

## 21. Known limitations & roadmap

- **No cross-device sync** — by design ($0/no-backend). Manual export/import bridges it.
- **`localStorage` ceiling (~5 MB)** — mitigated by the quota banner + export/prune.
- **CORS fallback** — if direct browser calls ever break, a stateless Cloudflare Worker
  proxy that forwards the *user's* key is the documented mitigation (still BYOK, still ~$0).
- **Probe transcript not persisted** — the ledger stores final evidence only; capturing the
  probe Q&A is an optional future enrichment.
- **Future (out of v1):** other PM archetypes, a manager/team view (needs a free-tier
  backend such as Cloudflare D1 + Access), optional read-only share links, inline comments.

## 22. How the MVP architectural review was addressed

| Review point | Resolution |
|---|---|
| 3.1 Multi-turn schema gap | Resolved by design — structured `sections` per gate; probe is an ephemeral, non-blocking nudge; the ledger stores final synthesized evidence, never an overwritten/concatenated transcript. |
| 3.2 CORS / proxy | Direct BYOK with client-side error handling shipped; Worker proxy retained as the documented fallback. |
| 3.3 Export/import → Phase 1 | Done early, and promoted to a prominent backlog card. |
| 3.3 localStorage ceiling | Quota-aware save with a UI warning banner. |
| 4.1 De-gamify the indicator | Qualitative from the start; added archetype tags (Unvalidated / Sizing missing / Fully evidenced) instead of a number. |
| 5 Adversarial testing | Funnel, skips, tags, editing, and persistence verified end-to-end in a browser preview. |
