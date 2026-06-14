// Single-key, single-blob localStorage persistence. One JSON object under one
// key keeps writes atomic and the whole data model trivially exportable.
//
// NOTE: localStorage does NOT work inside the Claude.ai artifact sandbox, but
// works perfectly on a real deployed site or local dev server — so run this in
// Cursor / `npm run dev` / the live deploy, not in an artifact.

const STORAGE_KEY = 'diligence_state_v1';

export const emptyState = () => ({
  profile: {
    pmType: '',
    archetype: 'b2b-saas', // drives gate overlays — see config/gates.js
    productName: '',
    productLines: [],
    setupComplete: false,
  },
  decisions: [],
  settings: {
    apiKey: null, // stored locally only; never sent anywhere except Anthropic
    model: 'claude-opus-4-8',
  },
  // Mapping/Roadmap canvas. `elements` holds every canvas item:
  //  - initiative: { id, type:'initiative', decisionId, x, y, style, comment }
  //      (content read live from `decisions`; presence here == "placed")
  //  - shape:      { id, type:'shape', shape, x, y, width, height, text, style, comment }
  //  - text:       { id, type:'text', x, y, width, text, style, comment }
  // Edges: { id, source, target, comment }. Layout only — never duplicates
  // initiative content.
  map: {
    elements: [],
    edges: [],
  },
});

// Tolerates the legacy `{ nodes: {decisionId:{x,y}}, edges }` shape and upgrades
// it to the unified `elements` model.
export function normalizeMap(m) {
  if (!m || typeof m !== 'object') return { elements: [], edges: [] };
  const edges = Array.isArray(m.edges) ? m.edges : [];
  if (Array.isArray(m.elements)) return { elements: m.elements, edges };
  const elements = [];
  if (m.nodes && typeof m.nodes === 'object') {
    for (const [decisionId, pos] of Object.entries(m.nodes)) {
      elements.push({
        id: decisionId,
        type: 'initiative',
        decisionId,
        x: pos.x,
        y: pos.y,
        style: {},
        comment: '',
      });
    }
  }
  return { elements, edges };
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    // Shallow-merge against the empty shape so older saves missing newer keys
    // (e.g. settings) still load cleanly.
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      profile: { ...base.profile, ...(parsed.profile || {}) },
      settings: { ...base.settings, ...(parsed.settings || {}) },
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
      map: normalizeMap(parsed.map),
    };
  } catch (err) {
    console.error('[storage] Failed to load state, starting fresh:', err);
    return emptyState();
  }
}

// Returns true on success. localStorage is capped (~5 MB/origin), so a backlog
// stuffed with long transcripts can hit QuotaExceededError — callers surface a
// warning so the user can export + prune (MVP feedback §3.3).
export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch (err) {
    console.error('[storage] Failed to save state:', err);
    return false;
  }
}

// Export / import — the cheap insurance against a cleared browser wiping the
// whole decision history (implementation plan §8 risk).
export function exportStateBlob(state) {
  return JSON.stringify(state, null, 2);
}

export function parseImportedBlob(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.decisions)) {
    throw new Error('That file does not look like a Diligence export.');
  }
  const base = emptyState();
  return {
    ...base,
    ...parsed,
    profile: { ...base.profile, ...(parsed.profile || {}) },
    settings: { ...base.settings, ...(parsed.settings || {}) },
    decisions: parsed.decisions,
    map: normalizeMap(parsed.map),
  };
}

export const newId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
