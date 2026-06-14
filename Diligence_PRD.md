# PRD — Product Decision Funnel (working title: "Diligence")

**Author:** Kevin Amato
**Status:** Draft v1 — single-user (self) scope
**Last updated:** June 2026

---

## 1. Problem

Product managers make dozens of consequential decisions — what to build, what to kill, what to deprioritise — but the *reasoning and evidence* behind those decisions is rarely captured in any structured way. Decisions live in scattered Slack threads, Notion docs, and people's heads.

This creates three problems:

1. **No audit trail.** When a decision is questioned months later ("why did we build this?"), the evidence chain is gone.
2. **Skipped diligence is invisible.** A PM can ship a feature with zero user validation and nobody notices until it fails. There's no mechanism that makes the *gaps* in rigour visible.
3. **No feedback loop on decision quality.** PMs and their managers have no structured way to see whether decisions are being made with appropriate diligence, or to improve over time.

Existing tools (Productboard, Jira, Notion, opportunity-mapping tools) capture *what* was decided or *what* will be built. None capture the **evidence-backed journey of a decision through a diligence funnel**, and none make skipped validation steps an explicit, tracked event.

## 2. Vision

A product decision funnel that works like a due-diligence checklist *and* a tracker. Every product decision a PM makes passes through a sequence of lifecycle gates. At each gate, the tool asks for evidence. The PM either provides it (stored, timestamped) or explicitly skips it (also stored, timestamped). The result is a living backlog of decisions, each with a complete, visible evidence trail — giving PMs and their leaders unprecedented visibility into the *quality* of product decision-making, and giving PMs a feedback loop to sharpen it.

**One-line positioning:** *An audit trail for product judgment.*

## 3. Design principles

1. **The AI facilitates, it does not decide.** The tool asks the right questions, enforces the gates, and structures the PM's own thinking into evidence. It never generates the insight or makes the call. Ideation suggestions are a last resort, only on explicit request, framed as prompts to react to.
2. **Feedback before solutioning.** The funnel is biased toward forcing real user/stakeholder validation *before* a decision advances to build. This is the core philosophical stance and the main differentiator versus generative "AI does your PRD" tools.
3. **Skipping is allowed but never hidden.** A PM can always skip a gate to keep momentum — but every skip is logged with a reason and surfaced in the backlog. Visibility, not enforcement, is the mechanism.
4. **Structured-but-adaptive.** Gates and the core question bank are predefined and consistent (so the audit trail is comparable across decisions). The AI personalises phrasing and asks probing follow-ups based on the PM's profile and product — but never invents the gates themselves.
5. **Minimalist UI.** The product is the funnel logic and the evidence ledger, not a heavy interface. Keep it clean and low-friction.

## 4. Target user (v1)

A single user: the author (Kevin), a B2B SaaS PM owning a multi-segment platform. The tool is tuned to real decisions being made at work. Generalisation to other PM types comes only after the tool demonstrably changes the author's own behaviour.

**Later (out of scope for v1):** other PM archetypes (growth PM, platform PM, 0-to-1 PM, etc.), and a manager/Head-of-Product view across a team's decisions.

## 5. Core concepts / data model

The data model *is* the product. Five entities:

