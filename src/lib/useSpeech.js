import { useCallback, useEffect, useRef, useState } from 'react';

// Voice input via the Web Speech API (free, on-device/OS-provided — great on
// Android Chrome, present on recent iOS Safari, absent on some desktops).
// Tap mic → listen until the user pauses → final transcript fires onFinal.
export default function useSpeech({ onFinal }) {
  const Rec =
    typeof window !== 'undefined' &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);
  const supported = !!Rec;

  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const recRef = useRef(null);
  const finalRef = useRef('');
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Rec || recRef.current) return;
    const rec = new Rec();
    recRef.current = rec;
    finalRef.current = '';
    rec.lang = navigator.language || 'en-US';
    rec.interimResults = true;
    rec.continuous = false; // one utterance per tap — right shape for commands

    rec.onresult = (e) => {
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalRef.current += t;
        else interimText += t;
      }
      setInterim(interimText);
    };
    rec.onend = () => {
      recRef.current = null;
      setListening(false);
      setInterim('');
      const text = finalRef.current.trim();
      if (text) onFinalRef.current?.(text);
    };
    rec.onerror = () => {
      /* onend fires after and cleans up */
    };

    try {
      rec.start();
      setListening(true);
    } catch {
      recRef.current = null;
    }
  }, [Rec]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { supported, listening, interim, start, stop };
}
