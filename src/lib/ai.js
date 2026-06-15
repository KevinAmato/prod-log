import Anthropic from '@anthropic-ai/sdk';

// Multi-provider BYOK. The user picks a provider, supplies that provider's key
// (kept only in the browser), and types ANY model id — we don't restrict it.
// All three calls reduce to one shape: system + user → text, dispatched per
// provider by chat(). (Same idea as ThreadPatrol/Sync-O's AI client factory,
// reimplemented for the browser.)

export const PROVIDERS = [
  { id: 'anthropic', label: 'Anthropic (Claude)', keyHint: 'sk-ant-…' },
  { id: 'openai', label: 'OpenAI (ChatGPT)', keyHint: 'sk-…' },
  { id: 'gemini', label: 'Google (Gemini)', keyHint: 'AIza…' },
];

// Suggested defaults shown as a datalist — NOT a restriction; any id is allowed.
export const MODEL_SUGGESTIONS = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'o3'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-1.5-pro'],
};

export const DEFAULT_MODEL = {
  anthropic: 'claude-opus-4-8',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
};

// The active provider's key (tolerant of the legacy single-key shape).
export function activeKey(settings) {
  return settings?.keys?.[settings.provider] || settings?.apiKey || '';
}
export function hasKey(settings) {
  return !!activeKey(settings);
}

function aiError(status, message) {
  const e = new Error(message || `Request failed (${status})`);
  e.status = status;
  return e;
}

// ── Per-provider browser calls ──────────────────────────────────────────────
async function anthropicChat(apiKey, model, system, user) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const msg = await client.messages.create({
    model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = (msg.content || []).find((b) => b.type === 'text');
  return block ? block.text.trim() : '';
}

async function openaiChat(apiKey, model, system, user) {
  // No temperature / max_tokens so any model (incl. reasoning models that reject
  // those params) works without per-model special-casing.
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw aiError(res.status, e?.error?.message);
  }
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function geminiChat(apiKey, model, system, user) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
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

async function chat(settings, system, user) {
  const key = activeKey(settings);
  if (!key) throw aiError(0, 'No API key set for the selected provider.');
  const model = settings.model;
  switch (settings.provider) {
    case 'openai':
      return openaiChat(key, model, system, user);
    case 'gemini':
      return geminiChat(key, model, system, user);
    case 'anthropic':
    default:
      return anthropicChat(key, model, system, user);
  }
}

// ── System prompt (provider-agnostic) ────────────────────────────────────────
function buildSystemPrompt({ profile, decision, gate, priorEvidence }) {
  const lines = priorEvidence
    .map((e) => {
      const g = e.gateName || `Gate ${e.gateOrder}`;
      if (e.status === 'skipped') {
        return `- [${g}] SKIPPED — reason: ${e.skipReason || '(none given)'}`;
      }
      const body =
        Array.isArray(e.sections) && e.sections.length
          ? e.sections.map((s) => `    ${s.label}: ${s.value}`).join('\n')
          : `    → ${e.response || ''}${e.source ? ` (source: ${e.source})` : ''}`;
      return `- [${g}] ${e.questionAsked}\n${body}`;
    })
    .join('\n');

  const productLines = (profile.productLines || []).filter(Boolean).join(', ');
  const decisionLines = Array.isArray(decision.productLines)
    ? decision.productLines
    : decision.productLine
    ? [decision.productLine]
    : [];

  return `You are Diligence, a sharp, supportive product-management mentor running a
stage-gate diligence review. You facilitate the PM's own thinking and structure
it into evidence. You are NOT a generator.

HARD CONSTRAINTS (never violate):
- You never make the decision, generate the evidence, or invent user feedback.
- You never claim that validation happened. You never fabricate quotes or data.
- You never advance or skip a gate — those are the user's clicks, not yours.
- Only offer solution ideas if the user explicitly asks; if they do, frame them
  as prompts to react to, clearly labelled as suggestions, never as the answer.

STANCE:
- Feedback before solutioning. Bias hard toward forcing real user / stakeholder
  validation before a decision advances to build.
- Tone: direct, not sycophantic. A peer doing a rigorous stage-gate review.
- Personalise phrasing to THIS PM and product, but keep questions tight and
  answerable. One question (or a short, focused series). No preamble.

PM PROFILE:
- Type of PM: ${profile.pmType || '(unspecified)'}
- Product / platform: ${profile.productName || '(unspecified)'}
- Product lines / segments: ${productLines || '(none specified)'}

CURRENT DECISION:
- Title: ${decision.title}
- Type: ${decision.type}
- Affected product lines: ${decisionLines.join(', ') || '(unspecified)'}

EVIDENCE GATHERED SO FAR:
${lines || '(none yet — this is the first gate)'}

CURRENT GATE: ${gate.name} — purpose: ${gate.purpose}
Evidence bar for this gate: ${gate.evidenceBar}`;
}

// Robust JSON extraction — the model is prompted for JSON, never trusted blindly.
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

// 1) Ask the gate's core question, personalised. Returns plain text.
export async function generateGateQuestion(settings, ctx) {
  const text = await chat(
    settings,
    buildSystemPrompt(ctx),
    'Ask me the core question for the current gate, personalised to my product ' +
      'and the decision. One question, or a short focused series. No preamble, ' +
      'no restating the gate name — just the question(s).',
  );
  return text || ctx.gate.coreQuestion;
}

// 2) Evaluate evidence against the bar. Returns at most ONE probing follow-up.
export async function probeEvidence(settings, ctx, response) {
  const text = await chat(
    settings,
    buildSystemPrompt(ctx),
    `Here is my evidence for the "${ctx.gate.name}" gate:\n\n"${response}"\n\n` +
      'Does this meet the evidence bar? Reply ONLY with JSON: ' +
      '{"meetsBar": boolean, "followUp": string}. If it does NOT meet the bar, ' +
      '"followUp" is exactly ONE probing question to sharpen the evidence (e.g. ' +
      'distinguishing a stakeholder request from end-user validation). If it ' +
      'does meet the bar, "followUp" is an empty string. Do not generate evidence.',
  );
  const parsed = extractJson(text);
  return {
    meetsBar: !!parsed.meetsBar,
    followUp: typeof parsed.followUp === 'string' ? parsed.followUp.trim() : '',
  };
}

// 3) Last-resort ideation — ONLY on explicit request. Angles to react to.
export async function getIdeationAngles(settings, ctx) {
  const text = await chat(
    settings,
    buildSystemPrompt(ctx),
    "I'm stuck — give me angles for this gate. Reply ONLY with JSON: " +
      '{"angles": string[]}. Each angle is a short prompt for ME to react to or ' +
      'investigate — NOT a decision, NOT invented evidence. 3–4 angles.',
  );
  const parsed = extractJson(text);
  return Array.isArray(parsed.angles) ? parsed.angles.filter(Boolean) : [];
}

export function describeError(err) {
  const s = err?.status;
  if (s === 401 || s === 403) return 'The provider rejected your API key. Check the provider + key in Settings.';
  if (s === 429) return 'Rate limited by the provider (429). Wait a moment and retry.';
  if (s >= 500) return 'The provider had a server error. Try again shortly.';
  if (err instanceof TypeError)
    return 'Could not reach the provider (network/CORS). Check the key, or try another provider.';
  return err?.message || 'Something went wrong talking to the AI provider.';
}
