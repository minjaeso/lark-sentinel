# Lark Sentinel

> **DevNetwork AI/ML Hackathon 2026 — Lark Track submission.**
> A GitHub Action that turns every PR into a self-testing PR. Sentinel generates
> **new, diff-targeted** Lark workflows on every pull request, deploys the PR
> to a fresh Vercel preview, runs the workflows against it, and posts a
> video-rich pass/fail comment back to the PR — closing the loop with
> Lark's repair flow on flakes and a Linear ticket on real regressions.

## Live demo

The demo system-under-test is **Quant Console** — a Binance-styled AI trading
agent control plane (dashboard with KPIs + agents table, a deploy-an-agent
form, and a POST endpoint). Two PRs show the full pass/fail story:

| Path | PR | What it shows |
|---|---|---|
| 🟢 **Green** | [#3 — rebuild as Quant Console](https://github.com/minjaeso/lark-sentinel/pull/3) | The new dashboard ships clean. Sentinel reads the diff, deploys the PR to a Vercel preview, generates 2 regression workflows, and reports `all 2 passing` — including the full deploy-an-agent end-to-end flow. |
| 🔴 **Red** | [#4 — pre-map agent response into dashboard schema](https://github.com/minjaeso/lark-sentinel/pull/4) | A one-line "schema refactor" silently drops the agent's name on the redirect. Sentinel walks the deploy flow, scrolls the dashboard, **sees the literal word "undefined" where the new agent's name should be**, and posts a screenshot named `dashboard-showing-undefined.png` + video. |

Click into either PR → scroll to the Sentinel comment → click `▶ video` to
watch Lark's recording, or `🖼 screenshot` to see what its agent saw.

> **Note on artifact URLs.** Lark serves videos/screenshots via presigned S3
> URLs that expire ~1 hour after they're fetched. The PR comments are
> refreshed at submission time; if a link returns
> `AccessDenied · Request has expired`, re-run the action (or ping me) and
> a fresh comment will go up.

## The problem

Coverage % doesn't tell a reviewer *which user journeys this diff breaks.*
Existing E2E suites only catch what someone wrote a test for months ago.
PRs that touch the checkout flow, the auth middleware, or a layout component
ship without anyone verifying the user-facing surface actually still works.

## What Sentinel does on every PR

```
            ┌──────────────────────────────────────────────────────────┐
PR opened → │  1. Read the diff (via GitHub API)                       │
            │  2. Map files → user-facing surface                      │
            │       (Next.js app router pages, layouts, route          │
            │        handlers, route-child components, root-child      │
            │        helpers, pages router)                            │
            │  3. Deploy this PR to a fresh Vercel preview             │
            │       (vercel pull → build → deploy --prebuilt)          │
            │  4. Ask OpenAI gpt-5 for N regression workflows that     │
            │       walk the touched user flow end-to-end              │
            │       (grounded in actual diff patches, NOT in claims    │
            │        the PR author makes in the description)           │
            │  5. Create + invoke the workflows in Lark (getlark CLI)  │
            │  6. Lark's AI agent drives a real browser through each   │
            │  7. On flake (deterministic mode) → Lark repair + re-run │
            │  8. Post a single upsertable PR comment with             │
            │       per-step checklist + video / screenshot / repro    │
            │  9. On real failure → file a Linear ticket               │
            │ 10. Archive ephemeral workflows so Lark stays tidy       │
            └──────────────────────────────────────────────────────────┘
```

The result: every PR carries a **fresh, targeted** answer to *"did this break
anything the user can see?"* — generated in ~2 minutes, not maintained by hand.

## Why this is differentiated

Lark already ships a `validate-branch` skill that runs **existing**
workflows. Sentinel **generates new ones aimed at the diff**, so the test
catalog automatically follows the shape of the code instead of lagging it.

The prompt is explicitly framed as **regression detection, not diff
verification**: the PR author may have introduced a bug they didn't notice,
so the generated tests assert *user-visible outcomes* ("the success message
appears", "the new agent shows up in the list") rather than implementation
details that just mirror the diff. PR #4's bug — a misleading "schema refactor"
comment that hides a missing field — passed the LLM's "is this what the
author claims they did?" interpretation but **failed Sentinel's user-flow
assertion** because the user-visible name was `undefined`. That's the whole
product insight.

## What a Sentinel PR comment looks like

```
## Lark Sentinel
1 failing, 0 passing of 1 generated workflow(s).

|   | Workflow                | Artifacts                  |
|:-:|-------------------------|----------------------------|
| ❌ | deploy-agent-dashboard  | ▶ video · 🖼 screenshot     |

### Findings
❌ deploy-agent-dashboard — wflw_us14mD2op7vPOqrjJp63j5YW

Lark's agent ran these steps:
- ✅ Navigate to /agents/new
- ✅ Fill agent name with "Alpha Test Bot"
- ✅ Verify initial capital is pre-filled with $100,000
- ✅ Click Deploy Agent button to submit form
- ✅ Verify redirect to homepage with ?created= query parameter
- ❌ Verify "Alpha Test Bot" text is visible on dashboard

> The agent deployment workflow partially works but has a critical bug.
> Form submission at /agents/new succeeds, shows "Agent deployed
> successfully" toast, and redirects to homepage with ?created=
> query parameter. However, the newly created agent displays
> "undefined" instead of "Alpha Test Bot" in the dashboard table.
> The agent name is not being properly saved or rendered.
```

## 60-second demo recipe

1. Clone this repo, push to your own GitHub account.
2. Add repo secrets (`gh secret set ... -R <repo>`):
   - `GETLARK_API_KEY` from app.getlark.ai → settings → API keys
   - `OPENAI_API_KEY` from platform.openai.com/api-keys
   - `VERCEL_TOKEN` from vercel.com/account/tokens
   - `LINEAR_API_KEY` *(optional)*
3. Add repo vars: `VERCEL_PROJECT_ID`, `VERCEL_ORG_ID` (from your local
   `demo-app/.vercel/project.json` after running `vercel link`), and
   optionally `LINEAR_TEAM_ID`.
4. Open a PR that touches `demo-app/**`. Within ~2 minutes a Sentinel
   comment appears with the verdict + Lark video URLs.

## Repo layout

```
.
├── sentinel/                            The reusable GitHub Action
│   ├── action.yml                       Composite action manifest
│   ├── src/                             JS modules (Node 20, ESM, no build)
│   │   ├── index.js                     10-phase orchestrator
│   │   ├── diff.js                      PR file list (@actions/github)
│   │   ├── surface.js                   file → route / api / component /
│   │   │                                route-child / root-child
│   │   ├── generate.js                  OpenAI gpt-5 → regression workflows,
│   │   │                                grounded in the actual diff patches
│   │   ├── lark.js                      getlark CLI for create / invoke
│   │   │                                --wait / executions get / repairs /
│   │   │                                archive; tolerant of JSON and human
│   │   │                                output, accepts exit codes [0, 1]
│   │   ├── comment.js                   single upsertable PR comment with
│   │   │                                per-step checklist + artifact links
│   │   ├── linear.js                    issueCreate GraphQL on real failures
│   │   └── smoke.js                     offline smoke test (6 assertions)
│   └── README.md
├── demo-app/                            Quant Console (Next.js 15)
│   ├── DESIGN.md                        Binance-derived design system spec
│   ├── app/
│   │   ├── globals.css                  Design tokens as CSS variables
│   │   ├── layout.tsx                   Root layout, top nav, footer
│   │   ├── page.tsx                     Dashboard Suspense wrapper
│   │   ├── Dashboard.tsx                Agents dashboard (KPIs + table)
│   │   ├── agents/new/page.tsx          Deploy form page
│   │   ├── agents/new/AgentForm.tsx     Deploy form (client)
│   │   └── api/agents/route.ts          GET (list) + POST (create)
│   ├── lib/
│   │   └── agents.ts                    Seed data + types + formatters
│   └── README.md
├── .github/workflows/
│   └── sentinel.yml                     vercel pull → build → deploy →
│                                        Sentinel
├── DEVPOST.md                           Hackathon submission write-up
└── README.md                            You are here
```

## Setup checklist

| Where | Name | Purpose |
|---|---|---|
| Repo secret | `GETLARK_API_KEY` | Lark API |
| Repo secret | `OPENAI_API_KEY` | OpenAI API (workflow generation) |
| Repo secret | `VERCEL_TOKEN` | Deploys the PR's code as a fresh preview |
| Repo secret | `LINEAR_API_KEY` *(opt)* | Auto-file tickets on real failures |
| Repo var | `VERCEL_PROJECT_ID` | From `demo-app/.vercel/project.json` |
| Repo var | `VERCEL_ORG_ID` | From `demo-app/.vercel/project.json` |
| Repo var | `LINEAR_TEAM_ID` *(opt)* | Where Linear tickets land |

## Smoke test

```bash
cd sentinel
npm install
npm run smoke
# All smoke checks passed.
```

## Built with

- **Lark CLI** — `@getlark/cli` for workflow `create` / `invoke --wait` /
  `executions get` / `repairs trigger` / `archive`.
- **Lark REST artifacts** — presigned S3 URLs for video, screenshot,
  and repro-script downloads.
- **OpenAI gpt-5** — generates regression workflow descriptions in JSON
  mode. Override via `SENTINEL_OPENAI_MODEL`.
- **Vercel CLI** — `vercel pull` → `vercel build` → `vercel deploy
  --prebuilt` for the per-PR preview deploy.
- **Linear GraphQL** — `issueCreate` mutation for the failure-ticket loop.
- **GitHub Actions** — composite action that runs in any repo.

## What's next

- **Persistent artifact storage.** Today, Lark's video/screenshot/repro
  links expire ~1 hour after fetch; the PR comment goes stale. Pull
  artifacts to GitHub release assets so they persist for the lifetime
  of the repo.
- **`workflow_dispatch` refresh button** so anyone (judge, reviewer) can
  re-run the comment refresh on demand without a new commit.
- **Switch generated workflows to deterministic mode** after first run so
  Lark's repair-on-flake path can actually fire (currently no-op for
  ai_driven workflows).
- **GitHub App distribution** so the action installs in one click.

## Hackathon entry

**Track:** Lark — Best Use of Lark CLI and/or MCP
**Built by:** [@minjaeso](https://github.com/minjaeso)
**Repo:** [minjaeso/lark-sentinel](https://github.com/minjaeso/lark-sentinel)
**Submission write-up:** [DEVPOST.md](./DEVPOST.md)
