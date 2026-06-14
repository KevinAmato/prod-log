import Anthropic from '@anthropic-ai/sdk';

// BYOK: the key lives only in the user's browser and is sent only to Anthropic.
// `dangerouslyAllowBrowser` is required for direct browser calls — acceptable
// for a personal, technical-user tool (implementation plan §8). The SDK adds
// the `anthropic-dangerous-direct-browser-access` header for us.
//
// Model note: default is claude-opus-4-8. Do NOT pass `temperature` — it is
// removed on Opus 4.8 / 4.7 and returns a 400. Keep the request surface minimal.

function makeClient(apiKey) {
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

// ── System prompt: the design principles, made operational ──────────────────
function buildSystemPrompt({ profile, decision, gate, priorEvidence }) {
  const lines = priorEvidence
    .map((e) => {
      const g = e.gateName || `Gate ${e.gateOrder}`;
      if (e.status === 'skipped') {
        return `- [${g}] SKIPPED — reason: ${e.skipReason || '(none given)'}`;
      }
      // New entries store labelled `sections`; tolerate the legacy
      // response/source shape for anything saved before the merge.
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

// Robust JSON extraction (pattern borrowed from ThreadPatrol's AnthropicClient):
// the model is prompted for JSON, but we never trust the envelope blindly.
function extractJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON object in model response');
  return JSON.parse(match[0]);
}

function firstText(message) {
  const block = (message.content || []).find((b) => b.type === 'text');
  return block ? block.text.trim() : '';
}

// 1) Ask the gate's core question, personalised. Returns plain text.
export async function generateGateQuestion(settings, ctx) {
  const client = makeClient(settings.apiKey);
  const system = buildSystemPrompt(ctx);
  const message = await client.messages.create({
    model: settings.model,
    max_tokens: 512,
    system,
    messages: [
      {
        role: 'user',
        content:
          'Ask me the core question for the current gate, personalised to my ' +
          'product and the decision. One question, or a short focused series. ' +
          'No preamble, no restating the gate name — just the question(s).',
      },
    ],
  });
  return firstText(message) || ctx.gate.coreQuestion;
}

// 2) Evaluate the user's evidence against the bar. Returns at most ONE probing
//    follow-up. Never blocks — the caller still lets the user provide/skip.
export async function probeEvidence(settings, ctx, response) {
  const client = makeClient(settings.apiKey);
  const system = buildSystemPrompt(ctx);
  const message = await client.messages.create({
    model: settings.model,
    max_tokens: 512,
    system,
    messages: [
      {
        role: 'user',
        content:
          `Here is my evidence for the "${ctx.gate.name}" gate:\n\n"${response}"\n\n` +
          'Does this meet the evidence bar? Reply ONLY with JSON: ' +
          '{"meetsBar": boolean, "followUp": string}. ' +
          'If it does NOT meet the bar, "followUp" is exactly ONE probing ' +
          'question to sharpen the evidence (e.g. distinguishing a stakeholder ' +
          'request from end-user validation). If it does meet the bar, ' +
          '"followUp" is an empty string. Do not generate evidence yourself.',
      },
    ],
  });
  const parsed = extractJson(firstText(message));
  return {
    meetsBar: !!parsed.meetsBar,
    followUp: typeof parsed.followUp === 'string' ? parsed.followUp.trim() : '',
  };
}

// 3) Last-resort ideation — ONLY on explicit user request. Returns angles
//    framed as prompts to react to, never as the decision.
export async function getIdeationAngles(settings, ctx) {
  const client = makeClient(settings.apiKey);
  const system = buildSystemPrompt(ctx);
  const message = await client.messages.create({
    model: settings.model,
    max_tokens: 700,
    system,
    messages: [
      {
        role: 'user',
        content:
          "I'm stuck — give me angles for this gate. Reply ONLY with JSON: " +
          '{"angles": string[]}. Each angle is a short prompt for ME to react ' +
          'to or investigate — NOT a decision, NOT invented evidence. 3–4 angles.',
      },
    ],
  });
  const parsed = extractJson(firstText(message));
  return Array.isArray(parsed.angles) ? parsed.angles.filter(Boolean) : [];
}

// Surfaces a clean message for the UI from SDK errors (401, 429, CORS, etc.).
export function describeError(err) {
  if (err && err.status === 401) return 'Anthropic rejected the API key (401). Check it in Settings.';
  if (err && err.status === 429) return 'Rate limited by Anthropic (429). Wait a moment and retry.';
  if (err && err.status >= 500) return 'Anthropic had a server error. Try again shortly.';
  return err?.message || 'Something went wrong talking to Anthropic.';
}
