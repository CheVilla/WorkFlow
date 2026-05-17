// ─── CONFIG ───────────────────────────────
const SUPABASE_URL = 'https://iyukyudkgudkaeqemagg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5dWt5dWRrZ3Vka2FlcWVtYWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NzIyMDQsImV4cCI6MjA5NDQ0ODIwNH0.NVu3inNPHl1GH-SXBbMqU0hyDiUxCLwuw-HwVJEEEM0';
// ──────────────────────────────────────────

let db = null;
let syncTimer = null;

async function initDB() {
  setLoadMsg('Connecting...');
  try {
    db = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    const { error: testErr } = await db.from('settings').select('id').limit(1);
    if (testErr) {
      console.error('Supabase connection test failed:', testErr);
      setLoadMsg('DB error: ' + testErr.message);
      setTimeout(async () => { await loadLocal(); hideLoading(); }, 2000);
      return;
    }
    await loadState();
  } catch(e) {
    console.error('initDB error:', e);
    setLoadMsg('Using local storage');
    await loadLocal();
  }
  hideLoading();
}

async function loadState() {
  setLoadMsg('Loading your data...');
  try {
    const [pr, tr, sr, setr] = await Promise.all([
      db.from('projects').select('*'),
      db.from('tasks').select('*'),
      db.from('sessions').select('*'),
      db.from('settings').select('*').eq('id','user').single(),
    ]);
    S.projects = (pr.data||[]).map(r => r.data);
    S.tasks    = (tr.data||[]).map(r => r.data);
    S.sessions = (sr.data||[]).map(r => r.data);
    if (setr.data) S.settings = { ...S.settings, ...setr.data.data };
  } catch(e) { console.warn('Load error', e); }
  migrateTasks();
  if (!S.projects.length) await seed();
  renderAll(); applyPS();
  document.getElementById('svol').value = S.settings.volume || 70;
  document.getElementById('svollbl').textContent = (S.settings.volume || 70) + '%';
}

async function loadLocal() {
  try {
    const p=localStorage.getItem('pm:projects'), t=localStorage.getItem('pm:tasks'),
          s=localStorage.getItem('pm:sessions'), se=localStorage.getItem('pm:settings');
    if(p) S.projects=JSON.parse(p); if(t) S.tasks=JSON.parse(t);
    if(s) S.sessions=JSON.parse(s); if(se) S.settings={...S.settings,...JSON.parse(se)};
  } catch(e) {}
  migrateTasks();
  if (!S.projects.length) seedLocal();
  renderAll(); applyPS();
}

function showSync(msg='Saving...') {
  const el = document.getElementById('sync');
  document.getElementById('sync-msg').textContent = msg;
  el.classList.add('show');
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => el.classList.remove('show'), 1800);
}

async function upsertRow(table, id, data) {
  if (!db) { localStorage.setItem('pm:'+table, JSON.stringify(data)); return; }
  showSync();
  const { error } = await db.from(table).upsert({ id, data, updated_at: new Date().toISOString() });
  if (error) {
    console.error('Supabase upsert error on', table, error);
    notify('Sync error', error.message || 'Could not save', '⚠️');
  } else { showSync('Saved ✓'); }
}

async function deleteRow(table, id) {
  if (!db) return;
  showSync();
  const { error } = await db.from(table).delete().eq('id', id);
  if (error) {
    console.error('Supabase delete error on', table, error);
    notify('Sync error', error.message || 'Could not delete', '⚠️');
  } else { showSync('Saved ✓'); }
}

async function saveProjects() {
  if (!db) { localStorage.setItem('pm:projects', JSON.stringify(S.projects)); return; }
  showSync();
  for (const p of S.projects) await db.from('projects').upsert({ id: p.id, data: p, updated_at: new Date().toISOString() });
  showSync('Saved ✓');
}

async function saveTasks() {
  if (!db) { localStorage.setItem('pm:tasks', JSON.stringify(S.tasks)); return; }
  showSync();
  for (const t of S.tasks) await db.from('tasks').upsert({ id: t.id, data: t, updated_at: new Date().toISOString() });
  showSync('Saved ✓');
}

async function saveSessions() {
  if (!db) { localStorage.setItem('pm:sessions', JSON.stringify(S.sessions)); return; }
  showSync();
  for (const s of S.sessions) if (s.completed) await db.from('sessions').upsert({ id: s.id, data: s, updated_at: new Date().toISOString() });
  showSync('Saved ✓');
}

async function saveSettings() {
  if (!db) { localStorage.setItem('pm:settings', JSON.stringify(S.settings)); return; }
  await db.from('settings').upsert({ id: 'user', data: S.settings, updated_at: new Date().toISOString() });
}
