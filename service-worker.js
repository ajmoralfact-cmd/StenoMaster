/**
 * StenoMaster Service Worker — v7.4
 * Instant 15ms Cache-First App Shell Architecture with Background Stale-While-Revalidate
 */

const CACHE_NAME = 'stenomaster-v7.4-shell';
const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css?v=7.4',
  '/js/audio_player.js?v=7.4',
  '/js/keyboard_map.js?v=7.4',
  '/js/typing_engine.js?v=7.4',
  '/js/app.js?v=7.4',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/fonts/Mangal.ttf',
  '/assets/fonts/Kruti_Dev_010.ttf'
];

// Install: Pre-cache app shell assets immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.warn('Pre-cache non-fatal warning:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: Purge older caches instantly and claim active clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v7.4] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Smart Hybrid Routing (Cache-First Shell + Network-Only APIs)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // 1. Dynamic API calls, audio uploads, and Admin portal: STRICTLY Network-only
  if (url.includes('/api/') || url.includes('/uploads/') || url.includes('/admin') || url.includes('/admin.html')) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Navigation Requests (Opening website URL / clicking links):
  // Cache-First with Background Stale-While-Revalidate (Instant 15ms page load on 2G/offline)
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match('/index.html').then((cachedHtml) => {
        const fetchPromise = fetch(req).then((networkHtml) => {
          if (networkHtml && networkHtml.status === 200) {
            const copy = networkHtml.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy));
          }
          return networkHtml;
        }).catch(() => null);

        // Serve local cached shell immediately if available (under 15ms)
        return cachedHtml || fetchPromise;
      })
    );
    return;
  }

  // 3. Static Assets (.css, .js, fonts, images): Cache-First + Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const resToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resToCache));
        }
        return networkResponse;
      }).catch(() => null);

      return cachedResponse || fetchPromise;
    })
  );
});
