// Due-date display helpers, shared by cards and subtasks.

export function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function isOverdue(dueDate) {
  return !!dueDate && dueDate < todayStamp();
}

// → { label, cls } chip descriptor, or null when no due date.
export function dueInfo(dueDate) {
  if (!dueDate) return null;
  const stamp = todayStamp();
  const label = new Date(`${dueDate}T12:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  if (dueDate < stamp) return { label, cls: 'bg-red-500/15 text-red-600' };
  if (dueDate === stamp) return { label: 'Today', cls: 'bg-amber-500/20 text-amber-700' };
  return { label, cls: 'bg-ink/5 text-ink/50' };
}
