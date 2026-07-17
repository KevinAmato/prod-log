// The AI assistant's brain-adjacent plumbing: the numbered board snapshot the
// model sees, the system prompt (function, guardrails, action schema), and the
// executor that turns the model's JSON actions into store mutations.
//
// Protocol: provider-agnostic JSON-in-text (works with any BYOK model — same
// approach as ThreadPatrol's BYOM, no per-provider tool-calling schemas).
// The model replies ONLY with { reply, actions[] }; every task reference is a
// NUMBER from the snapshot ("7" or "7.2"), so resolution is exact. Fuzzy title
// matching exists as a fallback for models that reference by name anyway.

import { newId } from './storage.js';
import { toLocalInput } from './reminders.js';

// ── Numbering ────────────────────────────────────────────────────────────
// Global top-to-bottom order: columns left→right, live cards top→bottom.
// 1-based; subtasks are n.m over the card's full subtask array. Numbers are
// display indexes — they shift when cards move, and both the UI chips and the
// snapshot are rebuilt from the same function so they always agree.
export function numberCards(state) {
  const map = new Map(); // cardId → n
  let n = 0;
  for (const col of state.columns) {
    for (const c of state.cards) {
      if (c.status === 'live' && c.columnId === col.id) map.set(c.id, ++n);
    }
  }
  return map;
}

export function buildSnapshot(state) {
  const numbers = numberCards(state);
  const byNumber = new Map(); // n → card
  const tasks = [];
  for (const col of state.columns) {
    for (const c of state.cards) {
      if (c.status !== 'live' || c.columnId !== col.id) continue;
      const n = numbers.get(c.id);
      byNumber.set(n, c);
      tasks.push({
        n,
        title: c.title,
        column: col.name,
        due: c.dueDate || undefined,
        category: state.categories.find((k) => k.id === c.categoryId)?.name,
        note: c.note ? c.note.slice(0, 300) : undefined,
        reminders: (c.reminders || []).filter((r) => !r.fired).map((r) => r.at),
        subtasks: c.subtasks.length
          ? c.subtasks.map((t, i) => ({
              n: `${n}.${i + 1}`,
              text: t.text,
              done: t.done,
              due: t.dueDate || undefined,
            }))
          : undefined,
      });
    }
  }
  return {
    byNumber,
    json: {
      columns: state.columns.map((c, i) => ({
        name: c.name,
        position: i + 1,
        filter: c.filter?.categoryId
          ? state.categories.find((k) => k.id === c.filter.categoryId)?.name
          : undefined,
      })),
      categories: state.categories.map((k) => k.name),
      tasks,
    },
  };
}

// ── System prompt ────────────────────────────────────────────────────────
export function buildSystemPrompt(state) {
  const { json } = buildSnapshot(state);
  const now = new Date();
  return `You are the assistant inside ProdLog, a personal task board. You help the user manage tasks by voice or text: create, complete, delete, annotate, schedule and categorise. Be brief and friendly; confirm what you did.

CURRENT LOCAL TIME: ${toLocalInput(now)} (${Intl.DateTimeFormat().resolvedOptions().timeZone}). Resolve relative times ("tomorrow 9am", "in 2 hours") against this.

BOARD (live tasks, numbered):
${JSON.stringify(json)}

Each task has a number n; subtasks are "n.m". The user may reference tasks by number ("task 7", "7.2") or by approximate name — match it to the snapshot yourself and use the NUMBER in your actions. If a name matches multiple tasks or none, ask instead of guessing.

RESPOND WITH ONLY A JSON OBJECT, no other text:
{"reply": "<short conversational answer>", "actions": [ ...zero or more... ]}

ACTIONS:
- {"type":"create_task","title":string,"column"?:string,"note"?:string,"due"?:"YYYY-MM-DD","category"?:string,"reminders"?:["YYYY-MM-DDTHH:mm"],"subtasks"?:[string]}
- {"type":"add_subtasks","task":n,"texts":[string]}
- {"type":"complete_task","task":n}            // also completes its open subtasks — say so in reply
- {"type":"complete_subtask","task":"n.m"}
- {"type":"delete_task","task":n}              // moves to the Deleted board (recoverable)
- {"type":"delete_subtask","task":"n.m"}
- {"type":"rename_task","task":n,"title":string}   // ONLY when the user explicitly asks to rename/edit the title
- {"type":"add_note","task":n,"text":string}   // append-only; the app prefixes "Bot update:" automatically
- {"type":"set_due","task":n or "n.m","due":"YYYY-MM-DD" or null}
- {"type":"add_reminder","task":n or "n.m","at":"YYYY-MM-DDTHH:mm"}
- {"type":"remove_reminder","task":n or "n.m","at":"YYYY-MM-DDTHH:mm"}   // "at" must exactly match an existing reminder from the snapshot above
- {"type":"set_category","task":n,"category":string or null}
- {"type":"filter_column","column":string or "all","category":string or null,"overdue"?:boolean}

RULES:
- New tasks go to the FIRST column ("${state.columns[0]?.name}") unless the user names a column.
- There is no in-place edit for a reminder. To CHANGE/UPDATE/RESCHEDULE one,
  call remove_reminder with its exact current "at" (copy it from the snapshot),
  then add_reminder with the new time — two actions for one user request. If
  the task has exactly one pending reminder and the user just says "change
  the reminder" without saying which, that one is unambiguous — remove it.
  Example: task 5's snapshot shows reminders ["2026-07-20T09:00"] and the user
  says "change task 5's reminder to 10am" → remove_reminder task 5 at
  "2026-07-20T09:00", then add_reminder task 5 at "2026-07-20T10:00".
- Never rename a task unless explicitly asked to rename/change its title.
- Notes are append-only — you can add, never remove or rewrite.
- You CANNOT sort tasks. If asked to sort, say the column menu (⇅) does that.
- You cannot permanently destroy anything; "delete" moves to the Deleted board.
- Category and column names may be approximate — match to the snapshot.
- If the request is ambiguous, ask a clarifying question with empty actions.`;
}

