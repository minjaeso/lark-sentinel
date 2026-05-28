import OpenAI from 'openai';

// Default to gpt-4o (broad availability + native JSON mode).
// Set SENTINEL_OPENAI_MODEL to override (e.g. gpt-5, gpt-4o-mini for cheaper runs).
const MODEL = process.env.SENTINEL_OPENAI_MODEL || 'gpt-4o';

const SYSTEM = `You generate end-to-end test workflow descriptions for the Lark testing platform.
Lark workflows are written in plain English and executed by an AI browser agent.

CRITICAL: Ground every test in what the diff ACTUALLY shows. Do not invent UI affordances
(e.g., "click the product name to open a details page") unless you can SEE them in the diff
patch. If the diff shows a "Buy" button, the test clicks "Buy" — not the product name.
If the patch is small and the surrounding code isn't shown, stick to behaviors you can
infer from filenames and the snippet you do see.

Each workflow must:
- Verify ONE concrete user-facing behavior that the diff actually changes or surrounds.
- Start from the provided base URL.
- Be self-contained: include the URL to visit, the literal selectors/labels visible in the
  patch, the steps to take, and a clear pass criterion.
- Prefer regression tests (the existing flow still works) over assertions about brand-new
  text or numbers that might be cosmetic.

Return ONLY valid JSON of the shape:
{"workflows":[{"name":"<short-kebab-case>","description":"<plain English test, 2-6 sentences>"}]}
No prose, no markdown fences, no commentary.`;

const MAX_PATCH_CHARS = 2500;
const MAX_TOTAL_PATCH_CHARS = 8000;

function summarizePatches(files = []) {
  const blocks = [];
  let used = 0;
  for (const f of files) {
    if (!f.patch) continue;
    const remaining = MAX_TOTAL_PATCH_CHARS - used;
    if (remaining <= 200) break;
    const slice = f.patch.length > MAX_PATCH_CHARS
      ? f.patch.slice(0, MAX_PATCH_CHARS) + '\n... (truncated)'
      : f.patch;
    const block = `### ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})\n\`\`\`diff\n${slice}\n\`\`\``;
    if (block.length > remaining) break;
    blocks.push(block);
    used += block.length;
  }
  return blocks.join('\n\n');
}

function userPrompt({ surface, files, previewUrl, maxWorkflows, prTitle, prBody }) {
  const surfaceLines = surface
    .map((s) => {
      const hint = s.hint ? ` — ${s.hint}` : '';
      return `- [${s.kind}] ${s.label}${hint}  (touched by: ${s.source})`;
    })
    .join('\n');
  const patches = summarizePatches(files);
  return `Preview deploy base URL: ${previewUrl}

PR title: ${prTitle}
PR description: ${prBody.slice(0, 800) || '(none)'}

The diff touches the following user-facing surface:
${surfaceLines}

Diff patches (use these as the source of truth for what the page actually contains):
${patches || '(no patch content available)'}

Generate up to ${maxWorkflows} workflow descriptions that, together, verify the changed surface end-to-end.
- One workflow per distinct user journey. Do not over-test a single surface item.
- If a route is touched, write "Visit ${previewUrl}<route>, then ..." (use the actual route).
- If an API route is touched, exercise it via the UI that calls it; only fall back to a direct
  fetch() if no UI path exists.
- If a layout or shared component is touched, pick one representative page to test it through.
- Use ONLY selectors, labels, and behaviors visible in the diff patches above. Don't assume
  features (detail pages, modals, dropdowns) that aren't shown.
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
