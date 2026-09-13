/**
 * StenoMaster Service Worker — v7.4
 * Zero-Refresh High-Performance Architecture with Dynamic Module Cache
 */

const CACHE_NAME = 'stenomaster-v7.4';
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

self.addEventListener('activate', (event) => {
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
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. Static Assets: Stale-While-Revalidate (Instant cached response + background update)
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((networkRes) => {
        if (networkRes && networkRes.status === 200 && networkRes.type === 'basic') {
          const resToCache = networkRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resToCache));
        }
        return networkRes;
      }).catch(() => null);

      return cached || fetchPromise;
    })
  );
});
