/**
 * StenoMaster Service Worker — v6.0
 * Zero-Refresh High-Performance Architecture with Active Cache Purge & Fast Navigation
 */

const CACHE_NAME = 'stenomaster-v6.0';
const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css?v=6.0',
  '/js/charts.js?v=6.0',
  '/js/audio_player.js?v=6.0',
  '/js/typing_engine.js?v=6.0',
  '/js/comparison_view.js?v=6.0',
  '/js/admin.js?v=6.0',
  '/js/app.js?v=6.0',
  '/manifest.json',
  '/assets/logo.png'
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
            console.log('[SW v5.0] Purging obsolete cache:', key);
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
  // Fast network-first with instant fallback if network hangs, guaranteeing zero-refresh 1st load!
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      new Promise((resolve) => {
        let responded = false;
        const netTimeout = setTimeout(() => {
          caches.match(req).then((cached) => {
            if (!responded && cached) {
              responded = true;
              resolve(cached);
            }
          });
        }, 2500);

        fetch(req)
          .then((networkResponse) => {
            clearTimeout(netTimeout);
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            if (!responded) {
              responded = true;
              resolve(networkResponse);
            }
          })
          .catch(() => {
            clearTimeout(netTimeout);
            if (!responded) {
              caches.match(req).then((cached) => {
                resolve(cached || caches.match('/index.html'));
              });
            }
          });
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
