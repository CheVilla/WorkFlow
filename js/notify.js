// ── IN-APP TOASTS ──
let notifStack = [];
let confirmCb = null;

function notify(title, body, icon) {
  const el = document.createElement('div');
  el.className = 'notif';
  el.innerHTML = `<div class="notif-icon">${icon || '🔔'}</div>
    <div class="notif-body"><h4>${title}</h4><p>${body}</p></div>`;
  document.body.appendChild(el);
  notifStack.push(el);
  notifStack.forEach((n, i) => { n.style.top = (12 + i * 72) + 'px'; });
  setTimeout(() => {
    el.remove();
    notifStack = notifStack.filter(n => n !== el);
    notifStack.forEach((n, i) => { n.style.top = (12 + i * 72) + 'px'; });
  }, 4000);
}

// ── CONFIRM DIALOG ──
function showConfirm(title, msg, cb) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-msg').textContent = msg;
  confirmCb = cb;
  document.getElementById('confirm-overlay').classList.remove('hidden');
}
function closeConfirm() {
  document.getElementById('confirm-overlay').classList.add('hidden');
  confirmCb = null;
}
async function runConfirm() {
  const cb = confirmCb;
  closeConfirm();
  if (cb) await cb();
}

// ── PUSH NOTIFICATIONS ──
const VAPID_PUBLIC_KEY = 'BEM7xU0S1A0A1vlP_RI0ZTnEIWyiL4RjQUKEn00TlFuPmtS66Kr3Do7UIX2aSMg6eYphBO_fPD4WlwYi4wcdGmA';
const EDGE_FUNCTION_URL = 'https://iyukyudkgudkaeqemagg.supabase.co/functions/v1/push-notify';

let swRegistration = null;

// Called once on app load
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported on this browser');
    return;
  }
  try {
    swRegistration = await navigator.serviceWorker.ready;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeToPush();
      await checkDeadlinesOnLoad();
    }
  } catch(e) {
    console.warn('Push init error:', e);
  }
}

async function subscribeToPush() {
  if (!swRegistration) return;
  try {
    // Check if already subscribed
    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }
    // Save subscription to Supabase
    if (db) {
      const subId = btoa(sub.endpoint).slice(-20);
      await db.from('push_subscriptions').upsert({
        id: subId,
        subscription: sub.toJSON(),
        created_at: new Date().toISOString(),
      });
      console.log('[Push] Subscription saved to Supabase');
    }
  } catch(e) {
    console.warn('[Push] Subscribe error:', e);
  }
}

// Send push via Supabase Edge Function
async function sendPush(title, body, icon) {
  try {
    await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ title, body, icon }),
    });
  } catch(e) {
    console.warn('[Push] Send error:', e);
  }
}

// Notify via SW message (works when tab is open/background)
function notifyViaSW(type, data) {
  if (!swRegistration) return;
  swRegistration.active?.postMessage({ type, ...data });
}

// Check deadlines on app load and notify
async function checkDeadlinesOnLoad() {
  if (!S.tasks || !S.tasks.length) return;
  const due = S.tasks
    .filter(t => t.deadline === today() && t.status !== 'done')
    .map(t => t.title);
  const overdue = S.tasks
    .filter(t => t.deadline && t.deadline < today() && t.status !== 'done')
    .map(t => t.title);

  if (due.length) {
    notifyViaSW('DEADLINE_CHECK', { tasks: due });
    notify(`📅 ${due.length} task${due.length > 1 ? 's' : ''} due today`, due.slice(0, 2).join(', '), '📅');
  }
  if (overdue.length) {
    notify(`⚠️ ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`, overdue.slice(0, 2).join(', '), '⚠️');
  }
}

// Helper: convert VAPID key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}