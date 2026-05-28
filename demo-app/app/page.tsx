import { Suspense } from 'react';
import Dashboard from './Dashboard';

export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={<p style={{ color: 'var(--muted)' }}>Loading...</p>}>
      <Dashboard />
    </Suspense>
  );
}
