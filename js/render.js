function renderSidebar() {
  const editBtn = (id) => `<button onclick="event.stopPropagation();openProjModal('${id}')" title="Edit"
    style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;display:flex;align-items:center;flex-shrink:0;margin-left:2px"
    onmouseenter="this.style.color='var(--accent)'" onmouseleave="this.style.color='var(--text3)'"><i class="ri-pencil-line"></i></button>`;
  const active = activeProjects();
  const archived = S.projects.filter(p=>p.archived);
  let html = active.map(p=>`<div class="proj-item ${S.activeProj===p.id?'active':''}" onclick="selProj('${p.id}')">
    <span class="dot" style="background:${p.color}"></span>
    <span class="pname">${p.title}</span>${editBtn(p.id)}</div>`).join('');
  if (archived.length) {
    html += `<div class="sec" style="padding-top:8px">Archived</div>`;
    html += archived.map(p=>`<div class="proj-item ${S.activeProj===p.id?'active':''}" onclick="selProj('${p.id}')" style="opacity:.5">
      <span class="dot" style="background:${p.color}"></span>
      <span class="pname">${p.title}</span><span class="archived-tag">archived</span>${editBtn(p.id)}</div>`).join('');
  }
  document.getElementById('plist').innerHTML = html;
}

function selProj(id) {
  S.activeProj = S.activeProj===id ? null : id;
  renderSidebar();
  if(S.view==='kanban') renderKanban();
  if(S.view==='matrix') renderMatrix();
}

// ── DASHBOARD ──
function renderDash() {
  const tasks = S.tasks.filter(t=>!byId(t.projectId)?.archived);
  const done=tasks.filter(t=>t.status==='done').length;
  const active=tasks.filter(t=>t.status!=='done').length;
  const td=tasks.filter(t=>t.deadline===today()&&t.status!=='done');
  const ov=tasks.filter(t=>t.deadline&&t.deadline<today()&&t.status!=='done').length;
  const tp=S.sessions.filter(s=>s.completed).length;
  document.getElementById('dstats').innerHTML=`
    <div class="sc"><div class="sl">Active</div><div class="sv">${active}</div><div class="ss">${ov} overdue</div></div>
    <div class="sc"><div class="sl">Done</div><div class="sv">${done}</div><div class="ss">tasks</div></div>
    <div class="sc"><div class="sl">Due today</div><div class="sv" style="color:${td.length?'var(--amber)':'inherit'}">${td.length}</div><div class="ss">tasks</div></div>
    <div class="sc"><div class="sl">Pomodoros</div><div class="sv">${tp}</div><div class="ss">total</div></div>`;
  document.getElementById('dtoday').innerHTML = !td.length
    ? '<div class="es"><i class="ri-check-double-line"></i><p>No tasks due today</p></div>'
    : td.map(t=>{const p=byId(t.projectId),q=getQuadrant(t);return`<div class="task-row" onclick="openTaskModal('${t.id}')"><span class="dot" style="background:${p?p.color:'#888'}"></span><span class="tn">${t.title}</span><span class="qbadge ${q.cls}">${q.emoji} ${q.label.split('—')[0].trim()}</span></div>`;}).join('');
  document.getElementById('dprojs').innerHTML = !activeProjects().length
    ? '<div class="es"><i class="ri-folder-open-line"></i><p>No projects yet</p></div>'
    : activeProjects().map(p=>{const pt=S.tasks.filter(t=>t.projectId===p.id),pd=pt.filter(t=>t.status==='done').length,pct=pt.length?Math.round(pd/pt.length*100):0;return`<div class="proj-row" onclick="selProj('${p.id}');sv('kanban',document.querySelector('[data-v=kanban]'))"><span class="dot" style="background:${p.color};width:10px;height:10px;flex-shrink:0"></span><div class="proj-info"><div class="pn">${p.title}</div><div class="pd">${pt.length} tasks · ${pd} done</div></div><div class="prog-wrap"><div class="prog-bg"><div class="prog-fill" style="width:${pct}%;background:${p.color}"></div></div><div class="prog-pct">${pct}%</div></div></div>`;}).join('');
}

// ── KANBAN ──
function renderKanban() {
  const cols=['backlog','todo','in_progress','done'];
  const labels={backlog:'Backlog',todo:'To Do',in_progress:'In Progress',done:'Done'};
  const colors={backlog:'var(--text3)',todo:'var(--blue)',in_progress:'var(--amber)',done:'var(--green)'};
  const ft=activeProjTasks().filter(t=>!byId(t.projectId)?.archived);
  document.getElementById('kboard').innerHTML=cols.map(col=>{
    const ts=ft.filter(t=>t.status===col);
    return`<div class="kcol" id="col-${col}"
      ondragover="event.preventDefault();document.getElementById('col-${col}').classList.add('drop-active')"
      ondragleave="document.getElementById('col-${col}').classList.remove('drop-active')"
      ondrop="dropK(event,'${col}')">
      <div class="col-hdr"><span class="col-title" style="color:${colors[col]}">${labels[col]}</span><span class="col-count">${ts.length}</span><button class="col-add" onclick="openTaskModal(null,'${col}')"><i class="ri-add-line"></i></button></div>
      ${ts.length?ts.map(t=>tcHTML(t)).join(''):'<div class="es" style="padding:16px 8px"><i class="ri-inbox-line" style="font-size:20px"></i><p style="font-size:11px">Empty</p></div>'}
    </div>`;
  }).join('');
}

