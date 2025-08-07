// sw.js

// --- CONSTANTS ---
// Version for the cache. Update this string to force an update of the cached assets.
const VERSION = 'v1.0.1'; 
// A list of core assets that are essential for the app's shell to function.
const CORE_ASSETS = [
  '/',
  'index.html',
  'assets/css/styles.css',
  'assets/js/main.js',
  'assets/js/auth.js',
  'assets/js/charts.js',
  'assets/js/event-listeners.js',
  'assets/js/firestore.js',
  'assets/js/loader.js',
  'assets/js/navigation.js',
  'assets/js/portfolio-logic.js',
  'assets/js/renderer.js',
  'assets/js/utils.js',
  'partials/sidebar.html',
  'partials/auth/auth-forms.html',
  'partials/modals.html',
  'pages/dashboard.html',
  'pages/portfolio.html',
  'pages/ai-screener.html',
  'pages/insights.html',
  'pages/preferences.html',
  'pages/asset-profile.html',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// --- EVENT LISTENERS ---

/**
 * 'install' event listener.
 * This event is fired when the service worker is first installed.
 * It opens a cache and adds all the core assets to it.
 */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .catch(error => console.error('Service Worker installation failed:', error))
  );
  self.skipWaiting(); // Activate the new service worker immediately.
});

/**
 * 'activate' event listener.
 * This event is fired when the service worker is activated.
 * It cleans up old caches to remove outdated assets.
 */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== VERSION) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim(); // Take control of all open clients.
});

/**
 * 'fetch' event listener.
 * This event is fired for every network request made by the page.
 * It implements a "stale-while-revalidate" caching strategy.
 * 1. Responds with a cached version if available (for speed).
 * 2. Simultaneously, fetches an updated version from the network.
 * 3. Caches the new version for the next request.
 * 4. Falls back to the cache if the network fails (offline support).
 */
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Fetch from the network in the background.
      const networkFetch = fetch(request)
        .then(networkResponse => {
          // If the fetch is successful, update the cache.
          caches.open(VERSION).then(cache => {
            cache.put(request, networkResponse.clone());
          });
          return networkResponse;
        })
        .catch(() => {
          // If the network fetch fails, return the cached response if it exists.
          return cachedResponse;
        });

      // Return the cached response immediately if it exists, otherwise wait for the network fetch.
      return cachedResponse || networkFetch;
    })
  );
});
