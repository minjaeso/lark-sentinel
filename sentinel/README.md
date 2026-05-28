# Lark Sentinel — the GitHub Action

A GitHub Action that turns every PR into a self-testing PR.

## What it does, end to end

1. **Reads the PR diff** via the GitHub API.
2. **Maps changed files → user-facing surface area** — Next.js app router pages,
   `route.ts` API endpoints, pages-router pages, and shared components.
3. **Generates 3–5 natural-language Lark workflow descriptions** targeted at
   exactly that surface, using Claude.
4. **Creates the workflows in Lark** via the `getlark` CLI.
5. **Invokes them in parallel against the PR's preview deploy URL.**
6. **Polls executions via the Lark REST API**, pulling presigned video,
   screenshot, and repro-script URLs.
7. **On first failure**, triggers Lark's `repairs` flow and re-runs (gates
   flakes from being reported as real failures).
8. **Posts (or updates) a single PR comment** with pass/fail badges + embedded
   artifact links.
9. **Optional:** files a Linear issue per real (post-repair) failure.
10. **Archives the ephemeral workflows** so the user's Lark dashboard stays
    clean.

## Usage

```yaml
- uses: somanyjuice/lark-sentinel@v1
  with:
    github-token: ${{ secrets.GITHUB_TOKEN }}
    lark-api-key: ${{ secrets.GETLARK_API_KEY }}
    anthropic-api-key: ${{ secrets.ANTHROPIC_API_KEY }}
    preview-url: ${{ steps.resolve-preview.outputs.url }}
    # optional
    linear-api-key: ${{ secrets.LINEAR_API_KEY }}
    linear-team-id: ${{ vars.LINEAR_TEAM_ID }}
    max-workflows: '4'
    repair-on-flake: 'true'
```

## Inputs

| Input | Required | Default | Notes |
|---|---|---|---|
| `github-token` | yes | — | needs `pull-requests: write` |
| `lark-api-key` | yes | — | from app.getlark.ai |
| `anthropic-api-key` | yes | — | used to generate workflow descriptions |
| `preview-url` | yes | — | base URL of the PR preview deploy |
| `max-workflows` | no | `4` | upper bound on generated workflows |
| `repair-on-flake` | no | `true` | trigger Lark repair + re-run on first failure |
| `linear-api-key` | no | `""` | enables ticket filing |
| `linear-team-id` | no | `""` | required if `linear-api-key` is set |
| `secret-context` | no | `""` | Lark secret context name to attach to workflows |

## Project layout

```
src/
├── index.js     — entrypoint; orchestrates the 6 phases
├── diff.js      — PR file list via @actions/github
├── surface.js   — file path → route / api / component
├── generate.js  — Claude → natural-language workflow descriptions
├── lark.js      — getlark CLI for writes, REST API for reads
├── comment.js   — single upsertable PR comment with artifacts
├── linear.js    — issueCreate GraphQL mutation
└── smoke.js     — offline smoke test (run with `npm run smoke`)
```

## How "surface area" is mapped

See `src/surface.js`. The heuristic recognizes:

- `app/**/page.{tsx,jsx,ts,js}` → `route` (strips `(group)` and `[param]` syntax)
- `app/**/layout.{tsx,jsx,ts,js}` → `layout` (flagged as wide-impact)
- `app/**/route.{ts,js}` → `api`
- `pages/**/*.{tsx,jsx,ts,js}` → `route`
- `pages/api/**/*.{ts,js}` → `api`
- `components/**/*.{tsx,jsx}` → `component` (only listed when no routes are touched)

When zero surface items are found, Sentinel posts a "nothing to test" comment
and exits without burning Lark credits.
