'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Agent,
  SEED_AGENTS,
  STRATEGY_LABELS,
  RISK_LABELS,
  fmtUSD,
  fmtAgo,
} from '@/lib/agents';

function decodeCreated(raw: string | null): Agent | null {
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as Agent;
  } catch {
    return null;
  }
}

function StatCard({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' | 'neutral' }) {
  const color = tone === 'up' ? 'var(--trading-up)' : tone === 'down' ? 'var(--trading-down)' : 'var(--on-dark)';
  return (
    <div className="card" style={{ minHeight: 120 }}>
      <div style={{ color: 'var(--muted)', fontSize: 12, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div className="num" style={{ color, fontSize: 28, fontWeight: 700, marginTop: 12, letterSpacing: '-0.01em' }}>
        {value}
      </div>
      {sub && (
        <div className="num" style={{ color: 'var(--muted-strong)', fontSize: 13, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: 'active' | 'paused' | string }) {
  const isActive = status === 'active';
  const color = isActive ? 'var(--trading-up)' : 'var(--muted)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color }} />
      <span style={{ color, fontWeight: 500, fontSize: 13 }}>
        {isActive ? 'Active' : status === 'paused' ? 'Paused' : status}
      </span>
    </span>
  );
}

export default function Dashboard() {
  const params = useSearchParams();
  const created = decodeCreated(params.get('created'));
  const agents: Agent[] = created ? [created, ...SEED_AGENTS] : SEED_AGENTS;

  const totalAum = agents.reduce((s, a) => s + (Number.isFinite(a.aum) ? a.aum : 0), 0);
  const totalPnlToday = agents.reduce((s, a) => s + (Number.isFinite(a.pnlToday) ? a.pnlToday : 0), 0);
  const activeCount = agents.filter((a) => a.status === 'active').length;
  const openPositions = activeCount * 3 + 4; // demo fiction

  return (
    <>
      {created && (
        <div
          data-testid="created-banner"
          style={{
            background: 'rgba(14, 203, 129, 0.08)',
            border: '1px solid rgba(14, 203, 129, 0.25)',
            borderRadius: 8,
            padding: '12px 16px',
            color: 'var(--trading-up)',
            marginBottom: 24,
            fontSize: 14,
          }}
        >
          Agent <strong>{created.name}</strong> deployed successfully.
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 32 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--on-dark)', letterSpacing: '-0.02em' }}>
            Agents
          </h1>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)' }}>
            Your live AI trading agents and their PnL across all venues.
          </p>
        </div>
        <Link href="/agents/new" className="btn-primary" data-testid="deploy-agent">
          Deploy New Agent
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label="Total AUM" value={fmtUSD(totalAum)} sub="across all agents" />
        <StatCard
          label="Live PnL — today"
          value={fmtUSD(totalPnlToday, true)}
          sub="net of fees"
          tone={totalPnlToday >= 0 ? 'up' : 'down'}
        />
        <StatCard label="Active agents" value={`${activeCount} / ${agents.length}`} sub={`${agents.length - activeCount} paused`} />
        <StatCard label="Open positions" value={String(openPositions)} sub="across 6 venues" />
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--on-dark)' }}>Agents</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>All</button>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13, opacity: 0.7 }}>Active</button>
            <button className="btn-secondary" style={{ padding: '8px 14px', fontSize: 13, opacity: 0.7 }}>Paused</button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'transparent' }}>
              {['Agent', 'Strategy', 'Status', 'AUM', 'PnL today', 'PnL lifetime', 'Created', ''].map((h, i) => (
                <th
                  key={i}
                  style={{
                    textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
                    color: 'var(--muted)',
                    fontWeight: 500,
                    fontSize: 12,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    padding: '14px 24px',
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr
                key={a.id}
                data-testid={`agent-row-${a.id}`}
                style={{ borderTop: '1px solid var(--hairline)' }}
              >
                <td style={{ padding: '16px 24px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--on-dark)', fontSize: 14 }} data-testid="agent-name">
                    {String(a.name)}
                  </div>
                  <div className="num" style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                    {a.id}
                  </div>
                </td>
                <td style={{ padding: '16px 24px', color: 'var(--body)', fontSize: 14 }}>
                  {STRATEGY_LABELS[a.strategy] || a.strategy}
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                    {RISK_LABELS[a.risk] || a.risk}
                  </div>
                </td>
                <td style={{ padding: '16px 24px' }}><StatusPill status={a.status} /></td>
                <td className="num" style={{ padding: '16px 24px', textAlign: 'right', fontSize: 14, color: 'var(--body)' }}>
                  {fmtUSD(a.aum)}
                </td>
                <td className="num" style={{ padding: '16px 24px', textAlign: 'right', fontSize: 14 }} data-testid="agent-pnl-today">
                  <span className={a.pnlToday > 0 ? 'up' : a.pnlToday < 0 ? 'down' : ''}>
                    {fmtUSD(a.pnlToday, true)}
                  </span>
                </td>
                <td className="num" style={{ padding: '16px 24px', textAlign: 'right', fontSize: 14 }}>
                  <span className={a.pnlLifetime > 0 ? 'up' : a.pnlLifetime < 0 ? 'down' : ''}>
                    {fmtUSD(a.pnlLifetime, true)}
                  </span>
                </td>
                <td style={{ padding: '16px 24px', color: 'var(--muted)', fontSize: 13 }}>
                  {fmtAgo(a.createdAt)}
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: 13 }}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