function tcHTML(t) {
  const p=byId(t.projectId),dl=t.deadline,ov=dl&&dl<today()&&t.status!=='done',q=getQuadrant(t);
  return`<div class="tc" draggable="true" id="tc-${t.id}" ondragstart="dstart(event,'${t.id}')" ondragend="dend()" onclick="openTaskModal('${t.id}')">
    <div class="tc-title">${t.title}</div>
    <div class="tc-meta">
      <span class="qbadge ${q.cls}">${q.emoji} ${q.key.toUpperCase()}</span>
      ${p?`<span class="dot" style="background:${p.color}"></span>`:''}
      ${dl?`<span class="tc-dl ${ov?'ov':''}"><i class="ri-calendar-line"></i>${dl.slice(5)}</span>`:''}
      ${t.estimatedPomodoros?`<span class="tc-pomo"><i class="ri-timer-line"></i>${t.completedPomodoros||0}/${t.estimatedPomodoros}</span>`:''}
    </div>
  </div>`;
}

let dragId=null;
function dstart(e,id){dragId=id;setTimeout(()=>document.getElementById('tc-'+id)?.classList.add('dragging'),0);}
function dend(){document.querySelectorAll('.tc').forEach(c=>c.classList.remove('dragging'));}
function dropK(e,status){
  e.preventDefault();document.querySelectorAll('.kcol').forEach(c=>c.classList.remove('drop-active'));
  if(!dragId)return;
  const t=S.tasks.find(t=>t.id===dragId);
  if(t){t.status=status;saveTasks();renderKanban();renderDash();}
  dragId=null;
}

// ── MATRIX ──
function renderMatrix() {
  const ft=activeProjTasks().filter(t=>t.status!=='done'&&!byId(t.projectId)?.archived);
  document.getElementById('mx-grid').innerHTML=QUADS.map(q=>{
    const ts=ft.filter(t=>!!t.urgent===q.urgent&&!!t.important===q.important);
    return`<div class="mx-quad" id="mxq-${q.key}" style="border-top:3px solid ${q.color}"
      ondragover="event.preventDefault();document.getElementById('mxq-${q.key}').classList.add('drop-active')"
      ondragleave="document.getElementById('mxq-${q.key}').classList.remove('drop-active')"
      ondrop="dropMx(event,${q.urgent},${q.important})">
      <div class="mx-quad-hdr">
        <span class="qbadge ${q.cls}">${q.key.toUpperCase()}</span>
        <div><div class="mx-quad-title">${q.title}</div><div class="mx-quad-sub">${q.sub}</div></div>
        <span class="mx-quad-count">${ts.length}</span>
      </div>
      ${ts.length?ts.map(t=>mxCardHTML(t)).join(''):'<div class="es" style="padding:14px 8px"><i class="ri-inbox-line" style="font-size:18px"></i><p style="font-size:11px">Drop tasks here</p></div>'}
    </div>`;
  }).join('');
}

function mxCardHTML(t) {
  const p=byId(t.projectId),dl=t.deadline,ov=dl&&dl<today();
  return`<div class="tc" draggable="true" id="tc-${t.id}" ondragstart="dstart(event,'${t.id}')" ondragend="dend()" onclick="openTaskModal('${t.id}')">
    <div class="tc-title">${t.title}</div>
    <div class="tc-meta">
      ${p?`<span class="dot" style="background:${p.color}"></span><span style="font-size:11px;color:var(--text3)">${p.title}</span>`:''}
      ${dl?`<span class="tc-dl ${ov?'ov':''}" style="margin-left:auto"><i class="ri-calendar-line"></i>${dl.slice(5)}</span>`:''}
    </div>
  </div>`;
}

function dropMx(e,urgent,important){
  e.preventDefault();document.querySelectorAll('.mx-quad').forEach(c=>c.classList.remove('drop-active'));
  if(!dragId)return;
  const t=S.tasks.find(t=>t.id===dragId);
  if(t){t.urgent=urgent;t.important=important;saveTasks();renderMatrix();}
  dragId=null;
}

