import { useRef, useState } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { exportStateBlob } from '../lib/storage.js';
import { boardToText, copyText } from '../lib/exportText.js';

// Export / import the whole board (lives in the header ⋯ menu).
//   - JSON backup: full-fidelity, restorable — the ONLY way data leaves one
//     browser besides sync, so this is the insurance + device-migration path.
//   - Copy as text / Markdown: one-way, human-readable — for sharing a status
//     update, pasting into an external AI, or archiving into a notes app.
export default function BackupControls() {
  const { state, actions } = useStore();
  const fileRef = useRef(null);
  const [copied, setCopied] = useState(null); // null | 'text' | 'markdown'

  const doExport = () => {
    const blob = new Blob([exportStateBlob(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pino-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doCopy = async (markdown) => {
    const ok = await copyText(boardToText(state, { markdown }));
    if (ok) {
      setCopied(markdown ? 'markdown' : 'text');
      setTimeout(() => setCopied(null), 1500);
    }
  };

  const doImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      if (
        window.confirm(
          'Import will REPLACE your current board with the contents of this file. Continue?',
        )
      ) {
        actions.importState(text);
      }
    } catch (err) {
      alert(`Import failed: ${err.message}`);
    } finally {
      e.target.value = '';
    }
  };

  const item = 'block w-full px-3 py-2 text-left text-sm text-ink/80 hover:bg-ink/5';

  return (
    <>
      <button type="button" className={item} onClick={doExport} disabled={state.cards.length === 0}>
        Export backup
      </button>
      <button type="button" className={item} onClick={() => fileRef.current?.click()}>
        Import backup
      </button>
      <div className="my-1 h-px bg-ink/10" />
      <button type="button" className={item} onClick={() => doCopy(false)}>
        {copied === 'text' ? 'Copied ✓' : 'Copy as text'}
      </button>
      <button type="button" className={item} onClick={() => doCopy(true)}>
        {copied === 'markdown' ? 'Copied ✓' : 'Copy as Markdown'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        onChange={doImport}
        className="hidden"
      />
    </>
  );
}
