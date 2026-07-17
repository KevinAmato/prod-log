// Board search. Deliberately transient: a query lives in React state, never in
// the synced blob — "what I'm looking for right now" isn't a preference, and
// syncing it would make one device's typing rewrite another's view.
//
// Composes with (never replaces) the per-column category/overdue filters: a
// card must satisfy BOTH. Multi-word queries are AND-ed, so "legal dpa" finds
// the task mentioning both, in any order, across title/note/subtasks.

export function queryTerms(q) {
  return String(q || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function cardMatches(card, terms) {
  if (!terms.length) return true;
  const hay = [card.title, card.note, ...(card.subtasks || []).map((t) => t.text)]
    .filter(Boolean)
    .join('\n')
    .toLowerCase();
  return terms.every((t) => hay.includes(t));
}
