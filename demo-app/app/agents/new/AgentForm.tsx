'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Risk, Strategy } from '@/lib/agents';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--muted-strong)',
  marginBottom: 6,
  letterSpacing: '0.02em',
  textTransform: 'uppercase',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--surface-card)',
  color: 'var(--on-dark)',
  border: '1px solid var(--hairline)',
  borderRadius: 8,
  padding: '12px 14px',
  fontSize: 14,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: 'none',
  backgroundImage:
    'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'8\' viewBox=\'0 0 12 8\'><path fill=\'%23929aa5\' d=\'M6 8L0 0h12z\'/></svg>")',
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
};

export default function AgentForm() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('momentum');
  const [capital, setCapital] = useState('100000');
  const [risk, setRisk] = useState<Risk>('moderate');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('submitting');
    setError('');
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          strategy,
          initialCapital: Number(capital),
          risk,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus('error');
        setError(json.error || 'Deploy failed');
        return;
      }
      const encoded = encodeURIComponent(JSON.stringify(json));
      router.push(`/?created=${encoded}`);
    } catch (err) {
      setStatus('error');
      setError((err as Error).message);
    }
  }

  return (
    <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label htmlFor="name" style={labelStyle}>Agent name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          minLength={2}
          placeholder="e.g. Eos Momentum"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          data-testid="agent-name-input"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div>
          <label htmlFor="strategy" style={labelStyle}>Strategy</label>
          <select
            id="strategy"
            name="strategy"
            value={strategy}
            onChange={(e) => setStrategy(e.target.value as Strategy)}
            style={selectStyle}
            data-testid="agent-strategy-input"
          >
            <option value="momentum">Momentum</option>
            <option value="mean_reversion">Mean Reversion</option>
            <option value="pairs_trading">Pairs Trading</option>
            <option value="market_making">Market Making</option>
          </select>
        </div>
        <div>
          <label htmlFor="risk" style={labelStyle}>Risk tolerance</label>
          <select
            id="risk"
            name="risk"
            value={risk}
            onChange={(e) => setRisk(e.target.value as Risk)}
            style={selectStyle}
            data-testid="agent-risk-input"
          >
            <option value="conservative">Conservative</option>
            <option value="moderate">Moderate</option>
            <option value="aggressive">Aggressive</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="capital" style={labelStyle}>Initial capital (USD)</label>
        <input
          id="capital"
          name="initialCapital"
          type="number"
          required
          min={1000}
          step={1000}
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
          style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
          data-testid="agent-capital-input"
        />
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          Minimum $1,000. Will be drawn from your treasury account.
        </div>
      </div>

      {status === 'error' && (
        <div
          data-testid="agent-form-error"
          style={{
            background: 'rgba(246, 70, 93, 0.08)',
            border: '1px solid rgba(246, 70, 93, 0.25)',
            borderRadius: 8,
            padding: '12px 14px',
            color: 'var(--trading-down)',
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => router.push('/')}
          className="btn-secondary"
          data-testid="agent-form-cancel"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="btn-primary"
          data-testid="agent-form-submit"
        >
          {status === 'submitting' ? 'Deploying...' : 'Deploy Agent'}
        </button>
      </div>
    </form>
  );
}
