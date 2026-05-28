import OpenAI from 'openai';

// Default to gpt-4o (broad availability + native JSON mode).
// Set SENTINEL_OPENAI_MODEL to override (e.g. gpt-5, gpt-4o-mini for cheaper runs).
const MODEL = process.env.SENTINEL_OPENAI_MODEL || 'gpt-4o';

const SYSTEM = `You generate end-to-end test workflow descriptions for the Lark testing platform.
Lark workflows are written in plain English and executed by an AI browser agent.
Each workflow you generate must:
- Verify ONE concrete user-facing behavior touched by the PR's diff.
- Start from the provided base URL.
- Be self-contained: include the URL to visit, the steps to take, and the expected outcome.
- Be concrete enough that an AI agent (with no other context) can execute it end-to-end.
- Prefer happy-path verification first, then 1-2 critical edge cases if budget allows.

Return ONLY valid JSON of the shape:
{"workflows":[{"name":"<short-kebab-case>","description":"<plain English test, 2-6 sentences>"}]}
No prose, no markdown fences, no commentary.`;

function userPrompt({ surface, previewUrl, maxWorkflows, prTitle, prBody }) {
  const surfaceLines = surface
    .map((s) => {
      const hint = s.hint ? ` — ${s.hint}` : '';
      return `- [${s.kind}] ${s.label}${hint}  (touched by: ${s.source})`;
    })
    .join('\n');
  return `Preview deploy base URL: ${previewUrl}

PR title: ${prTitle}
PR description: ${prBody.slice(0, 800) || '(none)'}

The diff touches the following user-facing surface:
${surfaceLines}

Generate up to ${maxWorkflows} workflow descriptions that, together, verify the changed surface end-to-end.
- One workflow per distinct user journey. Do not over-test a single surface item.
- If a route is touched, write "Visit ${previewUrl}<route>, then ..." (use the actual route).
- If an API route is touched, write a workflow that exercises the route via the UI that calls it; only fall back to a direct fetch() if no UI path exists.
- If a layout or shared component is touched, pick one representative page to test it through.
- Keep names short (3-5 words, kebab-case). Keep descriptions tight and unambiguous.`;
}

export async function generateWorkflowDescriptions(opts) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: MODEL,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM },
      { role: 'user', content: userPrompt(opts) },
    ],
  });

  const text = (completion.choices?.[0]?.message?.content || '').trim();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new Error(`LLM did not return valid JSON. Got: ${text.slice(0, 400)}`);
  }
  if (!parsed.workflows || !Array.isArray(parsed.workflows)) {
    throw new Error(`LLM JSON missing "workflows" array. Got: ${text.slice(0, 400)}`);
  }
  return parsed.workflows
    .filter((w) => w && typeof w.name === 'string' && typeof w.description === 'string')
    .slice(0, opts.maxWorkflows)
    .map((w) => ({
      name: w.name.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/^-+|-+$/g, '').slice(0, 40),
      description: w.description.trim(),
    }));
}
