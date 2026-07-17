import { useCallback, useEffect, useRef } from 'react';
import { useStore } from '../store/StoreContext.jsx';
import { useSnack } from './Snackbar.jsx';
import { syncNow, syncEnabled } from '../lib/sync.js';

// Headless sync loop: on load, on tab focus, and debounced 4 s after any local
// change. Never blocks the UI; a failure shows one snackbar then stays quiet
// until a sync succeeds again (offline use shouldn't nag).
export default function SyncEngine() {
  const { state, actions } = useStore();
  const snack = useSnack();
  const stateRef = useRef(state);
  stateRef.current = state;
  const timer = useRef(null);
  const errShown = useRef(false);

  const run = useCallback(async () => {
    if (!syncEnabled()) return;
    const result = await syncNow(stateRef.current, (merged) => actions.replaceState(merged));
    if (result.status === 'ok') {
      errShown.current = false;
      if (result.pulled) snack('Synced changes from this workspace');
    } else if (result.status === 'limited' && !errShown.current) {
      errShown.current = true;
      snack('Daily sync limit reached — changes stay on this device and sync tomorrow');
    } else if (result.status === 'toobig' && !errShown.current) {
      errShown.current = true;
      snack('Board too large to sync — clear old Done/Deleted tasks');
    } else if (result.status === 'error' && !errShown.current) {
      errShown.current = true;
      snack('Sync failed — working locally, will retry');
    }
    // Let the settings sheet reflect fresh status without prop drilling.
    window.dispatchEvent(new CustomEvent('prodlog-sync-done', { detail: result }));
  }, [actions, snack]);

  // Expose for the "Sync now" button in the settings sheet.
  useEffect(() => {
    const f = () => run();
    window.addEventListener('prodlog-sync-request', f);
    return () => window.removeEventListener('prodlog-sync-request', f);
  }, [run]);

  useEffect(() => {
    run(); // on load
    const onVis = () => document.visibilityState === 'visible' && run();
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced push after local edits. A sync-applied merge retriggers this
  // once, but the second pass compares equal and skips the network push loop.
  useEffect(() => {
    if (!syncEnabled()) return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(run, 4000);
    return () => clearTimeout(timer.current);
  }, [state, run]);

  return null;
}
