// Service Worker — Phase 1 placeholder
// Full background sync + push notifications coming in Phase 1 build
const CACHE_NAME = 'flowdesk-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/components.css',
  '/css/views.css',
  '/css/mobile.css',
  '/js/app.js',
  '/js/db.js',
  '/js/render.js',
  '/js/pomodoro.js',
  '/js/modals.js',
  '/js/notify.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
