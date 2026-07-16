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
      return { past: [...h.past, h.present].slice(-60), present: next, future: [] };
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
    const patchCard = (s, id, fn) => ({
      ...s,
      cards: s.cards.map((c) => (c.id === id ? fn(c) : c)),
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

      // Generic column patch — used for the per-column display sort.
      updateColumn(id, patch) {
        setState((s) => ({
          ...s,
          columns: s.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        }));
      },

      // Live cards in a removed column move to the first remaining column so
      // nothing silently disappears. The UI blocks removing the last column.
      removeColumn(id) {
        setState((s) => {
          if (s.columns.length <= 1) return s;
          const columns = s.columns.filter((c) => c.id !== id);
          const fallback = columns[0].id;
          return {
            ...s,
            columns,
            cards: s.cards.map((c) =>
              c.columnId === id && c.status === 'live' ? { ...c, columnId: fallback } : c,
            ),
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
              doneAt: null,
              deletedAt: null,
              subtasks: [],
            })),
          ],
        }));
      },

      updateCard(id, patch) {
        setState((s) => patchCard(s, id, (c) => ({ ...c, ...patch })));
      },

      // Guarded here too: a card is only done when every subtask is done.
      markDone(id) {
        setState((s) => {
          const card = s.cards.find((c) => c.id === id);
          if (!card || card.subtasks.some((t) => !t.done)) return s;
          return patchCard(s, id, (c) => ({
            ...c,
            status: 'done',
            doneAt: new Date().toISOString(),
          }));
        });
      },

      deleteCard(id) {
        setState((s) =>
          patchCard(s, id, (c) => ({
            ...c,
            status: 'deleted',
            deletedAt: new Date().toISOString(),
          })),
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
      // confirm in the UI.
      destroyCard(id) {
        setState((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) }));
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
          const moved = { ...card, columnId };
          return { ...s, cards: [...rest.slice(0, gi), moved, ...rest.slice(gi)] };
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
