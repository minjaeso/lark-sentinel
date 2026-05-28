import Link from 'next/link';
import AgentForm from './AgentForm';

export default function NewAgentPage() {
  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <Link href="/" style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 12, display: 'inline-block' }}>
        ← Back to agents
      </Link>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: 'var(--on-dark)', letterSpacing: '-0.02em' }}>
        Deploy a new agent
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: 6, marginBottom: 32 }}>
        Configure your trading agent. It will start in paused state — flip to active from the dashboard.
      </p>
      <AgentForm />
    </div>
  );
}
