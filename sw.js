// PWA Service Worker (Git & Offline Support - Stale-While-Revalidate)
const CACHE_NAME = 'travel-pwa-v2026-v7';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Core asset cache warning:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME) {
            return caches.delete(k);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stale-while-revalidate for local assets, network-first for external tiles
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Navigation: Network first with cache fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('./index.html') || caches.match('./');
      })
    );
    return;
  }

  // Same-origin assets: Stale-while-revalidate
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fetchPromise = fetch(req).then((networkRes) => {
          if (networkRes && networkRes.status === 200) {
            const resClone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return networkRes;
        }).catch(() => {});
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Third-party (Leaflet CDN / OSM tiles): Cache falling back to network
  event.respondWith(
    caches.match(req).then((cached) => {
      return cached || fetch(req).then((netRes) => {
        if (netRes && netRes.status === 200 && (url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('unpkg.com'))) {
          const clone = netRes.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return netRes;
      }).catch(() => cached);
    })
  );
});
