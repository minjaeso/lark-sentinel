# Lark Sentinel

> **DevNetwork AI/ML Hackathon 2026 — Lark Track submission.**
> Turn every PR into a self-testing PR. Sentinel generates **new, diff-targeted**
> Lark workflows on every pull request, runs them against the preview deploy,
> and posts a video-rich pass/fail comment back to the PR — closing the loop
> with auto-repair on flakes and a Linear ticket on real regressions.

## The problem

Coverage % doesn't tell a reviewer *which user journeys this diff breaks.*
Existing E2E suites only catch what someone wrote a test for **months ago**.
PRs that touch the checkout flow, the auth middleware, or a layout component
ship without anyone verifying the user-facing surface actually still works.

## What Sentinel does

For every PR:

```
            ┌──────────────────────────────────────────────┐
PR opened → │  1. Read the diff                            │
            │  2. Map files → user-facing surface          │
            │     (routes, API endpoints, components)      │
            │  3. Ask OpenAI to write N natural-language   │
            │     Lark workflows that exercise it          │
            │  4. Create workflows in Lark (getlark CLI)   │
            │  5. Invoke them in parallel against the      │
            │     PR's preview deploy URL                  │
            │  6. On flake → trigger Lark repair + re-run  │
            │  7. Post a single PR comment with            │
            │     pass/fail + video + repro script         │
            │  8. On real failure → file a Linear ticket   │
            │  9. Archive the ephemeral workflows          │
            └──────────────────────────────────────────────┘
```

The result: every PR carries a **fresh, targeted** answer to "did this break
anything the user can see?" — generated in 90 seconds, not maintained by hand.

## Why this is differentiated

Lark already ships a `validate-branch` skill, but it runs **existing**
workflows. Sentinel **generates new ones aimed at the diff**, so the test
catalog automatically follows the shape of the code instead of lagging it.

## 60-second demo recipe

1. Clone this repo, push it to GitHub, deploy `demo-app/` to Vercel.
2. Add repo secrets: `GETLARK_API_KEY`, `OPENAI_API_KEY`, optionally
   `LINEAR_API_KEY`. Add repo vars: `PREVIEW_URL`, optionally `LINEAR_TEAM_ID`.
3. Open a PR that edits `demo-app/app/checkout/page.tsx`. Set
   `SENTINEL_DEMO_BUG=1` in the preview env (Vercel → project → environment).
4. Watch the **Lark Sentinel** check run. Within 60–90 seconds, a PR comment
   appears with a generated checkout workflow, a failure badge, and an embedded
   video showing the broken POST.
5. Click through to the auto-filed Linear ticket. Done.

## Repo layout

```
.
├── sentinel/                   The reusable GitHub Action
│   ├── action.yml              Composite action manifest
│   ├── src/                    JS modules (Node 20, ESM)
│   │   ├── index.js            6-phase orchestration
│   │   ├── diff.js             PR file list
│   │   ├── surface.js          file → route/api/component
│   │   ├── generate.js         Claude → workflow descriptions
│   │   ├── lark.js             getlark CLI + REST API
│   │   ├── comment.js          single upsertable PR comment
│   │   ├── linear.js           issueCreate GraphQL
│   │   └── smoke.js            offline smoke test
│   └── README.md
├── demo-app/                   Next.js 15 storefront with toggleable bug
│   ├── app/
│   │   ├── page.tsx            /
│   │   ├── products/page.tsx   /products
│   │   ├── checkout/page.tsx   /checkout
│   │   └── api/checkout/route.ts
│   └── README.md
├── .github/workflows/
│   └── sentinel.yml            Wires the action up for this repo's demo
└── README.md                   You are here
```

## Setup checklist

| Where | What | Why |
|---|---|---|
| Repo secret | `GETLARK_API_KEY` | Lark API. Get one at app.getlark.ai/settings |
| Repo secret | `OPENAI_API_KEY` | Claude API for workflow generation |
| Repo secret | `LINEAR_API_KEY` *(opt)* | Auto-file tickets on real failures |
| Repo var | `PREVIEW_URL` | Base URL the workflows run against |
| Repo var | `LINEAR_TEAM_ID` *(opt)* | Where Linear tickets land |
| Vercel env | `SENTINEL_DEMO_BUG=1` *(demo only)* | Flips on the deliberate checkout bug |

## Smoke test

```bash
cd sentinel
npm install
npm run smoke
# All smoke checks passed.
```

## Built with

- **Lark CLI** — `@getlark/cli` for workflow create / invoke / repair / archive.
- **Lark REST API** — `api.getlark.ai` for execution + presigned artifact URLs.
- **Lark webhooks** — designed to upgrade to (current path uses `--wait`).
- **OpenAI (gpt-4o)** — generates natural-language workflow descriptions in JSON mode. Override via `SENTINEL_OPENAI_MODEL` env.
- **Linear GraphQL API** — `issueCreate` mutation for the ticket loop.
- **GitHub Actions** — composite action; runs in any repo.

## Hackathon entry

**Track:** Lark — Best Use of Lark CLI and/or MCP
**Built by:** [@somanyjuice](https://github.com/somanyjuice)