### Decision
The thing being evaluated.
- `id`
- `title` (e.g. "Add bulk CSV export to GP dashboard")
- `type` (new feature / enhancement / kill-or-deprecate / pricing change / partnership / other)
- `product_line` (which part of the product it belongs to — derived from the PM profile setup)
- `status` (active / shipped / killed / parked)
- `current_gate` (which gate it's currently sitting at)
- `created_at`, `updated_at`

### Gate
A lifecycle stage every decision passes through (see §6 for the canonical set).
- `id`
- `name`
- `order`
- `purpose` (what this gate is meant to validate)

### Evidence Entry
One record per gate, per decision.
- `id`
- `decision_id`
- `gate_id`
- `question_asked` (the actual question the PM answered)
- `response` (the evidence the PM provided — free text, link, or attachment reference)
- `status` (provided / skipped)
- `skip_reason` (if skipped)
- `timestamp`

### Journey
The ordered history of a decision across all gates — derived from its Evidence Entries. Not stored separately; it's a view.

### Backlog
All decisions for the user, filterable and sortable, with an at-a-glance **diligence score** (proportion of gates with provided vs. skipped evidence). Not stored separately; it's a view.

## 6. The canonical decision funnel (gates)

The spine of the product. A decision moves top to bottom. Each gate has a *purpose* and an *evidence bar* (what counts as having cleared it).

| # | Gate | Purpose | Evidence bar (example) |
|---|------|---------|------------------------|
| 1 | **Problem framing** | Is there a real, articulated problem? | A clear problem statement + who has it |
| 2 | **Problem validation** | Is it a real problem for real users, evidenced? | User quotes, support tickets, data showing the pain — not just a request |
| 3 | **Strategic fit** | Does solving it align with product/company strategy? | Link to the strategic goal or OKR it serves |
| 4 | **Opportunity sizing** | Is it worth solving? | Rough reach/impact estimate, affected segments, $ where possible |
| 5 | **Solution validation** | Is the proposed solution desirable to users? | Feedback on the concept/prototype from real users before build |
| 6 | **Feasibility & risk** | Can we build it, and what are the risks? | Eng input, legal/infosec/compliance flags where relevant |
| 7 | **Prioritisation decision** | Why now, vs. other things? | The explicit trade-off made and against what |
| 8 | **Success definition** | How will we know if it worked? | Success metric(s) defined *before* build |
| 9 | **Post-launch review** | Did it work? What did we learn? | Actual outcome vs. predicted, retro note |

Notes:
- Gates 2 and 5 are the **validation gates** — the ones the "feedback first" principle most fiercely protects. Skipping these should be the most prominently flagged in the backlog.
- Gate 9 closes the loop and is what makes the tool a *learning* instrument, not just a capture tool.
- The set is fixed in v1; the AI adapts the *questions* within each gate to the PM profile, not the gates.

## 7. Key user flows

### 7.1 Onboarding / profile setup (first run)
1. User answers a short set of questions: what type of PM they are, what product/platform they own, what the main product lines/segments are.
2. This profile is stored and injected into the AI's context for every subsequent gate, so questions are tailored (e.g. it knows to ask about LP vs GP segments).
3. The backlog is initialised (empty).

### 7.2 Creating a decision
1. User clicks "New decision," gives it a title and type.
2. The decision enters the funnel at Gate 1.

### 7.3 Progressing a decision through a gate
1. The AI presents the current gate's purpose and asks a tailored question (or short series).
2. User provides evidence (text, link, or note) **or** chooses to skip.
   - If provided → evidence entry stored as `provided`, decision advances to next gate.
   - If skipped → user must give a one-line reason → entry stored as `skipped` → decision advances, but the skip is now part of the record.
3. The AI may ask one probing follow-up if the evidence looks thin (e.g. "That's a stakeholder request — do you have evidence it's a problem for end users?") but does **not** block; the user decides.
4. **Last-resort ideation:** only if the user explicitly asks ("I'm stuck, give me angles"), the AI offers options framed as prompts to react to — never as the decision.

### 7.4 Viewing the backlog
1. User sees all decisions in a list/board.
2. Each shows: title, type, product line, current gate, status, and a **diligence indicator** (e.g. "6/9 gates evidenced, 2 skipped — including 1 validation gate").
3. User can open any decision to see its full journey: every gate, every question, every piece of evidence or skip reason, timestamped.

### 7.5 (Future) Manager view
Out of scope for v1. Eventually: a Head of Product sees an aggregated view of a team's decisions and diligence patterns.

## 8. AI behaviour spec

- **Context the AI always has:** the PM profile (from onboarding), the current decision, the current gate and its purpose, and the evidence already gathered for this decision.
- **The AI's job per gate:** ask the gate's core question (personalised), evaluate whether the response meets the evidence bar, and ask *at most one* probing follow-up if it doesn't. Then let the user provide/skip.
- **Hard constraints:**
  - Never advance a gate on the user's behalf — the user provides or skips.
  - Never generate the evidence or invent user feedback.
  - Never fabricate that validation happened.
  - Only offer ideas when explicitly asked, and clearly label them as suggestions to react to.
- **Tone:** a sharp, supportive PM mentor doing a stage-gate review — direct, not sycophantic.

## 9. Success metrics (for the tool itself)

Since v1 is single-user, success = behaviour change in the author:
- Decisions are actually logged in the tool (adoption by self).
- Validation gates (2 and 5) are skipped *less* over time — the tool nudges more rigour.
- At least one real decision is changed or improved because the funnel surfaced a gap.
- Post-launch reviews (Gate 9) actually get filled in, closing loops that previously stayed open.

## 10. Out of scope (v1)

- Multi-user / team accounts and the manager view.
- Integrations (Jira, Notion, Slack) — manual entry only for now.
- Mobile-native app — responsive web is enough.
- Any server-side storage of user data or paid infrastructure (see implementation plan: bring-your-own-key, local storage).
- Generative PRD/artifact creation — deliberately excluded; this is a diligence tool, not a content generator.

## 11. Open questions

1. Should the diligence score be a single number or a more qualitative indicator? (Risk: a number gets gamed.)
2. Should some gates be skippable-but-with-a-nag vs. others hard-required? Current stance: all skippable, all logged.
3. For v1, is free-text evidence enough, or is link/attachment support needed on day one? (Leaning: text + links day one, attachments later.)
4. How much should the AI personalise the gate questions before it risks breaking audit-trail consistency?
