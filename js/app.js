// ── STATE ──
let S = {
  projects: [], tasks: [], sessions: [],
  settings: { workMin: 25, breakMin: 5, volume: 70 },
  activeProj: null, view: 'dashboard'
};

let calY, calM;
const now = new Date();
calY = now.getFullYear(); calM = now.getMonth();

const COLORS = ['#7c6af7','#f87171','#4ade80','#fbbf24','#60a5fa','#f472b6','#34d399','#fb923c','#a78bfa','#38bdf8'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MONTHS_S = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const QUADS = [
  {key:'q1',urgent:true, important:true, title:'Do First',  sub:'Important & Urgent',       cls:'q1b',color:'var(--q1)'},
  {key:'q2',urgent:false,important:true, title:'Schedule',  sub:'Important, Not Urgent',     cls:'q2b',color:'var(--q2)'},
  {key:'q3',urgent:true, important:false,title:'Delegate',  sub:'Urgent, Not Important',     cls:'q3b',color:'var(--q3)'},
  {key:'q4',urgent:false,important:false,title:'Eliminate', sub:'Not Urgent, Not Important', cls:'q4b',color:'var(--q4)'},
];

// ── UTILS ──
function uid() { return Math.random().toString(36).slice(2,10); }
function fmt(d) { return d.toISOString().slice(0,10); }
function addD(d,n) { const r=new Date(d); r.setDate(r.getDate()+n); return r; }
function today() { return fmt(new Date()); }
function byId(id) { return S.projects.find(p=>p.id===id); }
function isMob() { return window.innerWidth<=640; }
function activeProjTasks() { return S.activeProj ? S.tasks.filter(t=>t.projectId===S.activeProj) : S.tasks; }
function activeProjects() { return S.projects.filter(p=>!p.archived); }
function getQuadrant(t) {
  const u=t.urgent, i=t.important;
  if(u&&i)   return {key:'q1',label:'Q1 — Do First',  cls:'q1b',emoji:'🔴'};
  if(!u&&i)  return {key:'q2',label:'Q2 — Schedule',  cls:'q2b',emoji:'🔵'};
  if(u&&!i)  return {key:'q3',label:'Q3 — Delegate',  cls:'q3b',emoji:'🟡'};
  return           {key:'q4',label:'Q4 — Eliminate', cls:'q4b',emoji:'⚪'};
}

// ── MIGRATION ──
function migrateTasks() {
  S.tasks.forEach(t => {
    if (t.urgent === undefined && t.important === undefined) {
      if (t.priority==='high')        { t.urgent=true;  t.important=true;  }
      else if (t.priority==='medium') { t.urgent=false; t.important=true;  }
      else                            { t.urgent=false; t.important=false; }
      delete t.priority;
    }
  });
}

// ── SEED ──
async function seed() {
  const p1=uid(), p2=uid();
  S.projects = [
    {id:p1,title:'Website Redesign',description:'Company website overhaul',color:'#7c6af7',deadline:fmt(addD(now,30)),archived:false,createdAt:now.toISOString()},
    {id:p2,title:'Mobile App',description:'iOS & Android launch',color:'#4ade80',deadline:fmt(addD(now,60)),archived:false,createdAt:now.toISOString()},
  ];
  [
    [{title:'Research competitors',urgent:false,important:true, status:'backlog'},
     {title:'Design mockups',      urgent:true, important:true, status:'todo'},
     {title:'Set up CI/CD',        urgent:true, important:false,status:'in_progress'},
     {title:'Write copy',          urgent:false,important:false,status:'done'}],
    [{title:'User auth flow',      urgent:true, important:true, status:'backlog'},
     {title:'Push notifications',  urgent:false,important:true, status:'todo'},
     {title:'App icon design',     urgent:true, important:false,status:'in_progress'},
     {title:'Beta testing',        urgent:false,important:false,status:'done'}],
  ].forEach((ts,pi) => {
    ts.forEach((t,i) => S.tasks.push({id:uid(),projectId:[p1,p2][pi],...t,
      deadline:fmt(addD(now,5+i*7)),estimatedPomodoros:2+i,
      completedPomodoros:i>1?1:0,timeTracked:i>1?25:0,createdAt:now.toISOString()}));
  });
  await saveProjects(); await saveTasks();
}
function seedLocal() { seed(); }

// ── LOADING ──
function setLoadMsg(m) { document.getElementById('load-msg').textContent = m; }
function hideLoading() {
  const el = document.getElementById('loading');
  el.classList.add('fade');
  setTimeout(() => el.remove(), 400);
}

// ── VIEW SWITCHING ──
function sv(view, el) {
  document.querySelectorAll('.ni,.bni').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`[data-v="${view}"]`).forEach(n => n.classList.add('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-'+view).classList.add('active');
  S.view = view;
  const titles = {dashboard:'Dashboard',kanban:'Board',matrix:'Matrix',calendar:'Calendar',pomodoro:'Pomodoro',report:'Report',projects:'Projects'};
  document.getElementById('vtitle').textContent = titles[view];
  const acts = document.getElementById('tacts');
  const showTask = (view==='kanban'||view==='dashboard'||view==='matrix');
  acts.innerHTML = showTask
    ? `<button class="btn btnp" onclick="openTaskModal()"><i class="ri-add-line"></i>New task</button>${view==='dashboard'?'<button class="btn" onclick="openProjModal()"><i class="ri-folder-add-line"></i>New project</button>':''}`
    : '';
  document.getElementById('fab').style.display = showTask ? 'flex' : 'none';
  if(view==='dashboard') renderDash();
  if(view==='kanban')    renderKanban();
  if(view==='matrix')    renderMatrix();
  if(view==='calendar')  renderCal();
  if(view==='pomodoro')  renderPomo();
  if(view==='report')    renderReport();
  if(view==='projects')  renderProjects();
}

function renderAll() {
  renderSidebar();
  if(S.view==='dashboard') renderDash();
  if(S.view==='kanban')    renderKanban();
  if(S.view==='matrix')    renderMatrix();
  if(S.view==='calendar')  renderCal();
  if(S.view==='pomodoro')  renderPomo();
  if(S.view==='report')    renderReport();
  if(S.view==='projects')  renderProjects();
}

// ── BOOT ──
document.addEventListener('DOMContentLoaded', () => {
  document.addEventListener('click', () => { try { getACtx(); } catch(e) {} }, {once:true});
  initPushNotifications();
  window.addEventListener('resize', () => { if(S.view==='calendar') renderCal(); });
  document.addEventListener('keydown', e => {
    if(e.key==='Escape') { closeTaskModal(); closeProjModal(); closeConfirm(); }
    if((e.metaKey||e.ctrlKey)&&e.key==='k') { openTaskModal(); e.preventDefault(); }
  });
  document.getElementById('pmodal').addEventListener('click', e => { if(e.target===e.currentTarget) closeProjModal(); });
  document.getElementById('tmodal').addEventListener('click', e => { if(e.target===e.currentTarget) closeTaskModal(); });
  document.getElementById('confirm-overlay').addEventListener('click', e => { if(e.target===e.currentTarget) closeConfirm(); });
  document.getElementById('turgent').addEventListener('change', updateQuadrantPreview);
  document.getElementById('timportant').addEventListener('change', updateQuadrantPreview);
  initDB();
});