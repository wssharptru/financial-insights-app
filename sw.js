// sw.js

const VERSION = 'v1.0.7'; // Bumped for E*TRADE access control

const BASE = self.location.pathname.replace(/\/sw\.js$/, '/');

const CORE_ASSETS = [
  `${BASE}`,
  `${BASE}index.html`,
  `${BASE}assets/css/styles.css`,
  `${BASE}assets/js/main.js`,
  `${BASE}assets/js/auth.js`,
  `${BASE}assets/js/charts.js`,
  `${BASE}assets/js/event-listeners.js`,
  `${BASE}assets/js/firestore.js`,
  `${BASE}assets/js/loader.js`,
  `${BASE}assets/js/navigation.js`,
  `${BASE}assets/js/portfolio-logic.js`,
  `${BASE}assets/js/renderer.js`,
  `${BASE}assets/js/utils.js`,
  `${BASE}assets/js/transaction-import.js`,
  `${BASE}partials/sidebar.html`,
  `${BASE}partials/auth/auth-forms.html`,
  `${BASE}partials/modals.html`,
  `${BASE}pages/dashboard.html`,
  `${BASE}pages/portfolio.html`,
  `${BASE}pages/ai-screener.html`,
  `${BASE}pages/insights.html`,
  `${BASE}pages/preferences.html`,
  `${BASE}pages/asset-profile.html`,
  // New Budget Tool Assets
  `${BASE}pages/budget.html`,
  `${BASE}assets/css/budget.css`,
  `${BASE}assets/js/budget.js`,
  // External assets
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js'
];

// --- INSTALL EVENT ---
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => {
        console.log('Service Worker: Caching core assets');
        return cache.addAll(CORE_ASSETS);
      })
      .catch(error => {
        console.error('Service Worker installation failed:', error);
      })
  );
  self.skipWaiting();
});

// --- ACTIVATE EVENT ---
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
  return self.clients.claim();
});

// --- FETCH EVENT (Network-first, cache fallback) ---
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  event.respondWith(
    fetch(request)
      .then(networkResponse => {
        // Got a fresh response — cache it for offline use
        const clonedResponse = networkResponse.clone();
        caches.open(VERSION).then(cache => {
          cache.put(request, clonedResponse);
        });
        return networkResponse;
      })
      .catch(() => {
        // Network failed — fall back to cache (offline support)
        return caches.match(request);
      })
  );
});
