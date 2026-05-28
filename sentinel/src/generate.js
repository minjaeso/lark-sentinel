import OpenAI from 'openai';

// Default to gpt-5 — the latest model as of the hackathon (May 2026).
// Override via SENTINEL_OPENAI_MODEL (e.g. gpt-5-mini for cheaper runs, gpt-4o for fallback).
const MODEL = process.env.SENTINEL_OPENAI_MODEL || 'gpt-5';

const SYSTEM = `You generate end-to-end REGRESSION test workflows for the Lark testing platform.
Lark workflows are written in plain English and executed by an AI browser agent.

YOUR JOB IS REGRESSION DETECTION. The PR author may have introduced a regression they
didn't notice. Do NOT trust the diff or the PR title to define what's "correct" — test
what the END USER expects to happen.

Each workflow must:
- Walk the end user's happy path for the touched surface, all the way to the visible
  outcome the user expects (a confirmation message, a page rendering, an item in a cart,
  an order placed, etc.). Then explicitly assert that visible outcome.
- NEVER assert implementation details shown in the diff (request payload contents,
  internal headers, code shapes). Those will pass even when the user flow is broken.
- For a touched form: "fill in valid inputs, click submit, expect the success message"
  — NOT "verify the request body contains field X."
- For a touched list / display: "load the page, expect items to render"
  — NOT "verify each item's HTML attributes match the diff."
- For a touched API route: exercise the calling UI path; the test passes only if the
  user-visible result is correct.

The diff patches are CONTEXT for which user flow to test. They are NOT the specification
of what passes. The diff might be the bug.

Use the literal labels, selectors, and data-testids visible in the patches. Do not
invent UI affordances that aren't shown.

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

Generate up to ${maxWorkflows} REGRESSION workflows that walk the end-user happy path
through the touched surface and assert the user-visible outcome.
- One workflow per distinct user journey. Do not over-test a single surface item.
- If a route is touched, write "Visit ${previewUrl}<route>, then walk through the flow
  the user would take, then assert the user-visible outcome." Use the actual route.
- If an API route is touched, exercise the calling UI flow end-to-end. Do not call the
  API directly.
- If a layout or shared component is touched, pick one representative page.
- DO NOT write tests that just verify the diff itself (e.g. "the POST body contains X",
  "the new product is listed"). Test that the user flow still works.
- Use ONLY selectors, labels, and behaviors visible in the diff patches. Don't assume
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
