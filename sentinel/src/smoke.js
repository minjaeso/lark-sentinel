// Offline smoke test: exercises pure modules with no network / no CLI calls.
// Verifies syntax + happy-path logic for the surface mapper and comment renderer.

import assert from 'node:assert/strict';
import { mapToSurface } from './surface.js';
import { renderComment } from './comment.js';

console.log('1. surface mapper — Next.js app router');
{
  const files = [
    { filename: 'app/checkout/page.tsx', status: 'modified' },
    { filename: 'app/api/checkout/route.ts', status: 'modified' },
    { filename: 'app/(marketing)/about/page.tsx', status: 'added' },
    { filename: 'app/page.tsx', status: 'modified' },
    { filename: 'app/layout.tsx', status: 'modified' },
    { filename: 'components/Cart.tsx', status: 'modified' },
    { filename: 'README.md', status: 'modified' },
    { filename: 'app/old/page.tsx', status: 'removed' },
  ];
  const out = mapToSurface(files);
  const labels = out.map((o) => `${o.kind}:${o.label}`);
  console.log('   ->', labels.join(', '));
  assert.ok(labels.includes('route:/checkout'), 'expected /checkout');
  assert.ok(labels.includes('api:/api/checkout'), 'expected /api/checkout');
  assert.ok(labels.includes('route:/about'), 'expected /about (route group stripped)');
  assert.ok(labels.includes('route:/'), 'expected / (home)');
  assert.ok(!labels.includes('route:/old'), 'removed pages should be excluded');
}

console.log('2. surface mapper — Next.js pages router');
{
  const files = [
    { filename: 'pages/login.tsx', status: 'modified' },
    { filename: 'pages/api/auth/[id].ts', status: 'modified' },
  ];
  const out = mapToSurface(files);
  const labels = out.map((o) => `${o.kind}:${o.label}`);
  console.log('   ->', labels.join(', '));
  assert.ok(labels.includes('route:/login'));
  assert.ok(labels.includes('api:/api/auth/:id'));
}

console.log('3. surface mapper — components only');
{
  const files = [{ filename: 'components/CheckoutButton.tsx', status: 'modified' }];
  const out = mapToSurface(files);
  console.log('   ->', out);
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, 'component');
}

console.log('4. renderComment — generating state');
{
  const body = renderComment({
    status: 'generating',
    surface: [{ kind: 'route', label: '/checkout', source: 'app/checkout/page.tsx' }],
    previewUrl: 'https://preview.example.com',
    maxWorkflows: 4,
  });
  assert.ok(body.includes('generating'));
  assert.ok(body.includes('/checkout'));
}

console.log('5. renderComment — done with one pass one fail');
{
  const body = renderComment({
    status: 'done',
    previewUrl: 'https://preview.example.com',
    linearLinks: [{ workflowId: 'wf_abc', url: 'https://linear.app/x/y' }],
    results: [
      {
        workflow: { id: 'wf_abc', name: 'happy-path', intent: { name: 'checkout-happy', description: 'x' } },
        execution: {
          id: 'exec_1',
          status: 'failure',
          summary: 'Button missing',
          artifacts: [
            { type: 'video', url: 'https://art.example.com/v.mp4' },
            { type: 'screenshot', url: 'https://art.example.com/s.png' },
          ],
        },
        repaired: true,
      },
      {
        workflow: { id: 'wf_def', name: 'edge-case', intent: { name: 'cart-edge', description: 'y' } },
        execution: { id: 'exec_2', status: 'success', artifacts: [] },
        repaired: false,
      },
    ],
  });
  assert.ok(body.includes('1 failing'));
  assert.ok(body.includes('checkout-happy'));
  assert.ok(body.includes('auto-repaired'));
  assert.ok(body.includes('Linear tickets'));
}

console.log('\nAll smoke checks passed.');
