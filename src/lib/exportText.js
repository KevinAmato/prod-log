// Human-readable board export — plain-text or Markdown checklist. Complements
// the full-fidelity JSON backup (lib/storage.js): this is for SHARING (a
// status update, pasting into an external AI, archiving into a notes app),
// not restoring — it's one-way, lossy by design (only what's visible: live
// cards, in board order).
//
// Nesting: column header, then per task — title, an optional note line, then
// a "Subtasks" line with each subtask one level deeper. Markdown mode adds
// `- [ ]`/`- [x]` so Obsidian/Notion/GitHub render real checkboxes.
export function boardToText(state, { markdown = false, columnIds = null } = {}) {
  const cols = columnIds ? state.columns.filter((c) => columnIds.includes(c.id)) : state.columns;
  const catName = (id) => state.categories.find((c) => c.id === id)?.name;
  const box = (done) => (markdown ? (done ? '[x] ' : '[ ] ') : '');

  const lines = [];
  for (const col of cols) {
    const cards = state.cards.filter((c) => c.status === 'live' && c.columnId === col.id);
    if (!cards.length) continue;
    lines.push(`${col.name}`, '='.repeat(col.name.length));
    for (const c of cards) {
      const meta = [];
      if (c.dueDate) meta.push(`due ${c.dueDate}`);
      const cat = catName(c.categoryId);
      if (cat) meta.push(cat);
      const suffix = meta.length ? ` (${meta.join(', ')})` : '';
      lines.push(`- ${box(false)}${c.title}${suffix}`);
      if (c.note) lines.push(`  - Note: ${c.note.replace(/\s*\n\s*/g, ' ').trim()}`);
      if (c.subtasks.length) {
        lines.push('  - Subtasks');
        for (const t of c.subtasks) lines.push(`    - ${box(t.done)}${t.text}`);
      }
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}

// Copy-to-clipboard with the textarea fallback for non-secure contexts —
// same pattern used throughout the app wherever text is copied.
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
