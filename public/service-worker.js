/**
 * StenoMaster Service Worker — v4.3
 * Network-First Strategy with Automatic Cache Purge & Instant Navigation
 */

const CACHE_NAME = 'stenomaster-v4.3';
const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css?v=4.3',
  '/js/charts.js?v=4.3',
  '/js/audio_player.js?v=4.3',
  '/js/typing_engine.js?v=4.3',
  '/js/comparison_view.js?v=4.3',
  '/js/admin.js?v=4.3',
  '/js/app.js?v=4.3',
  '/manifest.json',
  '/assets/logo.png'
];

self.addEventListener('install', (event) => {
  // Pre-cache core shell in background
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_PRECACHE).catch((err) => {
        console.warn('Pre-cache non-fatal warning:', err);
      });
    })
  );
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Purge ALL obsolete caches immediately
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // 1. API calls, dynamic server routes, and audio uploads: STRICTLY Network-only
  if (url.includes('/api/') || url.includes('/uploads/')) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Navigation (opening website link / page load):
  // ALWAYS Network-First so the user opens the live site on the very FIRST click without refresh!
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Fallback to cache only when offline
          return caches.match(req).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Static scripts, CSS, and images: Network-First with Cache Fallback
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req);
      })
  );
});
