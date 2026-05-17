// ── Service Worker Registration ──
// Detect repo subfolder automatically — works on any GitHub Pages URL
const BASE = window.location.pathname.split('/').slice(0, 2).join('/');
const SW_PATH = BASE + '/sw.js';
const SW_SCOPE = BASE + '/';

let swReady = null;

if ('serviceWorker' in navigator) {
  // Clear stale registrations
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => {
      if (!reg.scope.endsWith(SW_SCOPE) && !SW_SCOPE.includes(new URL(reg.scope).pathname)) {
        reg.unregister();
        console.log('[SW] Unregistered stale:', reg.scope);
      }
    });
  });

  swReady = new Promise(async (resolve) => {
    try {
      console.log('[SW] Registering:', SW_PATH, '| scope:', SW_SCOPE);
      const reg = await navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE });
      console.log('[SW] Registered:', reg.scope);
      setInterval(() => reg.update(), 60000);
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
      const ready = await navigator.serviceWorker.ready;
      console.log('[SW] Ready:', ready.scope);
      resolve(ready);
    } catch(e) {
      console.warn('[SW] Registration failed:', e);
      resolve(null);
    }
  });
} else {
  swReady = Promise.resolve(null);
}