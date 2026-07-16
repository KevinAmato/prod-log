import { useEffect, useState } from 'react';
import { useStore } from './store/StoreContext.jsx';
import { SnackProvider } from './components/Snackbar.jsx';
import Header from './components/Header.jsx';
import Board from './components/Board.jsx';
import ArchiveList from './components/ArchiveList.jsx';
import ReminderEngine from './components/ReminderEngine.jsx';
import SyncEngine from './components/SyncEngine.jsx';

export default function App() {
  const { storageFull, undo, redo } = useStore();
  const [view, setView] = useState('live'); // 'live' | 'done' | 'deleted'

  // Global undo/redo — guarded so typing in an input never triggers it.
  useEffect(() => {
    const onKey = (e) => {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <SnackProvider>
      <ReminderEngine />
      <SyncEngine />
      <div className="flex h-[100dvh] flex-col">
        <Header view={view} setView={setView} />

        {storageFull && (
          <div className="shrink-0 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-800">
            Browser storage is full — changes may not persist. Export a backup, then clear
            old tasks from the Deleted board.
          </div>
        )}

        <main className="min-h-0 flex-1">
          {view === 'live' ? <Board /> : <ArchiveList mode={view} />}
        </main>
      </div>
    </SnackProvider>
  );
}
