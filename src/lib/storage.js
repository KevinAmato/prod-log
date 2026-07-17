// Single-key, single-blob localStorage persistence. One JSON object under one
// key keeps writes atomic and the whole data model trivially exportable.
//
// NOTE: the key is new (prodlog_board_v1) — the old Diligence blob, if present
// in this browser, is left untouched under its own key.

const STORAGE_KEY = 'prodlog_board_v1';

// Color-code categories: fixed palette, user-renamable labels.
export const DEFAULT_CATEGORIES = [
  { id: 'cat-red', color: '#ef4444', name: 'Urgent' },
  { id: 'cat-amber', color: '#f59e0b', name: 'Important' },
  { id: 'cat-blue', color: '#3b82f6', name: 'Deep work' },
  { id: 'cat-green', color: '#10b981', name: 'Quick win' },
  { id: 'cat-violet', color: '#8b5cf6', name: 'Waiting' },
  { id: 'cat-pink', color: '#ec4899', name: 'Personal' },
];

export const emptyState = () => ({
  // Column order = array order. Cards reference columns by id so renames are free.
  columns: [
    { id: 'col-short', name: 'Short term' },
    { id: 'col-long', name: 'Long term' },
  ],
  // Card order within a column = order of appearance in this array (filtered by
  // columnId). status: 'live' | 'done' | 'deleted' — done/deleted cards stay in
  // the array (they power the Done/Deleted boards) until destroyed forever.
  // Card: { id, columnId, title, note, status, createdAt, doneAt, deletedAt,
  //         dueDate: 'YYYY-MM-DD'|null, categoryId: string|null, collapsed,
  //         reminders: [{ id, at: 'YYYY-MM-DDTHH:mm' local, fired }],
  //         subtasks: [{ id, text, done, dueDate, reminders }] }
  // Columns also carry a per-column display sort: 'manual'|'due'|'az'|'za'.
  cards: [],
  categories: DEFAULT_CATEGORIES,
  prefs: {
    hideDoneSubtasks: false, // board-level filter
    filterCategoryId: null, // board-level: only show this color (null = all)
    filterOverdue: false, // board-level: only show overdue cards
  },
  // Recurring cleanup review (Menu → Cleanup schedule). Syncs like the rest.
  cleanup: { everyDays: null, time: '18:00', nextAt: null },
  // Sync merge metadata: lastModified stamps every commit; tombstones record
  // permanent deletions so another device's copy can't resurrect them.
  lastModified: null,
  tombstones: { cards: [], columns: [] },
});

// Older blobs predate dueDate/reminders/categoryId/collapsed/updatedAt —
// default them in.
const normalizeCard = (c) => ({
  note: '',
  dueDate: null,
  categoryId: null,
  collapsed: false,
  reminders: [],
  updatedAt: c.updatedAt || c.createdAt || null,
  ...c,
  subtasks: (c.subtasks || []).map((t) => ({ dueDate: null, reminders: [], ...t })),
});

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    if (!Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) return base;
    return {
      ...base,
      ...parsed,
      // eslint-disable-next-line no-unused-vars
      columns: (parsed.columns.length ? parsed.columns : base.columns).map(
        ({ sort, ...c }) => c, // `sort` was a short-lived display mode — now inert
      ),
      cards: parsed.cards.map(normalizeCard),
      categories:
        Array.isArray(parsed.categories) && parsed.categories.length
          ? parsed.categories
          : base.categories,
      prefs: { ...base.prefs, ...(parsed.prefs || {}) },
      cleanup: { ...base.cleanup, ...(parsed.cleanup || {}) },
      tombstones: {
        cards: parsed.tombstones?.cards || [],
        columns: parsed.tombstones?.columns || [],
      },
    };
  } catch (err) {
    console.error('[storage] Failed to load state, starting fresh:', err);
    return emptyState();
  }
}

// Returns true on success (localStorage is capped ~5 MB/origin).
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('[storage] Failed to save state:', err);
    return false;
  }
}

// Export / import — the cheap insurance against a cleared browser, and the way
// a board moves between devices (localStorage is per-device).
export function exportStateBlob(state) {
  return JSON.stringify(state, null, 2);
}

export function parseImportedBlob(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.columns) || !Array.isArray(parsed.cards)) {
    throw new Error('That file does not look like a ProdLog export.');
  }
  const base = emptyState();
  return {
    ...base,
    ...parsed,
    // eslint-disable-next-line no-unused-vars
    columns: (parsed.columns.length ? parsed.columns : base.columns).map(
      ({ sort, ...c }) => c,
    ),
    cards: parsed.cards.map(normalizeCard),
    categories:
      Array.isArray(parsed.categories) && parsed.categories.length
        ? parsed.categories
        : base.categories,
    prefs: { ...base.prefs, ...(parsed.prefs || {}) },
    cleanup: { ...base.cleanup, ...(parsed.cleanup || {}) },
    tombstones: {
      cards: parsed.tombstones?.cards || [],
      columns: parsed.tombstones?.columns || [],
    },
  };
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
