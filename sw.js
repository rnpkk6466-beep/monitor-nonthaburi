/* Service worker - Nonthaburi Flood Monitor
 * Bump V when you change the app shell so old caches are cleaned up.
 * Cached: app shell + CDN libraries (so the page opens offline).
 * NEVER cached: Apps Script API, GISTDA/map tiles, Cloudflare Turnstile (always live network). */
const V = 'nb-flood-v1';
const SHELL = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];
const LIBS = ['unpkg.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);

  // Page navigation: network first (users always get the latest version), cache as offline fallback
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(res => { const cp = res.clone(); caches.open(V).then(c => c.put('index.html', cp)); return res; })
      .catch(() => caches.match('index.html')));
    return;
  }

  // Same-origin files and CDN libraries: stale-while-revalidate
  if (u.origin === location.origin || LIBS.includes(u.hostname)) {
    e.respondWith(caches.open(V).then(async c => {
      const hit = await c.match(r);
      const net = fetch(r).then(res => { if (res.ok || res.type === 'opaque') c.put(r, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
  // anything else: default browser network behaviour
});
