# Sentinel Demo Storefront

A minimal Next.js (App Router) storefront used to demonstrate **Lark Sentinel**.

## Routes

- `/` — home
- `/products` — list with "Buy" buttons
- `/checkout` — form: email + place order
- `/api/checkout` — POST endpoint that creates an order

## Demo bug toggle

The `/api/checkout` route checks `SENTINEL_DEMO_BUG=1`. When set, the endpoint
returns HTTP 500 with `"Payment provider unavailable"`. This is the bug the
generated Sentinel workflow is designed to catch.

## Local

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Demo recipe

1. Deploy this app to Vercel (or run `npm run dev` and tunnel via ngrok).
2. Open a PR that touches `app/checkout/page.tsx` or `app/api/checkout/route.ts`.
3. In the PR, set `SENTINEL_DEMO_BUG=1` in the preview environment.
4. Sentinel runs on the PR, generates a checkout workflow, fails it, posts video.
