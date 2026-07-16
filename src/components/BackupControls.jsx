import { useRef } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { exportStateBlob } from '../lib/storage.js';

// Export / import the whole board blob (lives in the header ⋯ menu). This is
// the only way data leaves one browser — localStorage is per-device, so the
// backup file (kept in e.g. OneDrive) is how a board moves between machines.
export default function BackupControls() {
  const { state, actions } = useStore();
  const fileRef = useRef(null);

  const doExport = () => {
    const blob = new Blob([exportStateBlob(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prodlog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
