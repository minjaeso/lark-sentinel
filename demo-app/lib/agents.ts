// Seed agents for the dashboard. In-memory store (resets per Vercel function
// invocation), so we treat the seed as the source of truth and let "new" agents
// flow through the URL on the redirect (see /agents/new -> /?created=...).

export type Strategy = 'momentum' | 'mean_reversion' | 'pairs_trading' | 'market_making';
export type Risk = 'conservative' | 'moderate' | 'aggressive';
export type AgentStatus = 'active' | 'paused';

export interface Agent {
  id: string;
  name: string;
  strategy: Strategy;
  risk: Risk;
  status: AgentStatus;
  aum: number;              // USD
  pnlToday: number;         // USD, signed
  pnlLifetime: number;      // USD, signed
  createdAt: string;        // ISO
}

export const STRATEGY_LABELS: Record<Strategy, string> = {
  momentum: 'Momentum',
  mean_reversion: 'Mean Reversion',
  pairs_trading: 'Pairs Trading',
  market_making: 'Market Making',
};

export const RISK_LABELS: Record<Risk, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
};

export const SEED_AGENTS: Agent[] = [
  {
    id: 'agt_atlas',
    name: 'Atlas Alpha',
    strategy: 'momentum',
    risk: 'aggressive',
    status: 'active',
    aum: 250_000,
    pnlToday: 3247.18,
    pnlLifetime: 24_891.42,
    createdAt: '2026-05-26T14:22:00Z',
  },
  {
    id: 'agt_boreas',
    name: 'Boreas Beta',
    strategy: 'mean_reversion',
    risk: 'moderate',
    status: 'active',
    aum: 180_000,
    pnlToday: -1432.07,
    pnlLifetime: 8127.55,
    createdAt: '2026-05-23T09:11:00Z',
  },
  {
    id: 'agt_cyclops',
    name: 'Cyclops Pairs',
    strategy: 'pairs_trading',
    risk: 'moderate',
    status: 'paused',
    aum: 500_000,
    pnlToday: 0,
    pnlLifetime: 67_243.88,
    createdAt: '2026-05-16T18:05:00Z',
  },
  {
    id: 'agt_delphi',
    name: 'Delphi MM',
    strategy: 'market_making',
    risk: 'conservative',
    status: 'active',
    aum: 1_200_000,
    pnlToday: -203.12,
    pnlLifetime: 143_872.04,
    createdAt: '2026-04-30T11:48:00Z',
  },
];

export function fmtUSD(n: number, signed = false): string {
  if (typeof n !== 'number' || !Number.isFinite(n)) {
    return `$${n}`; // intentionally surfaces 'undefined'/'NaN' so bugs are visible
  }
  const abs = Math.abs(n);
  const body =
    abs >= 1_000_000
      ? `${(n / 1_000_000).toFixed(2)}M`
      : abs >= 1000
      ? n.toLocaleString('en-US', { maximumFractionDigits: 2 })
      : n.toFixed(2);
  if (signed && n > 0) return `+$${body.replace(/^-/, '')}`;
  if (signed && n < 0) return `-$${body.replace(/^-/, '')}`;
  return `$${body.replace(/^-/, '')}`;
}

export function fmtAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86_400_000);
  if (d <= 0) {
    const h = Math.floor(ms / 3_600_000);
    return h <= 1 ? 'just now' : `${h}h ago`;
  }
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}
