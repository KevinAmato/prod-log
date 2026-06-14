import { useRef } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { exportStateBlob } from '../lib/storage.js';
import { Button, Card } from './ui.jsx';

// Export / import the whole state blob. Used compactly in the header and
// prominently on the backlog. This is the only way data leaves one browser —
// localStorage is per-device, so the backup file (kept in e.g. OneDrive) is how
// you move a backlog between machines.
export default function BackupControls({ variant = 'compact' }) {
  const { state, actions } = useStore();
  const fileRef = useRef(null);

  const doExport = () => {
    const blob = new Blob([exportStateBlob(state)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diligence-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
          'Import will REPLACE your current backlog and profile with the contents of this file. Continue?',
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

  const hiddenInput = (
    <input
      ref={fileRef}
      type="file"
      accept="application/json"
      onChange={doImport}
      className="hidden"
    />
  );

  if (variant === 'prominent') {
    const count = state.decisions.length;
    return (
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">Back up your backlog</p>
            <p className="text-xs text-ink/55">
              Everything is stored only in this browser. Save a backup file to keep it
              safe or move it to another device — then import it there.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="accent" onClick={doExport} disabled={count === 0}>
              Save (export)
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              Import
            </Button>
          </div>
        </div>
        {hiddenInput}
      </Card>
    );
  }

  return (
    <>
      <Button variant="ghost" onClick={doExport}>
        Export
      </Button>
      <Button variant="ghost" onClick={() => fileRef.current?.click()}>
        Import
      </Button>
      {hiddenInput}
    </>
  );
}
