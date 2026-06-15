import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { ARCHETYPES } from '../config/gates.js';
import { PROVIDERS, MODEL_SUGGESTIONS, DEFAULT_MODEL } from '../lib/ai.js';
import { Button, Field, inputClass } from './ui.jsx';

export default function SettingsModal({ onClose }) {
  const { state, actions } = useStore();
  const [provider, setProvider] = useState(state.settings.provider || 'anthropic');
  const [model, setModel] = useState(state.settings.model || DEFAULT_MODEL.anthropic);
  const [keys, setKeys] = useState(() => ({
    anthropic: '',
    openai: '',
    gemini: '',
    ...(state.settings.keys || {}),
  }));
  const [pmType, setPmType] = useState(state.profile.pmType || '');
  const [archetype, setArchetype] = useState(state.profile.archetype || ARCHETYPES[0].id);
  const [productName, setProductName] = useState(state.profile.productName || '');
  const [linesText, setLinesText] = useState((state.profile.productLines || []).join(', '));

  const providerMeta = PROVIDERS.find((p) => p.id === provider) || PROVIDERS[0];

  const onProviderChange = (id) => {
    setProvider(id);
    setModel(DEFAULT_MODEL[id]); // sensible default for the new provider; editable
  };

  const save = () => {
    const trimmedKeys = Object.fromEntries(
      Object.entries(keys).map(([k, v]) => [k, (v || '').trim()]),
    );
    actions.saveSettings({ provider, model: model.trim(), keys: trimmedKeys });
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
          <Field label="AI provider" hint="Bring your own key — pick any provider.">
            <select
              className={inputClass}
              value={provider}
              onChange={(e) => onProviderChange(e.target.value)}
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label={`${providerMeta.label} API key`}
            hint="Stored only in this browser (localStorage). Sent only to the provider, never to any server of ours."
          >
            <input
              className={inputClass}
              type="password"
              value={keys[provider] || ''}
              onChange={(e) => setKeys((k) => ({ ...k, [provider]: e.target.value }))}
              placeholder={providerMeta.keyHint}
              autoComplete="off"
            />
          </Field>

          <Field
            label="Model"
            hint="Type any model the provider offers — the suggestions are just shortcuts."
          >
            <input
              className={inputClass}
              list="diligence-model-suggestions"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={DEFAULT_MODEL[provider]}
            />
            <datalist id="diligence-model-suggestions">
              {(MODEL_SUGGESTIONS[provider] || []).map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
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
