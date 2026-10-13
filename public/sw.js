// Service Worker for Khmer AI Book Reader PWA
// Version: v2.3.3
const CACHE_NAME = 'khmer-ai-reader-v2.3.3';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/version.json',
  '/css/styles.css',
  '/js/app.js',
  '/js/settings.js',
  '/js/library.js',
  '/js/pdf-reader.js',
  '/js/book-audio-player.js',
  '/js/ai-assistant.js',
  '/icons/app-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  // Activate immediately without waiting for existing tabs to close
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Cache addAll skipped some assets:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  // Purge all old cache versions immediately
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log('[SW] Deleting legacy cache:', key);
          return caches.delete(key);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data === 'CLEAR_CACHE') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage('CACHE_CLEARED'));
      });
    });
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // 1. API and version.json: Always Network-Only (never serve stale cache)
  if (url.pathname.startsWith('/api/') || url.pathname.includes('version.json')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. HTML & Navigation requests: Strictly Network-First!
  // This guarantees that when an update is deployed, the user IMMEDIATELY gets the new HTML!
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Only fallback to cache when completely offline
          return caches.match(event.request).then((cached) => cached || caches.match('/index.html'));
        })
    );
    return;
  }

  // 3. Static Assets (CSS, JS, Icons): Stale-While-Revalidate with background cache update
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
