# Quant Console — demo app for Lark Sentinel

A Binance-styled Next.js storefront for an AI trading-agent control plane.
Used by Lark Sentinel as the system-under-test on every PR.

## What's inside

- `/` — agents dashboard (seeded list + KPI cards)
- `/agents/new` — deploy-an-agent form (name, strategy, risk, initial capital)
- `/api/agents` — `GET` returns the seeded list, `POST` validates and returns a new agent

State is intentionally **non-persistent** so the demo works on serverless
Vercel functions: the `POST` returns the created agent in its response body,
the client encodes it into a `?created=<json>` query param on the redirect to
`/`, and the dashboard prepends it to the seed list.

## Design system

See [DESIGN.md](./DESIGN.md). Tokens are mirrored as CSS variables in
[`app/globals.css`](./app/globals.css):

- `--canvas` `#0b0e11` page floor
- `--surface-card` `#1e2329` cards
- `--primary` `#FCD535` Binance Yellow (single brand accent)
- `--trading-up` `#0ecb81`, `--trading-down` `#f6465d`
- Inter (BinanceNova substitute) for type, JetBrains Mono (BinancePlex
  substitute) for every number — apply the `.num` class to any element
  rendering a price, AUM, or PnL.

## Local

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Test IDs (for Lark workflows)

| Element | data-testid |
|---|---|
| New-agent CTA in top nav | `nav-new-agent` |
| New-agent CTA in dashboard header | `deploy-agent` |
| Dashboard banner after redirect | `created-banner` |
| Each agent table row | `agent-row-<id>` |
| Agent name cell | `agent-name` |
| Agent today PnL cell | `agent-pnl-today` |
| Form: name input | `agent-name-input` |
| Form: strategy select | `agent-strategy-input` |
| Form: risk select | `agent-risk-input` |
| Form: capital input | `agent-capital-input` |
| Form: cancel | `agent-form-cancel` |
| Form: submit | `agent-form-submit` |
| Form: error banner | `agent-form-error` |
