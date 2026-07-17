// Client side of the Cloudflare Worker sync (sync-worker/). Local-first: the
// app never blocks on the network — sync pulls the server blob, merges it with
// local state (lib/merge.js), applies the result, and pushes it back with
// optimistic concurrency (baseRev; one merge-and-retry on 409).
//
// The sync key is the credential AND the identity: every device (and person)
// holding the same key converges on the same board. Since workspaces, the key
// lives on the active workspace's registry entry (lib/workspaces.js) — still
// never inside the synced blob itself.

import { mergeStates, stateSignature } from './merge.js';
import { activeWorkspace, updateWorkspace } from './workspaces.js';

// The deployed worker's public URL (sync-worker/, `wrangler deploy`).
export const DEFAULT_ENDPOINT = 'https://prodlog-sync.amatokevinp.workers.dev';

export function getSyncConfig() {
  const ws = activeWorkspace();
  return ws?.syncKey ? { key: ws.syncKey, lastSyncAt: ws.lastSyncAt || null } : null;
}

function stampSynced() {
  const ws = activeWorkspace();
  if (ws) updateWorkspace(ws.id, { lastSyncAt: new Date().toISOString() });
}

export function syncEnabled() {
  return !!activeWorkspace()?.syncKey;
}

// 192 bits of randomness, base64url, readable prefix for recognisability.
export function generateSyncKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const b64 = btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
  return `plog_${b64}`;
}

let inFlight = false;

// Pull → merge → apply → push. `apply` receives the merged state only when it
// differs from local. Returns { status, ... } and never throws on expected
// network errors — callers show one snack and move on.
export async function syncNow(state, apply) {
  const cfg = getSyncConfig();
  if (!cfg?.key) return { status: 'off' };
  if (inFlight) return { status: 'busy' };
  inFlight = true;
  try {
    const endpoint = `${DEFAULT_ENDPOINT}/state`;
    const headers = { 'X-Sync-Key': cfg.key };

    const pull = await fetch(endpoint, { headers });
    if (!pull.ok) return { status: 'error', detail: `pull ${pull.status}` };
    const remote = await pull.json(); // { rev, updatedAt, blob }

    let merged = remote.blob ? mergeStates(state, remote.blob) : state;
    const pulledChanges = stateSignature(merged) !== stateSignature(state);
    if (pulledChanges) apply(merged);

    // Nothing new to upload? (fresh server needs the first push even if equal)
    if (remote.blob && stateSignature(merged) === stateSignature(remote.blob)) {
      stampSynced();
      return { status: 'ok', pulled: pulledChanges, pushed: false };
    }

    let push = await doPut(endpoint, headers, remote.rev, merged);
    if (push.status === 409) {
      // Someone else pushed between our pull and push — merge theirs, retry once.
      const current = await push.json();
      merged = current.blob ? mergeStates(merged, current.blob) : merged;
      if (stateSignature(merged) !== stateSignature(state)) apply(merged);
      push = await doPut(endpoint, headers, current.rev, merged);
    }
    // Free-tier guards, distinct from generic failure so the UI can explain:
    // 429 = this board hit its daily write quota; 413 = board blob too big.
    if (push.status === 429) return { status: 'limited', pulled: pulledChanges };
    if (push.status === 413) return { status: 'toobig', pulled: pulledChanges };
    if (!push.ok) return { status: 'error', detail: `push ${push.status}` };

    stampSynced();
    return { status: 'ok', pulled: pulledChanges, pushed: true };
  } catch (err) {
    return { status: 'error', detail: err.message };
  } finally {
    inFlight = false;
  }
}

function doPut(endpoint, headers, baseRev, blob) {
  return fetch(endpoint, {
    method: 'PUT',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseRev, blob }),
  });
}
