import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  loadState,
  saveState,
  newId,
  parseImportedBlob,
} from '../lib/storage.js';
import { buildFunnel, decisionGateAt } from '../config/gates.js';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState);
  const [storageFull, setStorageFull] = useState(false);

  // Persist the whole blob on every change. One key, atomic write. If the write
  // fails (typically the ~5 MB localStorage quota), flag it so the UI can prompt
  // an export + prune — the data in memory is still intact for this session.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setStorageFull(!saveState(state));
  }, [state]);

  const actions = useMemo(() => {
    const touch = (decisions, id) =>
      decisions.map((d) =>
        d.id === id ? { ...d, updatedAt: new Date().toISOString() } : d,
      );

    return {
      // ── Profile / onboarding ──────────────────────────────────────────
      saveProfile(profile) {
        setState((s) => ({
          ...s,
          profile: { ...s.profile, ...profile, setupComplete: true },
        }));
      },

      // ── Settings (API key + model) ────────────────────────────────────
      saveSettings(settings) {
        setState((s) => ({ ...s, settings: { ...s.settings, ...settings } }));
      },

      // ── Decisions ─────────────────────────────────────────────────────
      createDecision({ title, type, productLines }) {
        const id = newId();
        const now = new Date().toISOString();
        setState((s) => {
          // Snapshot the funnel composed from this decision's type + the PM's
          // archetype. Frozen for the decision's life — audit-trail integrity.
          const gates = buildFunnel({
            archetype: s.profile.archetype,
            decisionType: type,
          });
          const decision = {
            id,
            title: title.trim(),
            type,
            productLines: Array.isArray(productLines) ? productLines : [],
            status: 'active',
            currentGateOrder: 1,
            createdAt: now,
            updatedAt: now,
            gates,
            evidence: [],
          };
          return { ...s, decisions: [decision, ...s.decisions] };
        });
        return id;
      },

      updateDecision(id, patch) {
        setState((s) => ({
          ...s,
          decisions: touch(
            s.decisions.map((d) => (d.id === id ? { ...d, ...patch } : d)),
            id,
          ),
        }));
      },

      deleteDecision(id) {
        setState((s) => {
          // Also remove its canvas element + any edges touching it.
          const elements = s.map.elements.filter((e) => e.id !== id);
          const edges = s.map.edges.filter((e) => e.source !== id && e.target !== id);
          return {
            ...s,
            decisions: s.decisions.filter((d) => d.id !== id),
            map: { ...s.map, elements, edges },
          };
        });
      },

      // ── Mapping / Roadmap canvas (layout only) ────────────────────────
      // Place a backlog initiative on the canvas (id === decisionId).
      placeInitiative(decisionId, position) {
        setState((s) => {
          if (s.map.elements.some((e) => e.id === decisionId)) return s;
          const el = {
            id: decisionId,
            type: 'initiative',
            decisionId,
            x: position.x,
            y: position.y,
            width: 224,
            height: 132,
            style: {},
            comment: '',
          };
          return { ...s, map: { ...s.map, elements: [...s.map.elements, el] } };
        });
      },

      // Add a shape or text element. Caller supplies a unique id (newId()).
      addElement(element) {
        setState((s) => ({
          ...s,
          map: { ...s.map, elements: [...s.map.elements, element] },
        }));
      },

      moveElement(id, position) {
        setState((s) => ({
          ...s,
          map: {
            ...s.map,
            elements: s.map.elements.map((e) =>
              e.id === id ? { ...e, x: position.x, y: position.y } : e,
            ),
          },
        }));
      },

      updateElement(id, patch) {
        setState((s) => ({
          ...s,
          map: {
            ...s.map,
            elements: s.map.elements.map((e) =>
              e.id === id
                ? { ...e, ...patch, style: patch.style ? { ...e.style, ...patch.style } : e.style }
                : e,
            ),
          },
        }));
      },

      removeElements(ids) {
        const set = new Set(ids);
        setState((s) => ({
          ...s,
          map: {
            ...s.map,
            elements: s.map.elements.filter((e) => !set.has(e.id)),
            edges: s.map.edges.filter((e) => !set.has(e.source) && !set.has(e.target)),
          },
        }));
      },

      addMapEdge({ source, target }) {
        if (!source || !target || source === target) return;
        setState((s) => {
          const id = `e-${source}-${target}`;
          if (s.map.edges.some((e) => e.id === id)) return s;
          return {
            ...s,
            map: {
              ...s.map,
              edges: [
                ...s.map.edges,
                {
                  id,
                  source,
                  target,
                  comment: '',
                  arrow: 'end',
                  color: '#b5562e',
                  width: 1.5,
                  lineStyle: 'solid',
                },
              ],
            },
          };
        });
      },

      updateEdge(id, patch) {
        setState((s) => ({
          ...s,
          map: {
            ...s.map,
            edges: s.map.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        }));
      },

      removeMapEdges(ids) {
        const set = new Set(ids);
        setState((s) => ({
          ...s,
          map: { ...s.map, edges: s.map.edges.filter((e) => !set.has(e.id)) },
        }));
      },

      // Record evidence (provided OR skipped) for the decision's CURRENT gate,
      // then advance. Advancement is a UI action, never an AI one.
      // `sections` is an array of { key, label, value } captured from the gate's
      // input sections (one entry per labelled field).
      recordEvidence(id, { questionAsked, sections, status, skipReason }) {
        setState((s) => ({
          ...s,
          decisions: touch(
            s.decisions.map((d) => {
              if (d.id !== id) return d;
              const gate = decisionGateAt(d, d.currentGateOrder);
              const entry = {
                gateOrder: d.currentGateOrder,
                gateName: gate ? gate.name : `Gate ${d.currentGateOrder}`,
                questionAsked: questionAsked || (gate ? gate.coreQuestion : ''),
                sections: status === 'provided' ? sections || [] : [],
                status,
                skipReason: status === 'skipped' ? skipReason || '' : null,
                timestamp: new Date().toISOString(),
              };
              return {
                ...d,
                evidence: [...d.evidence, entry],
                currentGateOrder: d.currentGateOrder + 1,
              };
            }),
            id,
          ),
        }));
      },

      // Edit a previously-saved gate in place. Does NOT move the funnel pointer.
      editEvidence(id, gateOrder, { status, sections, skipReason }) {
        setState((s) => ({
          ...s,
          decisions: touch(
            s.decisions.map((d) => {
              if (d.id !== id) return d;
              return {
                ...d,
                evidence: d.evidence.map((e) =>
                  e.gateOrder === gateOrder
                    ? {
                        ...e,
                        status,
                        sections: status === 'provided' ? sections || [] : [],
                        skipReason: status === 'skipped' ? skipReason || '' : null,
                        editedAt: new Date().toISOString(),
                      }
                    : e,
                ),
              };
            }),
            id,
          ),
        }));
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
    () => ({ state, actions, storageFull }),
    [state, actions, storageFull],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
