# Diligence — an audit trail for product judgment

A single-user **product-decision funnel**: every product decision passes through 9
lifecycle gates, and at each gate the tool asks for evidence. You either provide it
(stored, timestamped) or explicitly skip it (also stored, timestamped, and flagged
in the backlog). The result is a living backlog of decisions, each with a complete,
visible evidence trail.

Built per `Diligence_PRD.md` and `Diligence_Implementation_Plan.md`.

## Adaptive funnel (per decision)

The gate set is **not** fixed across decisions. `src/config/gates.js` composes a
base spine with two overlays:

- **PM archetype** (set in onboarding / Settings): a B2C / marketplace or growth
  PM gets analytics- & experiment-tilted validation/sizing/success gates; a B2B
  SaaS PM keeps qualitative user-evidence gates.
- **Decision type**: `pricing change` adds revenue/margin, price-testing,
  migration & comms gates; `kill-or-deprecate` swaps in a sunset/migration gate;
  `partnership` adds due-diligence and exit-terms gates.

The composed funnel is **snapshotted onto each decision at creation** (`decision.gates`)
and frozen for its life — so changing your archetype later, or editing the
config, never reshuffles a decision already in flight. Audit-trail integrity over
config churn.

## Deploy (free, BYOK for everyone)

The app is a static SPA, so giving others access costs you nothing — each person
brings their own Anthropic key (or runs key-free on the static questions), and
their data stays in their own browser.

- **Cloudflare Pages / Netlify:** connect the repo, build `npm run build`, output
  `dist`, base path `/`. Or one-shot: `npx wrangler pages deploy dist`.
- **GitHub Pages:** push to `main` — `.github/workflows/deploy-pages.yml` builds
  with the repo name as the base path and publishes automatically (set Pages
  source to "GitHub Actions" once).

## Design stance (enforced in code)

- **The AI facilitates, it never decides.** It asks the gate's question, evaluates
  evidence against the bar, and asks *at most one* probing follow-up. Advancing and
  skipping are **UI actions** (`recordEvidence` in the store), never AI actions.
- **Feedback before solutioning.** Gates 2 (Problem validation) and 5 (Solution
  validation) are `isValidationGate: true`; skipping them is flagged loudest.
- **Skipping is allowed but never hidden.** Every skip requires a one-line reason and
  surfaces in the backlog with a "validation skipped" pill.
- **Never fabricates.** The system prompt (`src/lib/anthropic.js`) forbids generating
  evidence, inventing user feedback, or claiming validation happened.

## Stack & cost

| Layer | Choice |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| State | React state + a single `localStorage` JSON blob (`diligence_state_v1`) |
| AI | Anthropic Messages API, **called directly from the browser with your own key** (BYOK) |
| Hosting | Any free static host (Cloudflare Pages / GitHub Pages / Netlify) |

**$0 running cost.** No backend, no database, no server-side key. Your Anthropic key
lives only in your browser and is sent only to Anthropic
(`dangerouslyAllowBrowser: true`). Default model is `claude-opus-4-8`; switch to
Sonnet/Haiku in Settings to lower BYOK spend.

> The funnel works **without** a key using the built-in gate questions — AI
> personalisation, probing, and ideation simply switch off until you add one.

## Run it

```bash
npm install
npm run dev      # local dev server (localStorage works here)
npm run build    # static output in dist/ — deploy as-is
```

> `localStorage` does **not** work inside the Claude.ai artifact sandbox. Run this on
> a local dev server or a real deploy, not in an artifact.

## Project structure

```
src/
  config/gates.js        # the 9-gate funnel — edit this to tune the product
  lib/storage.js         # single-blob localStorage load/save + export/import
  lib/anthropic.js       # BYOK browser client + the per-gate system prompt
  lib/diligence.js       # diligence scoring + post-launch-review detection
  store/StoreContext.jsx # state + actions (createDecision, recordEvidence, …)
  components/            # Setup, Backlog, DecisionView, GatePanel, Journey, …
```

## Backup

Use **Export** / **Import** in the header to save and restore your full decision
history as JSON — the insurance against a cleared browser wiping everything.
