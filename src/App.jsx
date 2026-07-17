import { useEffect, useState } from 'react';
import { useStore } from './store/StoreContext.jsx';
import { SnackProvider } from './components/Snackbar.jsx';
import Header from './components/Header.jsx';
import Board from './components/Board.jsx';
import ArchiveList from './components/ArchiveList.jsx';
import ReminderEngine from './components/ReminderEngine.jsx';
import SyncEngine from './components/SyncEngine.jsx';
import AiChat from './components/AiChat.jsx';
import QuickVoice from './components/QuickVoice.jsx';
import CleanupBanner from './components/CleanupBanner.jsx';
import CleanupMode from './components/CleanupMode.jsx';
import { aiEnabled } from './lib/ai.js';

export default function App() {
  const { storageFull, undo, redo } = useStore();
  const [view, setView] = useState('live'); // 'live' | 'done' | 'deleted'
  const [chatOpen, setChatOpen] = useState(false);
  // null = closed; else { categoryIds: string[]|null, scheduleIds: string[] }
  const [cleanupScope, setCleanupScope] = useState(null);
  // Bumped by Header when AI settings are saved, so the FAB appears instantly.
  const [aiRev, setAiRev] = useState(0);

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
        <Header
          view={view}
          setView={setView}
          onAiChanged={() => setAiRev((r) => r + 1)}
          onStartCleanup={(scope) =>
            setCleanupScope(scope || { categoryIds: null, scheduleIds: [] })
          }
        />

        {storageFull && (
          <div className="shrink-0 bg-amber-500/15 px-4 py-2 text-center text-xs text-amber-800">
            Browser storage is full — changes may not persist. Export a backup, then clear
            old tasks from the Deleted board.
          </div>
        )}

        <CleanupBanner onStart={(scope) => setCleanupScope(scope)} />

        <main className="min-h-0 flex-1">
          {view === 'live' ? <Board /> : <ArchiveList mode={view} />}
        </main>
      </div>

      {/* AI assistant — chat FAB with the voice FAB underneath, only with a key */}
      {aiEnabled() && !chatOpen && (
        <div
          key={aiRev}
          className="fixed bottom-5 right-4 z-40 flex flex-col items-center gap-3"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <button
            type="button"
            title="AI assistant"
            onClick={() => setChatOpen(true)}
            className="flex items-center justify-center rounded-full bg-accent text-xl text-white shadow-lg transition-transform hover:scale-105"
            style={{ width: 52, height: 52 }}
          >
            ✦
          </button>
          <QuickVoice />
        </div>
      )}
      {chatOpen && <AiChat onClose={() => setChatOpen(false)} />}
      {cleanupScope && (
        <CleanupMode scope={cleanupScope} onClose={() => setCleanupScope(null)} />
      )}
    </SnackProvider>
  );
}
