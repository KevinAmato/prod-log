import { useState } from 'react';
import { useStore } from './store/StoreContext.jsx';
import Setup from './components/Setup.jsx';
import Header from './components/Header.jsx';
import Backlog from './components/Backlog.jsx';
import DecisionView from './components/DecisionView.jsx';
import SettingsModal from './components/SettingsModal.jsx';

export default function App() {
  const { state } = useStore();
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
