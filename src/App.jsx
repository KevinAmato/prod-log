import { useEffect, useMemo, useState } from 'react';
import { DragDropContext } from '@hello-pangea/dnd';
import { useStore } from './store/StoreContext.jsx';
import { SnackProvider, useSnack } from './components/Snackbar.jsx';
import Header from './components/Header.jsx';
import Board from './components/Board.jsx';
import ArchiveList from './components/ArchiveList.jsx';
import ReminderEngine from './components/ReminderEngine.jsx';
import SyncEngine from './components/SyncEngine.jsx';
import AiChat from './components/AiChat.jsx';
import QuickVoice from './components/QuickVoice.jsx';
import CleanupBanner from './components/CleanupBanner.jsx';
import CleanupMode from './components/CleanupMode.jsx';
import ShareSheet from './components/ShareSheet.jsx';
import { aiEnabled } from './lib/ai.js';
import { isOverdue } from './lib/dates.js';
import { queryTerms, cardMatches } from './lib/search.js';
import {
  parseJoinFragment,
  clearJoinFragment,
  findBySyncKey,
  addWorkspace,
  setActiveWorkspace,
} from './lib/workspaces.js';

// SnackProvider has to be an ANCESTOR of anything calling useSnack(), and the
// drag handler below needs the snack — so the DragDropContext + its state
// live in an inner component, one level below the provider.
export default function App() {
  return (
    <SnackProvider>
      <Pino />
    </SnackProvider>
  );
}

