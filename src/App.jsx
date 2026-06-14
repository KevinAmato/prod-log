import { useState } from 'react';
import { useStore } from './store/StoreContext.jsx';
import Setup from './components/Setup.jsx';
import Header from './components/Header.jsx';
import Backlog from './components/Backlog.jsx';
import DecisionView from './components/DecisionView.jsx';
import SettingsModal from './components/SettingsModal.jsx';

export default function App() {
  const { state, storageFull } = useStore();
  const [selectedId, setSelectedId] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  if (!state.profile.setupComplete) {
    return <Setup />;
  }

  const selected = selectedId
    ? state.decisions.find((d) => d.id === selectedId)
    : null;

  return (
    <div className="min-h-full">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onHome={() => setSelectedId(null)}
      />
      {storageFull && (
        <div className="bg-accent px-5 py-2 text-center text-sm text-white">
          Browser storage is full — your latest change isn't saved. Use{' '}
          <span className="font-semibold">Save (export)</span> to back up, then delete
          old decisions to free space.
        </div>
      )}
      <main className="mx-auto max-w-4xl px-5 py-8">
        {selected ? (
          <DecisionView
            decision={selected}
            onBack={() => setSelectedId(null)}
            onOpenSettings={() => setSettingsOpen(true)}
          />
        ) : (
          <Backlog onOpen={(id) => setSelectedId(id)} />
        )}
      </main>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
