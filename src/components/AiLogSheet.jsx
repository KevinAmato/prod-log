import { useState } from 'react';
import { createPortal } from 'react-dom';
import { getAiLog, clearAiLog } from '../lib/aiLog.js';

// Read-only viewer for the rolling AI debug log — shows the RAW model reply
// for each exchange (not just the receipts), so a wrong action can be
// diagnosed from what the model actually said, not guessed at from the
// outcome. Newest first; most recent expanded by default.
export default function AiLogSheet({ onClose }) {
  const [log, setLog] = useState(() => getAiLog().slice().reverse());

  const clear = () => {
    clearAiLog();
    setLog([]);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 cursor-pointer bg-black/40" onClick={onClose} />
      <div className="relative flex h-[80dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-ink/10 bg-paper shadow-2xl sm:h-[600px] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-ink/10 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">AI activity log</h3>
            <p className="text-[11px] text-ink/45">Last {log.length} exchange{log.length === 1 ? '' : 's'} on this device</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={clear}
              disabled={!log.length}
              className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent/10 disabled:opacity-30"
            >
              Clear
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5">
              ✕
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-3 py-3">
          {log.length === 0 && (
            <p className="py-10 text-center text-xs text-ink/40">
              No AI exchanges logged yet on this device. Send the assistant a message and
              it'll show up here — including the raw model output.
            </p>
          )}
          {log.map((e, i) => (
            <details
              key={i}
              open={i === 0}
              className="rounded-xl border border-ink/10 bg-surface p-2.5 text-xs"
            >
              <summary className="cursor-pointer select-none font-medium leading-snug text-ink/80">
                <span className="text-ink/40">{new Date(e.at).toLocaleTimeString()}</span> “{e.input}”
              </summary>
              <div className="mt-2 space-y-2 pl-0.5">
                {e.error ? (
                  <p className="text-red-600">Error: {e.error}</p>
                ) : (
                  <>
                    <div>
                      <p className="font-medium text-ink/55">Raw model reply</p>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink/5 p-2 font-mono text-[10px] leading-snug">
                        {e.rawReply}
                      </pre>
                    </div>
                    {e.receipts?.length > 0 && (
                      <div>
                        <p className="font-medium text-ink/55">Receipts</p>
                        <ul className="mt-1 space-y-0.5">
                          {e.receipts.map((r, j) => {
                            // Receipts are logged as { text, destructive }
                            // objects; tolerate a bare string too (older logs).
                            const t = typeof r === 'string' ? r : r?.text || '';
                            return (
                              <li key={j} className={t.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}>
                                {t}
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    )}
                  </>
                )}
                <p className="text-[10px] text-ink/35">
                  {e.provider} · {e.model}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
