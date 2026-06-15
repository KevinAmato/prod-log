import { useEffect, useState } from 'react';
import { useStore } from './store/StoreContext.jsx';
import Setup from './components/Setup.jsx';
import Header from './components/Header.jsx';
import Backlog from './components/Backlog.jsx';
import DecisionView from './components/DecisionView.jsx';
import MappingView from './components/MappingView.jsx';
import SettingsModal from './components/SettingsModal.jsx';

export default function App() {
  const { state, storageFull, undo, redo } = useStore();
  const [view, setView] = useState('backlog'); // 'backlog' | 'mapping'
  const [selectedId, setSelectedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Global undo/redo. Skipped while typing so Ctrl+Z still does text undo.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const t = document.activeElement;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
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

  if (!state.profile.setupComplete) {
    return <Setup />;
  }

  const goBacklog = () => {
    setView('backlog');
    setSelectedId(null);
  };

  const selected = selectedId
    ? state.decisions.find((d) => d.id === selectedId)
    : null;

  return (
    <div className="flex h-[100dvh] flex-col">
      <Header
        view={view}
        onNavigate={(v) => (v === 'mapping' ? setView('mapping') : goBacklog())}
        onOpenSettings={() => setSettingsOpen(true)}
        onHome={goBacklog}
      />

      {storageFull && (
        <div className="shrink-0 bg-accent px-5 py-2 text-center text-sm text-white">
          Browser storage is full — your latest change isn't saved. Use{' '}
          <span className="font-semibold">Save (export)</span> to back up, then delete old
          decisions to free space.
        </div>
      )}

      {view === 'mapping' ? (
        <div className="min-h-0 flex-1">
          <MappingView
            onOpenDecision={(id) => {
              setSelectedId(id);
              setView('backlog');
            }}
          />
        </div>
      ) : (
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-5 py-8">
            {selected ? (
              <DecisionView
                decision={selected}
                onBack={() => setSelectedId(null)}
                onOpenSettings={() => setSettingsOpen(true)}
              />
            ) : (
              <Backlog onOpen={(id) => setSelectedId(id)} />
            )}
          </div>
        </main>
      )}

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