// ── Executor ─────────────────────────────────────────────────────────────
const norm = (s) => String(s || '').toLowerCase().trim();

function fuzzyFind(list, name, getLabel) {
  const q = norm(name);
  if (!q) return { error: 'empty reference' };
  const exact = list.filter((x) => norm(getLabel(x)) === q);
  if (exact.length === 1) return { hit: exact[0] };
  const partial = list.filter(
    (x) => norm(getLabel(x)).includes(q) || q.includes(norm(getLabel(x))),
  );
  if (partial.length === 1) return { hit: partial[0] };
  if (partial.length > 1) return { error: `"${name}" matches ${partial.length} items` };
  return { error: `couldn't find "${name}"` };
}

// Resolve "7", 7, or "7.2" (or a title string as fallback) against a snapshot.
function resolveRef(ref, snapshot, state) {
  const s = String(ref ?? '').trim();
  const m = s.match(/^(\d+)(?:\.(\d+))?$/);
  if (m) {
    const card = snapshot.byNumber.get(Number(m[1]));
    if (!card) return { error: `no task #${m[1]}` };
    if (m[2]) {
      const sub = card.subtasks[Number(m[2]) - 1];
      if (!sub) return { error: `no subtask ${s}` };
      return { card, sub };
    }
    return { card };
  }
  const live = state.cards.filter((c) => c.status === 'live');
  const found = fuzzyFind(live, s, (c) => c.title);
  return found.hit ? { card: found.hit } : { error: found.error };
}

function resolveColumn(name, state) {
  return fuzzyFind(state.columns, name, (c) => c.name);
}
function resolveCategory(name, state) {
  return fuzzyFind(state.categories, name, (c) => c.name);
}

