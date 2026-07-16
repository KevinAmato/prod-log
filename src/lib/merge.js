// Two-device state merge. Local-first design: the server blob is just another
// device's snapshot, so merging is symmetric.
//
// Rules, in order of importance:
//   1. Never lose a task: a card present on either side survives unless a
//      tombstone (recorded on permanent "Delete forever") says it was
//      intentionally destroyed.
//   2. Per-card last-write-wins: every card mutation stamps `updatedAt`, so
//      the newer edit of a given card wins wholesale (content, status,
//      column, subtasks).
//   3. The overall newer side (`lastModified`, stamped on every commit) wins
//      the tiebreaks that have no per-item clock: card ORDER, columns as a
//      set + their sort prefs, categories, prefs.
export function mergeStates(a, b) {
  const [win, lose] =
    (a.lastModified || '') >= (b.lastModified || '') ? [a, b] : [b, a];

  // ── Tombstones: union both sides (capped) ─────────────────────────────
  const tombCards = dedupe([
    ...(win.tombstones?.cards || []),
    ...(lose.tombstones?.cards || []),
  ]).slice(-300);
  const tombCols = dedupe([
    ...(win.tombstones?.columns || []),
    ...(lose.tombstones?.columns || []),
  ]).slice(-100);
  const deadCard = new Set(tombCards.map((t) => t.id));
  const deadCol = new Set(tombCols.map((t) => t.id));

  // ── Columns: winner's list, plus loser-only survivors appended ────────
  const columns = win.columns.filter((c) => !deadCol.has(c.id));
  for (const c of lose.columns) {
    if (!deadCol.has(c.id) && !columns.some((x) => x.id === c.id)) columns.push(c);
  }
  if (columns.length === 0) columns.push({ id: 'col-short', name: 'Short term' });

  // ── Cards: winner's order; per-card LWW; loser-only survivors appended ─
  const loseById = new Map(lose.cards.map((c) => [c.id, c]));
  const cards = [];
  for (const c of win.cards) {
    if (deadCard.has(c.id)) continue;
    const other = loseById.get(c.id);
    cards.push(other && (other.updatedAt || '') > (c.updatedAt || '') ? other : c);
  }
  const winIds = new Set(win.cards.map((c) => c.id));
  for (const c of lose.cards) {
    if (!winIds.has(c.id) && !deadCard.has(c.id)) cards.push(c);
  }

  // A merged-away column may leave orphans — reattach to the first column.
  const colIds = new Set(columns.map((c) => c.id));
  const fixed = cards.map((c) =>
    colIds.has(c.columnId) ? c : { ...c, columnId: columns[0].id },
  );

  return {
    ...win,
    columns,
    cards: fixed,
    categories: win.categories,
    prefs: win.prefs,
    tombstones: { cards: tombCards, columns: tombCols },
  };
}

// Content signature — everything that syncs (excludes lastModified, so a
// no-op merge compares equal and doesn't trigger a push loop).
export function stateSignature(s) {
  return JSON.stringify({
    c: s.columns,
    k: s.cards,
    g: s.categories,
    p: s.prefs,
    t: s.tombstones || { cards: [], columns: [] },
  });
}

function dedupe(tombs) {
  const seen = new Set();
  return tombs.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
}
