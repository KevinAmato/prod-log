import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { describeError } from '../lib/ai.js';
import { runAssistant } from '../lib/assistant.js';
import useSpeech from '../lib/useSpeech.js';

// Talk to the board WITHOUT opening the chat: a mic bubble under the ✦ FAB.
// Tap → speak → pause: the transcript runs through the exact same assistant
// pipeline as the chat (runAssistant), and the confirmation/error appears in
// a comic-style speech bubble above the FABs — dismissed by its ✕ or by
// tapping anywhere outside. Renders nothing where the Web Speech API is
// unavailable.
export default function QuickVoice() {
  const { state, actions } = useStore();
  const stateRef = useRef(state);
  stateRef.current = state;

  // bubble: null | { kind: 'listening'|'busy'|'reply'|'error', text?, receipts? }
  const [bubble, setBubble] = useState(null);

  const { supported, listening, interim, start, stop } = useSpeech({
    onFinal: (text) => run(text),
  });

  const run = async (text) => {
    setBubble({ kind: 'busy', text });
    try {
      const { reply, receipts } = await runAssistant({
        state: stateRef.current,
        actions,
        history: [{ role: 'user', content: text }],
      });
      setBubble({ kind: 'reply', text: reply, receipts });
    } catch (err) {
      setBubble({ kind: 'error', text: describeError(err) });
    }
  };

  // Recognition ended with nothing said → fold the listening bubble away.
  useEffect(() => {
    if (!listening) setBubble((b) => (b?.kind === 'listening' ? null : b));
  }, [listening]);

  if (!supported) return null;

  const micTap = () => {
    if (bubble?.kind === 'busy') return;
    if (listening) {
      stop();
      return;
    }
    setBubble({ kind: 'listening' });
    start();
  };

  const dismiss = () => {
    if (listening) stop();
    setBubble(null);
  };

  return (
    <>
      {/* Mic FAB — same size as the ✦ bubble above it */}
      <div className="relative">
        {listening && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400/60" />
        )}
        <button
          type="button"
          title={listening ? 'Stop listening' : 'Speak to ProdLog'}
          onClick={micTap}
          className={`relative flex items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105 active:scale-95 ${
            listening ? 'bg-red-500' : 'bg-accent'
          }`}
          style={{ width: 52, height: 52 }}
        >
          <svg width="22" height="22" viewBox="0 0 16 16" fill="currentColor">
            <rect x="6" y="1.5" width="4" height="8" rx="2" />
            <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0h1.2a5.7 5.7 0 0 1-5.1 5.66V15h-1.2v-1.84A5.7 5.7 0 0 1 2.3 7.5h1.2Z" />
          </svg>
        </button>
      </div>

      {/* Speech bubble (comic style, tail pointing at the mic) */}
      {bubble &&
        createPortal(
          <>
            {/* click-away scrim: below the FABs (z-40) so the mic stays tappable */}
            <div className="fixed inset-0 z-30" onClick={dismiss} />
            <div
              className="fixed right-4 z-50 w-[min(78vw,300px)] rounded-2xl border border-ink/10 bg-surface p-3 pr-8 shadow-2xl"
              style={{ bottom: 'calc(9.5rem + env(safe-area-inset-bottom))' }}
            >
              <span className="absolute -bottom-1.5 right-7 h-3 w-3 rotate-45 border-b border-r border-ink/10 bg-surface" />
              <button
                type="button"
                title="Dismiss"
                onClick={dismiss}
                className="absolute right-1.5 top-1.5 rounded-md p-1 leading-none text-ink/40 hover:bg-ink/5 hover:text-ink"
              >
                ✕
              </button>

              {bubble.kind === 'listening' && (
                <p className="text-sm italic text-accent">{interim || 'Listening…'}</p>
              )}
              {bubble.kind === 'busy' && (
                <p className="animate-pulse text-sm text-ink/45">
                  “{bubble.text}” — thinking…
                </p>
              )}
              {bubble.kind === 'error' && (
                <p className="text-sm leading-snug text-red-700">{bubble.text}</p>
              )}
              {bubble.kind === 'reply' && (
                <>
                  <p className="whitespace-pre-wrap break-words text-sm leading-snug">
                    {bubble.text}
                  </p>
                  {bubble.receipts?.length > 0 && (
                    <ul className="mt-1.5 space-y-0.5 border-t border-ink/10 pt-1.5">
                      {bubble.receipts.map((r, i) => (
                        <li
                          key={i}
                          className={`text-[11px] ${r.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}
                        >
                          {r}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
