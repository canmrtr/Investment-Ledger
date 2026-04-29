const CACHE = 'il-shell-v1';
const SHELL = [
  '/Investment-Ledger/',
  '/Investment-Ledger/index.html',
  '/Investment-Ledger/manifest.json',
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

  // Shell assets — cache-first, fall back to network
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
