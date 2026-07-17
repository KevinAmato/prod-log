// Rolling local debug log of AI exchanges. There's no server, so nothing
// about a chat is ever persisted anywhere reachable after the fact — this is
// what makes "what did the model actually return?" answerable later, from
// AI settings → "View activity log", instead of guessing from the outcome.
// Local-only: never synced, capped, and never includes the API key.
const LOG_KEY = 'prodlog_ai_log_v1';
const MAX_ENTRIES = 20;

export function getAiLog() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch {
    return [];
  }
}

export function logAiExchange(entry) {
  try {
    const log = getAiLog();
    log.push({ at: new Date().toISOString(), ...entry });
    localStorage.setItem(LOG_KEY, JSON.stringify(log.slice(-MAX_ENTRIES)));
  } catch {
    /* best-effort — never let logging break the chat */
  }
}

export function clearAiLog() {
  try {
    localStorage.removeItem(LOG_KEY);
  } catch {
    /* ignore */
  }
}
