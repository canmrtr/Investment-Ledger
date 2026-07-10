// NOTE: index.html (shell) cache-first servis edilir → her index.html değişikliğinde
// (yeni <script src> tag'i, meta, vb.) bu sürümü BUMP et, yoksa dönen kullanıcılar stale
// shell alır ve yeni script'ler yüklenmez (ReferenceError). v4: Sprint 28 FeedbackSection tag'i.
// v5: Sprint 31 — index.html CSS (--topbar-h token + .fbar-sticky sticky filter bar).
const CACHE = 'il-shell-v5';
const SHELL = [
  '/Investment-Ledger/',
  '/Investment-Ledger/index.html',
  '/Investment-Ledger/manifest.json',
  '/Investment-Ledger/favicon.svg',
  '/Investment-Ledger/favicon-32.png',
  '/Investment-Ledger/icon-192.png',
  '/Investment-Ledger/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Supabase / edge function / external API — always network-first, no cache
  if (
    url.hostname.includes('supabase.co') ||
    url.hostname.includes('frankfurter') ||
    url.hostname.includes('fonts.googleapis') ||
    url.hostname.includes('fonts.gstatic') ||
    url.hostname.includes('finance.yahoo') ||
    url.hostname.includes('massive.com') ||
    url.hostname.includes('sec.gov') ||
    url.hostname.includes('twelvedata')
  ) {
    e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // JS/CSS source files — network-first so code changes are picked up immediately
  if (url.pathname.match(/\.(js|css)$/)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Shell assets (HTML, manifest) — cache-first, fall back to network
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/Investment-Ledger/index.html'));
    })
  );
});
