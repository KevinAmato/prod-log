# Implementation Plan — Product Decision Funnel ("Diligence")

**Companion to:** PRD v1
**Scope:** Single-user (self), zero-cost infrastructure, built in Cursor + Claude
**Audience:** You (the builder)

---

## 1. Guiding constraints

- **$0 running cost, at any scale.** No paid hosting, no database bill, no inference bill borne by you.
- **Bring-your-own-key (BYOK).** Each user supplies their own Anthropic API key, stored only in their browser. You never proxy or pay for inference. (For v1 that "each user" is just you.)
- **No backend.** Fully static site. All state lives in the browser.
- **Built in Cursor**, deployed to a free static host. (Note: browser `localStorage` does NOT work inside the Claude.ai artifact sandbox, but works perfectly on a real deployed site — so build and test this in Cursor against a local dev server / the live deploy, not in an artifact.)

## 2. Recommended stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **React + Vite** | Fast, simple, great Cursor support, trivial static build |
| Styling | **Tailwind CSS** | Speed; matches the minimalist UI goal |
| State | **React state + `localStorage`** | No DB needed; persistence is free and local |
| AI calls | **Anthropic Messages API**, called directly from the browser with the user's key | BYOK; zero cost to you |
| Hosting | **Cloudflare Pages** (or GitHub Pages / Netlify) | Free static hosting, free custom domain, generous limits |
| Repo | **GitHub** | Free, and Cloudflare Pages deploys from it on push |

**Why not a backend / serverless functions?** The moment you hold the API key server-side, *you* pay for every call. BYOK keeps it genuinely free and is the standard pattern for indie AI tools. Trade-off: the key sits in the user's browser — acceptable for a personal tool and for technical users; revisit if you ever productise.

## 3. Data model implementation

All persisted in `localStorage` as a single JSON blob under one key (e.g. `diligence_state_v1`), to keep writes atomic and simple.

```
{
  profile: {
    pmType: string,
    productName: string,
    productLines: string[],   // e.g. ["Enterprise", "Mid-market", "Self-serve"]
    setupComplete: boolean
  },
  decisions: [
    {
      id: string,
      title: string,
      type: string,
      productLine: string,
      status: "active" | "shipped" | "killed" | "parked",
      currentGateOrder: number,
      createdAt: ISOstring,
      updatedAt: ISOstring,
      evidence: [
        {
          gateOrder: number,
          questionAsked: string,
          response: string,
          status: "provided" | "skipped",
          skipReason: string | null,
          timestamp: ISOstring
        }
      ]
    }
  ],
  apiKey: string | null   // stored locally only; never sent anywhere except Anthropic
}
```

Gates themselves are a **static config array** in code (not user data) — see §4.

## 4. Gate configuration (static, in code)

A single `gates.js` config drives the whole funnel. Editing this file is how you tune the product.

```
export const GATES = [
  {
    order: 1,
    name: "Problem framing",
    purpose: "Is there a real, articulated problem?",
    coreQuestion: "What's the problem, and who specifically has it?",
    evidenceBar: "A clear problem statement plus the affected user/segment.",
    isValidationGate: false
  },
  {
    order: 2,
    name: "Problem validation",
    purpose: "Is it a real problem for real users, with evidence?",
    coreQuestion: "What evidence do you have that this is a real problem — not just a request?",
    evidenceBar: "User quotes, support tickets, or data. Not an internal opinion.",
    isValidationGate: true
  },
  // ... gates 3-9 per the PRD table
];
```

`isValidationGate: true` on gates 2 and 5 is what lets the backlog flag skipped validation more prominently.

## 5. The AI integration

### 5.1 The call
Direct `fetch` to `https://api.anthropic.com/v1/messages` from the browser, with the user's key in the header. (Anthropic's API supports CORS for direct browser calls; confirm the current header requirement for browser-based calls during build, as this occasionally changes.)

