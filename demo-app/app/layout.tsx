import './globals.css';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Quant Console — AI trading agent control plane',
  description: 'Deploy, monitor, and pause AI trading agents.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--canvas)' }}>
          <div
            className="container"
            style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Link
              href="/"
              style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--on-dark)', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em' }}
            >
              <span style={{ color: 'var(--primary)' }}>◢◤</span>
              QUANT CONSOLE
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
              <Link href="/" style={{ color: 'var(--body)', fontWeight: 500 }}>Agents</Link>
              <Link href="/" style={{ color: 'var(--muted)', fontWeight: 500 }}>Positions</Link>
              <Link href="/" style={{ color: 'var(--muted)', fontWeight: 500 }}>Backtests</Link>
              <Link href="/" style={{ color: 'var(--muted)', fontWeight: 500 }}>Logs</Link>
              <Link href="/agents/new" className="btn-pill" data-testid="nav-new-agent">+ New Agent</Link>
            </nav>
          </div>
        </header>
        <main className="container" style={{ paddingTop: 48, paddingBottom: 80 }}>
          {children}
        </main>
        <footer style={{ borderTop: '1px solid var(--hairline)', padding: '24px 0', marginTop: 80 }}>
          <div className="container" style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 13 }}>
            <span>© 2026 Quant Console</span>
            <span className="num">Lark Sentinel demo · v0.2</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
