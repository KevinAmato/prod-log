import { createContext, useCallback, useContext, useRef, useState } from 'react';

const SnackContext = createContext(null);

// One transient snackbar at the bottom of the screen. `show(msg, {label, onAction})`
// optionally renders an action button (used for Undo after done/delete).
export function SnackProvider({ children }) {
  const [snack, setSnack] = useState(null);
  const timer = useRef(null);

  const show = useCallback((msg, opts = {}) => {
    clearTimeout(timer.current);
    setSnack({ msg, ...opts });
    timer.current = setTimeout(() => setSnack(null), 3500);
  }, []);

  const act = () => {
    clearTimeout(timer.current);
    snack?.onAction?.();
    setSnack(null);
  };

  return (
    <SnackContext.Provider value={show}>
      {children}
      {snack && (
        <div
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink px-4 py-2.5 text-sm text-paper shadow-lg"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <span className="whitespace-nowrap">{snack.msg}</span>
          {snack.label && (
            <button
              onClick={act}
              className="whitespace-nowrap font-semibold text-[#c4b5fd] underline-offset-2 hover:underline"
            >
              {snack.label}
            </button>
          )}
        </div>
      )}
    </SnackContext.Provider>
  );
}

export function useSnack() {
  const ctx = useContext(SnackContext);
  if (!ctx) throw new Error('useSnack must be used within a SnackProvider');
  return ctx;
}
