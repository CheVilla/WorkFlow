// ── Service Worker Registration ──
// Auto-detect base path for GitHub Pages subfolder support
const SW_PATH = new URL('sw.js', document.baseURI).href;
const SW_SCOPE = new URL('./', document.baseURI).href;

let swReady = null;

if ('serviceWorker' in navigator) {
  // Unregister any stale service workers first
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(reg => {
      if (!reg.scope.includes(SW_SCOPE)) {
        reg.unregister();
        console.log('[SW] Unregistered stale SW:', reg.scope);
      }
    });
  });

  swReady = new Promise(async (resolve) => {
    try {
      console.log('[SW] Registering at:', SW_PATH, 'scope:', SW_SCOPE);
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