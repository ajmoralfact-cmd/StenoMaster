/**
 * StenoMaster Service Worker — v9.7
 * Zero-Cache / Auto-Purging Service Worker
 * Ensures all users get fresh updates immediately without manual hard refresh or cache clear.
 */

const CACHE_NAME = 'stenomaster-v10.8-shell';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          console.log('[SW v9.7] Deleting obsolete cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-First for everything; never hold stale HTML or JS
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // Dynamic API calls or Admin portal: strictly network
  if (url.includes('/api/') || url.includes('/uploads/') || url.includes('/admin')) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    fetch(req)
      .catch(() => caches.match(req))
  );
});
