import { NextRequest, NextResponse } from 'next/server';
import { SEED_AGENTS, Strategy, Risk } from '@/lib/agents';

const STRATEGIES: Strategy[] = ['momentum', 'mean_reversion', 'pairs_trading', 'market_making'];
const RISKS: Risk[] = ['conservative', 'moderate', 'aggressive'];

export async function GET() {
  return NextResponse.json({ agents: SEED_AGENTS });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { name, strategy, initialCapital, risk } = body as {
    name?: string;
    strategy?: Strategy;
    initialCapital?: number;
    risk?: Risk;
  };

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return NextResponse.json({ error: 'Agent name is required (min 2 chars)' }, { status: 400 });
  }
  if (!strategy || !STRATEGIES.includes(strategy)) {
    return NextResponse.json({ error: 'Invalid strategy' }, { status: 400 });
  }
  if (!risk || !RISKS.includes(risk)) {
    return NextResponse.json({ error: 'Invalid risk tolerance' }, { status: 400 });
  }
  if (typeof initialCapital !== 'number' || !Number.isFinite(initialCapital) || initialCapital < 1000) {
    return NextResponse.json({ error: 'Initial capital must be at least $1,000' }, { status: 400 });
  }

  const agent = {
    id: 'agt_' + Math.random().toString(36).slice(2, 8),
    name: name.trim(),
    strategy,
    risk,
    status: 'paused',
    aum: initialCapital,
    pnlToday: 0,
    pnlLifetime: 0,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(agent, { status: 201 });
}
