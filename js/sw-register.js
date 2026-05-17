// ── Service Worker Registration ──
let swReady = null; // Promise that resolves when SW is ready

if ('serviceWorker' in navigator) {
  swReady = new Promise(async (resolve) => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('[SW] Registered:', reg.scope);

      // Check for updates every 60 seconds
      setInterval(() => reg.update(), 60000);

      // Tell SW to skip waiting if there's a new version
      if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            newSW.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Wait until SW is active
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