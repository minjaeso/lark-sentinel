# Lark Sentinel

> **DevNetwork AI/ML Hackathon 2026 — Lark Track submission.**
> A GitHub Action that turns every PR into a self-testing PR. Sentinel generates
> **new, diff-targeted** Lark workflows on every pull request, deploys the PR
> to a fresh Vercel preview, runs the workflows against it, and posts a
> video-rich pass/fail comment back to the PR — closing the loop with
> Lark's repair flow on flakes and a Linear ticket on real regressions.

## Live demo

Both demo paths are live in this repo:

| Path | PR | What it shows |
|---|---|---|
| 🟢 **Green** | [#1 — add product to list](https://github.com/minjaeso/lark-sentinel/pull/1) | Sentinel runs against the PR's own Vercel preview, generates a `/products` test, passes. Video of the rendered storefront. |
| 🔴 **Red** | [#2 — drop email from POST](https://github.com/minjaeso/lark-sentinel/pull/2) | Same flow, but the diff silently breaks `/api/checkout`. Sentinel catches the regression and posts the broken-submit video. |

Click into either PR → scroll to the Sentinel comment → click `▶ video` to
see the Lark agent's recording.

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
            │       (Next.js app router + pages router + children)     │
            │  3. Deploy this PR to a fresh Vercel preview (CLI)       │
            │  4. Ask OpenAI to write N regression workflows that      │
            │       walk the touched user flow end-to-end              │
            │  5. Create + invoke the workflows in Lark (getlark CLI)  │
            │  6. Lark's AI agent drives a real browser through each   │
            │  7. On flake (deterministic mode) → Lark repair + re-run │
            │  8. Post a single upsertable PR comment with video,      │
            │       screenshot, and repro-script links                 │
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
appears") rather than implementation details that just mirror the diff.

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
├── sentinel/                      The reusable GitHub Action
│   ├── action.yml                 Composite action manifest
│   ├── src/                       JS modules (Node 20, ESM)
│   │   ├── index.js               10-phase orchestrator
│   │   ├── diff.js                PR file list (@actions/github)
│   │   ├── surface.js             file → route/api/component/route-child
│   │   ├── generate.js            OpenAI → regression workflow descriptions
│   │   ├── lark.js                getlark CLI for create/invoke/repair/archive
│   │   ├── comment.js             single upsertable PR comment
│   │   ├── linear.js              issueCreate GraphQL on real failures
│   │   └── smoke.js               offline smoke test
│   └── README.md
├── demo-app/                      Next.js 15 storefront
│   ├── app/
│   │   ├── page.tsx               /
│   │   ├── products/page.tsx      /products
│   │   ├── checkout/page.tsx      /checkout (server) + Suspense
│   │   ├── checkout/CheckoutForm.tsx   (client component)
│   │   └── api/checkout/route.ts  /api/checkout (POST)
│   └── README.md
├── .github/workflows/
│   └── sentinel.yml               vercel build → vercel deploy → Sentinel
└── README.md                      You are here
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

- **Lark CLI** — `@getlark/cli` for workflow `create` / `invoke --wait` / `repairs trigger` / `archive`.
- **Lark REST API** — `api.getlark.ai` for execution + presigned artifact URLs (videos, screenshots, repro scripts).
- **OpenAI gpt-4o** — generates regression workflow descriptions in JSON mode. Override via `SENTINEL_OPENAI_MODEL` env.
- **Vercel CLI** — `vercel pull` → `vercel build` → `vercel deploy --prebuilt` for the per-PR preview deploy.
- **Linear GraphQL** — `issueCreate` mutation for the failure-ticket loop.
- **GitHub Actions** — composite action that runs in any repo.

## Hackathon entry

**Track:** Lark — Best Use of Lark CLI and/or MCP
**Built by:** [@minjaeso](https://github.com/minjaeso)
**Repo:** [minjaeso/lark-sentinel](https://github.com/minjaeso/lark-sentinel)
