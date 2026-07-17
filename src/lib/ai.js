// Multi-provider BYOK chat, ported from the Diligence app (diligence-final
// branch) and extended to multi-turn conversations. The user picks a provider,
// supplies that provider's key, and types ANY model id — no restrictions.
// All three providers reduce to one shape:
//   chat(settings, system, messages[{role:'user'|'assistant', content}]) → text
// Keys are kept ONLY in this browser (localStorage, never in the synced blob).

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', keyHint: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI (ChatGPT)', keyHint: 'sk-…' },
  { id: 'gemini', label: 'Google (Gemini)', keyHint: 'AIza…' },
];

// Suggested defaults shown as a datalist — NOT a restriction; any id works.
export const MODEL_SUGGESTIONS = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-5', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
};

export const DEFAULT_MODEL = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o-mini',
  gemini: 'gemini-2.5-flash',
};

const CFG_KEY = 'prodlog_ai_v1';

export function getAiSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || 'null');
    if (!raw) return { provider: 'anthropic', model: '', keys: { anthropic: '', openai: '', gemini: '' } };
    return { provider: 'anthropic', model: '', ...raw, keys: { anthropic: '', openai: '', gemini: '', ...(raw.keys || {}) } };
  } catch {
    return { provider: 'anthropic', model: '', keys: { anthropic: '', openai: '', gemini: '' } };
  }
}

export function saveAiSettings(cfg) {
  try {
    localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  } catch {
    /* ignore */
  }
}

export function clearAiSettings() {
  try {
    localStorage.removeItem(CFG_KEY);
  } catch {
    /* ignore */
  }
}

export function activeKey(settings) {
  return settings?.keys?.[settings.provider] || '';
}
export function aiEnabled(settings = getAiSettings()) {
  return !!activeKey(settings);
}
export function activeModel(settings) {
  return settings.model?.trim() || DEFAULT_MODEL[settings.provider];
}

function aiError(status, message) {
  const e = new Error(message || `Request failed (${status})`);
  e.status = status;
  return e;
}

// ── Per-provider browser calls (multi-turn) ─────────────────────────────────

async function anthropicChat(apiKey, model, system, messages) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1500,
      system,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw aiError(res.status, e?.error?.message);
  }
  const data = await res.json();
  const block = (data.content || []).find((b) => b.type === 'text');
  return block ? block.text.trim() : '';
}

async function openaiChat(apiKey, model, system, messages) {
  // No temperature / max_tokens so any model (incl. reasoning models that
  // reject those params) works without per-model special-casing.
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw aiError(res.status, e?.error?.message);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function geminiChat(apiKey, model, system, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw aiError(res.status, e?.error?.message);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts
    .map((p) => p.text || '')
    .join('')
    .trim();
}

export async function chat(settings, system, messages) {
  const key = activeKey(settings);
  const model = activeModel(settings);
  if (!key) throw aiError(401, 'No API key set for the selected provider.');
  if (settings.provider === 'anthropic') return anthropicChat(key, model, system, messages);
  if (settings.provider === 'openai') return openaiChat(key, model, system, messages);
  if (settings.provider === 'gemini') return geminiChat(key, model, system, messages);
  throw aiError(400, `Unknown provider: ${settings.provider}`);
}

// Pull the first JSON object out of a model reply (tolerates ``` fences and
// surrounding prose).
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  if (start === -1) return null;
  for (let end = candidate.length; end > start; end--) {
    try {
      return JSON.parse(candidate.slice(start, end));
    } catch {
      /* keep shrinking */
    }
  }
  return null;
}

export function describeError(err) {
  if (err?.status === 401) return 'The API key was rejected — check it in AI settings.';
  if (err?.status === 404) return 'That model id was not found for this provider.';
  if (err?.status === 429) return 'Rate limited by the provider — try again in a moment.';
  if (err?.message?.includes('Failed to fetch')) return 'Network error — are you offline?';
  return err?.message || 'The AI request failed.';
}
