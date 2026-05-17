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
const EDGE_FUNCTION_URL = 'https://iyukyudkgudkaeqemagg.supabase.co/functions/v1/swift-api';

let swRegistration = null;

// Called after DB loads and SW is ready
async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('[Push] Not supported on this browser');
    return;
  }

  try {
    // Wait for SW to be fully ready
    swRegistration = await swReady;
    if (!swRegistration) {
      console.warn('[Push] SW not available');
      return;
    }

    // Request permission — this shows the browser prompt
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission:', permission);

    if (permission === 'granted') {
      notify('🔔 Notifications enabled', 'You\'ll get alerts for deadlines and pomodoros', '✅');
      await subscribeToPush();
      // Small delay to let data load before checking deadlines
      setTimeout(checkDeadlinesOnLoad, 1500);
    } else {
      console.log('[Push] Permission denied');
    }
  } catch(e) {
    console.warn('[Push] Init error:', e);
  }
}
async function requestNotifPermission() {
  try {
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission:', permission);
    if (permission === 'granted') {
      hideNotifPrompt();
      notify('🔔 Notifications enabled', 'You\'ll get alerts for deadlines and pomodoros', '✅');
      await subscribeToPush();
      setTimeout(checkDeadlinesOnLoad, 1000);
    } else {
      notify('Notifications blocked', 'You can enable them in browser settings', '⚠️');
    }
  } catch(e) {
    console.warn('[Push] Permission error:', e);
  }
}

function hideNotifPrompt() {
  const el = document.getElementById('notif-prompt');
  if (el) el.style.display = 'none';
}
async function subscribeToPush() {
  if (!swRegistration) return;
  try {
    let sub = await swRegistration.pushManager.getSubscription();
    if (!sub) {
      sub = await swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log('[Push] New subscription created');
    } else {
      console.log('[Push] Already subscribed');
    }

    // Save subscription to Supabase
    if (db) {
      const subId = btoa(sub.endpoint).slice(-20).replace(/[^a-zA-Z0-9]/g, '');
      await db.from('push_subscriptions').upsert({
        id: subId,
        subscription: sub.toJSON(),
        created_at: new Date().toISOString(),
      });
      console.log('[Push] Subscription saved');
    }
  } catch(e) {
    console.warn('[Push] Subscribe error:', e);
  }
}

// Fire push via SW message — works when tab is open or backgrounded
function notifyViaSW(type, data) {
  if (!swRegistration?.active) {
    console.warn('[SW] No active SW to message');
    return;
  }
  swRegistration.active.postMessage({ type, ...data });
}

// Fire push via Edge Function — reaches all subscribed devices
async function sendPush(title, body) {
  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify({ title, body }),
    });
    const data = await res.json();
    console.log('[Push] Edge Function response:', data);
  } catch(e) {
    console.warn('[Push] Edge Function error:', e);
  }
}

// Check deadlines and fire notifications
async function checkDeadlinesOnLoad() {
  if (!S.tasks?.length) return;
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
    notify(`⚠️ ${overdue.length} overdue`, overdue.slice(0, 2).join(', '), '⚠️');
  }
}

// Helper — convert VAPID public key
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return new Uint8Array([...raw].map(c => c.charCodeAt(0)));
}
