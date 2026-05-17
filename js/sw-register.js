// ── Service Worker Registration ──
let swReady = null;

if ('serviceWorker' in navigator) {
  swReady = new Promise(async (resolve) => {
    try {
      const reg = await navigator.serviceWorker.register('/Workflow/sw.js', { scope: '/Workflow/' });
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
      console.log('[SW] Ready');
      resolve(ready);
    } catch(e) {
      console.warn('[SW] Registration failed:', e);
      resolve(null);
    }
  });
} else {
  swReady = Promise.resolve(null);
}