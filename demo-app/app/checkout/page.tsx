'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';

export default function CheckoutPage() {
  const params = useSearchParams();
  const sku = params.get('sku') || 'sku-1';
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(json.error || 'Checkout failed');
        return;
      }
      setStatus('success');
      setMessage(`Order ${json.orderId} confirmed.`);
    } catch (err) {
      setStatus('error');
      setMessage((err as Error).message);
    }
  }

  return (
    <section>
      <h1>Checkout</h1>
      <p>
        Buying: <code>{sku}</code>
      </p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8, marginTop: 4 }}
            data-testid="checkout-email"
          />
        </label>
        <button
          type="submit"
          disabled={status === 'loading'}
          data-testid="checkout-submit"
          style={{
            padding: '10px 16px',
            background: '#111',
            color: 'white',
            border: 'none',
            borderRadius: 6,
            cursor: status === 'loading' ? 'wait' : 'pointer',
          }}
        >
          {status === 'loading' ? 'Placing order...' : 'Place order'}
        </button>
      </form>
      {status === 'success' && (
        <p data-testid="checkout-success" style={{ color: 'green', marginTop: 16 }}>
          {message}
        </p>
      )}
      {status === 'error' && (
        <p data-testid="checkout-error" style={{ color: 'crimson', marginTop: 16 }}>
          {message}
        </p>
      )}
    </section>
  );
}
