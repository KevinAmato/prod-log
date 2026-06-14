import { useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { ARCHETYPES } from '../config/gates.js';
import { Button, Field, inputClass } from './ui.jsx';

// First-run profile capture. This profile is injected into the AI's context for
// every gate, so questions are tailored (e.g. it knows to ask about LP vs GP).
export default function Setup() {
  const { actions } = useStore();
  const [pmType, setPmType] = useState('');
  const [archetype, setArchetype] = useState(ARCHETYPES[0].id);
  const [productName, setProductName] = useState('');
  const [linesText, setLinesText] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const productLines = linesText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    actions.saveProfile({ pmType, archetype, productName, productLines });
  };

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center px-5 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        Diligence
      </p>
      <h1 className="mt-1 text-2xl font-semibold">An audit trail for product judgment.</h1>
      <p className="mt-2 text-sm text-ink/60">
        A quick profile so the questions at each gate are tuned to you and your
        product. You can change this later.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-5">
        <Field
          label="What kind of PM are you?"
          hint="e.g. B2B SaaS PM owning a multi-segment platform"
        >
          <input
            className={inputClass}
            value={pmType}
            onChange={(e) => setPmType(e.target.value)}
            placeholder="B2B SaaS PM, multi-segment platform"
            required
          />
        </Field>

        <Field
          label="Which best describes your product?"
          hint="This shapes the funnel — e.g. B2C/marketplace adds analytics & experiment gates."
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

        <Field label="What product / platform do you own?">
          <input
            className={inputClass}
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. Holtara"
            required
          />
        </Field>

        <Field
          label="Main product lines / segments"
          hint="Comma-separated — e.g. Corporate, GP, LP"
        >
          <input
            className={inputClass}
            value={linesText}
            onChange={(e) => setLinesText(e.target.value)}
            placeholder="Corporate, GP, LP"
          />
        </Field>

        <Button type="submit" className="w-full">
          Start the backlog
        </Button>
      </form>
    </div>
  );
}
