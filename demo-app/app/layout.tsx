import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Sentinel Demo Storefront',
  description: 'Tiny store used to demo Lark Sentinel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: 0, color: '#111' }}>
        <header
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #eee',
            display: 'flex',
            gap: 24,
            alignItems: 'center',
          }}
        >
          <strong>Sentinel Storefront</strong>
          <nav style={{ display: 'flex', gap: 16 }}>
            <Link href="/">Home</Link>
            <Link href="/products">Products</Link>
            <Link href="/checkout">Checkout</Link>
          </nav>
        </header>
        <main style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>{children}</main>
      </body>
    </html>
  );
}
