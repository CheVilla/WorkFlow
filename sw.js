// ── FlowDesk Service Worker ──
const CACHE_NAME = 'flowdesk-v2';
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
  '/js/sw-register.js',
];

// ── INSTALL — cache all assets ──
self.addEventListener('install', e => {
  console.log('[SW] Installing...');
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── ACTIVATE — clean old caches ──
self.addEventListener('activate', e => {
  console.log('[SW] Activating...');
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH — serve from cache, fallback to network ──
self.addEventListener('fetch', e => {
  // Only handle GET requests for our own assets
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('supabase.co')) return; // never cache API calls

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache new assets on the fly
        if (response.ok && e.request.url.startsWith(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// ── PUSH — receive push notifications ──
self.addEventListener('push', e => {
  console.log('[SW] Push received');
  let data = { title: 'FlowDesk', body: 'You have a notification', icon: '/favicon.ico' };
  try {
    if (e.data) data = { ...data, ...e.data.json() };
  } catch(err) {
    if (e.data) data.body = e.data.text();
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || '/favicon.ico',
      badge: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: data.tag || 'flowdesk',
      renotify: true,
      data: { url: data.url || '/' },
    })
  );
});

// ── NOTIFICATION CLICK — focus or open the app ──
self.addEventListener('notificationclick', e => {
  console.log('[SW] Notification clicked');
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin) && 'focus' in c);
      if (existing) return existing.focus();
      return clients.openWindow(e.notification.data?.url || '/');
    })
  );
});

// ── MESSAGE — communicate with main app ──
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (e.data?.type === 'POMO_COMPLETE') {
    self.registration.showNotification('🍅 Pomodoro Complete!', {
      body: e.data.body || 'Great work! Time for a break.',
      icon: '/favicon.ico',
      vibrate: [200, 100, 200, 100, 200],
      tag: 'pomodoro',
      renotify: true,
    });
  }
  if (e.data?.type === 'BREAK_COMPLETE') {
    self.registration.showNotification('☕ Break Over!', {
      body: 'Ready to focus? Start your next session.',
      icon: '/favicon.ico',
      vibrate: [200, 100, 200],
      tag: 'pomodoro',
      renotify: true,
    });
  }
  if (e.data?.type === 'DEADLINE_CHECK') {
    const { tasks } = e.data;
    if (tasks && tasks.length > 0) {
      self.registration.showNotification(`📅 ${tasks.length} task${tasks.length > 1 ? 's' : ''} due today`, {
        body: tasks.slice(0, 3).map(t => `• ${t}`).join('\n'),
        icon: '/favicon.ico',
        vibrate: [200, 100, 200],
        tag: 'deadlines',
        renotify: false,
      });
    }
  }
});