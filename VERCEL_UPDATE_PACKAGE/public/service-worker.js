/**
 * StenoMaster Service Worker — v7.5
 * Network-First Architecture with Offline Cache Fallback
 * Ensures changes are visible immediately without manual hard refresh or incognito
 */

const CACHE_NAME = 'stenomaster-v7.5-shell';
const ASSETS_TO_PRECACHE = [
  '/',
  '/index.html',
  '/css/style.css?v=7.5',
  '/js/audio_player.js?v=7.5',
  '/js/keyboard_map.js?v=7.5',
  '/js/typing_engine.js?v=7.5',
  '/js/app.js?v=7.5',
  '/manifest.json',
  '/assets/logo.png',
  '/assets/fonts/Mangal.ttf',
  '/assets/fonts/Kruti_Dev_010.ttf'
];

// Install: Pre-cache assets and immediately activate without waiting
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_PRECACHE).catch(() => {});
    })
  );
  self.skipWaiting();
});

// Activate: Immediately delete all obsolete caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW v7.5] Purging obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-First with Cache Fallback for instant updates
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = req.url;

  // 1. Dynamic API calls, audio uploads, and Admin portal: STRICTLY Network-only
  if (url.includes('/api/') || url.includes('/uploads/') || url.includes('/admin') || url.includes('/admin.html')) {
    event.respondWith(fetch(req));
    return;
  }

  // 2. Navigation & Static Assets (.html, .js, .css): Network-First
  // Tries live network first for latest updates; falls back to cache if offline
  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const copy = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
            return caches.match('/index.html');
          }
          return null;
        });
      })
  );
});
