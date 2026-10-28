/**
 * StenoMaster Service Worker — v15.5
 * Zero-Cache / Auto-Purging Service Worker
 * Ensures all users get fresh updates immediately without manual hard refresh or cache clear.
 * API calls and admin portal pages are NEVER intercepted — native browser networking handles them.
 */

const CACHE_NAME = 'stenomaster-v17.2-shell';
const ALWAYS_NETWORK = ['/api/', '/uploads/', '/admin', 'admin.html', 'admin.js'];

self.addEventListener('install', (event) => {
  // Skip waiting immediately — activate new SW without waiting for old clients to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v15.5] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch handler:
// 1. Non-GET requests (POST, PUT, DELETE, PATCH): NEVER intercept. Let browser handle natively.
// 2. API endpoints and Admin routes: NEVER intercept. Let browser handle natively.
// 3. HTML, JS, and CSS: network first with no-store to ensure latest code, no stale cache.
// 4. Static media/fonts: network first, cache fallback.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  if (req.method !== 'GET') {
    return;
  }

  const url = req.url;

  // API calls, admin portal, uploads: strictly native browser network
  const isAlwaysNetwork = ALWAYS_NETWORK.some((p) => url.includes(p));
  if (isAlwaysNetwork) {
    return;
  }

  const isHtmlOrJsOrCss = url.match(/\.(html|js|css)(\?.*)?$/) || url.endsWith('/') || url.endsWith('.vercel.app');
  if (isHtmlOrJsOrCss) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          return new Response('Offline — please reconnect and refresh.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          });
        });
      })
    );
    return;
  }

  // Assets (images, fonts): network first, cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
