import { NextRequest, NextResponse } from 'next/server';

// Flip SENTINEL_DEMO_BUG=1 in the environment to deliberately break the happy path
// — Sentinel's generated checkout workflow will catch it and post a failing PR comment.
const DEMO_BUG = process.env.SENTINEL_DEMO_BUG === '1';

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { sku, email } = body as { sku?: string; email?: string };

  if (!sku || !email) {
    return NextResponse.json({ error: 'sku and email are required' }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }

  if (DEMO_BUG) {
    return NextResponse.json({ error: 'Payment provider unavailable' }, { status: 500 });
  }

  const orderId = 'ord_' + Math.random().toString(36).slice(2, 10);
  return NextResponse.json({ orderId, sku, email });
}
