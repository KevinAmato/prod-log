import BackupControls from './BackupControls.jsx';
import { Button } from './ui.jsx';

export default function Header({ onOpenSettings, onHome }) {
  return (
    <header className="border-b border-ink/10 bg-paper/80 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-5 py-3">
        <button onClick={onHome} className="text-left">
          <span className="text-sm font-semibold tracking-tight">Diligence</span>
          <span className="ml-2 hidden text-xs text-ink/50 sm:inline">
            an audit trail for product judgment
          </span>
        </button>
        <div className="flex items-center gap-1">
          {/* Export/Import live on the prominent backlog card on mobile; keep the
              header uncluttered on small screens. */}
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
