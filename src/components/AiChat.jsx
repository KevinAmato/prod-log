import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store/StoreContext.jsx';
import { describeError, getAiSettings, activeModel } from '../lib/ai.js';
import { runAssistant } from '../lib/assistant.js';
import useSpeech from '../lib/useSpeech.js';

// The assistant chat. Docked to the BOTTOM THIRD of the screen (not full
// height) so the board stays visible above it — the point is watching cards
// update live as the assistant acts, not a modal that hides them. Backdrop is
// transparent everywhere (tap it to dismiss; it never dims the board).
// Voice is the primary input: the mic is the largest control in the bar —
// tap, speak, pause, and the final transcript sends itself.
export default function AiChat({ onClose }) {
  const { state, actions } = useStore();
  const [messages, setMessages] = useState([]); // {role, content, receipts?, error?}
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const stateRef = useRef(state);
  stateRef.current = state;
  const scrollRef = useRef(null);
  const settings = getAiSettings();

  const { supported: voiceOk, listening, interim, start, stop } = useSpeech({
    onFinal: (text) => send(text),
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, listening, interim]);

  const send = async (raw) => {
    const text = String(raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    const history = [...messages, { role: 'user', content: text }];
    setMessages(history);
    try {
      const forModel = history.slice(-10).map((m) => ({
        role: m.role,
        content:
          m.role === 'assistant' && m.receipts?.length
            ? `${m.content}\n(did: ${m.receipts.join('; ')})`
            : m.content,
      }));
      const { reply, receipts } = await runAssistant({
        state: stateRef.current,
        actions,
        history: forModel,
      });
      setMessages((ms) => [...ms, { role: 'assistant', content: reply, receipts }]);
    } catch (err) {
      setMessages((ms) => [...ms, { role: 'assistant', content: describeError(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-end sm:justify-end sm:p-4">
      {/* Transparent, not dark — the board stays fully visible; tap it to dismiss */}
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative flex h-[clamp(300px,34dvh,420px)] w-full flex-col overflow-hidden rounded-t-2xl border border-ink/10 bg-paper shadow-2xl sm:h-[480px] sm:w-[400px] sm:rounded-2xl">
        {/* Drag-handle affordance (mobile sheet only) */}
        <div className="flex shrink-0 justify-center pt-1.5 sm:hidden">
          <span className="h-1 w-9 rounded-full bg-ink/15" />
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-2 border-b border-ink/10 px-3 py-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/15 text-xs text-accent">
            ✦
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Assistant</p>
            <p className="truncate text-[10px] text-ink/40">
              {settings.provider} · {activeModel(settings)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            className="rounded-lg p-1.5 text-ink/50 hover:bg-ink/5 hover:text-ink"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2.5">
          {messages.length === 0 && (
            <div className="px-2 py-2 text-center text-xs leading-relaxed text-ink/45">
              “Add buy milk to short term” · “mark task 3 done” · “show only Important”
              {voiceOk && <> — or just tap the mic.</>}
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-snug ${
                  m.role === 'user'
                    ? 'rounded-br-md bg-accent text-white'
                    : m.error
                      ? 'rounded-bl-md bg-red-500/10 text-red-700'
                      : 'rounded-bl-md border border-ink/10 bg-surface'
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.content}</p>
                {m.receipts?.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5 border-t border-ink/10 pt-1.5">
                    {m.receipts.map((r, j) => (
                      <li
                        key={j}
                        className={`text-[11px] ${r.startsWith('✓') ? 'text-emerald-600' : 'text-red-600'}`}
                      >
                        {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-md border border-ink/10 bg-surface px-3 py-2 text-sm text-ink/40">
                <span className="animate-pulse">thinking…</span>
              </div>
            </div>
          )}
          {listening && (
            <div className="flex justify-end">
              <div className="rounded-2xl rounded-br-md bg-accent/15 px-3 py-2 text-sm italic text-accent">
                {interim || 'listening…'}
              </div>
            </div>
          )}
        </div>

        {/* Input — mic is the dominant control */}
        <div
          className="flex shrink-0 items-center gap-2.5 border-t border-ink/10 px-3 py-2"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 8px)' }}
        >
          {voiceOk && (
            <div className="relative shrink-0">
              {listening && (
                <span className="absolute inset-0 animate-ping rounded-full bg-red-400/60" />
              )}
              <button
                type="button"
                title={listening ? 'Stop listening' : 'Speak'}
                onClick={() => (listening ? stop() : start())}
                className={`relative flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
                  listening ? 'bg-red-500 text-white' : 'bg-accent text-white hover:brightness-110'
                }`}
              >
                <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="6" y="1.5" width="4" height="8" rx="2" />
                  <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0h1.2a5.7 5.7 0 0 1-5.1 5.66V15h-1.2v-1.84A5.7 5.7 0 0 1 2.3 7.5h1.2Z" />
                </svg>
              </button>
            </div>
          )}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder={listening ? 'Listening…' : 'Type instead…'}
            disabled={busy}
            className="min-w-0 flex-1 rounded-full border border-ink/15 bg-surface px-3.5 py-2 text-base outline-none placeholder:text-ink/35 focus:border-accent sm:text-sm"
          />
          <button
            type="button"
            title="Send"
            onClick={() => send()}
            disabled={busy || !input.trim()}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-opacity disabled:opacity-30"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 1.5 7 8M13.5 1.5 9.2 13.7l-2.2-5.5-5.5-2.2L13.5 1.5Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
