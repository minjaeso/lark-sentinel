// Map changed files to user-facing surface area: routes, API endpoints, shared components.
// Covers Next.js app router, Next.js pages router, and a few generic conventions.
// Outputs items shaped as { kind, label, source, hint }.

const APP_ROUTER_PAGE = /^(?:.*\/)?app\/(.+)\/page\.(?:tsx|jsx|ts|js)$/;
const APP_ROUTER_LAYOUT = /^(?:.*\/)?app\/(.+)\/layout\.(?:tsx|jsx|ts|js)$/;
const APP_ROUTER_ROUTE = /^(?:.*\/)?app\/(.+)\/route\.(?:ts|js)$/;
const APP_ROOT_PAGE = /^(?:.*\/)?app\/page\.(?:tsx|jsx|ts|js)$/;
// Any other tsx/ts/jsx/js file inside app/<segments>/ is a child of the route at that path
// (helper components, hooks, etc. that the page imports).
const APP_ROUTER_CHILD = /^(?:.*\/)?app\/(.+)\/[^/]+\.(?:tsx|jsx|ts|js)$/;
const PAGES_ROUTER = /^(?:.*\/)?pages\/(?!api\/)(.+)\.(?:tsx|jsx|ts|js)$/;
const PAGES_API = /^(?:.*\/)?pages\/api\/(.+)\.(?:ts|js)$/;
const COMPONENT = /^(?:.*\/)?components\/(.+)\.(?:tsx|jsx)$/;

function segmentsToRoute(segments) {
  // Strip Next.js route groups like (marketing) and parallel routes @slot
  const cleaned = segments
    .split('/')
    .filter((s) => !s.startsWith('(') && !s.startsWith('@'))
    .map((s) => (s.startsWith('[') && s.endsWith(']') ? `:${s.slice(1, -1)}` : s));
  const path = '/' + cleaned.join('/');
  return path === '//' ? '/' : path;
}

export function mapToSurface(files) {
  const seen = new Set();
  const items = [];
  const componentSources = [];

  for (const f of files) {
    if (f.status === 'removed') continue;
    const name = f.filename;

    if (APP_ROOT_PAGE.test(name)) {
      const key = 'route:/';
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ kind: 'route', label: '/', source: name, hint: 'home page' });
      }
      continue;
    }

    let m = name.match(APP_ROUTER_PAGE);
    if (m) {
      const route = segmentsToRoute(m[1]);
      const key = `route:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ kind: 'route', label: route, source: name });
      }
      continue;
    }

    m = name.match(APP_ROUTER_LAYOUT);
    if (m) {
      const route = segmentsToRoute(m[1]);
      const key = `layout:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          kind: 'layout',
          label: route,
          source: name,
          hint: 'layout — affects every page nested under this route',
        });
      }
      continue;
    }

    m = name.match(APP_ROUTER_ROUTE);
    if (m) {
      const route = segmentsToRoute(m[1]);
      const key = `api:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ kind: 'api', label: route, source: name });
      }
      continue;
    }

    // Child of an app-router route (e.g. app/checkout/CheckoutForm.tsx)
    m = name.match(APP_ROUTER_CHILD);
    if (m) {
      const route = segmentsToRoute(m[1]);
      const key = `route:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({
          kind: 'route',
          label: route,
          source: name,
          hint: `helper file under the route; test the route end-to-end`,
        });
      }
      continue;
    }

    m = name.match(PAGES_ROUTER);
    if (m) {
      const rest = m[1].replace(/\/index$/, '').replace(/^index$/, '');
      const route = rest ? segmentsToRoute(rest) : '/';
      const key = `route:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ kind: 'route', label: route, source: name });
      }
      continue;
    }

    m = name.match(PAGES_API);
    if (m) {
      const rest = m[1].replace(/\/index$/, '');
      const route = '/api' + (rest ? segmentsToRoute(rest) : '');
      const key = `api:${route}`;
      if (!seen.has(key)) {
        seen.add(key);
        items.push({ kind: 'api', label: route, source: name });
      }
      continue;
    }

    m = name.match(COMPONENT);
    if (m) {
      componentSources.push({ filename: name, label: m[1] });
    }
  }

  if (componentSources.length > 0 && items.length === 0) {
    // No routes touched but components changed — flag the components themselves;
    // the LLM step will be told to test wherever they appear.
    for (const c of componentSources) {
      items.push({
        kind: 'component',
        label: c.label,
        source: c.filename,
        hint: 'shared component — test any page that renders it',
      });
    }
  }

  return items;
}
