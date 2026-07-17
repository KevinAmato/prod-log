// Workspaces: named boards, each with its own local blob and (optionally) its
// own sync key. Collaboration IS the existing device-sync model — a workspace
// shared with someone else is just a sync key held by more than one person.
// Access control is knowledge of the key (192-bit random): you can only open
// a workspace you created or were handed a link to; there is nothing to
// enumerate server-side.
//
// The registry lives in its own localStorage entry (never synced — which
// workspaces YOU have is device-private). Switching workspaces reloads the
// page: the store loads once at boot, and a reload gives a clean undo history
// and zero cross-workspace state leaks for ~100 ms of blank screen.
//
// Invite links carry the key in the URL FRAGMENT (#join=…) — fragments never
// leave the browser (not sent to GitHub Pages, not logged), so the only copies
// are the chat message it was shared through and the recipient's device.

const REG_KEY = 'prodlog_workspaces_v1';
const LEGACY_SYNC_KEY = 'prodlog_sync_v1';
const HOME_ID = 'ws-home';

// Free-tier guard: each workspace is a KV entry + its share of the daily
// write quota. Ten is far beyond "colleagues + GF" and far below any quota.
export const MAX_WORKSPACES = 10;

const wsId = () => `ws-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function readReg() {
  try {
    return JSON.parse(localStorage.getItem(REG_KEY) || 'null');
  } catch {
    return null;
  }
}

function writeReg(reg) {
  try {
    localStorage.setItem(REG_KEY, JSON.stringify(reg));
  } catch {
    /* ignore */
  }
}

// First boot after this feature ships: fold the pre-workspace world (one
// board + the old global sync config) into workspace #1 unchanged — same
// storage key, same sync key, so existing devices keep syncing seamlessly.
export function getRegistry() {
  let reg = readReg();
  if (!reg || !Array.isArray(reg.list) || reg.list.length === 0) {
    let legacy = null;
    try {
      legacy = JSON.parse(localStorage.getItem(LEGACY_SYNC_KEY) || 'null');
    } catch {
      /* ignore */
    }
    reg = {
      active: HOME_ID,
      list: [
        {
          id: HOME_ID,
          name: 'My board',
          syncKey: legacy?.key || null,
          lastSyncAt: legacy?.lastSyncAt || null,
        },
      ],
    };
    writeReg(reg);
  }
  if (!reg.list.some((w) => w.id === reg.active)) reg.active = reg.list[0].id;
  return reg;
}

export function activeWorkspace() {
  const reg = getRegistry();
  return reg.list.find((w) => w.id === reg.active) || reg.list[0];
}

// The pre-workspace board key is kept for the home workspace so nothing moves.
export function boardStorageKey(id) {
  return id === HOME_ID ? 'prodlog_board_v1' : `prodlog_board_v1:${id}`;
}

export function updateWorkspace(id, patch) {
  const reg = getRegistry();
  writeReg({
    ...reg,
    list: reg.list.map((w) => (w.id === id ? { ...w, ...patch } : w)),
  });
}

// Returns the new workspace (caller switches + reloads). `syncKey` set when
// joining someone else's; null when creating a fresh local one.
export function addWorkspace(name, syncKey = null) {
  const reg = getRegistry();
  if (reg.list.length >= MAX_WORKSPACES) return null;
  const ws = { id: wsId(), name: name.trim() || 'Workspace', syncKey, lastSyncAt: null };
  writeReg({ ...reg, active: ws.id, list: [...reg.list, ws] });
  return ws;
}

export function setActiveWorkspace(id) {
  const reg = getRegistry();
  if (reg.list.some((w) => w.id === id)) writeReg({ ...reg, active: id });
}

// Leaving removes the registry entry AND the local blob. The shared copy on
// the relay (and everyone else's devices) is untouched — rejoin via the link.
export function removeWorkspace(id) {
  const reg = getRegistry();
  if (reg.list.length <= 1) return; // always keep one
  const list = reg.list.filter((w) => w.id !== id);
  writeReg({ ...reg, active: reg.active === id ? list[0].id : reg.active, list });
  try {
    localStorage.removeItem(boardStorageKey(id));
  } catch {
    /* ignore */
  }
}

// ── Invite links ─────────────────────────────────────────────────────────
export function inviteLink(ws) {
  if (!ws?.syncKey) return null;
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#join=${encodeURIComponent(ws.syncKey)}&n=${encodeURIComponent(ws.name)}`;
}

// Parses (and does NOT clear) a #join fragment. { key, name } or null.
export function parseJoinFragment() {
  const h = window.location.hash || '';
  if (!h.startsWith('#join=')) return null;
  const p = new URLSearchParams(h.slice(1));
  const key = (p.get('join') || '').trim();
  if (key.length < 16) return null;
  return { key, name: (p.get('n') || 'Shared board').slice(0, 60) };
}

export function clearJoinFragment() {
  window.history.replaceState({}, '', window.location.pathname + window.location.search);
}

export function findBySyncKey(key) {
  return getRegistry().list.find((w) => w.syncKey === key) || null;
}
