import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { ARCHETYPES } from '../config/gates.js';
import { Button, Field, inputClass } from './ui.jsx';

const MODELS = [
  { id: 'claude-opus-4-8', label: 'Claude Opus 4.8 — most capable (default)' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 — balanced, cheaper' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 — fastest, cheapest' },
];

export default function SettingsModal({ onClose }) {
  const { state, actions } = useStore();
  const [apiKey, setApiKey] = useState(state.settings.apiKey || '');
  const [model, setModel] = useState(state.settings.model || 'claude-opus-4-8');
  const [pmType, setPmType] = useState(state.profile.pmType || '');
  const [archetype, setArchetype] = useState(state.profile.archetype || ARCHETYPES[0].id);
  const [productName, setProductName] = useState(state.profile.productName || '');
  const [linesText, setLinesText] = useState(
    (state.profile.productLines || []).join(', '),
  );

  const save = () => {
    actions.saveSettings({ apiKey: apiKey.trim() || null, model });
    actions.saveProfile({
      pmType,
      archetype,
      productName,
      productLines: linesText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-20 flex items-start justify-center bg-ink/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-paper p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Settings</h2>

        <div className="mt-5 space-y-5">
          <Field
            label="Anthropic API key"
            hint="Stored only in this browser (localStorage). Sent only to Anthropic, never to any server of ours."
          >
            <input
              className={inputClass}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              autoComplete="off"
            />
          </Field>

          <Field label="Model">
            <select
              className={inputClass}
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>

          <div className="border-t border-ink/10 pt-4">
            <p className="mb-3 text-sm font-medium text-ink/70">PM profile</p>
            <div className="space-y-4">
              <Field label="Type of PM">
                <input
                  className={inputClass}
                  value={pmType}
                  onChange={(e) => setPmType(e.target.value)}
                />
              </Field>
              <Field
                label="Product archetype"
                hint="Changing this only affects the funnel of NEW decisions — existing ones keep their snapshotted gates."
              >
                <select
                  className={inputClass}
                  value={archetype}
                  onChange={(e) => setArchetype(e.target.value)}
                >
                  {ARCHETYPES.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Product / platform">
                <input
                  className={inputClass}
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </Field>
              <Field label="Product lines / segments" hint="Comma-separated">
                <input
                  className={inputClass}
                  value={linesText}
                  onChange={(e) => setLinesText(e.target.value)}
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </div>
      </div>
    </div>
  );
}