// Executes the model's actions against the store. Returns human-readable
// receipt strings (✓/✗ prefixed) for the chat UI.
export function executeActions(rawActions, snapshot, state, actions) {
  const receipts = [];
  const ok = (msg) => receipts.push(`✓ ${msg}`);
  const fail = (msg) => receipts.push(`✗ ${msg}`);

  for (const a of Array.isArray(rawActions) ? rawActions : []) {
    try {
      switch (a.type) {
        case 'create_task': {
          if (!a.title?.trim()) {
            fail('create_task without a title');
            break;
          }
          let columnId = state.columns[0].id;
          let colName = state.columns[0].name;
          if (a.column) {
            const r = resolveColumn(a.column, state);
            if (r.hit) {
              columnId = r.hit.id;
              colName = r.hit.name;
            }
          }
          let categoryId = null;
          if (a.category) {
            const r = resolveCategory(a.category, state);
            if (r.hit) categoryId = r.hit.id;
          }
          actions.addCardFull(columnId, {
            title: a.title.trim(),
            note: a.note ? `Bot update: ${a.note}` : '',
            dueDate: a.due || null,
            categoryId,
            reminders: (a.reminders || []).map((at) => ({ id: newId(), at, fired: false })),
            subtasks: (a.subtasks || []).map((t) => ({
              id: newId(),
              text: String(t),
              done: false,
              dueDate: null,
              reminders: [],
            })),
          });
          ok(`Created "${a.title.trim()}" in ${colName}`);
          break;
        }

        case 'add_subtasks': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`add subtasks: ${r.error}`);
            break;
          }
          const texts = (a.texts || []).map(String).filter(Boolean);
          actions.addSubtasks(r.card.id, texts);
          ok(`Added ${texts.length} subtask${texts.length === 1 ? '' : 's'} to "${r.card.title}"`);
          break;
        }

        case 'complete_task': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`complete: ${r.error}`);
            break;
          }
          // Atomic: marks all subtasks done + the card done against CURRENT
          // state (an earlier action in this batch may have added subtasks).
          actions.completeCard(r.card.id);
          ok(`Completed "${r.card.title}" (subtasks included)`);
          break;
        }

        case 'complete_subtask': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.sub) {
            fail(`complete subtask: ${r.error || 'reference has no subtask part'}`);
            break;
          }
          actions.updateSubtask(r.card.id, r.sub.id, { done: true });
          ok(`Checked off "${r.sub.text}" in "${r.card.title}"`);
          break;
        }

        case 'delete_task': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`delete: ${r.error}`);
            break;
          }
          actions.deleteCard(r.card.id);
          ok(`Deleted "${r.card.title}" (recoverable from the Deleted board)`);
          break;
        }

        case 'delete_subtask': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.sub) {
            fail(`delete subtask: ${r.error || 'reference has no subtask part'}`);
            break;
          }
          actions.removeSubtask(r.card.id, r.sub.id);
          ok(`Removed subtask "${r.sub.text}" from "${r.card.title}"`);
          break;
        }

        case 'rename_task': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`rename: ${r.error}`);
            break;
          }
          if (!a.title?.trim()) {
            fail('rename without a new title');
            break;
          }
          actions.updateCard(r.card.id, { title: a.title.trim() });
          ok(`Renamed "${r.card.title}" → "${a.title.trim()}"`);
          break;
        }

        case 'add_note': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`note: ${r.error}`);
            break;
          }
          actions.appendNote(r.card.id, `Bot update: ${String(a.text || '').trim()}`);
          ok(`Added a note to "${r.card.title}"`);
          break;
        }

        case 'set_due': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`due date: ${r.error}`);
            break;
          }
          const due = a.due || null;
          if (r.sub) {
            actions.updateSubtask(r.card.id, r.sub.id, { dueDate: due });
            ok(`Due ${due || 'cleared'} on subtask "${r.sub.text}"`);
          } else {
            actions.updateCard(r.card.id, { dueDate: due });
            ok(`Due ${due || 'cleared'} on "${r.card.title}"`);
          }
          break;
        }

        case 'add_reminder': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`reminder: ${r.error}`);
            break;
          }
          if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(String(a.at || ''))) {
            fail(`reminder time "${a.at}" is not YYYY-MM-DDTHH:mm`);
            break;
          }
          const rem = { id: newId(), at: a.at.slice(0, 16), fired: false };
          actions.addReminderTo(r.card.id, r.sub?.id || null, rem);
          ok(
            `Reminder ${rem.at.replace('T', ' ')} on ${r.sub ? `subtask "${r.sub.text}"` : `"${r.card.title}"`}`,
          );
          break;
        }

        case 'remove_reminder': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`remove reminder: ${r.error}`);
            break;
          }
          const target = r.sub || r.card;
          const list = target.reminders || [];
          // Exact match preferred; if there's only one reminder on this item,
          // that's an unambiguous match even if the model's "at" is slightly off.
          const match = list.find((x) => x.at === a.at) || (list.length === 1 ? list[0] : null);
          const who = r.sub ? `subtask "${r.sub.text}"` : `"${r.card.title}"`;
          if (!match) {
            fail(
              `remove reminder: no reminder at "${a.at}" on ${who} (existing: ${list.map((x) => x.at).join(', ') || 'none'})`,
            );
            break;
          }
          actions.removeReminderFrom(r.card.id, r.sub?.id || null, match.id);
          ok(`Removed the ${match.at.replace('T', ' ')} reminder on ${who}`);
          break;
        }

        case 'set_category': {
          const r = resolveRef(a.task, snapshot, state);
          if (!r.card) {
            fail(`category: ${r.error}`);
            break;
          }
          if (a.category == null) {
            actions.updateCard(r.card.id, { categoryId: null });
            ok(`Cleared the color on "${r.card.title}"`);
            break;
          }
          const c = resolveCategory(a.category, state);
          if (!c.hit) {
            fail(`category: ${c.error}`);
            break;
          }
          actions.updateCard(r.card.id, { categoryId: c.hit.id });
          ok(`"${r.card.title}" → ${c.hit.name}`);
          break;
        }

        case 'filter_column': {
          let categoryId = null;
          let catName = null;
          if (a.category != null) {
            const c = resolveCategory(a.category, state);
            if (!c.hit) {
              fail(`filter: ${c.error}`);
              break;
            }
            categoryId = c.hit.id;
            catName = c.hit.name;
          }
          const patch = { categoryId, overdue: !!a.overdue };
          const targets =
            norm(a.column) === 'all' || !a.column
              ? state.columns
              : (() => {
                  const r = resolveColumn(a.column, state);
                  return r.hit ? [r.hit] : null;
                })();
          if (!targets) {
            fail(`filter: couldn't find column "${a.column}"`);
            break;
          }
          targets.forEach((col) => actions.setColumnFilter(col.id, patch));
          const what = catName ? `to ${catName}` : a.overdue ? 'to overdue' : 'cleared';
          ok(
            `Filter ${what} on ${targets.length === state.columns.length ? 'all columns' : `"${targets[0].name}"`}`,
          );
          break;
        }

        default:
          fail(`unknown action "${a.type}"`);
      }
    } catch (err) {
      fail(`${a.type} failed: ${err.message}`);
    }
  }
  return receipts;
}
