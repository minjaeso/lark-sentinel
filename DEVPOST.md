# Lark Sentinel — Devpost submission

> **Track:** Lark — Best Use of Lark CLI and/or MCP
> **Repo:** https://github.com/minjaeso/lark-sentinel
> **Live demo PRs:**
> - Green path: https://github.com/minjaeso/lark-sentinel/pull/3 — Quant Console rebuild; Sentinel ships `all 2 passing`.
> - Red path: https://github.com/minjaeso/lark-sentinel/pull/4 — a one-line "schema refactor" silently drops the agent's name on redirect. Sentinel walks the deploy flow, scrolls the dashboard, and **sees the literal word `undefined`** where the new agent's name should be.

## Inspiration

Coverage % doesn't tell a PR reviewer *which user journeys this diff breaks*,
and the E2E suite only catches what someone wrote a test for months ago.
PRs that touch the checkout flow, the auth middleware, or a layout component
ship with no fresh, targeted verification that the user-facing surface still
works.

Lark's own `validate-branch` skill runs the **existing** workflow catalog.
We wanted the inverse: a GitHub Action that **generates a brand-new,
diff-targeted regression suite on every PR**, runs it against the PR's
preview deploy, and posts a video-rich pass/fail back to the PR.

## What it does

For every PR Lark Sentinel:

1. Reads the PR diff via the GitHub API.
2. Maps the changed files to user-facing surface (Next.js app router
   pages, layouts, route handlers, route-child components, root-level
   helper files, pages router, shared components).
3. Deploys the PR's code to a fresh Vercel preview with `vercel pull` →
   `vercel build` → `vercel deploy --prebuilt`.
4. Prompts OpenAI gpt-5 with the surface area + the actual diff patches,
   asking for natural-language **regression** workflow descriptions (not
   diff-verification tests).
5. Creates the workflows in Lark via `getlark workflows create`, invokes
   them with `--wait`, and parses both the JSON-shaped and human-readable
   CLI outputs.
6. Polls each execution via `getlark workflows executions get`, pulling
   presigned URLs for the video recording, screenshot, and repro script —
   and the per-step pass/fail trace Lark's agent emits.
7. On a first-run failure, triggers Lark's `repairs` flow (when the
   workflow is deterministic) and re-invokes.
8. Posts (and upserts) a single PR comment with pass/fail badges, the
   per-step checklist, the summary Lark generated, and the artifact links.
9. On any real failure, files a Linear issue via the Linear GraphQL
   `issueCreate` mutation with the video + repro attached.
10. Archives the ephemeral workflows so the Lark dashboard stays clean.

The demo system-under-test is **Quant Console**, a Binance-styled AI
trading-agent control plane (dashboard with KPIs + agents table, a
deploy-an-agent form, and a POST endpoint) — the kind of product a real
SF startup would actually build.

## How we built it

- **Composite GitHub Action** (Node 20, ESM, no build step) so the same
  action can be dropped into any repo via `uses: minjaeso/lark-sentinel@v1`.
- **Lark CLI** (`@getlark/cli`) for every read and write operation. We
  probed every command's stdout/stderr against a live Lark account to lock
  in parsers tolerant of both JSON and human-readable formats and exit
  codes [0, 1].
- **Vercel CLI in-CI** so each PR gets a truly per-commit preview URL.
- **OpenAI gpt-5** with `response_format: json_object` so we get parseable
  output without retries. Override via `SENTINEL_OPENAI_MODEL` env.
- **Linear GraphQL** for the failure-to-ticket pipeline.
- **Binance-derived design system** for the demo app — see `demo-app/DESIGN.md`.

## Challenges we ran into

- **Prompt grounding (the core insight).** First iteration generated tests
  that *asserted the diff did what its author claimed* — so a broken PR
  passed because the test verified the bug. PR #4 is the proof:
  a one-line "schema refactor" that drops a field silently. We watched the
  same PR flip from "passes the bug" to "catches the bug" the moment we
  rewrote the prompt to frame the LLM as a **regression detector** that
  asserts user-visible outcomes regardless of what the diff claims.
- **getlark CLI output is dual-format.** Most commands return JSON, but
  `workflows invoke --wait` emits human progress on stderr and exits
  non-zero on test failures (which is correct CLI behavior but breaks
  naive parsers). Built a tolerant parser that accepts both shapes and
  exit codes.
- **Vercel deployment protection.** Every Vercel preview is gated by
  default; Lark's browser agent has no way to authenticate. Resolved by
  disabling Vercel Authentication on the demo project.
- **Surface mapper coverage.** First implementation only matched
  `app/<route>/page.tsx` — editing a helper component under the same
  route fell through and Sentinel reported the PR as having no surface.
  Added an `APP_ROUTER_CHILD` fallback, then later an `APP_ROOT_CHILD`
  fallback for files directly under `app/` (e.g. `app/Dashboard.tsx`).
- **Repair flow only works on deterministic workflows.** AI-driven
  workflows can't be "repaired" because they regenerate each run. Added
  a graceful skip so the orchestrator doesn't warn loudly on every fail.
- **Lark artifact URLs expire.** Videos, screenshots, and repro scripts
  are presigned S3 URLs valid for ~1 hour. The PR comment goes stale.
  Today we refresh on demand; the durable fix is to mirror artifacts into
  the GitHub repo's release assets (see "What's next").

## Accomplishments we're proud of

- Goes from `git push` to a video-bearing PR comment in **~2 minutes**.
- Both demo paths (green PR #3 + red PR #4) are reproducible by opening
  one PR each, no manual setup required after secrets are wired.
- The regression-not-diff prompt change is a real product insight — we
  watched the same PR flip from "passes the bug" to "catches the bug"
  after the rewrite.
- Lark's per-step trace makes the PR comment self-explanatory: judges see
  exactly which step in the user flow failed without watching a video.
- Composes five separate platforms (GitHub, Vercel, Lark, OpenAI, Linear)
  without managing any infrastructure of our own.

## What we learned

- Lark's CLI surface is enough to build production-grade automation on
  top of without ever touching the dashboard.
- LLM-driven E2E test generation lives or dies by what context you ground
  it in. Surface area + literal diff patches is the right level — patches
  alone over-trust the diff; surface area alone under-grounds the test.
- The "diff is the bug" framing is the key to building useful regression
  detectors with LLMs — telling the model to verify the diff is exactly
  the failure mode you want to avoid.

## What's next

- **Persistent artifact storage.** Mirror Lark's videos and screenshots
  into GitHub release assets so the PR comment links never expire.
- **`workflow_dispatch` refresh button** so anyone (judge, reviewer) can
  re-run the comment refresh on demand without a new commit.
- **Switch generated workflows to deterministic mode** after first run so
  Lark's repair-on-flake path can actually fire (currently no-op for
  ai_driven workflows).
- **Lark `secret-contexts` integration** to pass test fixture credentials
  (login state, API keys) for workflows that need authenticated state.
- **GitHub App distribution** so the action installs in one click.

## Built with

`Lark CLI` · `OpenAI gpt-5` · `Vercel CLI` · `Linear GraphQL` · `GitHub Actions` · `Next.js 15` · `Node 20 / ESM`
