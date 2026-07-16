# ProdLog — Project Paper

**A mobile-first personal task board. Capture product work in seconds, break it down, check it off.**

| | |
|---|---|
| **Status** | v1 rebuild (July 2026) — replaced the earlier "Diligence" decision-funnel app |
| **Repo** | https://github.com/KevinAmato/prod-log (public) |
| **Live app** | https://kevinamato.github.io/prod-log/ |
| **Author** | Kevin Amato |
| **Stack** | React + Vite + Tailwind, static SPA, `localStorage` — no backend, no accounts |
| **Running cost** | $0 |
| **Previous app** | The full Diligence funnel + mapping canvas is preserved on the `diligence-final` branch |

---

# Part I — The Product

## 1. Problem

PM work generates a constant stream of small commitments — follow-ups, drafts,
decisions, prep. Team tools (Jira, Trello) are built for *intra-team visibility* and
make personal capture slow: projects, tickets, fields, assignees. What's missing is a
**personal** tracker where getting a task in takes seconds, from a phone, with zero
ceremony.

## 2. Design principle

**Time-to-captured-task is the only metric.** Every interaction is optimised for: open
app → task is recorded → pocket the phone. No modals, no required fields beyond a
title, no navigation between capture and view.

## 3. Feature set (v1)

- **Board** of configurable columns (default: *Short term* / *Long term*). Add, rename
  (tap the name), remove (live tasks move to the first remaining column). Mobile:
  columns are full-width and swipe with scroll-snap; desktop: side by side.
- **Quick add** at the bottom of each column: one tap opens an autofocused input;
  **Enter saves and keeps the field open** for rapid entry; **pasting multiline text
  creates one task per line** (the "paste a list" flow). Same behaviour for subtasks.
- **Cards**: title, optional note, subtasks. A **+** on the card adds subtasks; every
  card and subtask has a large round checkbox.
- **Done discipline**: a card cannot be completed while subtasks are open (the card
  shakes and a toast says how many remain). Completing a card moves it to the **Done**
  board with an **Undo** snackbar.
- **Three boards** — *Live / Done / Deleted* — switched by a segmented control.
  Unchecking a card in Done restores it. Deleted cards can be restored or deleted
  forever (confirm required).
- **Board-level filter**: *Hide done* hides completed subtasks on live cards.
- **Prioritisation**: drag & drop on desktop; *Move up / Move down / Move to column*
  in the card's ⋯ menu (works on touch).
- **Undo/redo everywhere**: Ctrl/Cmd+Z / Ctrl+Y, plus Undo snackbars on destructive
  actions. Bulk paste is a single undo step.
- **Dark mode**, **export/import backup** (JSON file — also the way a board moves
  between devices).

## 4. Deliberate non-features

- No accounts, no sync, no sharing — single user, local-first (localStorage).
- No due dates, labels, estimates, or priorities-as-fields — order *is* priority.
- No AI (v1). Voice capture is a candidate v2 feature (Web Speech API).

---

# Part II — Architecture

## 5. Data model (one localStorage blob, key `prodlog_board_v1`)

```js
{
  columns: [{ id, name }],                    // order = array order
  cards: [{
    id, columnId, title, note,
    status: 'live' | 'done' | 'deleted',      // done/deleted stay in the array
    createdAt, doneAt, deletedAt,
    subtasks: [{ id, text, done }],
  }],                                          // order within a column = array order
  prefs: { hideDoneSubtasks: bool },
}
```

The old Diligence blob (`diligence_state_v1`) is untouched — different key.

## 6. Code map (`src/`)

| File | Role |
|---|---|
| `lib/storage.js` | load/save/export/import of the blob, `newId()` |
| `store/StoreContext.jsx` | history-aware store (undo/redo stacks), theme, all actions |
| `components/QuickAdd.jsx` | the capture input — Enter-repeats + multiline-paste splitting |
| `components/TaskCard.jsx` | card row, subtasks, done-guard, ⋯ menu, drag source/target |
| `components/Column.jsx` | column header (rename/menu), card list, drop target, quick add |
| `components/Board.jsx` | live board, snap-scroll layout, add column |
| `components/ArchiveList.jsx` | Done + Deleted boards, restore / delete forever |
| `components/Header.jsx` | brand, Hide-done filter, theme, backup menu, view switcher |
| `components/Snackbar.jsx` | toast + Undo action |
| `components/CheckCircle.jsx` | the 44px-hit-area round checkbox |

Every store action commits one history entry, so any batch (paste of 10 tasks) is one
Ctrl+Z.

---

# Part III — Operations

- **Dev**: `npm run dev` (Vite, port 5173). **Build**: `npm run build`.
- **Deploy**: push to `main` → `.github/workflows/deploy-pages.yml` builds with
  `BASE_PATH=/prod-log/` and publishes to GitHub Pages.
- **Limitations**: localStorage is per-browser/per-device (~5 MB). The app warns when
  the quota is hit; backup/export is the recovery path.
