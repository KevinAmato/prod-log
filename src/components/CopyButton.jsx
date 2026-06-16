import { useState } from 'react';
import { decisionToText } from '../lib/decisionText.js';

// Copies the whole initiative (overview + every gate value) to the OS clipboard.
// Stops propagation so it never opens the backlog card or drags the canvas node.
export default function CopyButton({ decision, className = '', size = 14 }) {
  const [copied, setCopied] = useState(false);

  const copy = async (e) => {
    e.stopPropagation();
    e.preventDefault();
    const text = decisionToText(decision);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={copy}
      onPointerDown={(e) => e.stopPropagation()}
      title="Copy all fields to clipboard"
      className={`nodrag inline-flex items-center justify-center rounded text-ink/45 transition-colors hover:bg-ink/5 hover:text-ink ${className}`}
    >
      {copied ? (
        <span className="text-[11px] font-medium text-emerald-600">Copied</span>
      ) : (
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
    </button>
  );
}