function Pino() {
  const { state, actions, storageFull, undo, redo } = useStore();
  const snack = useSnack();
  const [view, setView] = useState('live'); // 'live' | 'done' | 'deleted'
  const [chatOpen, setChatOpen] = useState(false);
  const [query, setQuery] = useState(''); // transient board search — never synced
  const [dragging, setDragging] = useState(false);
  // null = closed; else the (editable) text to capture
  const [shareText, setShareText] = useState(null);
  // Invite-link intake: { key, name } while the join confirm is showing.
  const [joinInfo, setJoinInfo] = useState(() => parseJoinFragment());
  // null = closed; else { categoryIds: string[]|null, scheduleIds: string[] }
  const [cleanupScope, setCleanupScope] = useState(null);
  // Bumped by Header when AI settings are saved, so the FAB appears instantly.
  const [aiRev, setAiRev] = useState(0);

  // Share target intake. The manifest registers Pino in Android's share sheet
  // with method GET, so shared content arrives as query params on the start
  // URL — no server route needed, which is what makes this work on static
  // hosting. Params are stripped immediately so a refresh can't re-import.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const title = p.get('title');
    const text = p.get('text');
    const url = p.get('url');
    if (!title && !text && !url) return;
    const shared = [title, text, url && url !== text ? url : null]
      .filter(Boolean)
      .join('\n')
      .trim();
    window.history.replaceState({}, '', window.location.pathname);
    if (shared) setShareText(shared);
  }, []);

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

  // ONE DragDropContext for the whole app — Board's columns, ArchiveList's
  // rows, AND the Header's Done/Deleted tabs are all descendants of it, which
  // is what lets a card be dragged out of the board and dropped on a tab.
  // Routes by destination first (tab drop = complete/delete, regardless of
  // which board is currently mounted), then falls back to whichever kind of
  // reorder the source droppableId indicates.
  const terms = useMemo(() => queryTerms(query), [query]);

  const visibleInColumn = (col) => {
    const f = col.filter || {};
    return state.cards.filter(
      (c) =>
        c.status === 'live' &&
        c.columnId === col.id &&
        (!f.categoryId || c.categoryId === f.categoryId) &&
        (!f.overdue || isOverdue(c.dueDate)) &&
        cardMatches(c, terms),
    );
  };

  const onDragEnd = ({ draggableId: id, source, destination }) => {
    setDragging(false);
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // ── Dropped on a Header tab: complete or delete, from whatever board is
    // currently open. No-ops for a transition that isn't one of the three
    // that already exist elsewhere in the UI (see Header.jsx for why).
    if (destination.droppableId === 'tab-done' || destination.droppableId === 'tab-deleted') {
      const card = state.cards.find((c) => c.id === id);
      if (!card) return;
      if (destination.droppableId === 'tab-done' && card.status === 'live') {
        actions.completeCard(id); // force-completes subtasks — see Header.jsx
        snack('Task done', { label: 'Undo', onAction: undo });
      } else if (destination.droppableId === 'tab-deleted' && card.status !== 'deleted') {
        actions.deleteCard(id);
        snack('Task deleted', { label: 'Undo', onAction: undo });
      }
      return;
    }

    // ── Archive reorder (Done/Deleted board, dragging within itself) ──────
    if (source.droppableId.startsWith('archive-')) {
      const mode = source.droppableId.slice('archive-'.length);
      const visible = state.cards.filter((c) => c.status === mode && cardMatches(c, terms));
      const anchor = visible.filter((c) => c.id !== id)[destination.index];
      const underlying = state.cards.filter((c) => c.status === mode && c.id !== id);
      actions.moveArchiveCard(id, anchor ? underlying.indexOf(anchor) : underlying.length);
      return;
    }

    // ── Live board: move within/between columns ────────────────────────────
    const destCol = state.columns.find((c) => c.id === destination.droppableId);
    if (!destCol) return;
    const visible = visibleInColumn(destCol).filter((c) => c.id !== id);
    const anchor = visible[destination.index];
    let slot = Infinity;
    if (anchor) {
      const underlying = state.cards.filter(
        (c) => c.status === 'live' && c.columnId === destination.droppableId && c.id !== id,
      );
      slot = underlying.indexOf(anchor);
    }
    actions.moveCard(id, destination.droppableId, slot);
  };

  return (
    <>
      <ReminderEngine />
      <SyncEngine />
      <DragDropContext
        onDragStart={() => setDragging(true)}
        onDragEnd={onDragEnd}
        // Softer cross-column drags on mobile: the board starts auto-scrolling
        // much earlier (30% from the edge vs 25% default) and ramps to a faster
        // max sooner, so nudging a card toward the next column — or up toward
        // the Done/Deleted tabs — scrolls the view to meet it.
        autoScrollerOptions={{
          startFromPercentage: 0.3,
          maxScrollAtPercentage: 0.15,
          maxPixelScroll: 34,
        }}
      >
        <div className="flex h-[100dvh] flex-col">
          <Header
            view={view}
            setView={setView}
            query={query}
            setQuery={setQuery}
            onAiChanged={() => setAiRev((r) => r + 1)}
            onQuickCapture={() => setShareText('')}
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
            {view === 'live' ? (
              <Board query={query} dragging={dragging} />
            ) : (
              <ArchiveList mode={view} query={query} />
            )}
          </main>
        </div>
      </DragDropContext>

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
      {shareText !== null && (
        <ShareSheet initialText={shareText} onClose={() => setShareText(null)} />
      )}

      {/* Invite-link confirm. Deliberately a hard gate: a tapped link should
          never silently join a shared board. Accepting adds the workspace and
          reloads into it; the fragment (which carries the key) is cleared
          either way so history/refresh can't re-trigger it. */}
      {joinInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative w-full max-w-sm rounded-2xl border border-ink/10 bg-paper p-4 shadow-2xl">
            <h3 className="text-sm font-semibold">Join “{joinInfo.name}”?</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-ink/60">
              You've opened an invite link to a shared workspace. Everyone in it can
              see and edit its tasks — including ones you add. Your other workspaces
              stay private to you.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  clearJoinFragment();
                  setJoinInfo(null);
                }}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink/60 hover:bg-ink/5"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  const { key, name } = joinInfo;
                  clearJoinFragment();
                  const existing = findBySyncKey(key);
                  if (existing) setActiveWorkspace(existing.id);
                  else if (!addWorkspace(name, key)) {
                    setJoinInfo(null);
                    return; // workspace cap hit — stay put
                  }
                  window.location.reload();
                }}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-ink/90"
              >
                Join workspace
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
