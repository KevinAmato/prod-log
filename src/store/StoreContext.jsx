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

  // Persist the whole blob on every change. One key, atomic write.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    saveState(state);
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
        setState((s) => ({
          ...s,
          decisions: s.decisions.filter((d) => d.id !== id),
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

  const value = useMemo(() => ({ state, actions }), [state, actions]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within a StoreProvider');
  return ctx;
}
