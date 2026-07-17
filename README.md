# Pino

A mobile-first personal task board. Capture product work in seconds, break it
down into subtasks, check it off — from your phone or desktop, in sync.

Full product write-up: [`DOCUMENTATION/Pino-Project-Paper.md`](DOCUMENTATION/Pino-Project-Paper.md).

> Formerly **ProdLog**, and before that a completely different app called
> **Diligence** (a product-decision funnel — see
> `DOCUMENTATION/Diligence-Project-Paper-ARCHIVED.md` and the
> `diligence-final` branch). The current task-board product has no relation
> to either beyond sharing this repo and some infrastructure.

## What it does

- **Board** of configurable columns, drag-reorderable cards with subtasks,
  due dates, reminders, and six renamable color categories.
- **Quick capture**: tap a column to add a task; paste a multiline list to
  create one task per line; the same paste-splitting works for subtasks.
- **Done / Deleted boards** — nothing is destroyed without a confirm; both
  are drag-reorderable and have their own restore/move actions.
- **Cross-device sync** via a small Cloudflare Worker relay, keyed by a
  secret you generate in-app — no accounts.
- **Cleanup schedules**: recurring nudges (daily/weekly/custom, optionally
  scoped to a category) that walk you through the board one task at a time.
- **AI assistant (BYOK)**: bring your own Anthropic/OpenAI/Gemini key and
  manage the board by chat or voice — create, complete, delete, reschedule,
  reorganise. Runs entirely from your browser to the provider's API.
- **Installable PWA** with offline support.

## Stack & cost

| Layer | Choice |
|---|---|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| State | React state + a single `localStorage` JSON blob (`prodlog_board_v1`) |
| Sync | Cloudflare Worker + KV (`sync-worker/`) — free tier |
| AI | Anthropic / OpenAI / Gemini, called directly from the browser with your own key (BYOK) |
| Hosting | GitHub Pages (static) |

**$0 running cost.** No backend beyond the tiny sync relay, no database, no
server-side AI key. Everything works with zero keys configured — sync and
the AI assistant are both opt-in.

## Run it

```bash
npm install
npm run dev      # local dev server, http://localhost:5173
npm run build    # static output in dist/ — deploy as-is
```

Push to `main` and `.github/workflows/deploy-pages.yml` builds and deploys
automatically (Settings → Pages → Source = "GitHub Actions").

## Project structure

```
src/
  lib/storage.js          # single-blob localStorage load/save/export/import
  lib/sync.js, merge.js   # cross-device sync + conflict merge
  lib/assistant.js        # AI system prompt, action schema, executor
  lib/ai.js                # multi-provider BYOK chat client
  lib/cleanup.js           # recurring cleanup-schedule logic
  store/StoreContext.jsx   # state + actions, undo/redo history
  components/              # Board, Column, TaskCard, ArchiveList, AiChat, …
sync-worker/                # Cloudflare Worker: the sync relay (separate deploy)
```

## Backup

Menu → **Import backup** / **Export backup** saves and restores your full
board as JSON — the insurance against a cleared browser, and a manual way to
move a board between devices if you'd rather not use sync.
