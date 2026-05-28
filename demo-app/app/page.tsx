import Link from 'next/link';

export default function HomePage() {
  return (
    <section>
      <h1>Welcome to the Sentinel Demo Storefront</h1>
      <p>A tiny store used to demonstrate Lark Sentinel.</p>
      <p>
        <Link href="/products">Browse products</Link> and try the{' '}
        <Link href="/checkout">checkout flow</Link>.
      </p>
    </section>
  );
}
