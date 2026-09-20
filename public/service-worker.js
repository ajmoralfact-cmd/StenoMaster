/**
 * StenoMaster Service Worker — v11.5
 * Zero-Cache / Auto-Purging Service Worker
 * Ensures all users get fresh updates immediately without manual hard refresh or cache clear.
 * Admin portal pages are ALWAYS fetched fresh — never cached.
 */

const CACHE_NAME = 'stenomaster-v11.5-shell';
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
            console.log('[SW v11.5] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Strict Network-First: HTML and JS are NEVER served from cache
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // API calls, admin portal, uploads: strictly network — no cache ever
  const isAlwaysNetwork = ALWAYS_NETWORK.some(p => url.includes(p));
  const isHtmlOrJs = url.match(/\.(html|js)(\?.*)?$/);

  if (isAlwaysNetwork || isHtmlOrJs) {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => {
        // For HTML/JS failures, don't serve stale cache — let browser show error
        return new Response('Offline — please reconnect and refresh.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // Assets (images, fonts, CSS): network first, cache fallback
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

