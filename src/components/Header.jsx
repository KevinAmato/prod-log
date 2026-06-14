import BackupControls from './BackupControls.jsx';
import { Button } from './ui.jsx';

export default function Header({ view, onNavigate, onOpenSettings, onHome }) {
  const tab = (id, label) => (
    <button
      onClick={() => onNavigate(id)}
      className={`rounded px-3 py-2 text-sm font-medium transition-colors ${
        view === id ? 'bg-white text-ink shadow-sm' : 'text-ink/60 hover:text-ink'
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="shrink-0 border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2.5 sm:gap-3">
        <button
          onClick={onHome}
          className="text-sm font-semibold tracking-tight"
          title="Diligence — an audit trail for product judgment"
        >
          Diligence
        </button>
        <nav className="flex rounded-md bg-ink/5 p-0.5">
          {tab('backlog', 'Backlog')}
          {tab('mapping', 'Mapping')}
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <span className="hidden items-center gap-1 sm:flex">
            <BackupControls variant="compact" />
          </span>
          <Button variant="outline" onClick={onOpenSettings}>
            Settings
          </Button>
        </div>
      </div>
    </header>
  );
}