### 5.2 The system prompt (the heart of the product)
Assembled per gate from: the design principles (facilitate-don't-decide, feedback-first, never fabricate), the PM profile, the current decision, the current gate's `purpose` + `coreQuestion` + `evidenceBar`, and the evidence gathered so far.

Skeleton:

```
You are a sharp, supportive product-management mentor running a stage-gate
diligence review. You facilitate the PM's thinking — you never make the
decision, generate the evidence, or invent user feedback.

PM PROFILE: {profile}
CURRENT DECISION: {decision title, type, product line}
EVIDENCE SO FAR: {prior gate entries}
CURRENT GATE: {name} — purpose: {purpose}
Evidence bar for this gate: {evidenceBar}

Ask the core question, personalised to this PM and product. If the user's
response does not meet the evidence bar, ask AT MOST ONE probing follow-up,
then stop. Do not advance the gate yourself. Do not offer solution ideas
unless the user explicitly asks; if they do, frame them as options to react
to, never as the answer.
```

### 5.3 What the AI does NOT control
Advancement and skipping are **UI actions**, not AI decisions. The AI asks and probes; the user clicks "Provide evidence" or "Skip with reason." This keeps the audit trail clean and the AI within its facilitation role.

## 6. UI surfaces (minimalist)

1. **Setup screen** (first run): captures the profile. One screen, a few fields.
2. **API key screen / settings**: user pastes their Anthropic key; stored in `localStorage`. Clear note that it stays in their browser.
3. **Backlog view** (home): list/board of decisions, each with title, type, product line, current gate, status, and the diligence indicator. "New decision" button.
4. **Decision view**: the active funnel for one decision — current gate, the AI conversation for that gate, provide/skip controls, and the journey-so-far (prior gates with evidence/skips).
5. **Journey/detail view**: full timeline of a decision — every gate, question, evidence/skip, timestamp. (Can be the same screen as #4, scrolled.)

## 7. Build phases

### Phase 0 — Scaffold (½ day)
- Vite + React + Tailwind project in Cursor.
- GitHub repo, Cloudflare Pages connected, "hello world" deployed. Confirm the deploy pipeline works end to end before building features.

### Phase 1 — Local data layer, no AI (1 day)
- Implement the `localStorage` state blob, load/save helpers.
- Profile setup screen → writes profile.
- Create-decision flow → writes a decision.
- Backlog view reading from state.
- **Advance/skip gates manually with hardcoded questions** (no AI yet). This proves the whole funnel + evidence ledger + skip-tracking works before adding AI complexity.

### Phase 2 — AI layer (1–2 days)
- API key screen + storage.
- Wire the per-gate system prompt and the `fetch` call.
- Replace hardcoded questions with AI-asked, profile-personalised questions + the single probing follow-up.
- Keep provide/skip as UI actions.

### Phase 3 — Backlog intelligence (½–1 day)
- Diligence indicator per decision (provided vs skipped, with validation-gate skips highlighted).
- Filtering/sorting.
- Gate 9 post-launch review surfacing (e.g. nudge decisions that shipped but have no Gate 9 entry).

### Phase 4 — Polish & dogfood (ongoing)
- Use it for your real decisions at work.
- Tune `gates.js` questions and evidence bars based on what actually helps.
- Only after it changes your behaviour: consider generalising to other PM types.

## 8. Key risks & mitigations

| Risk | Mitigation |
|------|------------|
| Browser-direct Anthropic calls blocked by CORS or header rules | Verify during Phase 2; if blocked, a tiny Cloudflare Worker proxy that forwards the *user's* key (still BYOK, still ~$0 on free tier) is the fallback |
| API key in `localStorage` feels insecure | Fine for personal/technical-user v1; document it; revisit for any public release |
| Fully-dynamic AI questions break audit-trail consistency | Gates and core questions are fixed in `gates.js`; AI only personalises phrasing + one follow-up |
| Scope creep toward "AI writes my PRD" | The design principles explicitly forbid generation; keep provide/skip as human actions |
| `localStorage` data loss (cleared browser) | Add a simple JSON export/import button early so the user can back up their decision history |

## 9. First concrete step

Stand up Phase 0 and Phase 1 — a working funnel with manual, hardcoded questions and a real backlog with skip-tracking — *before* touching the AI. If the evidence ledger and skip-visibility don't feel useful on their own, the AI won't save it; if they do, the AI makes it shine.