// ── CALENDAR ──
function renderCal() {
  const mob=isMob();
  document.getElementById('cmlbl').textContent=mob?`${MONTHS_S[calM]} ${calY}`:`${MONTHS[calM]} ${calY}`;
  const days=mob?['S','M','T','W','T','F','S']:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const fd=new Date(calY,calM,1).getDay(),dim=new Date(calY,calM+1,0).getDate(),dip=new Date(calY,calM,0).getDate();
  const ts=today();let cells=[];
  for(let i=fd-1;i>=0;i--) cells.push({day:dip-i,m:calM-1,y:calY,o:true});
  for(let d=1;d<=dim;d++) cells.push({day:d,m:calM,y:calY,o:false});
  while(cells.length%7!==0) cells.push({day:cells.length-dim-fd+1,m:calM+1,y:calY,o:true});
  const g=document.getElementById('cgrid');
  g.innerHTML=days.map(d=>`<div class="cal-dn">${d}</div>`).join('');
  cells.forEach(c=>{
    const ds=`${c.y}-${String(c.m+1).padStart(2,'0')}-${String(c.day).padStart(2,'0')}`;
    const dt=S.tasks.filter(t=>t.deadline===ds&&!c.o);const it=ds===ts;
    g.innerHTML+=`<div class="cal-day ${c.o?'other':''} ${it?'today':''}">
      <div class="day-num">${c.day}</div>
      ${dt.slice(0,mob?1:2).map(t=>{const p=byId(t.projectId),col=p?p.color:'#888';return`<div class="cal-task" style="background:${col}20;color:${col};border:1px solid ${col}40" onclick="openTaskModal('${t.id}');event.stopPropagation()">${mob?'●':t.title}</div>`;}).join('')}
      ${dt.length>(mob?1:2)?`<div style="font-size:9px;color:var(--text3)">+${dt.length-(mob?1:2)}</div>`:''}
    </div>`;
  });
}
function calNav(d){
  if(d===0){calY=now.getFullYear();calM=now.getMonth();}
  else{calM+=d;if(calM>11){calM=0;calY++;}else if(calM<0){calM=11;calY--;}}
  renderCal();
}

// ── REPORT ──
function renderReport() {
  const tp=S.sessions.filter(s=>s.completed).length,tm=tp*(S.settings.workMin||25);
  const done=S.tasks.filter(t=>t.status==='done').length;
  const ap=activeProjects().filter(p=>S.tasks.some(t=>t.projectId===p.id&&t.status!=='done')).length;
  document.getElementById('rtpomo').textContent=tp;
  document.getElementById('rttime').textContent=`${Math.floor(tm/60)}h ${tm%60}m`;
  document.getElementById('rtdone').textContent=done;
  document.getElementById('rtproj').textContent=ap;
  const tb=document.getElementById('rtbody');
  if(!S.projects.length){tb.innerHTML='<tr><td colspan="5" style="color:var(--text3);text-align:center;padding:20px">No projects yet</td></tr>';return;}
  const mp=Math.max(...S.projects.map(p=>S.sessions.filter(s=>s.projectId===p.id&&s.completed).length),1);
  tb.innerHTML=S.projects.map(p=>{
    const ps=S.sessions.filter(s=>s.projectId===p.id&&s.completed).length;
    const pm=ps*(S.settings.workMin||25),pd=S.tasks.filter(t=>t.projectId===p.id&&t.status==='done').length;
    const bw=Math.round(ps/mp*100);
    return`<tr><td><span class="dot" style="background:${p.color};display:inline-block;margin-right:6px;vertical-align:middle"></span>${p.title}${p.archived?'<span style="font-size:10px;color:var(--text3);margin-left:4px">(archived)</span>':''}</td>
      <td style="font-family:var(--mono)">${ps}</td>
      <td style="font-family:var(--mono);white-space:nowrap">${Math.floor(pm/60)}h ${pm%60}m</td>
      <td style="font-family:var(--mono)">${pd}</td>
      <td><div style="height:5px;background:var(--bg4);border-radius:3px;width:80px"><div style="height:5px;border-radius:3px;background:${p.color};width:${bw}%"></div></div></td></tr>`;
  }).join('');
}

// ── PROJECTS VIEW ──
function renderProjects() {
  const el=document.getElementById('proj-cards');
  if(!el)return;
  if(!S.projects.length){el.innerHTML='<div class="es"><i class="ri-folder-open-line"></i><p>No projects yet</p></div>';return;}
  el.innerHTML=S.projects.map(p=>{
    const pt=S.tasks.filter(t=>t.projectId===p.id);
    const pd=pt.filter(t=>t.status==='done').length;
    const pct=pt.length?Math.round(pd/pt.length*100):0;
    return`<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);padding:14px;margin-bottom:10px;${p.archived?'opacity:.6':''}">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <span class="dot" style="background:${p.color};width:12px;height:12px"></span>
        <span style="font-size:14px;font-weight:600;flex:1">${p.title}</span>
        ${p.archived?'<span class="archived-tag">archived</span>':''}
        <button class="btn btng" style="padding:5px 10px;font-size:12px" onclick="openProjModal('${p.id}')"><i class="ri-pencil-line"></i>Edit</button>
      </div>
      ${p.description?`<div style="font-size:12px;color:var(--text3);margin-bottom:10px">${p.description}</div>`:''}
      <div style="display:flex;align-items:center;gap:12px">
        <div style="flex:1"><div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden"><div style="height:4px;border-radius:2px;background:${p.color};width:${pct}%"></div></div></div>
        <span style="font-size:11px;color:var(--text3)">${pd}/${pt.length} done · ${pct}%</span>
      </div>
      ${p.deadline?`<div style="font-size:11px;color:var(--text3);margin-top:8px"><i class="ri-calendar-line"></i> Deadline: ${p.deadline}</div>`:''}
    </div>`;
  }).join('');
}
