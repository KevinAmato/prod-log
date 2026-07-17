import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  loadState,
  saveState,
  newId,
  parseImportedBlob,
} from '../lib/storage.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [storageFull, setStorageFull] = useState(false);

  // History-aware state for undo/redo. Each committed change pushes the prior
  // state onto `past` and clears `future`; undo/redo move between the stacks.
  // This also powers the snackbar's "Undo" after done/delete.
  const [hist, setHist] = useState(() => ({ past: [], present: loadState(), future: [] }));
  const state = hist.present;

  const setState = useCallback((updater) => {
    setHist((h) => {
      const next = typeof updater === 'function' ? updater(h.present) : updater;
      if (next === h.present) return h; // no-op action — don't record history
      // lastModified drives the "newer side" tiebreak in the sync merge.
      const stamped = { ...next, lastModified: new Date().toISOString() };
      return { past: [...h.past, h.present].slice(-60), present: stamped, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHist((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
  }, []);

  const redo = useCallback(() => {
    setHist((h) =>
      h.future.length
        ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) }
        : h,
    );
  }, []);

  // Theme — kept out of the undo history so Ctrl+Z doesn't flip dark mode.
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('diligence_theme') || 'light';
    } catch {
      return 'light';
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('diligence_theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggleTheme = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);

  // Persist the present blob on every change. One key, atomic write. If the
  // write fails (~5 MB localStorage quota), flag it so the UI can prompt an
  // export — the data in memory is still intact for this session.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStorageFull(!saveState(state));
  }, [state]);

  const actions = useMemo(() => {
    // Every card mutation flows through here, so per-card `updatedAt` (the
    // sync merge's last-write-wins clock) is stamped in one place.
    const patchCard = (s, id, fn) => ({
      ...s,
      cards: s.cards.map((c) =>
        c.id === id ? { ...fn(c), updatedAt: new Date().toISOString() } : c,
      ),
    });

    // The Done/Deleted boards render in array order (so they can be
    // drag-reordered like the live board), so a card landing there is hoisted
    // to the front — newest first by default. Harmless for live ordering: the
    // card isn't live anymore, and on restore it simply reappears on top.
    const hoist = (s, id) => {
      const card = s.cards.find((c) => c.id === id);
      if (!card) return s;
      return { ...s, cards: [card, ...s.cards.filter((c) => c.id !== id)] };
    };

    // A card leaving the live board keeps only its CURRENT name — the
    // Shorten undo stacks are working state, not archive material.
    const dropHistory = (c) => ({
      ...c,
      titleHistory: [],
      subtasks: (c.subtasks || []).map((t) => ({ ...t, textHistory: [] })),
    });

    return {
      // ── Columns ───────────────────────────────────────────────────────
      addColumn(name) {
        const id = newId();
        setState((s) => ({
          ...s,
          columns: [...s.columns, { id, name: name.trim() || 'New column' }],
        }));
        return id;
      },

      renameColumn(id, name) {
        const clean = name.trim();
        if (!clean) return;
        setState((s) => ({
          ...s,
          columns: s.columns.map((c) => (c.id === id ? { ...c, name: clean } : c)),
        }));
      },

      // Per-column view filter (category color and/or overdue-only).
      setColumnFilter(columnId, filter) {
        setState((s) => ({
          ...s,
          columns: s.columns.map((c) =>
            c.id === columnId
              ? { ...c, filter: filter.categoryId || filter.overdue ? filter : undefined }
              : c,
          ),
        }));
      },

      // One-shot sort: reorders the column's live cards IN the manual order
      // (drag keeps working afterwards — sorting is an action, not a mode).
      sortColumn(columnId, mode) {
        const cmp = {
          due: (a, b) => (a.dueDate || '9999-99-99').localeCompare(b.dueDate || '9999-99-99'),
          az: (a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }),
          za: (a, b) => b.title.localeCompare(a.title, undefined, { sensitivity: 'base' }),
        }[mode];
        if (!cmp) return;
        setState((s) => {
          const inCol = s.cards.filter((c) => c.columnId === columnId && c.status === 'live');
          const sorted = [...inCol].sort(cmp);
          if (sorted.every((c, i) => c === inCol[i])) return s; // already in order
          let i = 0;
          return {
            ...s,
            cards: s.cards.map((c) =>
              c.columnId === columnId && c.status === 'live' ? sorted[i++] : c,
            ),
          };
        });
      },

      // Live cards in a removed column move to the first remaining column so
      // nothing silently disappears. The UI blocks removing the last column.
      removeColumn(id) {
        setState((s) => {
          if (s.columns.length <= 1) return s;
          const columns = s.columns.filter((c) => c.id !== id);
          const fallback = columns[0].id;
          const now = new Date().toISOString();
          return {
            ...s,
            columns,
            cards: s.cards.map((c) =>
              c.columnId === id && c.status === 'live'
                ? { ...c, columnId: fallback, updatedAt: now }
                : c,
            ),
            // Tombstone so the sync merge doesn't resurrect the column.
            tombstones: {
              ...(s.tombstones || { cards: [], columns: [] }),
              columns: [...(s.tombstones?.columns || []), { id, at: now }].slice(-100),
            },
          };
        });
      },

      // ── Cards ─────────────────────────────────────────────────────────
      // Bulk-friendly: one commit per batch so a pasted list is a single undo.
      addCards(columnId, titles) {
        const clean = titles.map((t) => t.trim()).filter(Boolean);
        if (!clean.length) return;
        const now = new Date().toISOString();
        setState((s) => ({
          ...s,
          cards: [
            ...s.cards,
            ...clean.map((title) => ({
              id: newId(),
              columnId,
              title,
              note: '',
              status: 'live',
              createdAt: now,
              updatedAt: now,
              doneAt: null,
              deletedAt: null,
              dueDate: null,
              categoryId: null,
              collapsed: false,
              reminders: [],
              subtasks: [],
            })),
          ],
        }));
      },

      updateCard(id, patch) {
        setState((s) => patchCard(s, id, (c) => ({ ...c, ...patch })));
      },

      // Create one fully-specified card (used by the AI assistant so a task
      // with note/due/category/reminders/subtasks lands in ONE commit).
      addCardFull(columnId, data) {
        const id = newId();
        const now = new Date().toISOString();
        setState((s) => ({
          ...s,
          cards: [
            ...s.cards,
            {
              id,
              columnId,
              title: data.title,
              note: data.note || '',
              status: 'live',
              createdAt: now,
              updatedAt: now,
              doneAt: null,
              deletedAt: null,
              dueDate: data.dueDate || null,
              categoryId: data.categoryId || null,
              collapsed: false,
              reminders: data.reminders || [],
              subtasks: data.subtasks || [],
            },
          ],
        }));
        return id;
      },

      // Complete a card AND all its subtasks in one commit (used by the AI
      // assistant — atomic against current state, single undo step).
      completeCard(id) {
        setState((s) =>
          hoist(
            patchCard(s, id, (c) => ({
              ...dropHistory(c),
              subtasks: c.subtasks.map((t) => ({ ...t, done: true, textHistory: [] })),
              status: 'done',
              doneAt: new Date().toISOString(),
            })),
            id,
          ),
        );
      },

      // ── AI "Shorten" (title/text rewrite with a restore stack) ────────
      // The old value is pushed onto a bounded history so Restore can walk
      // back; both stacks are cleared when the card leaves the live board.
      setTitleWithHistory(cardId, title) {
        setState((s) =>
          patchCard(s, cardId, (c) =>
            title === c.title
              ? c
              : { ...c, title, titleHistory: [...(c.titleHistory || []), c.title].slice(-5) },
          ),
        );
      },

      restoreTitle(cardId) {
        setState((s) =>
          patchCard(s, cardId, (c) => {
            const hist = c.titleHistory || [];
            if (!hist.length) return c;
            return { ...c, title: hist[hist.length - 1], titleHistory: hist.slice(0, -1) };
          }),
        );
      },

      setSubtaskTextWithHistory(cardId, subId, text) {
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.map((t) =>
              t.id === subId && text !== t.text
                ? { ...t, text, textHistory: [...(t.textHistory || []), t.text].slice(-5) }
                : t,
            ),
          })),
        );
      },

      restoreSubtaskText(cardId, subId) {
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.map((t) => {
              if (t.id !== subId) return t;
              const hist = t.textHistory || [];
              if (!hist.length) return t;
              return { ...t, text: hist[hist.length - 1], textHistory: hist.slice(0, -1) };
            }),
          })),
        );
      },

      // Empty a whole archive board in ONE commit (one undo step), leaving
      // tombstones so a synced device can't resurrect any of them.
      destroyAll(status) {
        setState((s) => {
          const doomed = s.cards.filter((c) => c.status === status);
          if (!doomed.length) return s;
          const at = new Date().toISOString();
          return {
            ...s,
            cards: s.cards.filter((c) => c.status !== status),
            tombstones: {
              ...(s.tombstones || { cards: [], columns: [] }),
              cards: [
                ...(s.tombstones?.cards || []),
                ...doomed.map((c) => ({ id: c.id, at })),
              ].slice(-300),
            },
          };
        });
      },

      // Append-only note edit reading CURRENT state (safe in multi-action
      // assistant batches where the same card is touched twice).
      appendNote(id, text) {
        setState((s) =>
          patchCard(s, id, (c) => ({
            ...c,
            note: c.note ? `${c.note}\n\n${text}` : text,
          })),
        );
      },

      // Append a reminder to a card or one of its subtasks, atomically.
      addReminderTo(cardId, subId, reminder) {
        setState((s) =>
          patchCard(s, cardId, (c) =>
            subId
              ? {
                  ...c,
                  subtasks: c.subtasks.map((t) =>
                    t.id === subId ? { ...t, reminders: [...(t.reminders || []), reminder] } : t,
                  ),
                }
              : { ...c, reminders: [...(c.reminders || []), reminder] },
          ),
        );
      },

      // Remove one reminder from a card or one of its subtasks, atomically.
      // Used by the AI assistant to "change/reschedule" a reminder — it
      // removes the old one then adds the new one (there's no in-place edit).
      removeReminderFrom(cardId, subId, remId) {
        setState((s) =>
          patchCard(s, cardId, (c) =>
            subId
              ? {
                  ...c,
                  subtasks: c.subtasks.map((t) =>
                    t.id === subId
                      ? { ...t, reminders: (t.reminders || []).filter((r) => r.id !== remId) }
                      : t,
                  ),
                }
              : { ...c, reminders: (c.reminders || []).filter((r) => r.id !== remId) },
          ),
        );
      },

      // Guarded here too: a card is only done when every subtask is done.
      markDone(id) {
        setState((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card || card.subtasks.some((t) => !t.done)) return s;
          return hoist(
            patchCard(s, id, (c) => ({
              ...dropHistory(c),
              status: 'done',
              doneAt: new Date().toISOString(),
            })),
            id,
          );
        });
      },

      deleteCard(id) {
        setState((s) =>
          hoist(
            patchCard(s, id, (c) => ({
              ...dropHistory(c),
              status: 'deleted',
              deletedAt: new Date().toISOString(),
            })),
            id,
          ),
        );
      },

      // From Done or Deleted back to the live board. Falls back to the first
      // column if the card's column was removed in the meantime.
      restoreCard(id) {
        setState((s) => {
          const exists = (colId) => s.columns.some((c) => c.id === colId);
          return patchCard(s, id, (c) => ({
            ...c,
            status: 'live',
            doneAt: null,
            deletedAt: null,
            columnId: exists(c.columnId) ? c.columnId : s.columns[0].id,
          }));
        });
      },

      // Permanent removal — only reachable from the Deleted board, behind a
      // confirm in the UI. Leaves a tombstone so the sync merge doesn't
      // resurrect the card from another device's copy.
      destroyCard(id) {
        setState((s) => ({
          ...s,
          cards: s.cards.filter((c) => c.id !== id),
          tombstones: {
            ...(s.tombstones || { cards: [], columns: [] }),
            cards: [
              ...(s.tombstones?.cards || []),
              { id, at: new Date().toISOString() },
            ].slice(-300),
          },
        }));
      },

      // Reposition a card: `index` is the target slot among the LIVE cards of
      // `columnId` (Infinity/oversized = end). Used by drag-drop and the
      // move up/down/to-column menu.
      moveCard(id, columnId, index) {
        setState((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card) return s;
          const rest = s.cards.filter((c) => c.id !== id);
          const colCards = rest.filter((c) => c.columnId === columnId && c.status === 'live');
          const anchor = colCards[index];
          let gi;
          if (anchor) {
            gi = rest.indexOf(anchor);
          } else {
            const last = colCards[colCards.length - 1];
            gi = last ? rest.indexOf(last) + 1 : rest.length;
          }
          const moved = { ...card, columnId, updatedAt: new Date().toISOString() };
          return { ...s, cards: [...rest.slice(0, gi), moved, ...rest.slice(gi)] };
        });
      },

      // Same idea for the Done/Deleted boards: `index` is the target slot
      // among the cards sharing this card's status.
      moveArchiveCard(id, index) {
        setState((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card) return s;
          const rest = s.cards.filter((c) => c.id !== id);
          const peers = rest.filter((c) => c.status === card.status);
          const anchor = peers[index];
          let gi;
          if (anchor) {
            gi = rest.indexOf(anchor);
          } else {
            const last = peers[peers.length - 1];
            gi = last ? rest.indexOf(last) + 1 : rest.length;
          }
          return { ...s, cards: [...rest.slice(0, gi), card, ...rest.slice(gi)] };
        });
      },

      // ── Subtasks ──────────────────────────────────────────────────────
      addSubtasks(cardId, texts) {
        const clean = texts.map((t) => t.trim()).filter(Boolean);
        if (!clean.length) return;
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: [...c.subtasks, ...clean.map((text) => ({ id: newId(), text, done: false }))],
          })),
        );
      },

      toggleSubtask(cardId, subId) {
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.map((t) => (t.id === subId ? { ...t, done: !t.done } : t)),
          })),
        );
      },

      // Patch one subtask (due date, reminders, text).
      updateSubtask(cardId, subId, patch) {
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.map((t) => (t.id === subId ? { ...t, ...patch } : t)),
          })),
        );
      },

      removeSubtask(cardId, subId) {
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            subtasks: c.subtasks.filter((t) => t.id !== subId),
          })),
        );
      },

      // Mark a reminder as fired (called by the reminder engine, not the user).
      // Searches both the card's own reminders and every subtask's.
      markReminderFired(cardId, remId) {
        const fire = (rs) => (rs || []).map((r) => (r.id === remId ? { ...r, fired: true } : r));
        setState((s) =>
          patchCard(s, cardId, (c) => ({
            ...c,
            reminders: fire(c.reminders),
            subtasks: (c.subtasks || []).map((t) => ({ ...t, reminders: fire(t.reminders) })),
          })),
        );
      },

      // ── Categories (color codes) ──────────────────────────────────────
      renameCategory(id, name) {
        const clean = name.trim();
        if (!clean) return;
        setState((s) => ({
          ...s,
          categories: s.categories.map((c) => (c.id === id ? { ...c, name: clean } : c)),
        }));
      },

      // ── Prefs ─────────────────────────────────────────────────────────
      setPref(key, value) {
        setState((s) => ({ ...s, prefs: { ...s.prefs, [key]: value } }));
      },

      // ── Cleanup schedules ─────────────────────────────────────────────
      setCleanups(list) {
        setState((s) => ({ ...s, cleanups: list }));
      },

      updateCleanup(id, patch) {
        setState((s) => ({
          ...s,
          cleanups: (s.cleanups || []).map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      // ── Backup / restore ──────────────────────────────────────────────
      importState(text) {
        const next = parseImportedBlob(text);
        setState(next);
      },
      replaceState(next) {
        setState(next);
      },
    };
  }, []);

  const value = useMemo(
    () => ({
      state,
      actions,
      storageFull,
      theme,
      toggleTheme,
      undo,
      redo,
      canUndo: hist.past.length > 0,
      canRedo: hist.future.length > 0,
    }),
    [state, actions, storageFull, theme, toggleTheme, undo, redo, hist.past.length, hist.future.length],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
